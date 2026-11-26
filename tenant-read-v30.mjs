/** V30.2A: isolated read-only pilot. No writes, no production activation.
 * Only the three reviewed legacy read routes are allowed. Authorization is bound
 * to the exact decorated state snapshot passed to the legacy handler.
 */
import {createHash} from 'node:crypto'
import {tenantContext,canManageLearning,canReadCourseMaterial} from './tenant-policy-v30.mjs'
const stateKey='system/state-v1'
const rows=x=>Array.isArray(x)?x:[]
const active=x=>x===true||x===1
const unique=(list,id)=>{const found=rows(list).filter(x=>x?.id===id);return found.length===1?found[0]:null}
const sha=x=>createHash('sha256').update(x).digest('hex')
const deny=(status=403)=>new Response(JSON.stringify({error:status===401?'Entre para continuar.':status===409?'Dados alterados. Atualize e tente novamente.':status===503?'Piloto indisponível.':'Recurso indisponível no piloto de isolamento.'}),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'private,no-store'}})
const fail=(status=403)=>{throw Object.assign(new Error('Tenant read denied'),{status})}
const check=(condition,status=403)=>{if(!condition)fail(status)}
export function pilotRoute(request){
 const p=new URL(request.url).pathname,m=request.method
 if(m==='GET'&&p==='/api/data')return {kind:'catalog'}
 const cover=p.match(/^\/cover\/(course|mission)\/([a-f0-9-]{36})$/)
 if(m==='GET'&&cover)return {kind:'cover',type:cover[1],id:cover[2]}
 const content=p.match(/^\/content\/([a-f0-9-]{36})\/(.+)$/)
 if(['GET','HEAD'].includes(m)&&content)return {kind:'content',id:content[1]}
 return null
}
function authenticUser(request,state){
 const identity=request.headers.get('oai-authenticated-user-id')||''
 const cookies=(request.headers.get('cookie')||'').match(/(?:^|; )learning=([^;]+)/g)||[]
 check(identity&&cookies.length===1,401)
 const token=cookies[0].split('learning=')[1];check(token&&token.length<=256,401)
 const digest=sha(token),sessions=rows(state.sessions).filter(s=>s.digest===digest&&s.identity===identity&&s.until>Date.now())
 check(sessions.length===1,401)
 const user=unique(state.users,sessions[0].person);check(user&&active(user.active),401)
 return user
}
function courseUsable(state,c,company){return Boolean(c&&unique(state.courses,c.id)===c&&c.tenantCompanyId===company)}
function enrollmentUsable(state,e,company){
 return Boolean(e&&unique(state.enroll,e.id)===e&&e.tenantCompanyId===company&&unique(state.users,e.person)&&state.organization.assignments.get(e.person)?.company_id===company&&courseUsable(state,unique(state.courses,e.course),company)&&(e.prerequisites===undefined||Array.isArray(e.prerequisites)&&e.prerequisites.every(id=>courseUsable(state,unique(state.courses,id),company))))
}
function missionUsable(state,m,company){return Boolean(m&&unique(state.missions,m.id)===m&&m.tenantCompanyId===company&&Array.isArray(m.courses)&&m.courses.length&&new Set(m.courses).size===m.courses.length&&m.courses.every(id=>courseUsable(state,unique(state.courses,id),company)))}
function ownEnrollment(state,user,course,company){const found=rows(state.enroll).filter(e=>e.person===user.id&&e.course===course.id);return found.length===1&&enrollmentUsable(state,found[0],company)?found[0]:null}
function uniqueMedia(state,key){
 if(typeof key!=='string'||!key)return false
 let count=0
 for(const c of rows(state.courses)){if(c.upload===key)count++;if(c.cover?.upload===key)count++}
 for(const m of rows(state.missions)){if(m.cover?.upload===key)count++;if(m.upload===key)count++}
 for(const u of rows(state.uploads))if(u.id===key)count++
 return count===1
}
function project(state,user,company){
 const ownPeople=rows(state.users).filter(p=>unique(state.users,p.id)===p&&state.organization.assignments.get(p.id)?.company_id===company)
 const people=new Set(ownPeople.map(p=>p.id))
 const courses=rows(state.courses).filter(c=>courseUsable(state,c,company))
 const courseIds=new Set(courses.map(c=>c.id))
 const missions=rows(state.missions).filter(m=>missionUsable(state,m,company));const missionIds=new Set(missions.map(m=>m.id))
 const enroll=rows(state.enroll).filter(e=>enrollmentUsable(state,e,company)&&people.has(e.person)&&(!e.originMission||missionIds.has(e.originMission)))
 // A malformed duplicate pair must not become a valid enrollment by filtering.
 const safeEnroll=enroll.filter(e=>rows(state.enroll).filter(x=>x.person===e.person&&x.course===e.course).length===1)
 const snapshot={...state,users:ownPeople,courses,missions,enroll:safeEnroll,missionEnrollments:rows(state.missionEnrollments).filter(e=>unique(state.missionEnrollments,e.id)===e&&e.tenantCompanyId===company&&people.has(e.person)&&missionIds.has(e.mission)&&rows(state.missionEnrollments).filter(x=>x.person===e.person&&x.mission===e.mission).length===1),records:rows(state.records).filter(r=>people.has(r.person)&&(!r.course||courseIds.has(r.course))&&(!r.author||people.has(r.author))),uploads:rows(state.uploads).filter(u=>u.tenantCompanyId===company&&people.has(u.owner)),pulses:rows(state.pulses).filter(p=>Array.isArray(p.people)&&p.people.every(id=>people.has(id))),logs:[]}
 Object.defineProperty(snapshot,'organization',{value:{...state.organization,companies:state.organization.companies.filter(c=>c.id===company),assignments:new Map([...state.organization.assignments].filter(([p])=>people.has(p))),grants:[],departments:rows(state.organization.departments).filter(d=>d.company_id===company),units:rows(state.organization.units).filter(d=>d.company_id===company)},configurable:true})
 return snapshot
}
function coverAllowed(state,user,company,route){
 const item=unique(route.type==='course'?state.courses:state.missions,route.id)
 if(!item?.cover||!uniqueMedia(state,item.cover.upload))return false
 if(route.type==='course')return courseUsable(state,item,company)&&(canManageLearning(state,user.id,company,item)||((item.status||'published')!=='draft'&&['published','archived'].includes(item.status||'published')&&!!ownEnrollment(state,user,item,company)))
 if(!missionUsable(state,item,company))return false
 return canManageLearning(state,user.id,company,item)||item.courses.every(id=>{const c=unique(state.courses,id);return c&&['published','archived'].includes(c.status||'published')&&!!ownEnrollment(state,user,c,company)})
}
function contentAllowed(state,user,company,route){
 const c=unique(state.courses,route.id);if(!courseUsable(state,c,company)||c.type==='SCORM'||!uniqueMedia(state,c.upload))return false
 const found=rows(state.enroll).filter(e=>e.person===user.id&&e.course===c.id),e=ownEnrollment(state,user,c,company)
 if(found.length&&!e)return false
 return canReadCourseMaterial(state,user.id,company,c,e?.id)
}
function catalogOutput(data,original,scoped,user,company){
 check(data&&typeof data==='object'&&Array.isArray(data.courses)&&Array.isArray(data.missions)&&Array.isArray(data.enroll)&&Array.isArray(data.missionEnrollments),503)
 const courses=new Map(scoped.courses.map(c=>[c.id,c]));const missions=new Set(scoped.missions.map(m=>m.id));const enroll=new Set(scoped.enroll.map(e=>e.id));const me=new Set(scoped.missionEnrollments.map(e=>e.id))
 // Preserve legacy visibility (including enrolled archived courses) but never allow metadata from a foreign item.
 data.courses=data.courses.filter(c=>courses.has(c.id)).map(c=>{
  const real=courses.get(c.id),manager=canManageLearning(original,user.id,company,real),e=ownEnrollment(original,user,real,company)
  const authorized=manager||!!e&&canReadCourseMaterial(original,user.id,company,real,e.id)
  const safe={...c};delete safe.answer;if(!authorized)for(const key of ['body','url','options','entry','upload','answer','history'])delete safe[key]
  if(real.upload&&!uniqueMedia(original,real.upload)){for(const key of ['entry','upload'])delete safe[key]}
  if(real.cover&&!uniqueMedia(original,real.cover.upload))delete safe.cover
  return safe
 })
 data.missions=data.missions.filter(m=>missions.has(m.id)).map(m=>{const real=unique(scoped.missions,m.id);const safe={...m};if(real?.cover&&!uniqueMedia(original,real.cover.upload))delete safe.cover;return safe})
 data.enroll=data.enroll.filter(e=>enroll.has(e.id));data.missionEnrollments=data.missionEnrollments.filter(e=>me.has(e.id))
 return data
}
function signature(raw,state){const rev=state.organization?.revision;check(typeof raw.etag==='string'&&raw.etag&&typeof rev==='string'&&rev.length>0,503);return [raw.etag,rev]}
/** handler receives the same scoped context for both guardLegacyOKR and app.fetch.
 * The read adapter denies any attempted write and limits object keys to approved media.
 */
