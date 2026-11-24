/** OKR aggregate stored in the existing LXP transaction, not a second people registry. */
import {randomUUID} from 'node:crypto'
const fail=(ok,msg,status=400)=>{if(!ok)throw Object.assign(new Error(msg),{status})}
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const timestamp=()=>new Date().toISOString()
const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x
const label=(v,max)=>{fail(typeof v==='string'&&v.trim()&&v.trim().length<=max,'Confira os campos de texto.');return v.trim()}
const number=v=>{fail(typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e12,'Valor numérico inválido.');return v}
const uuid=v=>typeof v==='string'&&/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(v)
const rows=s=>s.okrsV13||[]
const company=(s,id)=>s.organization?.assignments?.get(id)?.company_id
const person=(s,id)=>s.users.find(u=>u.id===id&&u.active)
const manages=u=>['Administrador','RH/DHO'].includes(u.role)
function team(s,actor,id,tenant){const seen=new Set();let p=person(s,id);while(p&&!seen.has(p.id)&&company(s,p.id)===tenant){if(p.id===actor.id)return true;seen.add(p.id);p=person(s,p.manager)}return false}
function access(s,d,u,o){return d.allowedCompanies(s,u).includes(o.companyId)&&company(s,o.ownerId)===o.companyId&&!!person(s,o.ownerId)&&(manages(u)||u.id===o.ownerId||u.role==='Líder'&&team(s,u,o.ownerId,o.companyId))}
const canManage=(s,d,u,o)=>access(s,d,u,o)&&(manages(u)||u.role==='Líder')
export function krProgress(k){const value=k.checkins.at(-1)?.value??k.baseline;return Math.round(Math.max(0,Math.min(1,(value-k.baseline)/(k.target-k.baseline)))*10000)/100}
export function objectiveProgress(o){const weight=o.results.reduce((n,k)=>n+k.weight,0);return weight?Math.round(o.results.reduce((n,k)=>n+krProgress(k)*k.weight,0)/weight*100)/100:null}
export function okrMetrics(db,scope,legacy=null){const eligible=rows(db).filter(o=>(!legacy||company(legacy,o.ownerId)===o.companyId)&&scope.ids.has(o.ownerId)&&scope.allCompanies.has(o.companyId)&&(!scope.from||o.endsOn>=scope.from)&&(!scope.to||o.startsOn<=scope.to));const active=eligible.filter(o=>o.status==='active');return {objectives:eligible.length,active:active.length,closed:eligible.filter(o=>o.status==='closed').length,checkins:eligible.reduce((n,o)=>n+o.results.reduce((m,k)=>m+k.checkins.filter(c=>(!scope.from||c.businessDate>=scope.from)&&(!scope.to||c.businessDate<=scope.to)).length,0),0),average:active.length?Math.round(active.reduce((n,o)=>n+objectiveProgress(o),0)/active.length*100)/100:null}}
export function listOKR(db,s,d,u){return {items:rows(db).filter(o=>access(s,d,u,o)&&(o.status!=='draft'||canManage(s,d,u,o))).map(o=>({...o,ownerName:person(s,o.ownerId).name,progress:objectiveProgress(o),canManage:canManage(s,d,u,o),results:o.results.map(k=>({...k,progress:krProgress(k)}))})),people:s.users.filter(p=>p.active&&company(s,p.id)&&canManage(s,d,u,{ownerId:p.id,companyId:company(s,p.id)})).map(p=>({id:p.id,name:p.name})),canCreate:manages(u)||u.role==='Líder'}}
export function mutateOKR(db,s,d,u,action,b){
 fail(b&&typeof b==='object'&&!Array.isArray(b),'Dados inválidos.');db.okrsV13??=[]
 if(action==='create'){
  const tenant=company(s,b.ownerId);fail(tenant&&canManage(s,d,u,{companyId:tenant,ownerId:b.ownerId}),'Responsável fora do escopo.',403)
  fail(validDate(b.startsOn)&&validDate(b.endsOn)&&b.startsOn<=b.endsOn,'Período inválido.');fail(uuid(b.requestId),'Identificador de requisição inválido.');const prior=rows(db).find(o=>o.requestId===b.requestId);if(prior){fail(prior.createdBy===u.id&&prior.ownerId===b.ownerId,'Requisição incompatível.',409);return {id:prior.id,revision:prior.revision,idempotent:true}}
  fail(rows(db).length<10000&&Array.isArray(b.results)&&b.results.length>=1&&b.results.length<=10,'Informe de 1 a 10 resultados-chave.');const results=b.results.map(k=>{const baseline=number(k.baseline),target=number(k.target),weight=number(k.weight);fail(target!==baseline&&weight>0&&weight<=100,'Meta deve diferir da base; peso entre 0 e 100.');return {id:randomUUID(),title:label(k.title,160),unit:label(k.unit,40),baseline,target,weight,checkins:[]}})
  const o={id:randomUUID(),requestId:b.requestId,title:label(b.title,160),ownerId:b.ownerId,companyId:tenant,startsOn:b.startsOn,endsOn:b.endsOn,results,status:'draft',revision:1,createdBy:u.id,createdAt:timestamp()};db.okrsV13.push(o);return {id:o.id,revision:o.revision}
 }
 const o=rows(db).find(x=>x.id===b.id);fail(o&&access(s,d,u,o),'Objetivo indisponível.',403)
 if(action==='checkin'){fail(uuid(b.requestId),'Identificador inválido.');const k=o.results.find(k=>k.id===b.resultId);fail(k,'Resultado-chave inexistente.',404);const prior=k.checkins.find(c=>c.requestId===b.requestId);if(prior){fail(prior.actorId===u.id,'Requisição incompatível.',409);return {id:o.id,revision:o.revision,progress:objectiveProgress(o),idempotent:true}}}
 fail(b.revision===o.revision,'Objetivo alterado. Atualize a página.',409)
 if(action==='publish'){fail(canManage(s,d,u,o)&&o.status==='draft','Publicação não autorizada.',403);o.status='active';o.publishedAt=timestamp()}
 else if(action==='close'){fail(canManage(s,d,u,o)&&o.status==='active','Encerramento não autorizado.',403);o.status='closed';o.closedAt=timestamp();o.closedBy=u.id;o.closingNote=label(b.note,500)}
 else if(action==='checkin'){
  fail(o.status==='active'&&day()>=o.startsOn&&day()<=o.endsOn,'Fora do período de check-in.',409);const k=o.results.find(k=>k.id===b.resultId);fail(k.checkins.length<500,'Limite de check-ins atingido.',409);k.checkins.push({requestId:b.requestId,value:number(b.value),note:label(b.note,500),actorId:u.id,at:timestamp(),businessDate:day()})
 }else fail(false,'Operação inexistente.',404)
 o.revision++;return {id:o.id,revision:o.revision,progress:objectiveProgress(o)}
}
