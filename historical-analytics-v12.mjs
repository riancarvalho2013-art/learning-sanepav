/** Historical completion read model. Never backfill with the current organization. */
import {historyWorkbook} from './report-xlsx-v12.mjs'
import {completionClassification} from './completion-v11.mjs'
const fail=(ok,message,status=400)=>{if(!ok)throw Object.assign(new Error(message),{status})}
const list=v=>Array.isArray(v)?v:[]
const id=/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i
const dateOk=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s
const iso=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(s)&&Number.isFinite(Date.parse(s))?new Date(s).toISOString():null
const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'})
const day=s=>dayFormat.format(new Date(s))
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'private,no-store','x-content-type-options':'nosniff'}})
const key=(...parts)=>JSON.stringify(parts)
import {HISTORICAL_DEFINITIONS} from './metric-registry-v13.mjs'
export {HISTORICAL_DEFINITIONS}
const metric=(code,value)=>({code,...HISTORICAL_DEFINITIONS[code],value,available:value!==null})
/** Bulk read, ordered once. No historical assignment is exposed directly to the browser. */
export function readHistoricalIndex(db,personIds){
 if(!personIds.length)return {assignments:[],managers:[],observedFrom:null}
 const ids=JSON.stringify(personIds)
 const assignments=db.prepare('SELECT sequence,person_id,company_id,unit_id,department_id,valid_from,valid_to FROM org_assignment_history_v11 WHERE person_id IN (SELECT value FROM json_each(?)) ORDER BY person_id,valid_from,sequence').all(ids)
 const managers=db.prepare('SELECT sequence,person_id,manager_id,valid_from,valid_to FROM org_manager_history_v11 WHERE person_id IN (SELECT value FROM json_each(?)) ORDER BY person_id,valid_from,sequence').all(ids)
 return {assignments,managers,observedFrom:db.prepare('SELECT observed_from FROM org_history_v11_schema WHERE version=1').get()?.observed_from||null}
}
const groupByPerson=rows=>{const out=new Map();for(const r of rows){if(!out.has(r.person_id))out.set(r.person_id,[]);out.get(r.person_id).push(r)}return out}
function lookup(map,person,at){
 const rows=map.get(person)||[];let lo=0,hi=rows.length
 while(lo<hi){const mid=(lo+hi)>>1;if(rows[mid].valid_from<=at)lo=mid+1;else hi=mid}
 const row=rows[lo-1];return row&&(!row.valid_to||at<row.valid_to)?row:null
}
function eventOrg(e,at,history){
 const recorded=e.completionV11?.event
 const snapshot=recorded?.id==='learning.course.completed:'+e.id&&recorded.enrollmentId===e.id&&recorded.courseId===e.course&&iso(recorded.occurredAt)===at?recorded.organization:null
 const known=lookup(history,e.person,at)
 if(snapshot?.companyId){
  const event={company_id:snapshot.companyId,department_id:snapshot.departmentId||null,unit_id:snapshot.unitId||null}
  if(known&&['company_id','department_id','unit_id'].some(k=>(known[k]||null)!==(event[k]||null)))return {reason:'divergencia'}
  return {org:event,source:'snapshot_conclusao'}
 }
 if(known?.company_id)return {org:known,source:'historico_vigente'}
 return {reason:'sem_historico'}
}
const csvCell=value=>{let s=String(value??'');if(/^[\s\uFEFF]*[=+@\-\t\r]/u.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
function csvStream(rows){
 const keys=['enrollmentId','personId','person','courseId','course','completedAt','companyId','departmentId','unitId','evidenceType','reconciliation','reason']
 const enc=new TextEncoder();let index=-1
 const body=new ReadableStream({pull(controller){if(index===-1){controller.enqueue(enc.encode('\ufeff'+keys.join(';')+'\r\n'));index=0;return}if(index>=rows.length){controller.close();return}const stop=Math.min(index+256,rows.length);let s='';for(;index<stop;index++)s+=keys.map(k=>csvCell(rows[index][k])).join(';')+'\r\n';controller.enqueue(enc.encode(s))}})
 return new Response(body,{headers:{'content-type':'text/csv;charset=utf-8','content-disposition':'attachment; filename="learning-conclusoes-historicas.csv"','cache-control':'private,no-store','x-content-type-options':'nosniff'}})
}
/** Pure projection: exact same rows are the source of totals, detail and exports. */
export function historicalProjection(state,user,domain,params,index){
 const filter=Object.fromEntries(['company','department','person','course','from','to'].map(k=>[k,params.get(k)||'']))
 for(const k of ['company','department','person','course'])fail(!filter[k]||id.test(filter[k]),'Filtro inválido: '+k)
 for(const k of ['from','to'])fail(!filter[k]||dateOk(filter[k]),'Data inválida: '+k)
 fail(!filter.from||!filter.to||filter.from<=filter.to,'Período inválido.')
 const global=user.role==='Administrador',leader=user.role==='Líder',allowed=new Set(domain.allowedCompanies(state,user))
 fail(!filter.company||allowed.has(filter.company),'Empresa fora do escopo.',403)
 const current=state.organization?.assignments||new Map(),people=new Map(list(state.users).map(u=>[u.id,u])),courses=new Map(list(state.courses).map(c=>[c.id,c]))
 const eligible=p=>!!p&&(global||p.active&&allowed.has(current.get(p.id)?.company_id)&&(!leader||p.id===user.id||domain.canSeePerson?.(state,user,p.id)===true))
 fail(!filter.person||eligible(people.get(filter.person)),'Pessoa fora do escopo.',403)
 const assignments=groupByPerson(index.assignments),managers=groupByPerson(index.managers)
 function inHistoricalTeam(p,at,company){if(!leader||p===user.id)return true;const seen=new Set();let next=p
  while(next&&!seen.has(next)){seen.add(next);if(lookup(assignments,next,at)?.company_id!==company)return false;next=lookup(managers,next,at)?.manager_id;if(next===user.id)return lookup(assignments,next,at)?.company_id===company}return false
 }
 const unresolvedAllowed=global&&!filter.company&&!filter.department,rows=[],groups=new Map(),seen=new Set()
 let resolved=0,unresolved=0
 for(const e of list(state.enroll)){
  if(e.progress!==100||seen.has(e.id)||!eligible(people.get(e.person))||filter.person&&filter.person!==e.person||filter.course&&filter.course!==e.course)continue
  seen.add(e.id)
  const at=iso(e.completed)
  if(at&&(filter.from&&day(at)<filter.from||filter.to&&day(at)>filter.to))continue
  // Undated records do not enter a dated denominator. They remain visible in the unfiltered global report.
  if(!at&&(filter.from||filter.to))continue
  const result=at?eventOrg(e,at,assignments):{reason:'sem_data'}
  if(result.org){const a=result.org
   if(!allowed.has(a.company_id)||filter.company&&a.company_id!==filter.company||filter.department&&a.department_id!==filter.department||!inHistoricalTeam(e.person,at,a.company_id))continue
   // A transfer does not grant the new company access to the former company's records.
   if(!global&&current.get(e.person)?.company_id!==a.company_id)continue
   resolved++
   const k=key(a.company_id,a.department_id||''),g=groups.get(k)||{companyId:a.company_id,departmentId:a.department_id||'',completions:0,people:new Set()};g.completions++;g.people.add(e.person);groups.set(k,g)
  }else{if(!unresolvedAllowed)continue;unresolved++}
  rows.push({enrollmentId:e.id,personId:e.person,person:people.get(e.person)?.name||'',courseId:e.course,course:courses.get(e.course)?.title||'Curso removido',completedAt:at,companyId:result.org?.company_id||'',departmentId:result.org?.department_id||'',unitId:result.org?.unit_id||'',evidenceType:completionClassification(e),reconciliation:result.source||'nao_reconciliado',reason:result.reason||''})
 }
 rows.sort((a,b)=>String(b.completedAt||'').localeCompare(String(a.completedAt||''))||a.enrollmentId.localeCompare(b.enrollmentId))
 const total=resolved+unresolved
 return {filters:filter,observedFrom:index.observedFrom,metrics:[metric('history.completions',resolved),metric('history.unresolved',unresolvedAllowed?unresolved:null),metric('history.coverage',unresolvedAllowed&&total?Math.round(resolved*10000/total)/100:null)],total,groups:[...groups.values()].map(g=>({companyId:g.companyId,departmentId:g.departmentId,completions:g.completions,people:g.people.size})),rows,caveats:['Conclusões por data de ocorrência em America/Sao_Paulo; não é uma fotografia de headcount nem uma taxa de conclusão de coorte.','Histórico desconhecido não é atribuído ao departamento atual; registros sem data não entram em recortes temporais.','Acesso exige autorização atual e, para gestores, vínculo histórico comprovado. Registros de pessoas transferidas para outra empresa não são compartilhados com nenhuma delas sem administração global.','Nomes e títulos exibidos são os cadastros atuais; o vínculo é histórico.']}
}
export async function historicalReport(req,ctx,state,user,route){
 fail(typeof ctx.DOMAIN.historicalIndex==='function','Histórico organizacional indisponível.',503)
 const params=new URL(req.url).searchParams
 const index=ctx.DOMAIN.historicalIndex(list(state.users).map(x=>x.id))
 const result=historicalProjection(state,user,ctx.DOMAIN,params,index)
 if(route==='history.csv')return csvStream(result.rows)
 if(route==='history.xlsx')return new Response(historyWorkbook(result),{headers:{'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':'attachment; filename="learning-conclusoes-historicas.xlsx"','cache-control':'private,no-store','x-content-type-options':'nosniff'}})
 const num=(k,def,max)=>{const s=params.get(k);return s!==null&&/^\d+$/.test(s)?Math.min(max,Number(s)):def}
 const limit=Math.max(1,num('limit',50,100)),offset=num('offset',0,10000000)
 const {rows,...summary}=result;return json({...summary,limit,offset,rows:rows.slice(offset,offset+limit)})
}
