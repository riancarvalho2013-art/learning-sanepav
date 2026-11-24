// Organograma: projeção de leitura, sem nova fonte de verdade ou ampliação das permissões de RH.
import {createHash} from 'node:crypto'
const ROUTE='/api/orgchart/v9'
const list=x=>Array.isArray(x)?x:[]
const fail=(condition,message,status=400)=>{if(!condition)throw Object.assign(new Error(message),{status})}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff','vary':'Cookie'}})
export const canViewChart=user=>Boolean(user?.active&&['Administrador','Líder'].includes(user.role))
const label=x=>typeof x==='string'?x:''
const byName=(a,b)=>a.name.localeCompare(b.name,'pt-BR')||a.id.localeCompare(b.id)

// Only active people with a valid active company; unassigned accounts are a separate admin-only group.
// The chart directory is intentionally company-wide for leaders, not a grant to other APIs.
export function projectChart(state,user,registry,allowedCompanyIds,selected=''){
 fail(canViewChart(user),'Organograma reservado a administradores e líderes.',403)
 const org=state.organization
 fail(org?.assignments instanceof Map,'Estrutura organizacional indisponível.',503)
 const permitted=new Set(allowedCompanyIds)
 if(user.role==='Líder'){
  const own=org.assignments.get(user.id)?.company_id
  for(const id of permitted)if(id!==own)permitted.delete(id)
 }
 fail(!selected||permitted.has(selected),'Empresa fora do seu escopo.',403)
 const companies=list(registry.companies).filter(c=>permitted.has(c.id)&&(!selected||c.id===selected)&&c.active!==0).map(c=>({id:c.id,name:label(c.name)})).sort(byName)
 const companyIds=new Set(companies.map(c=>c.id))
 fail(!selected||companyIds.has(selected),'Empresa indisponível.',403)
 const entries=(rows)=>list(rows).filter(r=>companyIds.has(r.company_id)&&r.active!==0).map(r=>({id:r.id,companyId:r.company_id,name:label(r.name)})).sort(byName)
 const departments=entries(registry.departments),units=entries(registry.units)
 const departmentCompany=new Map(departments.map(x=>[x.id,x.companyId])),unitCompany=new Map(units.map(x=>[x.id,x.companyId]))
 const people=[]
 for(const p of list(state.users)){
  if(!p.active)continue
  const a=org.assignments.get(p.id),companyId=a?.company_id||null
  if(companyId?!companyIds.has(companyId):user.role!=='Administrador'||Boolean(selected))continue
  people.push({id:p.id,name:label(p.name),position:label(a?.position)||'Cargo não informado',companyId,
   departmentId:companyId&&departmentCompany.get(a?.department_id)===companyId?a.department_id:null,
   unitId:companyId&&unitCompany.get(a?.unit_id)===companyId?a.unit_id:null,
   managerId:label(p.manager)||null})
 }
 const index=new Map(people.map(p=>[p.id,p]))
 for(const p of people){
  const m=index.get(p.managerId)
  // Never expose an ID/name of a hidden, inactive or foreign-company manager.
  p.managerStatus=!p.managerId?'not_assigned':m&&m.id!==p.id&&m.companyId===p.companyId&&p.companyId?'linked':'unavailable'
  if(p.managerStatus!=='linked')p.managerId=null
 }
 // Defensive cycle handling for legacy/corrupted data: break one edge in each cycle.
 // Do not pretend this is an authoritative correction to the source records.
 const resolved=new Set()
 for(const p of people){
  const seen=new Set();let current=p
  while(current&&!resolved.has(current.id)){
   if(seen.has(current.id)){current.managerId=null;current.managerStatus='cycle';break}
   seen.add(current.id);current=index.get(current.managerId)
  }
  for(const id of seen)resolved.add(id)
 }
 people.sort(byName)
 const direct=new Map();for(const p of people)if(p.managerId)direct.set(p.managerId,(direct.get(p.managerId)||0)+1)
 for(const p of people)p.directReports=direct.get(p.id)||0
 return {version:1,scope:user.role==='Administrador'?'administration':'company_directory',selectedCompany:selected||null,
  companies,departments,units,people,counts:{companies:companies.length,departments:departments.length,people:people.length,managers:people.filter(p=>p.directReports>0).length,unassigned:people.filter(p=>!p.companyId).length,withoutDepartment:people.filter(p=>!p.departmentId).length},
  generatedAt:new Date().toISOString()}
}

export async function handleOrganizationChart(req,{BUCKET,DOMAIN}){
 const url=new URL(req.url)
 if(url.pathname!==ROUTE)return null
 try{
  fail(req.method==='GET','Método não permitido.',405)
  const stored=await BUCKET.get('system/state-v1')
  fail(stored,'Entre no Learning para continuar.',401)
  const state=await stored.json()
  const token=(req.headers.get('cookie')||'').match(/(?:^|;\s*)learning=([^;]+)/)?.[1]||''
  fail(token,'Entre no Learning para continuar.',401)
  const digest=createHash('sha256').update(token).digest('hex'),identity=req.headers.get('oai-authenticated-user-id')||''
  fail(identity,'Acesse pelo endereço privado da plataforma.',401)
  const session=list(state.sessions).find(s=>s.digest===digest&&s.identity===identity&&s.until>Date.now())
  const user=list(state.users).find(p=>p.id===session?.person&&p.active)
  fail(user,'Entre no Learning para continuar.',401)
  fail(canViewChart(user),'Organograma reservado a administradores e líderes.',403)
  const allowed=DOMAIN.allowedCompanies(state,user),selected=url.searchParams.get('company')||''
  fail(!selected||allowed.includes(selected),'Empresa fora do seu escopo.',403)
  // Reuse the domain's authenticated organization registry (including empty departments).
  // Its people records are NOT sent to the client; the chart uses its own minimal projection.
  const registryUrl=new URL('/api/v2/organization',url)
  const response=await DOMAIN.handle(new Request(registryUrl,{headers:req.headers}),{digest,identity})
  fail(response.ok,'Não foi possível consultar a estrutura organizacional.',response.status>=400&&response.status<500?response.status:503)
  const registry=await response.json()
  // Re-read after the registry request: a revoked session or transferred leader must not use stale scope.
  const latest=await BUCKET.get('system/state-v1');fail(latest,'Estrutura indisponível.',503)
  const current=await latest.json(),freshSession=list(current.sessions).find(s=>s.digest===digest&&s.identity===identity&&s.until>Date.now())
  const freshUser=list(current.users).find(p=>p.id===freshSession?.person&&p.active)
  fail(freshUser,'Entre no Learning para continuar.',401)
  fail(canViewChart(freshUser),'Organograma reservado a administradores e líderes.',403)
  const currentAllowed=DOMAIN.allowedCompanies(current,freshUser)
  fail(allowed.length===currentAllowed.length&&allowed.every(id=>currentAllowed.includes(id))&&user.id===freshUser.id&&user.role===freshUser.role,'O escopo mudou. Atualize a página.',409)
  return json(projectChart(current,freshUser,registry,currentAllowed,selected))
 }catch(e){const status=Number.isInteger(e.status)&&e.status>=400&&e.status<500?e.status:503;return json({error:status===503?'Não foi possível carregar o organograma. Tente novamente.':e.message},status)}
}
