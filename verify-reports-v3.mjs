import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {handleReportsV3,REPORT_DEFINITIONS} from './reports-v3.mjs'
const uuid=()=>randomUUID()
const companyA=uuid(),companyB=uuid(),deptA=uuid(),deptB=uuid()
const password='validsession'
const token=val=>createHash('sha256').update(val).digest('hex')
const people=[
 ['admin','Administrador',companyA,''],
 ['hr','RH/DHO',companyA,''],
 ['leader','Líder',companyA,''],
 ...Array.from({length:7},(_,i)=>['employee'+i,'Colaborador',companyA,'leader']),
 ['outsider','Colaborador',companyB,'']
]
const ids=new Map(people.map(([k])=>[k,uuid()]))
const users=people.map(([k,role,comp,manager])=>({id:ids.get(k),name:k,email:k+'@example.test',role,manager:ids.get(manager)||'',active:true}))
const assignments=new Map(people.map(([k,role,comp])=>[ids.get(k),{person_id:ids.get(k),company_id:comp,department_id:comp===companyA?deptA:deptB}]))
const courses=[{id:uuid(),title:'Curso inclusivo',track:'DNA do Desenvolvimento',type:'SCORM',status:'published'},{id:uuid(),title:'Curso confidencial B',track:'B',type:'Leitura',status:'published'}]
const enroll=[{id:uuid(),person:ids.get('employee0'),course:courses[0].id,progress:100,score:92,completed:'2026-11-21T15:00:00Z',due:'2026-11-22'},
 {id:uuid(),person:ids.get('employee1'),course:courses[0].id,progress:40,score:null,updated:'2026-11-20T10:00:00Z',due:'2026-11-21'},
 {id:uuid(),person:ids.get('outsider'),course:courses[1].id,progress:100,score:88,completed:'2026-11-21T13:00:00Z'}]
const state={users,sessions:people.map(([k])=>({person:ids.get(k),digest:token(k),identity:'learning-railway',until:Date.now()+600000})),courses,enroll,missions:[],missionEnrollments:[{person:ids.get('employee0'),mission:uuid()}],organization:{assignments,companies:[{id:companyA,name:'Sanepav',active:1},{id:companyB,name:'Beta Clean',active:1}],grants:[]}}
const pulseId=uuid()
const lxp={schema:2,pulses:[{id:pulseId,companyId:companyA,participants:people.filter(x=>x[2]===companyA).map(x=>ids.get(x[0])),createdAt:'2026-11-20T00:00:00Z'}],pulseResponses:[],
 cycles:[{id:uuid(),companyId:companyA,participants:[ids.get('employee0')],createdAt:'2026-11-20T00:00:00Z'}],reviews:[],
 pdiActions:[{personId:ids.get('employee0'),status:'done',createdAt:'2026-11-20T00:00:00Z'}],meetings:[],feedbackRequests:[]}
