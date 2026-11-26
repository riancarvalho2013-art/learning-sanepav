/** V30.2C2 advanced fixture-only bridge. The original SCORM runtime grades evidence;
 * the adapter can persist exactly one enrollment and checks state, org and assessment
 * snapshots inside SQLite's write transaction. CMI is runtime-declared, not a proof of study.
 */
import {isDeepStrictEqual} from 'node:util'
import {createHash} from 'node:crypto'
const STATE='system/state-v1'
const check=(ok,status=403)=>{if(!ok)throw Object.assign(new Error('Conclusão indisponível no piloto.'),{status})}
const list=x=>Array.isArray(x)?x:[]
const one=(xs,id)=>{const a=list(xs).filter(x=>x?.id===id);return a.length===1?a[0]:null}
const copy=s=>JSON.parse(JSON.stringify(s))
const pairs=x=>list(x).map(r=>[r.id,r.revision]).sort((a,b)=>a[0].localeCompare(b[0]))
export function validateCommitInput(input){
 check(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(k=>['id','key','token','cmi'].includes(k)),400)
 const c=input.cmi;check(c&&typeof c==='object'&&!Array.isArray(c)&&Object.keys(c).length>0&&Object.keys(c).length<=2500&&Buffer.byteLength(JSON.stringify(c))<=90000,400)
 for(const [k,v] of Object.entries(c))check(/^cmi\.[\w.]+$/.test(k)&&k.length<=160&&typeof v==='string'&&v.length<=(k==='cmi.suspend_data'?64000:4000),400)
 const s12=c['cmi.core.lesson_status'],s04=c['cmi.completion_status'],success=c['cmi.success_status'];check(s12===undefined||['','passed','completed','failed','incomplete','browsed','not attempted'].includes(s12),400);check(s04===undefined||['','completed','incomplete','not attempted','unknown'].includes(s04),400);check(success===undefined||['','passed','failed','unknown'].includes(success),400)
 for(const k of ['cmi.progress_measure','cmi.score.raw','cmi.core.score.raw'])if(c[k]!==undefined&&c[k]!=='')check(c[k].trim()&&Number.isFinite(Number(c[k]))&&(k!=='cmi.progress_measure'||Number(c[k])>=0&&Number(c[k])<=1),400)
}
export async function guardedScormCommit({runtime,request,ctx,raw,state,access,revalidate,evidenceType='scorm',answer}){
 const assurance={scorm:'runtime_declared',manual:'self_attested',quiz:'server_graded'}[evidenceType];check(assurance,503)
 const {course,enrollment:e,user,company}=access
 check(e&&e.progress!==100&&Number.isFinite(e.progress)&&e.progress>=0&&e.progress<100,409)
 check(typeof ctx.BUCKET.tenantAssessmentSnapshot==='function',503)
 const scope={companyId:company,courseId:course.id,userId:user.id},snapshot=await ctx.BUCKET.tenantAssessmentSnapshot(scope)
 check(snapshot&&typeof snapshot.revision==='string'&&Array.isArray(snapshot.requirements)&&Array.isArray(snapshot.passes),503)
 const existing=e.completionV11
 if(existing?.courseRevision===(course.revision||0)&&existing?.organization?.companyId===company)check(isDeepStrictEqual(pairs(existing.requirements),pairs(snapshot.requirements)),409)
 const baseline=copy(state);const token=(request.headers.get('cookie')||'').match(/(?:^|;\s*)learning=([^;]+)/)?.[1]||'';const digest=createHash('sha256').update(token).digest('hex');const activeSessions=list(state.sessions).filter(x=>x.person===user.id&&x.digest===digest&&x.identity===request.headers.get('oai-authenticated-user-id')&&x.until>Date.now());check(activeSessions.length===1,401);let committed=false
 const adapter={async get(key){check(key===STATE,403);await revalidate();const pinned=copy(baseline);Object.defineProperty(pinned,'organization',{value:structuredClone(state.organization),enumerable:false});return {etag:raw.etag,json:async()=>pinned}},async put(key,value,options){
  check(key===STATE&&!committed&&options?.onlyIf?.etagMatches===raw.etag,409);await revalidate();let next;try{next=JSON.parse(value)}catch{check(false,503)}
  const n=one(next.enroll,e.id);check(n&&n.person===e.person&&n.course===e.course&&n.tenantCompanyId===company,409)
  check(Number.isFinite(n.progress)&&n.progress>=e.progress&&n.progress<=100,409)
  const original=one(baseline.enroll,e.id);const allowed=new Set(['cmi','score','progress','updated','completed','completionV11','scormMultiV12']);for(const k of new Set([...Object.keys(n),...Object.keys(original)]))if(!allowed.has(k))check(isDeepStrictEqual(n[k],original[k]),409)
  const normalized=copy(next);normalized.enroll[normalized.enroll.findIndex(x=>x.id===e.id)]=original;check(isDeepStrictEqual(normalized,baseline),409)
  if(n.completionV11?.content){const v=n.completionV11;check(v.courseRevision===(course.revision||0)&&v.organization?.companyId===company&&v.content.type===evidenceType&&v.content.assurance===assurance&&isDeepStrictEqual(pairs(v.requirements),pairs(snapshot.requirements)),409)}
  if(n.progress!==100){check(n.completed===original.completed&&!n.completionV11?.event,409)}
  if(n.score!==original.score)check(evidenceType!=='manual'&&typeof n.score==='number'&&Number.isFinite(n.score),409)
  if(evidenceType==='quiz')check(n.score===(Number(answer)===course.answer?100:0),409)
  if(n.progress===100){const v=n.completionV11;check(v?.content&&v.event?.id==='learning.course.completed:'+e.id&&v.event.courseId===course.id&&v.event.enrollmentId===e.id&&v.event.organization?.companyId===company&&v.event.evidenceType===evidenceType&&typeof n.completed==='string',409);const passed=new Map(snapshot.passes.map(x=>[x.formId,x.attemptId]));check(list(v.requirements).every(r=>r.passed===true&&passed.get(r.id)===r.attemptId&&passed.has(r.id)),409)}
  const saved=await ctx.BUCKET.put(STATE,JSON.stringify(next),{onlyIf:{etagMatches:raw.etag},requireStateEtag:raw.etag,requireOrganizationRevision:state.organization.revision,requireTenantAssessmentRevision:{...scope,revision:snapshot.revision},requireTenantSessionUntil:activeSessions[0].until});check(saved,409);committed=true;return saved
 }}
 const result=await runtime(request,{BUCKET:adapter,...(ctx.assessmentDb?{assessmentDb:ctx.assessmentDb}:{})});check(result instanceof Response,503);if(result.ok)check(committed,503);return result
}
