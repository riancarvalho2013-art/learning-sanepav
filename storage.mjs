import {readHistoricalIndex} from './historical-analytics-v12.mjs'
import {migrate} from './migrations.mjs'
import {installOrganizationHistory,recordManagerHistory,readOrganizationHistory} from './organization-history-v11.mjs'
import {createDomain} from './domain.mjs'
import {DatabaseSync,backup} from 'node:sqlite'
import {randomUUID,createHash} from 'node:crypto'
import {mkdirSync,existsSync,chmodSync,renameSync} from 'node:fs'
import {dirname,join} from 'node:path'
import {mediaConfig,createS3Store,createMediaAdapter,verifyRemote} from './media-storage-v27.mjs'
import {startBackupScheduler} from './backup-scheduler-v27.mjs'
import {scheduledBackup} from './recovery-v13.mjs'
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
const initialState=current?JSON.parse(Buffer.from(current.body).toString()):null
if(initialState)DOMAIN.syncPeople(initialState)
installOrganizationHistory(db,initialState)
DOMAIN.organizationHistory=filters=>readOrganizationHistory(db,filters)
DOMAIN.historicalIndex=ids=>readHistoricalIndex(db,ids)

// Includes direct v2 organizational edits which do not necessarily change the legacy ETag.
function organizationRevision(){const h=createHash('sha256');for(const table of ['companies','units','departments','person_organizations','company_access'])h.update(JSON.stringify(db.prepare(`SELECT * FROM ${table} ORDER BY ${table==='company_access'?'person_id,company_id':table==='person_organizations'?'person_id':'id'}`).all()));return h.digest('hex')}
// V30 advanced pilot: assessment criteria and attempts are read from the same
// SQLite database as the enrollment, and compared inside BEGIN IMMEDIATE.
function tenantAssessmentSnapshot(scope){
 if(!scope||!['companyId','courseId','userId'].every(k=>typeof scope[k]==='string'&&scope[k].length>0&&scope[k].length<=128))throw new TypeError('Escopo inválido.')
 const present=db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name IN ('assessment_v6_forms','assessment_v6_attempts')").get().n
 if(present!==2)return null
 const forms=db.prepare("SELECT id,title,revision,status,kind FROM assessment_v6_forms WHERE company_id=? AND course_id=? AND kind='final' ORDER BY id").all(scope.companyId,scope.courseId)
 const attempts=db.prepare("SELECT a.id,a.form_id,a.score,a.passed,a.submitted_at FROM assessment_v6_attempts a JOIN assessment_v6_forms f ON f.id=a.form_id WHERE f.company_id=? AND f.course_id=? AND f.kind='final' AND a.user_id=? ORDER BY a.form_id,a.score DESC,a.submitted_at,a.id").all(scope.companyId,scope.courseId,scope.userId)
 const requirements=forms.filter(f=>f.status==='published').map(({id,title,revision})=>({id,title,revision}))
 const passes=[];for(const f of requirements){const a=attempts.find(x=>x.form_id===f.id&&x.passed===1);if(a)passes.push({formId:f.id,attemptId:a.id,score:a.score})}
 return {revision:createHash('sha256').update(JSON.stringify([scope.companyId,scope.courseId,scope.userId,forms,attempts])).digest('hex'),requirements,passes}
}
const legacy = {
 async tenantAssessmentSnapshot(scope){return tenantAssessmentSnapshot(scope)},
 // Delete only unpublished video parts whose server-issued ID was authorized by the upload session.
 async deleteSocialVideoParts(id){
  if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id))throw new TypeError('Identificador inválido.')
  db.prepare('DELETE FROM objects WHERE key GLOB ?').run('social-video/'+id+'/*')
 },
 // Internal read-only batch check; callers must first derive authorized object keys.
 async countExisting(keys){
  if(!Array.isArray(keys)||keys.some(x=>typeof x!=='string'))throw new TypeError('Chaves inválidas.')
  const unique=[...new Set(keys)],statement=db.prepare('SELECT COUNT(*) AS n FROM objects WHERE key IN (SELECT value FROM json_each(?))');let total=0
  for(let i=0;i<unique.length;i+=2000)total+=statement.get(JSON.stringify(unique.slice(i,i+2000))).n
  return total
 },
 async get(key) {
  const row = db.prepare('SELECT * FROM objects WHERE key=?').get(key)
  if(!row) return null
  const body = Buffer.from(row.body)
  return {etag:row.etag,body,text:async()=>body.toString(),json:async()=>{
   const value=JSON.parse(body.toString())
   if(key==='system/state-v1'){DOMAIN.decorateState(value);value.organization.departments=db.prepare('SELECT id,company_id,name,active FROM departments WHERE active=1 ORDER BY name').all();value.organization.units=db.prepare('SELECT id,company_id,name,active FROM units WHERE active=1 ORDER BY name').all();value.organization.revision=organizationRevision()}
   return value
  }}
 },
 async put(key,value,options) {
  const etag=randomUUID(),body=Buffer.from(value)
  const expected=options?.onlyIf?.etagMatches
  db.exec('BEGIN IMMEDIATE')
  try {
   // OKR authorization is tied to the organization/session snapshot, not just the LXP revision.
   if(options?.requireStateEtag!==undefined&&db.prepare('SELECT etag FROM objects WHERE key=?').get('system/state-v1')?.etag!==options.requireStateEtag){db.exec('ROLLBACK');return null}
   if(options?.requireOrganizationRevision!==undefined&&organizationRevision()!==options.requireOrganizationRevision){db.exec('ROLLBACK');return null}
   if(options?.requireTenantSessionUntil!==undefined&&(!Number.isFinite(options.requireTenantSessionUntil)||options.requireTenantSessionUntil<=Date.now())){db.exec('ROLLBACK');return null}
   if(options?.requireTenantAssessmentRevision!==undefined){const proof=options.requireTenantAssessmentRevision;const current=tenantAssessmentSnapshot(proof);if(key!=='system/state-v1'||!current||current.revision!==proof.revision){db.exec('ROLLBACK');return null}}
   const result=expected
    ? db.prepare('UPDATE objects SET etag=?,body=? WHERE key=? AND etag=?').run(etag,body,key,expected)
    : db.prepare('INSERT OR IGNORE INTO objects VALUES(?,?,?)').run(key,etag,body)
   if(result.changes && key==='system/state-v1') {
    const state=JSON.parse(body.toString())
    DOMAIN.syncPeople(state,false)
    const assignments=options?.organizationAssignments|| (options?.organizationAssignment?[options.organizationAssignment]:[])
    for(const assignment of assignments){
     const actor=state.users.find(person=>person.id===assignment.actorId&&person.active)
     if(!actor)throw Object.assign(new Error('Sessão administrativa indisponível.'),{status:403})
     DOMAIN.assignPerson(state,actor,assignment.body)
    }
    DOMAIN.syncPeople(state)
    recordManagerHistory(db,state)
   }
   db.exec('COMMIT')
   return result.changes ? {etag} : null
  } catch(error) {
   db.exec('ROLLBACK')
   throw error
  }
 }
}
// Default is exactly the legacy adapter. The S3 SDK is loaded only after explicit opt-in.
const configuration=mediaConfig()
const remote=configuration.mode==='sqlite'?null:await createS3Store(configuration)
const adapter=createMediaAdapter({db,legacy,config:configuration,remote})
if(configuration.mode==='external')await verifyRemote(configuration,remote)
if(configuration.mode==='rehydrate'){
 const restored=await adapter.rehydrate()
 console.info(JSON.stringify({event:'media_v27_rehydrated',objects:restored,remaining:adapter.externalCount()}))
}
export const BUCKET=adapter.bucket

// Explicit opt-in only; the scheduler refuses the same device and never deletes backups.
if(configuration.mode!=='rehydrate')startBackupScheduler(databasePath,scheduledBackup)
