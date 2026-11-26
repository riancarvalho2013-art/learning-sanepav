/* V27: opt-in encrypted private S3 storage. Only existing authorized media keys
 * are eligible; all business data and authorization stay in the original adapter.
 * External objects are immutable and retained for recovery. Never expose their URLs. */
import {createHash,createCipheriv,createDecipheriv,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto'
const LIMIT=64*1024*1024, OVERHEAD=28
const sha=v=>createHash('sha256').update(v).digest('hex')
const fail=message=>{throw Object.assign(new Error(message),{status:503})}
export const isMediaKey=key=>typeof key==='string'&&/^(files|social|social-video)\/.+/.test(key)
const validKey=key=>typeof key==='string'&&/^[a-zA-Z0-9_-]{1,80}\/v27\/[a-f0-9-]{36}$/.test(key)
export function mediaConfig(env=process.env){
 const mode=env.LEARNING_MEDIA_MODE||'sqlite'
 if(!['sqlite','external','rehydrate'].includes(mode))fail('Modo de armazenamento inválido.')
 if(mode==='sqlite')return {mode}
 const required=['LEARNING_MEDIA_ENDPOINT','LEARNING_MEDIA_BUCKET','LEARNING_MEDIA_REGION','LEARNING_MEDIA_ACCESS_KEY','LEARNING_MEDIA_SECRET_KEY','LEARNING_MEDIA_PREFIX','LEARNING_MEDIA_KEY_HEX']
 if(required.some(k=>!env[k]?.trim()))fail('Configuração de mídia externa incompleta.')
 let endpoint;try{endpoint=new URL(env.LEARNING_MEDIA_ENDPOINT)}catch{fail('Endpoint de mídia inválido.')}
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||endpoint.pathname!=='/')fail('Endpoint de mídia deve ser HTTPS sem caminho.')
 const bucket=env.LEARNING_MEDIA_BUCKET.trim(),region=env.LEARNING_MEDIA_REGION.trim(),prefix=env.LEARNING_MEDIA_PREFIX.trim()
 if(!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)||!/^[a-zA-Z0-9_-]{1,80}$/.test(prefix)||!/^[a-zA-Z0-9-]{1,50}$/.test(region))fail('Configuração de mídia inválida.')
 if(!/^[0-9a-f]{64}$/i.test(env.LEARNING_MEDIA_KEY_HEX))fail('Chave de mídia deve ter 64 dígitos hexadecimais aleatórios.')
 const key=Buffer.from(env.LEARNING_MEDIA_KEY_HEX,'hex')
 const pathStyle=env.LEARNING_MEDIA_PATH_STYLE||'false'
 if(!['true','false'].includes(pathStyle))fail('Estilo de URL de mídia inválido.')
 return {mode,endpoint:endpoint.origin,bucket,region,prefix,key,accessKeyId:env.LEARNING_MEDIA_ACCESS_KEY,secretAccessKey:env.LEARNING_MEDIA_SECRET_KEY,forcePathStyle:pathStyle==='true',storeId:sha(`${endpoint.origin}\n${bucket}\n${prefix}\n${region}\n${pathStyle}`),keyId:sha(key)}
}
// Bind ciphertext to the exact immutable object, so swapping objects fails.
export function seal(body,key,remoteKey){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(remoteKey))
 return Buffer.concat([iv,cipher.update(body),cipher.final(),cipher.getAuthTag()])
}
export function unseal(ciphertext,key,remoteKey){
 if(ciphertext.length<OVERHEAD)fail('Mídia externa inválida.')
 const decipher=createDecipheriv('aes-256-gcm',key,ciphertext.subarray(0,12));decipher.setAAD(Buffer.from(remoteKey));decipher.setAuthTag(ciphertext.subarray(-16))
 try{return Buffer.concat([decipher.update(ciphertext.subarray(12,-16)),decipher.final()])}catch{fail('Integridade de mídia externa inválida.')}
}
export async function createS3Store(config){
 // Loaded only in explicit external modes. No credentials are sent to the browser.
 const {S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand}=await import('@aws-sdk/client-s3')
 const client=new S3Client({endpoint:config.endpoint,region:config.region,forcePathStyle:config.forcePathStyle,credentials:{accessKeyId:config.accessKeyId,secretAccessKey:config.secretAccessKey},maxAttempts:3,requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'})
 const send=async cmd=>{try{return await client.send(cmd,{abortSignal:AbortSignal.timeout(90000)})}catch{fail('Armazenamento externo temporariamente indisponível.')}}
 return {
  async put(key,body){await send(new PutObjectCommand({Bucket:config.bucket,Key:key,Body:body,ContentType:'application/octet-stream',ContentLength:body.length}))},
  async get(key,max){const response=await send(new GetObjectCommand({Bucket:config.bucket,Key:key}));const stream=response.Body;try{if(!stream||!Number.isSafeInteger(response.ContentLength)||response.ContentLength!==max)fail('Tamanho de mídia externa inválido.');const result=Buffer.allocUnsafe(max);let offset=0;for await(const chunk of stream){if(offset+chunk.length>max)fail('Tamanho de mídia externa inválido.');Buffer.from(chunk).copy(result,offset);offset+=chunk.length}if(offset!==max)fail('Mídia externa incompleta.');return result}catch{fail('Leitura de mídia externa indisponível ou inválida.')}finally{stream?.destroy?.()}},
  async remove(key){await send(new DeleteObjectCommand({Bucket:config.bucket,Key:key}))}
 }
}
const hasTable=db=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='media_refs_v27'").get()
export function createMediaAdapter({db,legacy,config,remote}){
 const mode=config.mode
 if(!['sqlite','external','rehydrate'].includes(mode))fail('Modo de armazenamento inválido.')
 if(mode==='sqlite'){
  if(hasTable(db)&&db.prepare('SELECT 1 FROM media_refs_v27 LIMIT 1').get())fail('Há mídias externas. Use rehydrate antes de voltar ao modo SQLite.')
  return {bucket:legacy,rehydrate:async()=>0,externalCount:()=>0}
 }
 if(!remote||!Buffer.isBuffer(config.key)||config.key.length!==32)fail('Armazenamento externo não configurado.')
 db.exec(`CREATE TABLE IF NOT EXISTS media_refs_v27 (
  object_key TEXT PRIMARY KEY, etag TEXT NOT NULL, remote_key TEXT NOT NULL UNIQUE,
  byte_size INTEGER NOT NULL CHECK(byte_size>=0 AND byte_size<=67108864),
  sha256 TEXT NOT NULL, store_id TEXT NOT NULL, key_id TEXT NOT NULL
 )`)
 if(db.prepare('SELECT 1 FROM media_refs_v27 WHERE store_id<>? OR key_id<>? LIMIT 1').get(config.storeId,config.keyId))fail('Bucket ou chave diferente da configuração das mídias existentes.')
 const read=db.prepare('SELECT o.etag AS object_etag,o.body,r.* FROM objects o LEFT JOIN media_refs_v27 r ON r.object_key=o.key WHERE o.key=?')
 const metadata=db.prepare('SELECT etag FROM objects WHERE key=?')
 const refs=db.prepare('SELECT * FROM media_refs_v27 WHERE object_key=?')
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r}catch(error){db.exec('ROLLBACK');throw error}}
 async function load(row){
  if(!row.remote_key||row.object_etag!==row.etag||row.store_id!==config.storeId||row.key_id!==config.keyId||!validKey(row.remote_key)||!row.remote_key.startsWith(config.prefix+'/v27/')||!Number.isSafeInteger(row.byte_size)||row.byte_size<0||row.byte_size>LIMIT||!/^[a-f0-9]{64}$/.test(row.sha256))fail('Referência de mídia inválida.')
  const ciphertext=await remote.get(row.remote_key,row.byte_size+OVERHEAD)
  if(ciphertext.length!==row.byte_size+OVERHEAD)fail('Tamanho de mídia externa inválido.')
  const bytes=unseal(ciphertext,config.key,row.remote_key)
  if(bytes.length!==row.byte_size||!timingSafeEqual(Buffer.from(sha(bytes),'hex'),Buffer.from(row.sha256,'hex')))fail('Integridade de mídia externa inválida.')
  return bytes
 }
 function object(etag,body){return {etag,body,text:async()=>body.toString(),json:async()=>JSON.parse(body.toString())}}
 const bucket={
  ...legacy,
  async get(key){if(!isMediaKey(key))return legacy.get(key);const row=read.get(key);if(!row)return null;if(!row.remote_key){if(refs.get(key))fail('Referência de mídia inválida.');return object(row.object_etag,Buffer.from(row.body))}return object(row.object_etag,await load(row))},
  async put(key,value,options){
   if(!isMediaKey(key))return legacy.put(key,value,options)
   if(mode==='rehydrate'){
    if(refs.get(key))fail('Mídia em recuperação. Tente novamente após a manutenção.')
    return legacy.put(key,value,options)
   }
   if(options&&Object.keys(options).some(k=>k!=='onlyIf'))fail('Opções de gravação de mídia não suportadas.')
   const cond=options?.onlyIf||{}
   if(Object.keys(cond).some(k=>k!=='etagMatches'&&k!=='etagDoesNotMatch')||(cond.etagDoesNotMatch!==undefined&&cond.etagDoesNotMatch!=='*')||(cond.etagMatches&&cond.etagDoesNotMatch))fail('Condição de gravação de mídia inválida.')
   const expected=cond.etagMatches,current=metadata.get(key)
   if(expected?current?.etag!==expected:!!current)return null
   const body=Buffer.from(value);if(body.length>LIMIT)throw Object.assign(new Error('Arquivo acima do limite de armazenamento atual.'),{status:413})
   const etag=randomUUID(),remoteKey=config.prefix+'/v27/'+randomUUID(),hash=sha(body),ciphertext=seal(body,config.key,remoteKey)
   await remote.put(remoteKey,ciphertext)
   // Read back before committing metadata; a failed/ambiguous write never replaces old data.
   const check=await remote.get(remoteKey,ciphertext.length)
   if(check.length!==ciphertext.length||!timingSafeEqual(Buffer.from(sha(check),'hex'),Buffer.from(sha(ciphertext),'hex')))fail('Falha de verificação da mídia enviada.')
   const committed=transaction(()=>{
    const result=expected?db.prepare('UPDATE objects SET etag=?,body=? WHERE key=? AND etag=?').run(etag,Buffer.alloc(0),key,expected):db.prepare('INSERT OR IGNORE INTO objects VALUES(?,?,?)').run(key,etag,Buffer.alloc(0))
    if(!result.changes)return false
    db.prepare('INSERT INTO media_refs_v27 VALUES(?,?,?,?,?,?,?) ON CONFLICT(object_key) DO UPDATE SET etag=excluded.etag,remote_key=excluded.remote_key,byte_size=excluded.byte_size,sha256=excluded.sha256,store_id=excluded.store_id,key_id=excluded.key_id').run(key,etag,remoteKey,body.length,hash,config.storeId,config.keyId)
    return true
   })
   // Retain immutable remote objects even when orphaned. Older backup snapshots may
   // reference replaced/deleted objects. Retention/GC requires separate audit.
   return committed?{etag}:null
  },
  async deleteSocialVideoParts(id){
   if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id))throw new TypeError('Identificador inválido.')
   transaction(()=>{const pattern='social-video/'+id+'/*';db.prepare('DELETE FROM media_refs_v27 WHERE object_key GLOB ?').run(pattern);db.prepare('DELETE FROM objects WHERE key GLOB ?').run(pattern)})
  }
 }
 async function rehydrate(){
  if(mode!=='rehydrate')fail('Recuperação não autorizada neste modo.')
  let restored=0
  for(;;){const ref=db.prepare('SELECT object_key FROM media_refs_v27 ORDER BY object_key LIMIT 1').get();if(!ref)break;const row=read.get(ref.object_key);if(!row)fail('Referência órfã. Recuperação interrompida.');const body=await load(row)
   transaction(()=>{const now=refs.get(ref.object_key);if(now?.etag!==row.etag)fail('Mídia alterada durante a recuperação.');const result=db.prepare('UPDATE objects SET body=? WHERE key=? AND etag=?').run(body,ref.object_key,row.etag);if(result.changes!==1)fail('Mídia alterada durante a recuperação.');db.prepare('DELETE FROM media_refs_v27 WHERE object_key=? AND etag=?').run(ref.object_key,row.etag)});restored++
  }return restored
 }
 return {bucket,rehydrate,externalCount:()=>db.prepare('SELECT count(*) n FROM media_refs_v27').get().n}
}
// A small non-personal write/read/delete probe. Failure prevents server startup in external mode.
export async function verifyRemote(config,remote){const key=config.prefix+'/v27/'+randomUUID(),body=randomBytes(32);await remote.put(key,body);const returned=await remote.get(key,body.length);if(returned.length!==body.length||!timingSafeEqual(body,returned))fail('Verificação de conexão com o bucket falhou.');await remote.remove(key)}
