import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {writeFile} from 'node:fs/promises'
import {DatabaseSync} from 'node:sqlite'
import {historicalProjection,readHistoricalIndex} from './historical-analytics-v12.mjs'
import {handleReportsV3} from './reports-v3.mjs'
import {installOrganizationHistory} from './organization-history-v11.mjs'
const id=()=>randomUUID(),A=id(),B=id(),D1=id(),D2=id(),D3=id(),admin=id(),hrA=id(),hrB=id(),leader=id(),p=id(),moved=id(),other=id(),course=id()
const users=[{id:admin,role:'Administrador'},{id:hrA,role:'RH/DHO'},{id:hrB,role:'RH/DHO'},{id:leader,role:'Líder'},{id:p,role:'Colaborador',manager:leader},{id:moved,role:'Colaborador'},{id:other,role:'Colaborador',manager:leader}].map(u=>({...u,active:true,name:u.id===p?'=CMD()':'Pessoa QA'}))
const assignments=new Map([[hrA,{company_id:A}],[hrB,{company_id:B}],[leader,{company_id:A,department_id:D1}],[p,{company_id:A,department_id:D2}],[moved,{company_id:B,department_id:D3}],[other,{company_id:A,department_id:D2}]])
const at='2026-10-15T12:00:00.000Z',old='2026-09-01T00:00:00.000Z',start='2026-10-01T00:00:00.000Z',change='2026-11-01T00:00:00.000Z'
const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE person_organizations(person_id TEXT PRIMARY KEY,company_id TEXT NOT NULL,unit_id TEXT,department_id TEXT,position TEXT NOT NULL,revision INTEGER NOT NULL)');installOrganizationHistory(db,null)
const add=db.prepare('INSERT INTO org_assignment_history_v11(person_id,company_id,department_id,position,source_revision,valid_from,valid_to,origin) VALUES(?,?,?,\'QA\',1,?,?,\'baseline\')')
for(const [person,c,d] of [[p,A,D1],[moved,A,D1],[leader,A,D1],[other,A,D1]])add.run(person,c,d,start,person===leader?null:change)
for(const [person,c,d] of [[p,A,D2],[moved,B,D3],[other,A,D2]])add.run(person,c,d,change,null)
const manager=db.prepare("INSERT INTO org_manager_history_v11(person_id,manager_id,valid_from,valid_to,origin) VALUES(?,?,?,?, 'baseline')")
manager.run(p,leader,start,null);manager.run(other,null,start,change);manager.run(other,leader,change,null)
const row=(person,completed,company,dept)=>{const e={id:id(),person,course,progress:100,completed};if(company)e.completionV11={content:{type:'manual'},event:{id:'learning.course.completed:'+e.id,courseId:course,enrollmentId:e.id,occurredAt:completed,organization:{companyId:company,departmentId:dept}}};return e}
const verified=row(p,at,A,D1),legacy=row(p,at),unknown=row(p,old),transfer=row(moved,at,A,D1),conflict=row(p,at,A,D2),unrelated=row(other,at,A,D1),undated=row(p,null),boundary=row(p,'2026-10-01T02:30:00.000Z',A,D1)
const state={users,courses:[{id:course,title:'Curso QA'}],enroll:[verified,legacy,unknown,transfer,conflict,unrelated,undated,boundary,{...verified}],organization:{assignments,companies:[{id:A},{id:B}]},sessions:users.map(u=>({person:u.id,digest:createHash('sha256').update(u.id).digest('hex'),identity:'qa',until:Date.now()+600000}))}
const domain={allowedCompanies:(s,u)=>u.role==='Administrador'?[A,B]:[assignments.get(u.id)?.company_id].filter(Boolean),canSeePerson:(s,u,p)=>s.users.find(x=>x.id===p)?.manager===u.id,historicalIndex:ids=>readHistoricalIndex(db,ids)}
const BUCKET={async get(k){return k==='system/state-v1'?{json:async()=>state}:null}}
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};const ok=x=>{assert.ok(x);checks++}
const call=(who,route)=>handleReportsV3(new Request('https://qa.test/api/reports/v3/'+route,{headers:{cookie:who?'learning='+who:'','oai-authenticated-user-id':'qa'}}),{BUCKET,DOMAIN:domain})
const fetchData=async(who,route)=>{const r=await call(who,route);eq(r.status,200);return r.json()}
try{
 const index=domain.historicalIndex(users.map(x=>x.id));eq(index.assignments.length,7)
 const report=await fetchData(admin,'history');eq(report.total,8);eq(report.metrics[0].value,5);eq(report.metrics[1].value,3);eq(report.metrics[2].value,62.5);eq(report.groups[0].departmentId,D1);eq(report.groups[0].completions,5)
 eq(report.rows.find(x=>x.enrollmentId===conflict.id).reason,'divergencia');eq(report.rows.find(x=>x.enrollmentId===legacy.id).reconciliation,'historico_vigente');eq(report.rows.find(x=>x.enrollmentId===unknown.id).departmentId,'');eq(report.rows.find(x=>x.enrollmentId===undated.id).reason,'sem_data')
 const period=await fetchData(admin,'history?from=2026-10-01&to=2026-10-31');eq(period.total,5);eq(period.rows.some(x=>x.enrollmentId===boundary.id),false)
 const historic=await fetchData(admin,'history?department='+D1);eq(historic.total,5);eq(historic.metrics[1].value,null)
 eq((await fetchData(admin,'history?department='+D2)).total,0)
 const first=await fetchData(admin,'history?limit=2&offset=0'),second=await fetchData(admin,'history?limit=2&offset=2');eq(first.rows.length,2);eq(second.rows.length,2);ok(!first.rows.some(x=>second.rows.some(y=>x.enrollmentId===y.enrollmentId)))
 const scopedA=await fetchData(hrA,'history?company='+A);eq(scopedA.total,4);eq(scopedA.rows.some(x=>x.personId===moved),false);eq(scopedA.metrics[1].value,null)
 const scopedB=await fetchData(hrB,'history?company='+B);eq(scopedB.total,0);eq((await call(hrB,'history?company='+A)).status,403)
 const team=await fetchData(leader,'history');eq(team.total,3);eq(team.rows.some(x=>x.personId===other),false)
 eq((await call(p,'history')).status,403);eq((await call(null,'history')).status,401);eq((await call(hrA,'history?person='+moved)).status,403);eq((await call(admin,'history?from=2026-11-31')).status,400)
 const exported=await call(hrA,'history.csv?company='+A);eq(exported.status,200);const csv=await exported.text();eq(csv.trimEnd().split('\r\n').length,scopedA.total+1);ok(!csv.includes(moved));ok(csv.includes("'=CMD()"));eq((await call(hrB,'history.csv?company='+A)).status,403)
 const xlsx=await call(hrA,'history.xlsx?company='+A);eq(xlsx.status,200);eq(xlsx.headers.get('content-type'),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');const bytes=Buffer.from(await xlsx.arrayBuffer());eq(bytes.readUInt32LE(0),0x04034b50);eq((await call(hrB,'history.xlsx?company='+A)).status,403);if(process.env.QA_XLSX_OUTPUT)await writeFile(process.env.QA_XLSX_OUTPUT,bytes)
 const catalog=await fetchData(admin,'catalog');eq(catalog.historicalDefinitions.length,3)
 console.log('PASS histórico V12: '+checks+' verificações (SQLite real, handler de relatórios, transferências, vigência, data local, CSV e ACL; BUCKET/domínio simulados).')
}finally{db.close()}
