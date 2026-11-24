/** OKR V14: one aggregate, explicit target, deny by default. Existing V13 rows remain intact. */
import {randomUUID} from 'node:crypto'
import {resolveActor} from './completion-v11.mjs'
const fail=(ok,msg,status=400)=>{if(!ok)throw Object.assign(new Error(msg),{status})}
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const timestamp=()=>new Date().toISOString()
const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x
const label=(v,max)=>{fail(typeof v==='string'&&v.trim()&&v.trim().length<=max,'Confira os campos de texto.');return v.trim()}
const number=v=>{fail(typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e12,'Valor numérico inválido.');return v}
const uuid=v=>typeof v==='string'&&/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(v)
const rows=s=>s.okrsV13||[]
const assignment=(s,id)=>s.organization?.assignments?.get(id)
const company=(s,id)=>assignment(s,id)?.company_id
const dept=(s,id)=>assignment(s,id)?.department_id||null
const person=(s,id)=>s.users.find(u=>u.id===id&&u.active)
const admin=u=>u.role==='Administrador'
const leader=u=>u.role==='Líder'
const type=o=>o.scope||'individual'
const registry=s=>s.organization?.departments||[]
const activeDepartment=(s,t,id)=>registry(s).find(x=>x.id===id&&x.company_id===t&&x.active!==0&&x.active!==false)
const activeCompany=(s,t)=>s.organization?.companies?.some(x=>x.id===t&&x.active!==0&&x.active!==false)
const members=(s,t,id)=>s.users.filter(p=>p.active&&company(s,p.id)===t&&dept(s,p.id)===id)
function team(s,actor,id,tenant){const seen=new Set();let p=person(s,id);while(p&&!seen.has(p.id)&&company(s,p.id)===tenant){if(p.id===actor.id)return true;seen.add(p.id);p=person(s,p.manager)}return false}
function managesDepartment(s,u,t,id){if(!leader(u)||company(s,u.id)!==t||!activeDepartment(s,t,id))return false;const people=members(s,t,id);return people.some(p=>p.id!==u.id&&team(s,u,p.id,t))&&people.every(p=>team(s,u,p.id,t))}
function departmentRelevant(s,u,t,id){return dept(s,u.id)===id||leader(u)&&members(s,t,id).some(p=>team(s,u,p.id,t))}
function inTenant(s,d,u,t){return activeCompany(s,t)&&company(s,u.id)===t&&d.allowedCompanies(s,u).includes(t)}
function ownerValid(s,o){return !!o.ownerId&&!!person(s,o.ownerId)&&company(s,o.ownerId)===o.companyId&&(!o.departmentId||dept(s,o.ownerId)===o.departmentId)}
export function canManageOKR(s,d,u,o){if(admin(u))return true;if(!leader(u)||!inTenant(s,d,u,o.companyId))return false;if(type(o)==='department')return managesDepartment(s,u,o.companyId,o.departmentId);return type(o)==='individual'&&ownerValid(s,o)&&o.ownerId!==u.id&&team(s,u,o.ownerId,o.companyId)}
function canView(s,d,u,o){if(canManageOKR(s,d,u,o))return true;if(o.status==='draft'||!inTenant(s,d,u,o.companyId))return false;if(type(o)==='company')return true;if(type(o)==='department')return !!activeDepartment(s,o.companyId,o.departmentId)&&departmentRelevant(s,u,o.companyId,o.departmentId);return type(o)==='individual'&&ownerValid(s,o)&&u.id===o.ownerId}
function canCheckin(s,d,u,o){return o.status==='active'&&(canManageOKR(s,d,u,o)||canView(s,d,u,o)&&ownerValid(s,o)&&o.ownerId===u.id)}
function target(s,d,u,b){
 fail(admin(u)||leader(u),'Configuração reservada à administração e à liderança autorizada.',403)
 const scope=b.scope??'individual';fail(['company','department','individual'].includes(scope),'Nível de OKR inválido.')
 const ownerId=b.ownerId||null,tenant=b.companyId||company(s,ownerId);fail(uuid(tenant)&&activeCompany(s,tenant)&&d.allowedCompanies(s,u).includes(tenant),'Empresa fora do escopo.',403)
 const departmentId=scope==='individual'?(dept(s,ownerId)||null):scope==='department'?b.departmentId||null:null
 if(scope==='company'){fail(admin(u),'OKR corporativo reservado à administração.',403);fail(!b.departmentId,'OKR corporativo não possui departamento.')}
 if(scope==='department'){fail(uuid(departmentId)&&activeDepartment(s,tenant,departmentId),'Departamento fora da empresa ou indisponível.',403);fail(admin(u)||managesDepartment(s,u,tenant,departmentId),'Departamento fora da sua gestão ou compartilhado.',403)}
 if(scope==='individual'){fail(ownerId&&person(s,ownerId),'Colaborador indisponível.',403);fail(!b.departmentId||b.departmentId===departmentId,'Colaborador não pertence ao departamento informado.',403);if(departmentId)fail(activeDepartment(s,tenant,departmentId),'Departamento indisponível.',403);if(!admin(u))fail(departmentId&&ownerId!==u.id&&team(s,u,ownerId,tenant),'Selecione um liderado de seu time com departamento cadastrado.',403)}
 if(ownerId){fail(uuid(ownerId)&&person(s,ownerId)&&company(s,ownerId)===tenant,'Responsável fora da empresa.',403);if(departmentId)fail(dept(s,ownerId)===departmentId,'Responsável fora do departamento.',403);if(!admin(u))fail(team(s,u,ownerId,tenant),'Responsável fora da sua liderança.',403)}
 return {scope,companyId:tenant,departmentId,ownerId}
}
function options(s,d,u){
 const isAdmin=admin(u),canConfigure=isAdmin||leader(u),allowed=new Set(d.allowedCompanies(s,u));if(!canConfigure)return {companies:[],departments:[],people:[],levels:[]}
 const companies=(s.organization?.companies||[]).filter(c=>allowed.has(c.id)&&(isAdmin||c.id===company(s,u.id))).map(c=>({id:c.id,name:c.name||c.id}))
 const cs=new Set(companies.map(c=>c.id)),departments=registry(s).filter(x=>cs.has(x.company_id)&&x.active!==0&&x.active!==false).map(x=>({id:x.id,name:x.name||x.id,companyId:x.company_id,canManage:isAdmin||managesDepartment(s,u,x.company_id,x.id)}))
 const people=s.users.filter(p=>p.active&&cs.has(company(s,p.id))&&(isAdmin||p.id!==u.id&&activeDepartment(s,company(s,p.id),dept(s,p.id))&&team(s,u,p.id,company(s,p.id)))).map(p=>({id:p.id,name:p.name,companyId:company(s,p.id),departmentId:dept(s,p.id)}))
 // List only departments actually relevant for assigning an OKR; no unrelated directory leakage.
 const visibleDepts=departments.filter(x=>x.canManage||people.some(p=>p.departmentId===x.id))
 const levels=[...(isAdmin&&companies.length?['company']:[]),...(visibleDepts.some(x=>x.canManage)?['department']:[]),...(people.length?['individual']:[])]
 return {companies,departments:visibleDepts,people,levels}
}
export function krProgress(k){const value=k.checkins.at(-1)?.value??k.baseline;return Math.round(Math.max(0,Math.min(1,(value-k.baseline)/(k.target-k.baseline)))*10000)/100}
export function objectiveProgress(o){const weight=o.results.reduce((n,k)=>n+k.weight,0);return weight?Math.round(o.results.reduce((n,k)=>n+krProgress(k)*k.weight,0)/weight*100)/100:null}
function metricTarget(o,scope,legacy){if(!scope.allCompanies.has(o.companyId)||scope.from&&o.endsOn<scope.from||scope.to&&o.startsOn>scope.to)return false;if(scope.person)return type(o)==='individual'&&o.ownerId===scope.person&&(!scope.department||((o.departmentId||dept(legacy||{},o.ownerId))===scope.department));if(scope.department)return type(o)==='department'?o.departmentId===scope.department:type(o)==='individual'&&(o.departmentId||dept(legacy||{},o.ownerId))===scope.department;return true}
export function okrMetrics(db,scope,legacy=null){
 const eligible=rows(db).filter(o=>metricTarget(o,scope,legacy)&&(legacy&&scope.okrActor&&scope.okrDomain?canView(legacy,scope.okrDomain,scope.okrActor,o):!legacy&&type(o)==='individual'&&scope.ids.has(o.ownerId)))
 const active=eligible.filter(o=>o.status==='active');return {objectives:eligible.length,active:active.length,closed:eligible.filter(o=>o.status==='closed').length,checkins:eligible.reduce((n,o)=>n+o.results.reduce((m,k)=>m+k.checkins.filter(c=>(!scope.from||c.businessDate>=scope.from)&&(!scope.to||c.businessDate<=scope.to)).length,0),0),average:active.length?Math.round(active.reduce((n,o)=>n+objectiveProgress(o),0)/active.length*100)/100:null}
}
function legacyVisible(s,d,u,r){if(admin(u))return true;const t=company(s,r.person);return !!t&&inTenant(s,d,u,t)&&!!person(s,r.person)&&(r.person===u.id||leader(u)&&team(s,u,r.person,t))}
function project(s,d,u,o){
 const manage=canManageOKR(s,d,u,o),owner=ownerValid(s,o),history=manage||owner&&o.ownerId===u.id
 const name=id=>s.users.find(p=>p.id===id)?.name||''
 return {id:o.id,title:o.title,scope:type(o),companyId:o.companyId,companyName:s.organization?.companies?.find(x=>x.id===o.companyId)?.name||'Empresa indisponível',
  departmentId:o.departmentId||null,departmentName:registry(s).find(x=>x.id===o.departmentId)?.name||'',ownerId:owner||admin(u)?o.ownerId:null,ownerName:owner||admin(u)?name(o.ownerId):'',
  startsOn:o.startsOn,endsOn:o.endsOn,status:o.status,revision:o.revision,progress:objectiveProgress(o),canManage:manage,
  canCheckin:canCheckin(s,d,u,o)&&day()>=o.startsOn&&day()<=o.endsOn,canRetarget:manage&&o.status!=='closed'&&o.results.every(k=>!k.checkins.length),
  ...(admin(u)?{audit:{createdAt:o.createdAt,createdBy:name(o.createdBy),publishedAt:o.publishedAt||null,closedAt:o.closedAt||null,closedBy:name(o.closedBy),closingNote:o.closingNote||'',scopeHistory:(o.scopeHistory||[]).map(x=>({...x,actorName:name(x.actorId)}))}}:{}),
  results:o.results.map(k=>({id:k.id,title:k.title,unit:k.unit,baseline:k.baseline,target:k.target,weight:k.weight,progress:krProgress(k),current:k.checkins.at(-1)?.value??k.baseline,checkinCount:k.checkins.length,canSeeHistory:history,
   checkins:history?k.checkins.map(({businessDate,value,note,at,actorId})=>({businessDate,value,note,at,...(admin(u)?{actorId,actorName:name(actorId)}:{})})):[]}))}
}
export function listOKR(db,s,d,u){const opts=options(s,d,u);return {items:rows(db).filter(o=>canView(s,d,u,o)).map(o=>project(s,d,u,o)),...opts,canCreate:opts.levels.length>0,legacy:(s.records||[]).filter(r=>r.kind==='OKR'&&legacyVisible(s,d,u,r)).map(r=>({id:r.id,title:r.title,ownerName:s.users.find(p=>p.id===r.person)?.name||'Pessoa indisponível',status:r.status,target:r.target,actual:r.actual,date:r.date,note:r.note}))}}
export function mutateOKR(db,s,d,u,action,b){
 fail(b&&typeof b==='object'&&!Array.isArray(b),'Dados inválidos.');db.okrsV13??=[]
 if(action==='create'){
  const selected=target(s,d,u,b);fail(validDate(b.startsOn)&&validDate(b.endsOn)&&b.startsOn<=b.endsOn,'Período inválido.');fail(uuid(b.requestId),'Identificador de requisição inválido.');const prior=rows(db).find(o=>o.requestId===b.requestId)
  if(prior){fail(prior.createdBy===u.id&&canManageOKR(s,d,u,prior)&&type(prior)===selected.scope&&prior.companyId===selected.companyId&&(prior.departmentId||null)===selected.departmentId&&(prior.ownerId||null)===selected.ownerId,'Requisição incompatível.',409);return {id:prior.id,revision:prior.revision,idempotent:true}}
  fail(rows(db).length<10000&&Array.isArray(b.results)&&b.results.length>=1&&b.results.length<=10,'Informe de 1 a 10 resultados-chave.');const results=b.results.map(k=>{const baseline=number(k.baseline),target=number(k.target),weight=number(k.weight);fail(target!==baseline&&weight>0&&weight<=100,'Meta deve diferir da base; peso entre 0 e 100.');return {id:randomUUID(),title:label(k.title,160),unit:label(k.unit,40),baseline,target,weight,checkins:[]}})
  const o={id:randomUUID(),requestId:b.requestId,title:label(b.title,160),...selected,startsOn:b.startsOn,endsOn:b.endsOn,results,status:'draft',revision:1,createdBy:u.id,createdAt:timestamp()};db.okrsV13.push(o);return {id:o.id,revision:o.revision}
 }
 const o=rows(db).find(x=>x.id===b.id);fail(o&&canView(s,d,u,o),'Objetivo indisponível.',403)
 if(action==='checkin'){fail(canCheckin(s,d,u,o)||o.status==='closed'&&canView(s,d,u,o)&&(canManageOKR(s,d,u,o)||ownerValid(s,o)&&o.ownerId===u.id),'Check-in não autorizado.',403);fail(uuid(b.requestId),'Identificador inválido.');const k=o.results.find(k=>k.id===b.resultId);fail(k,'Resultado-chave inexistente.',404);const prior=k.checkins.find(c=>c.requestId===b.requestId);if(prior){fail(prior.actorId===u.id,'Requisição incompatível.',409);return {id:o.id,revision:o.revision,progress:objectiveProgress(o),idempotent:true}}}
 fail(b.revision===o.revision,'Objetivo alterado. Atualize a página.',409)
 if(action==='publish'){fail(canManageOKR(s,d,u,o)&&o.status==='draft','Publicação não autorizada.',403);o.status='active';o.publishedAt=timestamp()}
 else if(action==='close'){fail(canManageOKR(s,d,u,o)&&o.status==='active','Encerramento não autorizado.',403);o.status='closed';o.closedAt=timestamp();o.closedBy=u.id;o.closingNote=label(b.note,500)}
 else if(action==='retarget'){fail(canManageOKR(s,d,u,o),'Alteração de escopo não autorizada.',403);fail(o.status!=='closed'&&o.results.every(k=>!k.checkins.length),'Objetivos com histórico ou encerrados não podem trocar de público.',409);const selected=target(s,d,u,b);(o.scopeHistory??=[]).push({scope:type(o),companyId:o.companyId,departmentId:o.departmentId||null,ownerId:o.ownerId||null,at:timestamp(),actorId:u.id});Object.assign(o,selected)}
 else if(action==='checkin'){fail(o.status==='active'&&day()>=o.startsOn&&day()<=o.endsOn,'Fora do período de check-in.',409);const k=o.results.find(k=>k.id===b.resultId);fail(k.checkins.length<500,'Limite de check-ins atingido.',409);k.checkins.push({requestId:b.requestId,value:number(b.value),note:label(b.note,500),actorId:u.id,at:timestamp(),businessDate:day()})}
 else fail(false,'Operação inexistente.',404)
 o.revision++;return {id:o.id,revision:o.revision,progress:objectiveProgress(o)}
}
/** Legacy records are read-only via public HTTP. Other modules/records keep their original policy. */
export async function guardLegacyOKR(req,ctx,fallback){
 const path=new URL(req.url).pathname
 if(path==='/api/record'&&req.method==='POST'){
  let b;try{b=await req.clone().json()}catch{return fallback(req)}
  if(b?.kind==='OKR')return new Response(JSON.stringify({error:'Use o módulo OKR para configurar objetivos. Registros antigos são somente leitura.'}),{status:403,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store'}})
 }
 const response=await fallback(req)
 if(path!=='/api/data'||req.method!=='GET'||!response.ok)return response
 const data=await response.clone().json();if(!Array.isArray(data.records)||!data.records.some(r=>r.kind==='OKR'))return response
 try{const state=await (await ctx.BUCKET.get('system/state-v1')).json(),u=resolveActor(req,state);data.records=data.records.filter(r=>r.kind!=='OKR'||legacyVisible(state,ctx.DOMAIN,u,r))}catch(e){return new Response(JSON.stringify({error:e.status?e.message:'Não foi possível validar o escopo.'}),{status:e.status||500,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store'}})}
 return new Response(JSON.stringify(data),{status:response.status,headers:response.headers})
}
