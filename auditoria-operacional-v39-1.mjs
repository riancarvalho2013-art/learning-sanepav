/** Read-only operational audit. Run against a verified backup, never production. */
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
const uuid=/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}/gi;
const hash=b=>createHash('sha256').update(b).digest('hex');
const mediaPrefix=/^(files|social|social-video)\//;
const brandBinary=/^evolution\/v1\/(logos|backgrounds)\//;
const table=(db,name)=>Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
const fail=m=>{throw Error(m)};
export function inventoryV391(db,{maxJsonBytes=64*1024*1024}={}){
 if(!table(db,'objects'))fail('Tabela objects ausente.');
 const refs=table(db,'media_refs_v27')?db.prepare('SELECT COUNT(*) n FROM media_refs_v27').get().n:0;
 const keys=new Set(),codes=new Map(),verification=new Map(),metrics=[];let scanned=0,unknown=0,missing=0,invalid=0,duplicate=0,orphan=0;
 const read=db.prepare('SELECT body FROM objects WHERE key=?');
 const metadata=db.prepare('SELECT key,length(body) bytes FROM objects ORDER BY key');
 for(const {key,bytes} of metadata.iterate()){
  if(mediaPrefix.test(key)||brandBinary.test(key))continue;
  if(bytes>maxJsonBytes||scanned+bytes>maxJsonBytes){unknown++;continue}
  const body=Buffer.from(read.get(key).body);scanned+=bytes;let data;
  try{data=JSON.parse(body.toString())}catch{unknown++;continue}
  for(const match of (key+' '+body.toString()).matchAll(uuid))keys.add(match[0].toLowerCase());
  if(key==='system/state-v1'||key==='lxp/v2/state')metrics.push({key,bytes,arrays:Object.fromEntries(Object.entries(data||{}).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length]))});
  if(key.startsWith('evolution/v1/issued/')){
   const code=data?.code;if(typeof code!=='string'||!/^([a-f0-9]{8}-)([a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(code)){invalid++;continue}
   if(codes.has(code))duplicate++;codes.set(code,{courseTitle:data.courseTitle,issuedAt:data.issuedAt,brandTitle:data.brandTitle});
  }
  if(key.startsWith('evolution/v1/verification/'))verification.set(key.slice('evolution/v1/verification/'.length),data);
 }
 for(const [code,record] of codes){if(!verification.has(code))missing++;else if(!isDeepStrictEqual(record,verification.get(code)))invalid++}
 for(const code of verification.keys())if(!codes.has(code))orphan++;
 let objects=0,bytes=0,candidateCount=0,candidateBytes=0,protectedExternal=0;
 const externalRef=table(db,'media_refs_v27')?db.prepare('SELECT 1 FROM media_refs_v27 WHERE object_key=?'):null;
 for(const item of metadata.iterate()){
  if(!mediaPrefix.test(item.key))continue;objects++;bytes+=item.bytes;
  if(externalRef?.get(item.key)){protectedExternal++;continue}
  const group=item.key.split('/')[1];if(!unknown&&group&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(group)&&!keys.has(group.toLowerCase())){candidateCount++;candidateBytes+=item.bytes}
 }
 return {readOnly:true,scanComplete:unknown===0,jsonBytesScanned:scanned,unclassifiedObjects:unknown,aggregates:metrics,certificates:{complete:unknown===0,issuedCodes:codes.size,verificationCodes:verification.size,missing,invalid,duplicate,orphan},media:{localAndExternalObjects:objects,localBytes:bytes,externalReferences:refs,protectedExternal,potentiallyUnreferencedLocalObjects:candidateCount,potentiallyUnreferencedLocalBytes:candidateBytes,deletionAuthorized:false,retentionAgeKnown:false}};
}
export async function verifyRemoteRefsV391(db,{config,remote,unseal}){
 if(!table(db,'media_refs_v27'))return {total:0,verified:0,invalid:0};
 let total=0,verified=0,invalid=0;
 const q=db.prepare('SELECT r.*,o.etag object_etag FROM media_refs_v27 r LEFT JOIN objects o ON o.key=r.object_key ORDER BY r.object_key');
 for(const row of q.iterate()){
  total++;try{
   if(!row.object_etag||row.object_etag!==row.etag||row.store_id!==config.storeId||row.key_id!==config.keyId||!row.remote_key.startsWith(config.prefix+'/v27/')||!/^\w[\w-]*\/v27\/[a-f0-9-]{36}$/i.test(row.remote_key)||!Number.isSafeInteger(row.byte_size)||row.byte_size<0||row.byte_size>64*1024*1024)fail('Referência incompatível.');
   const cipher=await remote.get(row.remote_key,row.byte_size+28);if(cipher.length!==row.byte_size+28)fail('Tamanho inválido.');const plain=unseal(cipher,config.key,row.remote_key);if(plain.length!==row.byte_size||hash(plain)!==row.sha256)fail('Hash divergente.');verified++;
  }catch{invalid++}
 }
 return {total,verified,invalid};
}
// Called only after the existing scheduler has verified and rehearsed its snapshot.
export async function auditSnapshotV391(path,{config,remote,unseal,verifyRemote=false,log=console.info}={}){
 const db=new DatabaseSync(path,{readOnly:true});try{
  const inventory=inventoryV391(db),total=inventory.media.externalReferences;
  const remoteResult=total&&verifyRemote&&remote?await verifyRemoteRefsV391(db,{config,remote,unseal}):{total,verified:0,invalid:0};
  const c=inventory.certificates,notChecked=total-remoteResult.verified-remoteResult.invalid;
  const status=!inventory.scanComplete?'incomplete':c.missing||c.invalid||c.duplicate||c.orphan||remoteResult.invalid?'inconsistent':notChecked?'media_not_checked':'verified';
  const result={event:'backup_v391_audit',status,certificateMissing:c.missing,certificateInvalid:c.invalid,certificateDuplicate:c.duplicate,certificateOrphan:c.orphan,remoteTotal:total,remoteVerified:remoteResult.verified,remoteInvalid:remoteResult.invalid,remoteNotChecked:notChecked};
  log(JSON.stringify(result));return result;
 }finally{db.close()}
}
async function main(){
 const [action,file,...flags]=process.argv.slice(2);
 if(!['inventory','restore'].includes(action)||!file||flags.some(x=>x!=='--verify-remote')||action==='inventory'&&flags.length)fail('Uso: node auditoria-operacional-v39-1.mjs inventory|restore /backup/arquivo.sqlite [--verify-remote]');
 const target=realpathSync(resolve(file));let primary;
 try{primary=realpathSync(resolve(process.env.LEARNING_DB||'data/learning.sqlite'))}catch(e){if(e.code!=='ENOENT')throw e}
 if(primary===target)fail('Operação proibida no banco principal.');
 const {verifySnapshot,rehearseRestore}=await import('./recovery-v13.mjs');
 const manifest=await verifySnapshot(target);const restore=action==='restore'?await rehearseRestore(target):null;
 const db=new DatabaseSync(target,{readOnly:true});try{
  const inventory=inventoryV391(db);let remote={total:inventory.media.externalReferences,verified:0,invalid:0,notChecked:inventory.media.externalReferences};
  if(flags.includes('--verify-remote')&&remote.total){const {mediaConfig,createS3Store,unseal}=await import('./media-storage-v27.mjs');const config=mediaConfig();if(config.mode==='sqlite')fail('Configure o acesso de mídia externa para verificar as referências.');remote=await verifyRemoteRefsV391(db,{config,remote:await createS3Store(config),unseal});remote.notChecked=0;}
  const c=inventory.certificates,consistent=c.complete&&!c.missing&&!c.invalid&&!c.duplicate&&!c.orphan;
  const ok=inventory.scanComplete&&consistent&&(action!=='restore'||manifest.storageDeviceIndependent===true&&restore?.dataHashVerified&&remote.invalid===0&&remote.notChecked===0);
  console.log(JSON.stringify({ok,action,backupCreatedAt:manifest.createdAt,independentStorage:manifest.storageDeviceIndependent,restore,inventory,remote},null,2));if(!ok)process.exitCode=2;
 }finally{db.close()}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=1});
