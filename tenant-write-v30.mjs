/** V30.2B: restricted metadata write pilot. Never enable in production.
 * Uses the existing atomic state+organization CAS storage contract. No binary writes.
 */
import {createHash,randomUUID} from 'node:crypto'
import {tenantContext,canManageLearning,canAssignCourse,canManageMission} from './tenant-policy-v30.mjs'
const key='system/state-v1', rows=x=>Array.isArray(x)?x:[], active=x=>x===true||x===1
const unique=(a,id)=>{const hits=rows(a).filter(x=>x?.id===id);return hits.length===1?hits[0]:null}
const fail=(status=403)=>{throw Object.assign(new Error('Tenant write denied'),{status})}
const check=(v,status=403)=>{if(!v)fail(status)}
const reply=(status,data)=>Response.json(data,{status,headers:{'cache-control':'private,no-store'}})
const ops=new Set(['course','courseEdit','courseState','assign','mission','missionAssign'])
export function pilotWriteRoute(req){const path=new URL(req.url).pathname;const op=path.startsWith('/api/')?path.slice(5):'';return req.method==='POST'&&ops.has(op)?op:null}
function actor(req,s){const identity=req.headers.get('oai-authenticated-user-id');const tokens=(req.headers.get('cookie')||'').match(/(?:^|;\s*)learning=([^;]+)/g)||[];check(identity&&tokens.length===1,401);const token=tokens[0].split('learning=')[1];check(token&&token.length<=256,401);const digest=createHash('sha256').update(token).digest('hex');const sessions=rows(s.sessions).filter(x=>x.digest===digest&&x.identity===identity&&x.until>Date.now());check(sessions.length===1,401);const u=unique(s.users,sessions[0].person);check(u&&active(u.active),401);return u}
const str=(v,max,required=false)=>{check(typeof v==='string'&&v.length<=max&&(!required||v.trim()),400);return v.trim()}
const mins=x=>{check(typeof x==='number'||typeof x==='string'&&x.trim(),400);const n=Number(x);check(Number.isFinite(n)&&n>=1&&n<=10000,400);return n}
const date=x=>{if(x===undefined||x==='')return '';check(typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x),400);const d=new Date(x+'T00:00:00Z');check(Number.isFinite(+d)&&d.toISOString().slice(0,10)===x,400);return x}
const rev=(c,b)=>check(Number.isSafeInteger(b.revision)&&b.revision===(c.revision??0)&&b.revision>=0&&b.revision<Number.MAX_SAFE_INTEGER,409)
const stamp=(c,u,event)=>{c.revision=(c.revision??0)+1;c.updated=new Date().toISOString();(c.history??=[]).push({at:c.updated,person:u.id,event,revision:c.revision})}
const courseStatus=c=>c.status||'published'
function strictKeys(b,allowed){check(b&&typeof b==='object'&&!Array.isArray(b)&&Object.keys(b).every(x=>allowed.includes(x)),400)}
function courseFields(b){return {title:str(b.title,150,true),track:b.track===undefined?'Catálogo geral':str(b.track,100)||'Catálogo geral',description:b.description===undefined?'':str(b.description,500),minutes:mins(b.minutes)}}
function textual(c,b,create=false){if(c.type==='Leitura'&&(create||Object.hasOwn(b,'body')))c.body=str(b.body,24000,true);else check(!Object.hasOwn(b,'body'),400);if(c.type==='Link'&&(create||Object.hasOwn(b,'url'))){const url=str(b.url,2000,true);let parsed;try{parsed=new URL(url)}catch{fail(400)}check(parsed.protocol==='https:'&&!parsed.username&&!parsed.password,400);c.url=url}else check(!Object.hasOwn(b,'url'),400)}
function personIn(s,id,company){const p=unique(s.users,id);return p&&active(p.active)&&s.organization.assignments.get(id)?.company_id===company}
function ownedCourse(s,u,company,id){const c=unique(s.courses,id);check(c&&canManageLearning(s,u.id,company,c));return c}
function published(s,u,company,id){const c=ownedCourse(s,u,company,id);check(courseStatus(c)==='published',409);return c}
function existingEnrollment(s,person,course,company){const found=rows(s.enroll).filter(e=>e.person===person&&e.course===course);check(found.length<=1,409);if(found.length){const e=found[0];check(unique(s.enroll,e.id)===e&&e.tenantCompanyId===company,409);check(e.prerequisites===undefined||Array.isArray(e.prerequisites)&&e.prerequisites.every(id=>unique(s.courses,id)?.tenantCompanyId===company),409);if(e.originMission){const m=unique(s.missions,e.originMission);check(m?.tenantCompanyId===company&&Array.isArray(m.courses)&&m.courses.includes(course),409)}return e}return null}
function addEnrollment(s,company,person,course,due,extra={}){s.enroll.push({id:randomUUID(),tenantCompanyId:company,person,course,progress:0,due,...extra})}
function addAudit(s,u,op,company){check(Array.isArray(s.logs),503);s.logs.unshift({at:new Date().toISOString(),who:u.name||u.id,event:'Operação piloto V30: '+op,tenantCompanyId:company,actorId:u.id})}
/** Mutates only an isolated candidate snapshot; caller commits atomically after validation. */
export function applyPilotWrite(s,u,company,op,b){
 const tc=tenantContext(s,u.id,company);check(tc&&['RH/DHO','Administrador corporativo'].includes(tc.role));check(Array.isArray(s.courses)&&Array.isArray(s.enroll)&&Array.isArray(s.logs),503)
 switch(op){
 case 'course':{
  strictKeys(b,['title','track','description','minutes','type','body','url']);check(['Leitura','Link'].includes(b.type),400)
  const c={id:randomUUID(),tenantCompanyId:company,type:b.type,...courseFields(b),status:'draft'};textual(c,b,true);stamp(c,u,'created');s.courses.push(c);break}
 case 'courseEdit':{
  strictKeys(b,['id','revision','title','track','description','minutes','body','url']);const c=ownedCourse(s,u,company,b.id);rev(c,b);Object.assign(c,courseFields(b));textual(c,b);stamp(c,u,'edited');break}
 case 'courseState':{
  strictKeys(b,['id','revision','status']);const c=ownedCourse(s,u,company,b.id);rev(c,b);check(['published','archived'].includes(b.status)&&courseStatus(c)!==b.status,409); // Only textual courses can be newly published until binary validation exists.
  if(b.status==='published')check(c.type==='Leitura'&&typeof c.body==='string'&&c.body.trim()||c.type==='Link'&&typeof c.url==='string'&&/^https:\/\//i.test(c.url),409)
  c.status=b.status;if(b.status==='published')c.published=new Date().toISOString();stamp(c,u,b.status);break}
 case 'assign':{
  strictKeys(b,['person','course','date']);const c=published(s,u,company,b.course);check(canAssignCourse(s,u.id,company,c,b.person));check(['Leitura','Link'].includes(c.type),409);check(!existingEnrollment(s,b.person,c.id,company),409);addEnrollment(s,company,b.person,c.id,date(b.date));break}
 case 'mission':{
  strictKeys(b,['id','revision','title','description','courses','sequential']);const list=s.missions??=[];check(Array.isArray(list),503);const m=Object.hasOwn(b,'id')?unique(list,b.id):{id:randomUUID(),tenantCompanyId:company,revision:0};check(m&&canManageLearning(s,u.id,company,m));if(Object.hasOwn(b,'id')){check(canManageMission(s,u.id,company,m));rev(m,b)}
  check(Array.isArray(b.courses)&&b.courses.length>=1&&b.courses.length<=30&&new Set(b.courses).size===b.courses.length,400);for(const cid of b.courses)ownedCourse(s,u,company,cid);check(b.sequential===undefined||typeof b.sequential==='boolean',400);const sequential=b.sequential===true;
  if(rows(s.missionEnrollments).some(e=>e.mission===m.id))check(JSON.stringify(b.courses)===JSON.stringify(m.courses)&&sequential===Boolean(m.sequential),409)
  Object.assign(m,{title:str(b.title,150,true),description:b.description===undefined?'':str(b.description,800),courses:[...b.courses],sequential,revision:(m.revision??0)+1,updated:new Date().toISOString()});if(!Object.hasOwn(b,'id'))list.push(m);break}
 case 'missionAssign':{
  strictKeys(b,['id','people','person','date']);check(!(Object.hasOwn(b,'people')&&Object.hasOwn(b,'person')),400);const m=unique(s.missions,b.id);check(m&&canManageMission(s,u.id,company,m));const people=Array.isArray(b.people)?b.people:[b.person];check(people.length>=1&&people.length<=200&&new Set(people).size===people.length,400);const due=date(b.date);for(const person of people)check(personIn(s,person,company));const courses=m.courses.map(id=>published(s,u,company,id));check(courses.every(c=>['Leitura','Link'].includes(c.type)),409);const list=s.missionEnrollments??=[];check(Array.isArray(list),503);
  for(const person of people){const old=list.filter(e=>e.person===person&&e.mission===m.id);check(old.length===0,409);for(const [i,c] of courses.entries()){const e=existingEnrollment(s,person,c.id,company);if(e){ // Never silently bypass sequencing on previously assigned courses.
    check(!m.sequential||i===0||e.progress===100,409);continue}addEnrollment(s,company,person,c.id,due,{originMission:m.id,prerequisites:m.sequential?m.courses.slice(0,i):[]})}list.push({id:randomUUID(),tenantCompanyId:company,mission:m.id,person,due,assigned:new Date().toISOString(),author:u.id})}break}
 default:fail()
 }
 addAudit(s,u,op,company)
}
export async function pilotWrite(req,ctx){try{
 const op=pilotWriteRoute(req);check(op);const url=new URL(req.url);check(req.headers.get('origin')===url.origin);check(req.headers.get('content-type')?.split(';')[0].trim().toLowerCase()==='application/json',415);check([...url.searchParams.keys()].every(k=>k==='company')&&url.searchParams.getAll('company').length<=1,400)
 const reader=req.body?.getReader();check(reader,400);const chunks=[];let size=0;try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();fail(413)}chunks.push(Buffer.from(value))}}finally{reader.releaseLock()}
 let b;try{b=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{fail(400)}
 const raw=await ctx.BUCKET.get(key);check(raw,401);const state=await raw.json(),u=actor(req,state);const tc=tenantContext(state,u.id,url.searchParams.has('company')?url.searchParams.get('company'):undefined);check(tc);const org=state.organization;check(typeof raw.etag==='string'&&raw.etag&&typeof org?.revision==='string'&&org.revision,503)
 const candidate=structuredClone(state);Object.defineProperty(candidate,'organization',{value:structuredClone(org),enumerable:false});applyPilotWrite(candidate,u,tc.company,op,b);
 // Existing SQLite adapter validates both expectations within BEGIN IMMEDIATE.
 // Never retry automatically: client must refresh authorization and revisions.
 actor(req,state);const saved=await ctx.BUCKET.put(key,JSON.stringify(candidate),{onlyIf:{etagMatches:raw.etag},requireStateEtag:raw.etag,requireOrganizationRevision:org.revision});check(saved,409);return reply(200,{ok:true})
 }catch(e){const status=[400,401,403,409,413,415,503].includes(e?.status)?e.status:503;return reply(status,{error:status===409?'Dados alterados ou operação incompatível. Atualize antes de tentar novamente.':status===401?'Entre para continuar.':'Operação indisponível no piloto de gravação.'})}}
