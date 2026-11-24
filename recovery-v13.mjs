/** Operational backup and isolated restore with full row digests and fail-closed target checks.
 * No command overwrites the primary database. Backups contain personal data; use encrypted storage.
 */
import {DatabaseSync,backup} from 'node:sqlite'
import {createHash,randomUUID} from 'node:crypto'
import {createReadStream,existsSync,mkdirSync,chmodSync,realpathSync,statSync,writeFileSync,readFileSync,renameSync,linkSync,rmSync,mkdtempSync,copyFileSync,readdirSync} from 'node:fs'
import {resolve,dirname,join,basename,relative,isAbsolute} from 'node:path'
import {tmpdir} from 'node:os'
import {pathToFileURL} from 'node:url'
const hash=()=>createHash('sha256')
const quote=x=>'"'+x.replaceAll('"','""')+'"'
const inside=(root,p)=>{const r=relative(root,p);return r===''||(!r.startsWith('..'+(process.platform==='win32'?'\\':'/'))&&r!=='..'&&!isAbsolute(r))}
const guard=(ok,msg)=>{if(!ok)throw Error(msg)}
const shaFile=async p=>{const h=hash();for await(const chunk of createReadStream(p))h.update(chunk);return h.digest('hex')}
const encode=v=>v===null?['null']:typeof v==='bigint'?['integer',String(v)]:ArrayBuffer.isView(v)?['blob',Buffer.from(v).toString('base64')]:[typeof v,v]
export function fingerprint(path){
 const db=new DatabaseSync(path,{readOnly:true});try{
  db.exec('BEGIN');const integrity=db.prepare('PRAGMA integrity_check').all();guard(integrity.length===1&&Object.values(integrity[0])[0]==='ok','Integridade SQLite inválida.');guard(!db.prepare('PRAGMA foreign_key_check').get(),'Relacionamentos inválidos no SQLite.')
  const schema=db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();const schemaHash=hash().update(JSON.stringify(schema)).digest('hex'),tables={}
  for(const entry of schema.filter(x=>x.type==='table')){const stmt=db.prepare('SELECT * FROM '+quote(entry.name));stmt.setReadBigInts(true);const digests=[];for(const row of stmt.iterate())digests.push(hash().update(JSON.stringify(Object.entries(row).map(([k,v])=>[k,encode(v)]))).digest('hex'));digests.sort();tables[entry.name]={rows:digests.length,sha256:hash().update(digests.join('')).digest('hex')}}
  db.exec('COMMIT');return {schemaHash,tables}
 }finally{db.close()}
}
function ensureIndependent(primary,destination,allowSameDevice=false){
 const src=realpathSync(primary),dstParent=realpathSync(dirname(destination));guard(!inside(dirname(src),dstParent),'Backup não pode estar dentro da pasta do banco principal.');guard(allowSameDevice||statSync(src).dev!==statSync(dstParent).dev,'Armazenamento independente não comprovado: mesmo dispositivo. Configure volume externo ou use --test-same-device somente em laboratório.');return join(dstParent,basename(destination))
}
export async function createSnapshot(primary,destination,{allowSameDevice=false}={}){
 guard(existsSync(primary),'Banco principal ausente.');mkdirSync(dirname(destination),{recursive:true,mode:0o700});const target=ensureIndependent(primary,destination,allowSameDevice);guard(!existsSync(target)&&!existsSync(target+'.json'),'Snapshot já existe; escolha nome novo.')
 const temp=target+'.'+randomUUID()+'.tmp',tempManifest=temp+'.json';let db
 try{db=new DatabaseSync(primary,{readOnly:true});await backup(db,temp);db.close();db=null;chmodSync(temp,0o600);const snapshot=fingerprint(temp),manifest={format:'learning-recovery-v13',createdAt:new Date().toISOString(),sha256:await shaFile(temp),bytes:statSync(temp).size,storageDeviceIndependent:statSync(primary).dev!==statSync(temp).dev,...snapshot};writeFileSync(tempManifest,JSON.stringify(manifest,null,2),{mode:0o600,flag:'wx'});linkSync(temp,target);try{linkSync(tempManifest,target+'.json')}catch(e){rmSync(target,{force:true});throw e}return {path:target,manifest}}
 finally{db?.close();rmSync(temp,{force:true});rmSync(tempManifest,{force:true})}
}
export async function verifySnapshot(path){const manifest=JSON.parse(readFileSync(path+'.json','utf8'));guard(manifest.format==='learning-recovery-v13','Formato de manifesto inválido.');guard(statSync(path).size===manifest.bytes&&await shaFile(path)===manifest.sha256,'Hash do arquivo divergente.');const current=fingerprint(path);guard(current.schemaHash===manifest.schemaHash&&JSON.stringify(current.tables)===JSON.stringify(manifest.tables),'Dados ou esquema divergentes.');return manifest}
export async function rehearseRestore(path){const before=await verifySnapshot(path),tmp=mkdtempSync(join(tmpdir(),'learning-restore-v13-'));try{const target=join(tmp,'restore.sqlite');copyFileSync(path,target);chmodSync(target,0o600);guard(await shaFile(target)===before.sha256,'Cópia de restauração divergente.');const restored=fingerprint(target);guard(restored.schemaHash===before.schemaHash&&JSON.stringify(restored.tables)===JSON.stringify(before.tables),'Restauração divergente.');return {ok:true,tables:Object.keys(restored.tables).length,rows:Object.values(restored.tables).reduce((n,x)=>n+x.rows,0),dataHashVerified:true}}finally{rmSync(tmp,{recursive:true,force:true})}}
export async function scheduledBackup(primary,dir,options={}){mkdirSync(dir,{recursive:true,mode:0o700});const path=join(dir,'learning-'+new Date().toISOString().replaceAll(':','-')+'-'+randomUUID().slice(0,8)+'.sqlite');const {manifest}=await createSnapshot(primary,path,options);const result=await rehearseRestore(path);return {ok:true,createdAt:manifest.createdAt,bytes:manifest.bytes,independent:manifest.storageDeviceIndependent,...result}}
async function cli(){const [action,target,...flags]=process.argv.slice(2),primary=resolve(process.env.LEARNING_DB||'data/learning.sqlite');guard(target&&['create','verify','restore-test','scheduled'].includes(action),'Uso: recovery-v13.mjs create|verify|restore-test|scheduled CAMINHO');guard(flags.every(x=>x==='--test-same-device'),'Flag desconhecida.');const options={allowSameDevice:flags.includes('--test-same-device')};guard(!options.allowSameDevice||process.env.NODE_ENV==='test','Exceção de dispositivo permitida somente com NODE_ENV=test.');let result;if(action==='create'){const {manifest}=await createSnapshot(primary,resolve(target),options);result={ok:true,bytes:manifest.bytes,createdAt:manifest.createdAt,independent:manifest.storageDeviceIndependent}}else if(action==='scheduled')result=await scheduledBackup(primary,resolve(target),options);else{guard(!existsSync(primary)||realpathSync(primary)!==realpathSync(target),'Nunca executar verificação/restauração usando o banco principal.');result=action==='verify'?{ok:true,verified:(await verifySnapshot(resolve(target))).createdAt}:await rehearseRestore(resolve(target))}console.log(JSON.stringify(result))}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)cli().catch(e=>{console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=1})
