/**
 * Learning Sanepav — consistent SQLite backup with verification.
 * Usage: node ops/backup-verify.mjs --create /independent/volume/backup.sqlite
 *        node ops/backup-verify.mjs --verify /independent/volume/backup.sqlite
 *        node ops/backup-verify.mjs --restore-test /independent/volume/backup.sqlite
 * Backup path MUST be independent from the primary Railway volume for disaster recovery.
 */
import {DatabaseSync,backup} from 'node:sqlite'
import {existsSync,mkdirSync,chmodSync,renameSync,rmSync,mkdtempSync,copyFileSync} from 'node:fs'
import {dirname,resolve,join} from 'node:path'
import {tmpdir} from 'node:os'
import {randomUUID} from 'node:crypto'

const [action,providedTarget]=process.argv.slice(2)
const target=providedTarget||process.env.LEARNING_BACKUP_PATH
const primary=resolve(process.env.LEARNING_DB||'data/learning.sqlite')
function checkedDatabase(path){
 const db=new DatabaseSync(path,{readOnly:true})
 try{
  const integrity=db.prepare('PRAGMA integrity_check').all().map(x=>Object.values(x).join(''))
  if(integrity.length!==1||integrity[0]!=='ok')throw Error('Integridade SQLite inválida.')
  const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(x=>x.name)
  const counts=Object.fromEntries(tables.map(table=>[table,db.prepare(`SELECT COUNT(*) AS n FROM "${table.replaceAll('"','""')}"`).get().n]))
  return {integrity:'ok',tables:tables.length,counts}
 }finally{db.close()}
}
async function execute(mode,file){
 if(!['--create','--verify','--restore-test'].includes(mode)||!file)throw Error('Use --create, --verify ou --restore-test, seguido do caminho do banco de backup.')
 const destination=resolve(file)
 if(mode==='--create'){
  if(!existsSync(primary))throw Error('Banco principal não encontrado.')
  if(destination===primary)throw Error('O backup não pode sobrescrever o banco principal.')
  mkdirSync(dirname(destination),{recursive:true,mode:0o700})
  const temp=destination+'.'+randomUUID()+'.tmp'
  const db=new DatabaseSync(primary,{readOnly:true})
  try{
   const before=checkedDatabase(primary)
   await backup(db,temp)
   chmodSync(temp,0o600)
   const after=checkedDatabase(temp)
   // Check after backup, without requiring exact counts under simultaneous writes.
   if(after.integrity!=='ok'||after.tables<before.tables)throw Error('Backup incompleto ou inconsistente.')
   renameSync(temp,destination)
   console.log(JSON.stringify({action:'backup_created',path:destination,verified:after.integrity,tables:after.tables}))
  }finally{db.close();if(existsSync(temp))rmSync(temp)}
  return
 }
 if(destination===primary)throw Error('Não use o banco de produção para teste de restauração.')
 if(!existsSync(destination))throw Error('Arquivo de backup inexistente.')
 if(mode==='--verify'){
  const result=checkedDatabase(destination)
  console.log(JSON.stringify({action:'backup_verified',path:destination,integrity:result.integrity,tables:result.tables,counts:result.counts}))
  return
 }
 // Rehearsal restore is made in an isolated temporary directory; no production overwrite.
 const tempdir=mkdtempSync(join(tmpdir(),'sanepav-restore-'))
 try{
  const restored=join(tempdir,'restore.sqlite')
  copyFileSync(destination,restored)
  const original=checkedDatabase(destination),reloaded=checkedDatabase(restored)
  if(JSON.stringify(original.counts)!==JSON.stringify(reloaded.counts))throw Error('Contagens divergentes após restauração.')
  console.log(JSON.stringify({action:'restore_test_passed',tables:reloaded.tables,counts:reloaded.counts}))
 }finally{rmSync(tempdir,{recursive:true,force:true})}
}
execute(action,target).catch(error=>{console.error(JSON.stringify({ok:false,error:error.message}));process.exitCode=1})
