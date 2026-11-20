import assert from 'node:assert/strict'
process.env.LEARNING_DB=':memory:'
const {BUCKET,DOMAIN}=await import('./storage.mjs')
const {default:app}=await import('./platform.mjs')
const origin='https://learning.example.test',password=crypto.randomUUID()
async function call(path,cookie='',body){
 const result=await app.fetch(new Request(origin+'/api/'+path,{method:body===undefined?'GET':'POST',
  headers:{origin,cookie,'content-type':'application/json','oai-authenticated-user-id':'user-company-test'},
  ...(body===undefined?{}:{body:JSON.stringify(body)})}),{BUCKET,DOMAIN})
 return {status:result.status,data:await result.json(),cookie:result.headers.get('set-cookie')?.split(';')[0]}
}
async function good(path,cookie,body){const result=await call(path,cookie,body);assert.equal(result.status,200,JSON.stringify(result.data));return result}
const admin=(await good('login','',{name:'Test admin',email:'admin@example.test',password})).cookie
const first=(await good('v2/company',admin,{name:'Company A test'})).data.id
const second=(await good('v2/company',admin,{name:'Company B test'})).data.id
const unit=(await good('v2/unit',admin,{name:'B unit',company_id:second})).data.id
const department=(await good('v2/department',admin,{name:'B department',company_id:second})).data.id
const input=(name,company,extra={})=>({name,email:name+'@example.test',role:'Colaborador',active:true,password,
 organization:{company_id:company,revision:0,position:'Test position',hired_at:'2026-01-01'},...extra})
const organization=async()=>(await good('v2/organization',admin)).data
const find=async name=>(await organization()).people.find(person=>person.name===name)
await good('user',admin,input('person',first))
let person=await find('person')
assert.equal(person.company_id,first);assert.equal(person.revision,1)
const user=(await good('login','',{email:person.email,password})).cookie
const invalid=input('invalid',first);invalid.organization.unit_id=unit
const beforeAudit=(await good('v2/audit',admin)).data.items.length
assert.equal((await call('user',admin,invalid)).status,400)
assert.equal(await find('invalid'),undefined,'Failed organization must not create an orphan user')
assert.equal((await good('v2/audit',admin)).data.items.length,beforeAudit)
const edit={...input('person',second),id:person.id,organization:{company_id:second,unit_id:unit,department_id:department,revision:1,position:'New position'}}
delete edit.password
await good('user',admin,edit)
person=await find('person');assert.equal(person.company_id,second);assert.equal(person.unit_id,unit);assert.equal(person.revision,2)
assert.equal((await good('v2/organization',user)).data.people[0].company_id,second)
assert.equal((await call('user',admin,{...edit,name:'Stale overwrite',active:false,password:crypto.randomUUID()})).status,409)
assert.equal((await find('person')).active,true)
assert.equal((await good('data',user)).data.me.name,'person','A rolled-back edit must not revoke sessions')
await good('login','',{email:person.email,password})
await good('user',admin,input('leaderA',first,{role:'Líder'}))
await good('user',admin,input('leaderB',second,{role:'Líder'}))
const leaderA=await find('leaderA'),leaderB=await find('leaderB')
await good('user',admin,input('report',first,{manager:leaderA.id}))
const report=await find('report')
assert.equal((await call('user',admin,{...input('leaderA',second,{role:'Líder'}),id:leaderA.id,organization:{company_id:second,revision:1}})).status,400)
assert.equal((await find('leaderA')).company_id,first)
await good('user',admin,{...input('report',second,{manager:leaderB.id}),id:report.id,organization:{company_id:second,revision:1}})
assert.equal((await find('report')).manager,leaderB.id,'Company and manager must change together')
assert.equal((await call('user',user,edit)).status,403)
assert.equal((await call('user',admin,input('unknown','missing-company'))).status,400)
assert.equal(await find('unknown'),undefined)
assert.ok((await good('v2/audit',admin)).data.items.some(item=>item.entity_id===person.id&&item.entity_type==='assignment'))
console.log('OK: empresa no cadastro e edição, transação atômica, rollback de credenciais e sessões, revisão, hierarquia e auditoria.')