lxp.reviews.push({cycleId:lxp.cycles[0].id,subjectId:ids.get('employee0'),reviewerId:ids.get('employee0'),status:'submitted',updatedAt:'2026-11-21'})
for(let i=0;i<7;i++)lxp.pulseResponses.push({surveyId:pulseId,userId:ids.get('employee'+i),rating:4,at:'2026-11-21'})
const store=new Map([['system/state-v1',state],['lxp/v2/state',lxp],['evolution/v1/issued/'+enroll[0].id,{code:uuid()}]])
const bucket={async get(key){const value=store.get(key);return value===undefined?null:{etag:'x',json:async()=>structuredClone(value)}},async put(key,value,options){if(!store.has(key)&&options?.onlyIf?.etagMatches)return null;if(store.has(key)&&options?.onlyIf?.etagDoesNotMatch)return null;store.set(key,JSON.parse(value));return {etag:'x'}}}
const domain={allowedCompanies:(s,u)=>u.role==='Administrador'?[companyA,companyB]:[assignments.get(u.id)?.company_id].filter(Boolean)}
async function call(user,route,body){const cookie=user?'learning='+user:'';const result=await handleReportsV3(new Request('https://learning.example.test/api/reports/v3/'+route,{headers:{cookie,'oai-authenticated-user-id':'learning-railway',...(body?{'origin':'https://learning.example.test','content-type':'application/json'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})}),{BUCKET:bucket,DOMAIN:domain})
 const rawBody=await result.text();let data;try{data=JSON.parse(rawBody)}catch{data=rawBody};return{status:result.status,data,headers:result.headers}}
const byCode=(data,code)=>data.metrics.find(x=>x.code===code)
assert.equal((await call('','summary')).status,401)
assert.equal((await call('employee0','summary')).status,403)
assert.equal((await call('leader','summary?company='+companyB)).status,403)
const leader=await call('leader','summary')
assert.equal(leader.status,200,JSON.stringify(leader.data))
assert.equal(byCode(leader.data,'people.active').value,8) // Leader plus 7 direct employees
assert.equal(byCode(leader.data,'learning.enrollments').value,2)
assert.equal(byCode(leader.data,'learning.completed').value,1)
assert.equal(byCode(leader.data,'learning.completion_rate').value,50)
assert.equal(byCode(leader.data,'learning.score_avg').value,92)
assert.equal(byCode(leader.data,'learning.certificates').value,1)
assert.equal(byCode(leader.data,'dho.pulse_mean').value,4)
assert.equal(byCode(leader.data,'dho.review_adherence').value,100)
assert.equal((await call('hr','summary?person='+ids.get('outsider'))).status,403)
const a=await call('hr','summary?company='+companyA)
assert.equal(a.status,200)
assert.equal(a.data.byCourse.length,1)
assert.equal(a.data.byCourse[0].title,'Curso inclusivo')
assert.equal(byCode(a.data,'dho.pdi_actions').value,1)
assert.equal((await call('admin','enrollments?company='+companyA+'&limit=1&offset=1')).data.rows.length,1)
assert.equal((await call('leader','enrollments?person='+ids.get('outsider'))).status,403)
const dept=await call('hr','summary?department='+deptA)
assert.equal(byCode(dept.data,'dho.pulse_mean').value,null)
assert.equal(byCode(dept.data,'dho.pulse_surveys').value,null)
const low={...lxp,pulseResponses:lxp.pulseResponses.slice(0,6)};store.set('lxp/v2/state',low)
const guarded=await call('hr','summary?company='+companyA)
assert.equal(byCode(guarded.data,'dho.pulse_mean').value,null)
assert.equal(byCode(guarded.data,'dho.pulse_response_rate').value,null)
store.set('lxp/v2/state',lxp)
assert.equal((await call('hr','summary?from=2026-11-20&to=2026-11-22')).status,200)
assert.equal((await call('hr','summary?from=2026-11-23&to=2026-11-20')).status,400)
assert.equal((await call('hr','summary?department=invalid')).status,400)
assert.equal((await call('hr','summary?person='+ids.get('employee0')+'&company='+companyB)).status,403)
const csv=await call('hr','export.csv?company='+companyA)
assert.equal(csv.status,200)
assert.match(csv.headers.get('content-type'),/text\/csv/)
assert.ok(csv.data.includes('Curso inclusivo'))
assert.ok(!csv.data.includes('Curso confidencial B'))
assert.ok(!csv.data.includes('outsider'))
const catalog=await call('hr','catalog')
assert.equal(catalog.status,200)
assert.ok(catalog.data.definitions.length>=15)
assert.ok(catalog.data.notTracked.some(x=>x.code==='people.turnover'))
assert.equal(Object.keys(REPORT_DEFINITIONS).length,catalog.data.definitions.length)
assert.equal((await call('hr','health')).status,200)
const saved=await call('hr','views',{name:'Minha visão de LMS',filters:{company:companyA,from:'2026-11-01'}})
assert.equal(saved.status,200,JSON.stringify(saved.data))
const savedId=saved.data.id
assert.equal((await call('hr','views')).data.items[0].name,'Minha visão de LMS')
assert.equal((await call('leader','views')).data.items.length,0)
assert.equal((await call('hr','views',{name:'Vazamento B',filters:{company:companyB}})).status,403)
assert.equal((await call('hr','views',{id:savedId,revision:0,name:'Conflito',filters:{company:companyA}})).status,409)
assert.equal((await call('hr','views/delete',{id:savedId,revision:1})).status,200)
assert.equal((await call('hr','views')).data.items.length,0)
assert.equal((await call('hr','views/delete',{id:savedId,revision:1})).status,404)
// CSV formula injection: a user-supplied course title must be escaped on download.
courses[0].title='=HYPERLINK("https://attacker.test")'
const bad=await call('hr','export.csv?company='+companyA)
assert.match(bad.data,/'=HYPERLINK/)
console.log('OK: relatórios v3: RBAC, hierarquia, empresas, filtros, matrícula real, certificados reais, Pulse com supressão por limite mínimo, supressão, CSV, paginação e dicionário.')