export async function pilotRead(request,ctx,handler,{corporateAlias=false}={}){
 try{
  const route=pilotRoute(request);check(route,403)
  const raw=await ctx.BUCKET.get(stateKey);check(raw,401)
  const state=await raw.json(),before=signature(raw,state),user=authenticUser(request,state)
  const url=new URL(request.url),companyParams=url.searchParams.getAll('company');check(companyParams.length<=1)
  const tc=tenantContext(state,user.id,companyParams.length?companyParams[0]:undefined);check(tc)
  const company=tc.company,scoped=project(state,user,company);let exactKey=null
  if(route.kind==='cover'){check(coverAllowed(state,user,company,route));const item=unique(route.type==='course'?state.courses:state.missions,route.id);exactKey='files/'+item.cover.upload+'/'+item.cover.entry}
  if(route.kind==='content'){check(contentAllowed(state,user,company,route));const item=unique(state.courses,route.id);const name=url.pathname.split('/').slice(3).map(decodeURIComponent).join('/');check(name.length<350&&!name.startsWith('/')&&!name.includes('\\')&&!name.includes(':')&&name.split('/').every(t=>t&&t!=='.'&&t!=='..'&&!/[\u0000-\u001f?#]/.test(t)));if(item.tenantMediaV30===true)check(name===item.entry);exactKey='files/'+item.upload+'/'+name}
  if(route.kind==='catalog')url.searchParams.set('company',company)
  // Only the already-authorized binary/cover handler receives this scoped compatibility alias.
  if(corporateAlias&&route.kind!=='catalog'&&user.role==='Administrador corporativo')scoped.users=scoped.users.map(x=>x.id===user.id?{...x,role:'RH/DHO'}:x)
  const pinned={etag:raw.etag,json:async()=>scoped}
  const readBucket={async get(key){if(key===stateKey)return pinned;check(typeof key==='string'&&key===exactKey);return ctx.BUCKET.get(key)},async put(){fail()},async delete(){fail()}}
  const scopedContext={...ctx,BUCKET:readBucket}
  const result=await handler(new Request(url,{method:request.method,headers:request.headers}),scopedContext)
  check(result instanceof Response,503)
  // Recheck state and organizational revision before returning content. This does not revoke bytes already sent.
  const afterRaw=await ctx.BUCKET.get(stateKey);check(afterRaw,409);const after=signature(afterRaw,await afterRaw.json());if(before[0]!==after[0]||before[1]!==after[1]){await result.body?.cancel().catch(()=>{});return deny(409)}
  if(result.status===416&&route.kind==='content'){const range=result.headers.get('content-range');await result.body?.cancel().catch(()=>{});return new Response(null,{status:416,headers:{'cache-control':'private,no-store',...(range&&/^bytes \*\/\d+$/.test(range)?{'content-range':range}:{})}})}
  if(!result.ok){await result.body?.cancel().catch(()=>{});return deny(result.status===404?404:result.status===401?401:result.status===403?403:503)}
  const headers=new Headers(result.headers);headers.set('cache-control','private,no-store')
  if(route.kind==='catalog'){const data=catalogOutput(await result.json(),state,scoped,user,company);headers.delete('content-length');headers.delete('etag');return new Response(JSON.stringify(data),{status:result.status,headers})}
  return new Response(result.body,{status:result.status,headers})
 }catch(e){return deny([401,403,404,409,503].includes(e?.status)?e.status:503)}
}
