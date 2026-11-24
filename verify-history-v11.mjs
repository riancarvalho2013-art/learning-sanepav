import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {randomUUID,createHash} from 'node:crypto'
import {installOrganizationHistory,recordManagerHistory,readOrganizationHistory,handleOrganizationHistory} from './organization-history-v11.mjs'
const db=new DatabaseSync(':memory:');let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};const id=()=>randomUUID(),p=id(),a=id(),b=id(),manager=id(),second=id()
try{
 db.exec("CREATE TABLE person_organizations(person_id TEXT PRIMARY KEY,company_id TEXT NOT NULL,unit_id TEXT,department_id TEXT,position TEXT NOT NULL,revision INTEGER NOT NULL)")
 db.prepare('INSERT INTO person_organizations VALUES(?,?,?,?,?,?)').run(p,a,null,null,'Analista',1)
 const state={users:[{id:p,manager},{id:manager,manager:null},{id:second,manager:null}]}
 installOrganizationHistory(db,state);installOrganizationHistory(db,state)
 eq(readOrganizationHistory(db,{personId:p}).total,1);eq(readOrganizationHistory(db,{personId:p}).assignments[0].origin,'baseline');eq(readOrganizationHistory(db,{personId:p}).managers[0].manager_id,manager)
 db.prepare('UPDATE person_organizations SET revision=2 WHERE person_id=?').run(p);eq(readOrganizationHistory(db,{personId:p}).total,1)
 db.exec('BEGIN');db.prepare('UPDATE person_organizations SET company_id=?,position=?,revision=3 WHERE person_id=?').run(b,'Especialista',p);recordManagerHistory(db,{users:[{id:p,manager:second},{id:manager},{id:second}]});db.exec('ROLLBACK')
 eq(readOrganizationHistory(db,{personId:p}).total,1);eq(readOrganizationHistory(db,{personId:p}).managers.length,1)
 db.exec('BEGIN');db.prepare('UPDATE person_organizations SET company_id=?,position=?,revision=3 WHERE person_id=?').run(b,'Especialista',p);recordManagerHistory(db,{users:[{id:p,manager:second},{id:manager},{id:second}]});db.exec('COMMIT')
 let x=readOrganizationHistory(db,{personId:p});eq(x.total,2);eq(x.assignments[0].company_id,b);eq(x.assignments[1].valid_to,x.assignments[0].valid_from);eq(x.managers.length,2);eq(x.managers[0].manager_id,second);eq(x.managers[1].valid_to,x.managers[0].valid_from)
 eq(readOrganizationHistory(db,{companyId:a}).total,1);eq(readOrganizationHistory(db,{companyId:b}).total,1);eq(readOrganizationHistory(db,{personId:p,companyId:a}).managers,[])
 recordManagerHistory(db,{users:[{id:p,manager:second},{id:manager},{id:second}]});eq(readOrganizationHistory(db,{personId:p}).managers.length,2)
 const users=[{id:p,active:true,role:'Administrador'},{id:manager,active:true,role:'Líder'}],token=id(),digest=createHash('sha256').update(token).digest('hex');let who=p
 const ctx={BUCKET:{async get(){return {async json(){return {users,sessions:[{digest,person:who,identity:'qa',until:Date.now()+60000}]}}}}},DOMAIN:{organizationHistory:filters=>readOrganizationHistory(db,filters)}}
 const req=(query='',cookie=true)=>new Request('https://qa.test/api/organization/v11/history'+query,{headers:{'oai-authenticated-user-id':'qa',cookie:cookie?'learning='+token:''}})
 eq((await handleOrganizationHistory(req('',false),ctx)).status,401);eq((await handleOrganizationHistory(req('?company=bad'),ctx)).status,400);eq((await (await handleOrganizationHistory(req('?person='+p),ctx)).json()).total,2);who=manager;eq((await handleOrganizationHistory(req(),ctx)).status,403)
 console.log('PASSOU: histórico V11 — '+checks+' verificações em SQLite real, baseline, alterações, rollback, intervalos e ACL.')
}finally{db.close()}
