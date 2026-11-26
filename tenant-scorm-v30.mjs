/** V30.2C1/C2: SCORM fixture pilot. Never publishes packages or confirms completion.
 * C2 adds optional synthetic-only resume checkpoints; completion and scores remain blocked.
 * The underlying runtime is pinned to a scoped state + verified package manifest.
 */
import {createHash,timingSafeEqual} from 'node:crypto'
import {validateCommitInput,guardedScormCommit} from './tenant-completion-v30.mjs'
import {tenantContext,canReadCourseMaterial,canManageLearning} from './tenant-policy-v30.mjs'
const STATE='system/state-v1', TTL=30*60_000, ABS=8*60*60_000, MAX=600
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i, TOKEN=/^[A-Za-z0-9_-]{40,64}$/
const hash=x=>createHash('sha256').update(x).digest('hex'), rows=x=>Array.isArray(x)?x:[]
const unique=(list,id)=>{const found=rows(list).filter(x=>x?.id===id);return found.length===1?found[0]:null}
const check=(v,status=403)=>{if(!v)throw Object.assign(new Error('SCORM pilot denied'),{status})}
const deny=(status=403)=>Response.json({error:status===401?'Entre para continuar.':status===409?'Dados alterados. Reabra a aula.':'Recurso SCORM indisponível no piloto.'},{status,headers:{'cache-control':'private,no-store','referrer-policy':'no-referrer'}})
const safePath=p=>typeof p==='string'&&p.length>0&&p.length<=350&&!/[\\:\u0000-\u001f?#]/.test(p)&&p.split('/').every(s=>s&&s!=='.'&&s!=='..')
function binding(req){const cookies=(req.headers.get('cookie')||'').match(/(?:^|;\s*)learning=([^;]+)/g)||[];const identity=req.headers.get('oai-authenticated-user-id');check(identity&&cookies.length===1,401);const token=cookies[0].split('learning=')[1];check(token&&token.length<=256,401);return {identity,digest:hash(token)}}
function actor(state,b){const sessions=rows(state.sessions).filter(s=>s.identity===b.identity&&s.digest===b.digest&&s.until>Date.now());check(sessions.length===1,401);const u=unique(state.users,sessions[0].person);check(u&&(u.active===true||u.active===1),401);return u}
function exclusive(state,upload){let n=0;for(const c of rows(state.courses)){if(c.upload===upload)n++;if(c.cover?.upload===upload)n++}for(const m of rows(state.missions)){if(m.upload===upload)n++;if(m.cover?.upload===upload)n++}for(const u of rows(state.uploads))if(u.id===upload)n++;for(const l of rows(state.tenantMediaV30))if(l.id===upload)n++;return n===1}
function manifest(course){
 const m=course.tenantScormV30;check(m?.fixtureOnly===true&&Array.isArray(m.files)&&m.files.length>0&&m.files.length<=256)
 const files=new Map();let total=0
 for(const f of m.files){check(safePath(f.path)&&!files.has(f.path)&&/^[a-f0-9]{64}$/.test(f.sha256)&&Number.isSafeInteger(f.bytes)&&f.bytes>0&&f.bytes<=4*1024*1024);total+=f.bytes;files.set(f.path,{sha256:f.sha256,bytes:f.bytes})}
 check(total<=32*1024*1024&&safePath(course.entry)&&/\.html?$/i.test(course.entry)&&files.has(course.entry));return {files,fingerprint:hash(JSON.stringify([...files].sort(([a],[b])=>a.localeCompare(b))))}
}
function authorize(state,b,courseId,enrollmentId,company){
 const user=actor(state,b),tc=tenantContext(state,user.id,company);check(tc);const c=unique(state.courses,courseId)
 check(c&&c.type==='SCORM'&&c.tenantCompanyId===tc.company&&UUID.test(c.upload||'')&&exclusive(state,c.upload)&&['draft','published','archived'].includes(c.status||'published'))
 const e=enrollmentId?unique(state.enroll,enrollmentId):null
 if(enrollmentId){check(e&&rows(state.enroll).filter(x=>x.person===user.id&&x.course===c.id).length===1&&canReadCourseMaterial(state,user.id,tc.company,c,e.id));for(const p of rows(e.prerequisites))check(rows(state.enroll).filter(x=>x.person===user.id&&x.course===p).length===1)}
 else check(canManageLearning(state,user.id,tc.company,c))
 return {user,company:tc.company,course:c,enrollment:e,...manifest(c)}
}
function signature(raw,state){check(typeof raw?.etag==='string'&&raw.etag&&typeof state?.organization?.revision==='string'&&state.organization.revision,503);return raw.etag+'\0'+state.organization.revision}
function scoped(state,a,b){const ids=new Set([a.course.id,...rows(a.enrollment?.prerequisites)]);const own={users:[!a.enrollment&&a.user.role==='Administrador corporativo'?{...a.user,role:'RH/DHO'}:a.user],sessions:rows(state.sessions).filter(s=>s.person===a.user.id&&s.identity===b.identity&&s.digest===b.digest),courses:rows(state.courses).filter(c=>ids.has(c.id)&&c.tenantCompanyId===a.company),enroll:rows(state.enroll).filter(e=>e.person===a.user.id&&ids.has(e.course)&&e.tenantCompanyId===a.company)};return own}
export function isScormPilotRoute(req){const p=new URL(req.url).pathname;return p.startsWith('/api/scorm/v3/')||p.startsWith('/scorm/v3/')}
export function createTenantScormPilot(runtime,{clock=Date.now,checkpoints=false,completion=false}={}){
 const tickets=new Map();
 return async function pilot(request,ctx){let result,ticket,token,issued=false,locked=false
 try{
  const url=new URL(request.url),p=url.pathname,m=request.method;check(isScormPilotRoute(request));
  for(const [t,s] of tickets)if(s.expires<=clock()||s.absolute<=clock())tickets.delete(t)
  // Advanced mode delegates only to the original runtime, never to a global route.
  if(completion&&p==='/api/scorm/v3/commit'&&m==='POST'){
   check(request.headers.get('origin')===url.origin&&request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()==='application/json'&&!url.searchParams.size,400)
   let input;try{input=await request.clone().json()}catch{check(false,400)}validateCommitInput(input);token=input.token;check(TOKEN.test(token||''));ticket=tickets.get(token);check(ticket&&ticket.enrollment&&!ticket.busy);const b=binding(request);check(b.identity===ticket.binding.identity&&b.digest===ticket.binding.digest&&input.id===ticket.enrollment&&typeof input.key==='string'&&typeof ticket.key==='string'&&Buffer.byteLength(input.key)===Buffer.byteLength(ticket.key)&&timingSafeEqual(Buffer.from(input.key),Buffer.from(ticket.key)));ticket.busy=true;locked=true
   const raw=await ctx.BUCKET.get(STATE);check(raw,401);const state=await raw.json(),before=signature(raw,state),a=authorize(state,b,ticket.course,ticket.enrollment,ticket.company)
   const valid=()=>check(a.user.id===ticket.user&&a.user.role===ticket.role&&a.course.upload===ticket.upload&&(a.course.revision||0)===ticket.revision&&a.fingerprint===ticket.fingerprint&&ticket.expires>clock()&&ticket.absolute>clock()&&tickets.get(token)===ticket)
   valid();const revalidate=async()=>{valid();const latest=await ctx.BUCKET.get(STATE);check(latest&&signature(latest,await latest.json())===before,409);actor(state,b)}
   result=await guardedScormCommit({runtime,request,ctx,raw,state,access:a,revalidate});if(result.ok)ticket.expires=Math.min(clock()+TTL,ticket.absolute);const headers=new Headers(result.headers);headers.set('cache-control','private,no-store');headers.set('referrer-policy','no-referrer');return new Response(result.body,{status:result.status,headers})
  }
  // CMI and other writes intentionally unavailable: no legacy mutation fallback.
  const checkpoint=checkpoints&&p==='/api/scorm/v3/checkpoint'&&m==='POST';
  if(checkpoint){
   check(request.headers.get('origin')===url.origin);check(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()==='application/json',400);check(!url.searchParams.size,400);
   const reader=request.body?.getReader();check(reader,400);const chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>262144){await reader.cancel();check(false,400)}chunks.push(Buffer.from(value))}}finally{reader.releaseLock()}
   let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{check(false,400)}
   check(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(k=>['token','key','id','revision','cmi'].includes(k)),400);token=input.token;check(TOKEN.test(token||''));const found=tickets.get(token);check(found&&found.enrollment);const b=binding(request);check(b.identity===found.binding.identity&&b.digest===found.binding.digest);check(typeof input.key==='string'&&typeof found.key==='string'&&Buffer.byteLength(input.key)===Buffer.byteLength(found.key)&&timingSafeEqual(Buffer.from(input.key),Buffer.from(found.key)));check(input.id===found.enrollment&&Number.isSafeInteger(input.revision)&&input.revision>=0,400);check(!found.busy,409);ticket=found;ticket.busy=true;locked=true;
   const raw=await ctx.BUCKET.get(STATE);check(raw,401);const state=await raw.json();signature(raw,state);const a=authorize(state,b,found.course,found.enrollment,found.company);check(a.user.id===found.user&&a.user.role===found.role&&a.course.upload===found.upload&&(a.course.revision||0)===found.revision&&a.fingerprint===found.fingerprint);check(found.expires>clock()&&found.absolute>clock());const e=a.enrollment;check(e&&Number.isFinite(e.progress)&&e.progress>=0&&e.progress<100);const current=e.tenantCheckpointV30?.revision??0;check(Number.isSafeInteger(current)&&current<Number.MAX_SAFE_INTEGER&&input.revision===current,409);
   const cmi=input.cmi;check(cmi&&typeof cmi==='object'&&!Array.isArray(cmi)&&Object.keys(cmi).length>=1&&Object.keys(cmi).every(k=>['cmi.suspend_data','cmi.location','cmi.core.lesson_location'].includes(k)),400);for(const [k,v] of Object.entries(cmi))check(typeof v==='string'&&v.length<=(k==='cmi.suspend_data'?64000:4000),400);check(e.cmi===undefined||e.cmi&&typeof e.cmi==='object'&&!Array.isArray(e.cmi),409);const merged={...e.cmi,...cmi};check(Buffer.byteLength(JSON.stringify(merged))<=90000,400);
   const candidate=structuredClone(state);delete candidate.organization;const target=unique(candidate.enroll,e.id);check(target,409);target.cmi=merged;target.tenantCheckpointV30={revision:current+1,at:new Date().toISOString(),courseRevision:found.revision};actor(state,b);check(found.expires>clock()&&found.absolute>clock());const saved=await ctx.BUCKET.put(STATE,JSON.stringify(candidate),{onlyIf:{etagMatches:raw.etag},requireStateEtag:raw.etag,requireOrganizationRevision:state.organization.revision});check(saved,409);found.expires=Math.min(clock()+TTL,found.absolute);return Response.json({ok:true,revision:current+1,progress:e.progress,completionEnabled:false},{headers:{'cache-control':'private,no-store','referrer-policy':'no-referrer'}})
  }
  check(['GET','HEAD','OPTIONS'].includes(m));
  const launch=p==='/api/scorm/v3/launch',keep=p==='/api/scorm/v3/keepalive',diag=p==='/api/scorm/v3/diagnostics',asset=p.startsWith('/scorm/v3/');check(asset||((launch||keep||diag)&&m==='GET'))
  for(const name of ['company','course','enrollment','token','sco'])check(url.searchParams.getAll(name).length<=1)
  let b,courseId,enrollmentId,requestedCompany=url.searchParams.has('company')?url.searchParams.get('company'):undefined,filename
  const raw=await ctx.BUCKET.get(STATE);check(raw,401);const state=await raw.json(),before=signature(raw,state)
  if(asset||keep){
   if(asset){const parts=p.slice('/scorm/v3/'.length).split('/');token=parts.shift();check(!parts.some(x=>/%2f|%5c/i.test(x)));filename=parts.map(decodeURIComponent).join('/');check(safePath(filename))}else token=url.searchParams.get('token')
   check(TOKEN.test(token||''));ticket=tickets.get(token);check(ticket);b=ticket.binding;courseId=ticket.course;enrollmentId=ticket.enrollment
   check(requestedCompany===undefined||requestedCompany===ticket.company);requestedCompany=ticket.company
   // Sandboxed iframe assets may lack cookies. A supplied cookie must still match the launch login.
   if(keep||request.headers.has('cookie')){const supplied=binding(request);check(supplied.identity===b.identity&&supplied.digest===b.digest)}
  }else{
   b=binding(request);const u=actor(state,b);enrollmentId=url.searchParams.get('enrollment')||'';courseId=url.searchParams.get('course')||''
   if(enrollmentId){check(!diag&&UUID.test(enrollmentId));const e=unique(state.enroll,enrollmentId);check(e&&e.person===u.id&&(!courseId||courseId===e.course));courseId=e.course}
   check(UUID.test(courseId));if(diag)check(!enrollmentId)
  }
  const a=authorize(state,b,courseId,enrollmentId,requestedCompany),revision=a.course.revision||0
  if(ticket)check(a.user.id===ticket.user&&a.user.role===ticket.role&&a.course.upload===ticket.upload&&revision===ticket.revision&&a.fingerprint===ticket.fingerprint)
  if(asset)check(a.files.has(filename),404)
  const prefix='files/'+a.course.upload+'/',pinned=scoped(state,a,b)
  const bucket={async get(key){if(key===STATE)return {etag:raw.etag,json:async()=>structuredClone(pinned)};check(typeof key==='string'&&key.startsWith(prefix));const name=key.slice(prefix.length),f=a.files.get(name);if(!f)return null;const o=await ctx.BUCKET.get(key);check(o&&o.body,409);const bytes=Buffer.from(o.body);check(bytes.length===f.bytes&&hash(bytes)===f.sha256,409);return {body:bytes,etag:o.etag,text:async()=>bytes.toString('utf8'),json:async()=>JSON.parse(bytes.toString('utf8'))}},async put(){check(false)},async delete(){check(false)}}
  result=await runtime(request,{BUCKET:bucket});check(result instanceof Response,503)
  if(!result.ok){await result.body?.cancel();return deny([400,401,403,404,405,409,416,422].includes(result.status)?result.status:503)}
  let response=result
  if(launch){const data=await result.json(),match=typeof data.url==='string'&&data.url.match(/^\/scorm\/v3\/([A-Za-z0-9_-]{40,64})\/(.+)$/);check(match&&data.course===courseId&&(data.enrollment||'')===enrollmentId&&data.preview===!enrollmentId,503);token=match[1];check(!tickets.has(token),503);const entry=match[2].split('/').map(decodeURIComponent).join('/');check(a.files.has(entry),503);response=Response.json({...data,pilotReadOnly:!(checkpoints||completion)||!enrollmentId,progressEnabled:completion&&!!enrollmentId,...(checkpoints&&enrollmentId?{checkpointEnabled:true,checkpointRevision:a.enrollment.tenantCheckpointV30?.revision??0}:{})});if(checkpoints||completion)check(typeof data.key==='string'&&data.key.length<=128,503);if(checkpoints||completion)ticket={key:data.key};issued=true}
  // A change while the runtime reads must not release a ticket or bytes.
  const latest=await ctx.BUCKET.get(STATE);check(latest&&signature(latest,await latest.json())===before,409)
  if(issued){if(completion&&enrollmentId)for(const [old,t] of tickets)if(t.enrollment===enrollmentId&&t.user===a.user.id)tickets.delete(old);if(tickets.size>=MAX)tickets.delete(tickets.keys().next().value);tickets.set(token,{...((checkpoints||completion)?{key:ticket.key}:{}),binding:b,company:a.company,user:a.user.id,role:a.user.role,course:courseId,enrollment:enrollmentId,revision,upload:a.course.upload,fingerprint:a.fingerprint,expires:clock()+TTL,absolute:clock()+ABS})}
  else if(keep)ticket.expires=Math.min(clock()+TTL,ticket.absolute)
  const headers=new Headers(response.headers);headers.set('cache-control','private,no-store');headers.set('referrer-policy','no-referrer');return new Response(response.body,{status:response.status,headers})
 }catch(e){if(ticket&&token)tickets.delete(token);try{await result?.body?.cancel()}catch{}return deny([400,401,403,404,409,503].includes(e?.status)?e.status:503)}finally{if(locked&&ticket)ticket.busy=false}
 }
}
