/** Offline CLI: authorized consistent backup only; never point at the live volume. */
import {DatabaseSync} from 'node:sqlite'
import {readFileSync,writeFileSync,existsSync,statSync} from 'node:fs'
import {resolve} from 'node:path'
import {fingerprint,makeInventory,prepareMigration} from './tenant-migration-v30.mjs'
const [mode,path,planPath,...extra]=process.argv.slice(2)
if(!['inventory','dry-run'].includes(mode)||!path||!planPath||extra.length||!existsSync(path)||resolve(path)===resolve(planPath))throw Error('Uso: inventory <backup.sqlite> <plano-privado.json> | dry-run <backup.sqlite> <plano-aprovado.json>')
if(!statSync(path).isFile())throw Error('Backup inválido')
const db=new DatabaseSync(path,{readOnly:true})
try{
 db.exec('PRAGMA query_only=ON; BEGIN')
 const row=db.prepare('SELECT etag,body FROM objects WHERE key=?').get('system/state-v1')
 if(!row)throw Error('Estado legado ausente')
 const raw=Buffer.from(row.body),state=JSON.parse(raw.toString()),org={companies:db.prepare('SELECT id,name,active FROM companies ORDER BY id').all(),assignments:db.prepare('SELECT person_id,company_id FROM person_organizations ORDER BY person_id').all()}
 const snapshot=fingerprint(raw,row.etag,org.companies,org.assignments)
 if(mode==='inventory'){
  const inventory=makeInventory(state,org,snapshot)
  writeFileSync(planPath,JSON.stringify(inventory,null,2)+'\n',{flag:'wx',mode:0o600})
  console.log(JSON.stringify({inventoryCreated:true,items:inventory.review.length,approved:false,runtimeIsolationEnabled:false}))
 }else{
  const plan=JSON.parse(readFileSync(planPath,'utf8'))
  const result=prepareMigration(state,org,snapshot,plan)
  console.log(JSON.stringify({dryRun:true,...result.summary},null,2))
 }
 db.exec('ROLLBACK')
}catch(e){console.error('V30.1B: '+(e.code||'OFFLINE_OPERATION_FAILED'));process.exitCode=1}finally{db.close()}
