import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {createHash} from 'node:crypto'
import {copyFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {pilotWrite} from './tenant-write-v30.mjs'
// Exact repo storage + media adapter, temporary SQLite, mocked domain/history/backup dependencies.
const dir=mkdtempSync(join(tmpdir(),'v30-storage-')), path=join(dir,'fixture.sqlite');let db,n=0;const old={LEARNING_DB:process.env.LEARNING_DB,LEARNING_MEDIA_MODE:process.env.LEARNING_MEDIA_MODE};const eq=(a,b)=>{assert.deepEqual(a,b);n++};const ok=x=>{assert.ok(x);n++}
try{
 for(const name of ['storage.mjs','media-storage-v27.mjs'])copyFileSync(new URL('./'+name,import.meta.url),join(dir,name))
 const stub=(name,source)=>writeFileSync(join(dir,name),source)
 stub('migrations.mjs',`export function migrate(db){db.exec('CREATE TABLE companies(id TEXT PRIMARY KEY,active INTEGER); CREATE TABLE units(id TEXT PRIMARY KEY,company_id TEXT,name TEXT,active INTEGER); CREATE TABLE departments(id TEXT PRIMARY KEY,company_id TEXT,name TEXT,active INTEGER); CREATE TABLE person_organizations(person_id TEXT PRIMARY KEY,company_id TEXT); CREATE TABLE company_access(person_id TEXT,company_id TEXT)')}`)
 stub('domain.mjs',`export function createDomain(db){return {syncPeople(){},decorateState(s){Object.defineProperty(s,'organization',{value:{companies:db.prepare('SELECT * FROM companies WHERE active=1').all(),assignments:new Map(db.prepare('SELECT * FROM person_organizations').all().map(a=>[a.person_id,a])),grants:db.prepare('SELECT * FROM company_access').all()}})}}}`)
 stub('historical-analytics-v12.mjs','export function readHistoricalIndex(){}');stub('organization-history-v11.mjs','export function installOrganizationHistory(){};export function recordManagerHistory(){};export function readOrganizationHistory(){}');stub('backup-scheduler-v27.mjs','export function startBackupScheduler(){}');stub('recovery-v13.mjs','export function scheduledBackup(){}')
 process.env.LEARNING_DB=path;process.env.LEARNING_MEDIA_MODE='sqlite';const {BUCKET}=await import(pathToFileURL(join(dir,'storage.mjs')).href);db=new DatabaseSync(path);db.exec("INSERT INTO companies VALUES('A',1),('B',1);INSERT INTO person_organizations VALUES('rh','A'),('other','B')")
 const key='system/state-v1',s={users:[{id:'rh',role:'RH/DHO',name:'RH',active:true},{id:'other',role:'RH/DHO',active:true}],sessions:[{person:'rh',identity:'fixture',digest:createHash('sha256').update('secret').digest('hex'),until:Date.now()+60000}],courses:[{id:'foreign',tenantCompanyId:'B',type:'Leitura',body:'B',title:'B',revision:1}],enroll:[],logs:[]};ok(await BUCKET.put(key,JSON.stringify(s)));const req=()=>new Request('http://fixture/api/course',{method:'POST',headers:{origin:'http://fixture','content-type':'application/json',cookie:'learning=secret','oai-authenticated-user-id':'fixture'},body:JSON.stringify({title:'A',type:'Leitura',body:'A',minutes:5})});eq((await pilotWrite(req(),{BUCKET})).status,200);let stored=await (await BUCKET.get(key)).json();eq(stored.courses.length,2);eq(stored.courses[1].tenantCompanyId,'A');eq(stored.courses[0],s.courses[0]);eq(stored.logs.length,1)
 // Change SQL organization after authorization, before actual adapter commit.
 const wrapped={get:k=>BUCKET.get(k),async put(k,v,o){db.exec("UPDATE person_organizations SET company_id='B' WHERE person_id='rh'");return BUCKET.put(k,v,o)}};eq((await pilotWrite(req(),{BUCKET:wrapped})).status,409);stored=await(await BUCKET.get(key)).json();eq(stored.courses.length,2);eq(stored.logs.length,1);eq(stored.organization.assignments.get('rh').company_id,'B');db.exec("UPDATE person_organizations SET company_id='A' WHERE person_id='rh'")
 // Revoke session in the real objects table, changing the state ETag.
 const revoked={get:k=>BUCKET.get(k),async put(k,v,o){const previous=await BUCKET.get(key),value=await previous.json();value.sessions=[];ok(await BUCKET.put(key,JSON.stringify(value),{onlyIf:{etagMatches:previous.etag}}));return BUCKET.put(k,v,o)}};eq((await pilotWrite(req(),{BUCKET:revoked})).status,409);stored=await(await BUCKET.get(key)).json();eq(stored.sessions,[]);eq(stored.courses.length,2);eq(stored.logs.length,1);eq((await pilotWrite(req(),{BUCKET})).status,401)
 console.log(`PASS V30.2B storage: ${n} assertions; exact storage/media adapter with real SQLite and simulated domain/history/backup.`)
}finally{db?.close();for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v}rmSync(dir,{recursive:true,force:true})}
