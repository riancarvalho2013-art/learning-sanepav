import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {migrate,rollbackFoundation} from './migrations.mjs'
process.env.LEARNING_DB=':memory:'
const {BUCKET,DOMAIN}=await import('./storage.mjs')
const {default:application}=await import('./platform.mjs')
const origin='https://learning.example.test'
const password=crypto.randomUUID()
async function call(path,cookie='',body,options={}){
 const result=await application.fetch(new Request(origin+'/api/'+path,{
  method:body===undefined?'GET':'POST',
  headers:{origin,cookie,'content-type':'application/json','oai-authenticated-user-id':'foundation-test',...options.headers},
  ...(body===undefined?{}:{body:JSON.stringify(body)})
 }),{BUCKET,DOMAIN})
 return {status:result.status,data:await result.json(),cookie:result.headers.get('set-cookie')?.split(';')[0]}
}
async function good(path,cookie,body){
 const result=await call(path,cookie,body)
 assert.equal(result.status,200,JSON.stringify(result.data))
 return result
}
assert.equal((await call('v2/organization')).status,401)
const admin=(await good('login','',{name:'Technical test',email:'technical@example.test',password})).cookie
const companies=[]
for(const name of ['Sanepav test','Beta Clean test'])companies.push((await good('v2/company',admin,{name})).data.id)
const [sanepav,beta]=companies
assert.equal((await call('v2/company',admin,{name:'Sanepav test'})).status,409)
const unit=(await good('v2/unit',admin,{name:'Unit A',company_id:sanepav})).data.id
const department=(await good('v2/department',admin,{name:'Area A',company_id:sanepav})).data.id
const persons={}
for(const [name,role] of [['leader','Líder'],['employee','Colaborador'],['outside','Colaborador'],['hr','RH/DHO'],['executive','Diretoria']]){
 await good('user',admin,{name,email:name+'@example.test',role,active:true,password,manager:name==='employee'?persons.leader.id:''})
 persons[name]=(await good('data',admin)).data.people.find(person=>person.name===name)
 persons[name].cookie=(await good('login','',{email:name+'@example.test',password})).cookie
}
for(const name of ['leader','employee','hr','executive'])await good('v2/assignment',admin,{person_id:persons[name].id,company_id:sanepav,unit_id:unit,department_id:department,position:'Test role',hired_at:'2026-11-01',revision:0})
await good('v2/assignment',admin,{person_id:persons.outside.id,company_id:beta,revision:0})
assert.equal((await call('v2/assignment',admin,{person_id:persons.outside.id,company_id:beta,unit_id:unit,revision:1})).status,400)
assert.equal((await call('v2/assignment',admin,{person_id:persons.employee.id,company_id:beta,revision:1})).status,400)
assert.equal((await call('v2/assignment',admin,{person_id:persons.employee.id,company_id:sanepav,revision:0})).status,409)
assert.equal((await good('v2/organization',admin)).data.people.find(person=>person.id===persons.employee.id).company_id,sanepav)
const leader=persons.leader.cookie,employee=persons.employee.cookie,hr=persons.hr.cookie,executive=persons.executive.cookie
assert.equal((await call('v2/company',employee,{name:'Forbidden'})).status,403)
assert.equal((await call('v2/access',hr,{person_id:persons.hr.id,company_ids:[beta]})).status,403)
assert.equal((await good('v2/organization',hr)).data.companies.some(company=>company.id===beta),false)
assert.equal((await good('v2/organization',leader)).data.people.some(person=>person.id===persons.outside.id),false)
assert.equal((await call('data?company='+beta,leader)).status,403)
assert.equal((await call('v2/analytics?company='+beta,hr)).status,403)
assert.equal((await call('v2/analytics',admin)).status,403)
assert.equal((await call('v2/analytics',employee)).status,403)
assert.equal((await good('v2/analytics',executive)).data.indicators.find(item=>item.id==='headcount').value,4)
await good('v2/access',admin,{person_id:persons.hr.id,company_ids:[beta]})
assert.equal((await good('v2/analytics?company='+beta,hr)).data.indicators.find(item=>item.id==='headcount').value,1)
await good('v2/access',admin,{person_id:persons.hr.id,company_ids:[]})
assert.equal((await call('v2/analytics?company='+beta,hr)).status,403)
assert.equal((await call('record',leader,{kind:'PDI',person:persons.outside.id,title:'Forbidden',date:'2099-01-01'})).status,403)
await good('record',leader,{kind:'1:1',person:persons.employee.id,title:'Private meeting',date:'2099-01-01'})
assert.equal((await good('data',admin)).data.records.some(item=>item.title==='Private meeting'),false)
assert.equal((await good('data',executive)).data.records.some(item=>item.title==='Private meeting'),false)
assert.equal((await good('data',employee)).data.records.some(item=>item.title==='Private meeting'),true)
await good('course',hr,{title:'Real API test',type:'Leitura',body:'Learning content',minutes:5})
assert.equal((await call('course',executive,{title:'Forbidden',type:'Leitura',body:'X',minutes:5})).status,403)
await good('socialPost',employee,{text:'Company A only'})
assert.equal((await good('socialFeed',persons.outside.cookie)).data.items.length,0)
assert.equal((await good('socialFeed',leader)).data.items.length,1)
const post=(await good('socialFeed',leader)).data.items[0]
assert.equal((await call('socialReaction',persons.outside.cookie,{id:post.id,reaction:'Curtir'})).status,404)
assert.equal((await call('record',employee,{kind:'Elogio',person:persons.outside.id,title:'Cross company'})).status,400)
assert.equal((await call('v2/unit',admin,{name:'Wrong origin',company_id:sanepav},{headers:{origin:'https://other.example.test'}})).status,403)
assert.ok((await good('v2/audit',admin)).data.items.length>=9)
assert.equal((await call('v2/audit',hr)).status,403)
// Atomic compare-and-swap observes relational access changes.
const before=await BUCKET.get('system/state-v1')
await good('v2/department',admin,{name:'Another area',company_id:sanepav})
assert.equal(await BUCKET.put('system/state-v1',await before.text(),{onlyIf:{etagMatches:before.etag}}),null)
// Versioned migrations are idempotent and reverse without deleting legacy state.
const database=new DatabaseSync(':memory:')
database.exec('CREATE TABLE objects(key TEXT PRIMARY KEY,body TEXT); INSERT INTO objects VALUES(\'legacy\',\'preserved\')')
migrate(database);migrate(database)
assert.equal(database.prepare('SELECT count(*) AS n FROM schema_migrations').get().n,1)
rollbackFoundation(database)
assert.equal(database.prepare('SELECT body FROM objects').get().body,'preserved')
migrate(database)
assert.equal(database.prepare('PRAGMA foreign_key_check').all().length,0)
database.close()
console.log('OK: cinco perfis, empresas, vínculos, escopos, CAS, auditoria, isolamento social e migração reversível.')
