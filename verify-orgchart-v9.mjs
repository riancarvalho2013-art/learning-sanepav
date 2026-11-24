import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {projectChart,handleOrganizationChart} from './organization-chart-v9.mjs'
const companies=[{id:'a',name:'Empresa A',active:1},{id:'b',name:'Empresa B',active:1}]
const departments=[{id:'a1',company_id:'a',name:'Jurídico',active:1},{id:'a2',company_id:'a',name:'Financeiro',active:1},{id:'a3',company_id:'a',name:'Compras',active:1},{id:'b1',company_id:'b',name:'Operações',active:1}]
const units=[{id:'u1',company_id:'a',name:'Matriz',active:1},{id:'u2',company_id:'b',name:'Filial',active:1}]
const user=(id,role='Colaborador',manager='',active=true)=>({id,name:id,role,manager,active,email:id+'@test.example',passwordHash:'secret',salary:5000})
const users=[user('admin','Administrador'),user('leader','Líder'),user('otherLeader','Líder'),user('staff','Colaborador','leader'),user('otherStaff','Colaborador','otherLeader'),user('foreign','Colaborador','leader'),user('badManager','Colaborador','foreign'),user('inactive','Colaborador','leader',false),user('cycle1','Colaborador','cycle2'),user('cycle2','Colaborador','cycle1'),user('rh','RH/DHO'),user('director','Diretoria'),user('unassigned','Colaborador')]
const assignments=new Map(users.filter(x=>!['admin','unassigned'].includes(x.id)).map(x=>[x.id,{company_id:x.id==='foreign'?'b':'a',department_id:x.id==='foreign'?'b1':x.id==='otherStaff'?'a2':'a1',unit_id:x.id==='foreign'?'u2':'u1',position:'Cargo '+x.id,hired_at:'2020-01-01'}]))
const token=id=>'token-'+id,digest=id=>createHash('sha256').update(token(id)).digest('hex')
const sessions=users.map(x=>({person:x.id,digest:digest(x.id),identity:'qa',until:Date.now()+60000}))
const state={users,sessions,organization:{companies,assignments}}
const registry={companies,departments,units}
const by=id=>users.find(x=>x.id===id)
let checks=0
const check=(predicate,message)=>{assert.ok(predicate,message);checks++}
const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++}
const chart=projectChart(state,by('leader'),registry,['a'])
eq(chart.companies.map(x=>x.id),['a']);eq(chart.departments.length,3,'Departamentos vazios incluídos');check(chart.people.some(x=>x.id==='otherStaff'),'Diretório da própria empresa');check(!chart.people.some(x=>['foreign','inactive','unassigned','admin'].includes(x.id)),'Isolamento e contas inativas');eq(chart.people.find(x=>x.id==='staff').managerId,'leader');eq(chart.people.find(x=>x.id==='badManager').managerId,null);eq(chart.people.find(x=>x.id==='badManager').managerStatus,'unavailable');eq(chart.people.find(x=>x.id==='leader').directReports,1);check(chart.people.some(x=>x.managerStatus==='cycle'),'Ciclo detectado');check(!JSON.stringify(chart).includes('@test.example'),'Sem e-mail');check(!JSON.stringify(chart).includes('passwordHash'),'Sem credenciais');check(!JSON.stringify(chart).includes('salary'),'Sem salário');check(!JSON.stringify(chart).includes('foreign'),'Sem ID de gestor externo');
const all=projectChart(state,by('admin'),registry,['a','b']);eq(all.counts.companies,2);eq(all.counts.unassigned,2);eq(all.people.find(x=>x.id==='foreign').managerId,null);eq(projectChart(state,by('admin'),registry,['a','b'],'b').people.map(x=>x.id),['foreign']);
assert.throws(()=>projectChart(state,by('leader'),registry,['a'],'b'),{status:403});checks++
assert.throws(()=>projectChart(state,by('staff'),registry,['a']),{status:403});checks++
// Direct handler with authenticated domain adapter fixture. Verify real server route separately.
let domainCalls=0,revokeDuringRead=false
const ctx={BUCKET:{async get(){return {async json(){return state}}}},DOMAIN:{allowedCompanies(s,u){return u.role==='Administrador'?['a','b']:assignments.get(u.id)?.company_id?[assignments.get(u.id).company_id]:[]},async handle(req,creds){domainCalls++;eq(new URL(req.url).pathname,'/api/v2/organization');check(creds.identity==='qa','Identidade repassada');if(revokeDuringRead)sessions.find(x=>x.person==='leader').until=0;return Response.json(registry)}}}
async function call(id,query='',status=200,method='GET',identity='qa'){const response=await handleOrganizationChart(new Request('https://qa.test/api/orgchart/v9'+query,{method,headers:{cookie:id?'learning='+token(id):'','oai-authenticated-user-id':identity}}),ctx);eq(response.status,status);eq(response.headers.get('cache-control'),'private, no-store');return response.json()}
await call('', '',401);await call('staff','',403);await call('rh','',403);await call('director','',403);await call('inactive','',401);await call('leader','?company=b',403);await call('leader','',405,'POST');await call('leader','',401,'GET','');eq(domainCalls,0,'Negados antes do registry');eq((await call('leader')).scope,'company_directory');eq((await call('admin','?company=b')).counts.people,1);revokeDuringRead=true;await call('leader','',401);revokeDuringRead=false;await call('leader','',401);eq(await handleOrganizationChart(new Request('https://qa.test/api/lxp/v2/pulse'),ctx),null)
const read=f=>readFileSync(new URL('./'+f,import.meta.url),'utf8'),html=read('web-index.html'),manifest=JSON.parse(read('asset-manifest.json')),server=read('serve.mjs'),pkg=JSON.parse(read('package.json'))
check(html.indexOf('/foundation.js')<html.indexOf('/orgchart-v9.js')&&html.indexOf('/orgchart-v9.js')<html.indexOf('/app.js'),'Hook após foundation, antes do app');eq(manifest['/orgchart-v9.js'].file,'web-orgchart-v9.js');eq(manifest['/orgchart-v9.css'].file,'web-orgchart-v9.css');check(server.includes("{exact:'/api/orgchart/v9',handler:request=>handleOrganizationChart(request,context)}"),'Rota antes da cadeia preservada');check(pkg.scripts.test.includes('verify-orgchart-http-v9.mjs'),'Integração real no npm test');
console.log('PASSOU: '+checks+' verificações de projeção, permissões, privacidade, autenticação, ciclo, manifesto e integração; adapter de domínio simulado.')
