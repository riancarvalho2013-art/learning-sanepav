import {migrate} from './migrations.mjs'
import {createDomain} from './domain.mjs'
import {DatabaseSync,backup} from 'node:sqlite'
import {randomUUID} from 'node:crypto'
import {mkdirSync,existsSync,chmodSync,renameSync} from 'node:fs'
import {dirname,join} from 'node:path'
const databasePath=process.env.LEARNING_DB||'data/learning.sqlite'
const existingDatabase=databasePath!==':memory:'&&existsSync(databasePath)
if(databasePath!==':memory:')mkdirSync(dirname(databasePath),{recursive:true})
const db=new DatabaseSync(databasePath)
// One consistent pre-release snapshot, including SQLite WAL data, before writes.
if(existingDatabase){
 const backupDirectory=join(dirname(databasePath),'backups')
 const backupPath=join(backupDirectory,'pre-foundation-v1.sqlite')
 if(!existsSync(backupPath)){
  mkdirSync(backupDirectory,{recursive:true,mode:0o700})
  const temporary=backupPath+'.'+randomUUID()+'.tmp'
  await backup(db,temporary)
  chmodSync(temporary,0o600)
  renameSync(temporary,backupPath)
 }
}
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS objects (key TEXT PRIMARY KEY, etag TEXT NOT NULL, body BLOB NOT NULL)')
migrate(db)
export const DOMAIN = createDomain(db)
const current = db.prepare('SELECT body FROM objects WHERE key=?').get('system/state-v1')
if(current) DOMAIN.syncPeople(JSON.parse(Buffer.from(current.body).toString()))

export const BUCKET = {
 async get(key) {
  const row = db.prepare('SELECT * FROM objects WHERE key=?').get(key)
  if(!row) return null
  const body = Buffer.from(row.body)
  return {etag:row.etag,body,text:async()=>body.toString(),json:async()=>{
   const value=JSON.parse(body.toString())
   return key==='system/state-v1' ? DOMAIN.decorateState(value) : value
  }}
 },
 async put(key,value,options) {
  const etag=randomUUID(),body=Buffer.from(value)
  const expected=options?.onlyIf?.etagMatches
  db.exec('BEGIN IMMEDIATE')
  try {
   const result=expected
    ? db.prepare('UPDATE objects SET etag=?,body=? WHERE key=? AND etag=?').run(etag,body,key,expected)
    : db.prepare('INSERT OR IGNORE INTO objects VALUES(?,?,?)').run(key,etag,body)
   if(result.changes && key==='system/state-v1') {
    const state=JSON.parse(body.toString())
    DOMAIN.syncPeople(state,false)
    const assignment=options?.organizationAssignment
    if(assignment){
     const actor=state.users.find(person=>person.id===assignment.actorId&&person.active)
     if(!actor)throw Object.assign(new Error('Sessão administrativa indisponível.'),{status:403})
     DOMAIN.assignPerson(state,actor,assignment.body)
    }
    DOMAIN.syncPeople(state)
   }
   db.exec('COMMIT')
   return result.changes ? {etag} : null
  } catch(error) {
   db.exec('ROLLBACK')
   throw error
  }
 }
}
