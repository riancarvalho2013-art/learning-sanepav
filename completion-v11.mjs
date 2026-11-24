/** Authoritative completion gateway for the existing LMS (V11). No new progress store. */
import {createHash, timingSafeEqual} from 'node:crypto'
import {courseStatus,courseRevision,requireLearningAccess} from './learning.mjs'
import {readFinalAssessmentRequirements,readFinalAssessmentPasses} from './learning-assessments-v6.mjs'
const ROOT='/api/completion/v11/', STATE='system/state-v1'
const check=(ok,message,status=400)=>{if(!ok)throw Object.assign(new Error(message),{status})}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'private,no-store','x-content-type-options':'nosniff'}})
const list=v=>Array.isArray(v)?v:[]
const own=(obj,key)=>Object.hasOwn(obj,key)
const ID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i
const MANUAL=new Set(['Leitura','Vídeo','Áudio','PDF','Imagem','Apresentação','Documento','Link'])
const CMI_LOCKED=new Set(['cmi.core.student_id','cmi.core.student_name','cmi.learner_id','cmi.learner_name','cmi.core.credit','cmi.credit','cmi.mode','cmi.core.lesson_mode'])
export const evidenceLabels=Object.freeze({legacy:'Conclusão legada — evidência não classificada',manual:'Confirmação autodeclarada de conteúdo',quiz:'Questionário corrigido no servidor',scorm:'Conclusão declarada pelo runtime SCORM',pending:'Conclusão pendente',assessment:'Avaliação final corrigida no servidor'})
export function completionClassification(e){
 if(e.progress!==100)return 'pending'
 const c=e.completionV11
 return c?.event?.id&&c?.content?.type?c.content.type:'legacy'
}
export function resolveActor(req,state,now=Date.now()){
 const token=(req.headers.get('cookie')||'').match(/(?:^|;\s*)learning=([^;]+)/)?.[1]||''
 const identity=req.headers.get('oai-authenticated-user-id')||''
 check(token&&identity,'Entre para continuar.',401)
 const digest=createHash('sha256').update(token).digest('hex')
 const s=list(state.sessions).find(x=>typeof x.digest==='string'&&x.digest.length===digest.length&&timingSafeEqual(Buffer.from(x.digest),Buffer.from(digest))&&x.identity===identity&&x.until>now)
 const user=list(state.users).find(u=>u.id===s?.person&&u.active)
 check(user,'Entre para continuar.',401);return user
}
const org=(state,uid)=>{const a=state.organization?.assignments?.get(uid);return {companyId:a?.company_id||null,unitId:a?.unit_id||null,departmentId:a?.department_id||null,managerId:list(state.users).find(u=>u.id===uid)?.manager||null}}
function enrollmentFor(state,user,id){
 check(ID.test(id||''),'Matrícula inválida.',400)
 const e=list(state.enroll).find(e=>e.id===id&&e.person===user.id)
 check(e,'Matrícula indisponível.',403)
 requireLearningAccess(state,e)
 const c=list(state.courses).find(c=>c.id===e.course)
 check(c&&courseStatus(c)!=='draft','Curso indisponível.',403)
 return {e,c}
}
function validateCMI(input,old={}){
 check(input&&typeof input==='object'&&!Array.isArray(input),'Estado SCORM inválido.')
 const entries=Object.entries(input);check(entries.length<=2500&&JSON.stringify(input).length<=90000,'Estado SCORM acima do limite.',413)
 const values={...old}
 for(const [k,v] of entries){check(/^cmi\.[\w.]+$/.test(k)&&k.length<=160&&typeof v==='string'&&v.length<=(k==='cmi.suspend_data'?64000:4000),'Campo CMI inválido.');if(!CMI_LOCKED.has(k))values[k]=v}
 check(JSON.stringify(values).length<=90000,'Estado SCORM acumulado acima do limite.',413)
 const s12=values['cmi.core.lesson_status']||'',s04=values['cmi.completion_status']||'',success=values['cmi.success_status']||''
 check(['','passed','completed','failed','incomplete','browsed','not attempted'].includes(s12),'Status SCORM 1.2 inválido.')
 check(['','completed','incomplete','not attempted','unknown'].includes(s04),'Status SCORM 2004 inválido.')
 check(['','passed','failed','unknown'].includes(success),'Resultado SCORM 2004 inválido.')
 const measure=values['cmi.progress_measure'];check(measure===undefined||measure===''||Number.isFinite(Number(measure))&&Number(measure)>=0&&Number(measure)<=1,'Medida SCORM inválida.')
 const raw=values['cmi.score.raw']??values['cmi.core.score.raw'];check(raw===undefined||raw===''||Number.isFinite(Number(raw)),'Nota SCORM inválida.')
 const complete=s12!=='failed'&&success!=='failed'&&(['passed','completed'].includes(s12)||s04==='completed')
 return {values,complete,percent:complete?99:Math.min(99,Math.max(1,Math.round(Number(measure||0)*100))),score:raw!=null&&raw!==''?Number(raw):null,terminalStatus:s04==='completed'?'2004:completed':'1.2:'+s12}
}
function status(e,c){
 const evidence=e.completionV11
 return {ok:true,enrollmentId:e.id,courseId:c.id,progress:e.progress||0,completed:e.completed||null,evidenceType:completionClassification(e),contentEvidence:evidence?.content?.type||null,requiredAssessments:(evidence?.requirements||[]).map(x=>({id:x.id,title:x.title,passed:!!x.passed})),pendingAssessment:e.progress!==100&&!!evidence?.content&&evidence.requirements?.some(x=>!x.passed),revisionChanged:e.progress!==100&&!!evidence?.content&&evidence.courseRevision!==courseRevision(c),classification:evidenceLabels[completionClassification(e)]}
}
function prepareEvidence(e,c,state,user,ctx,at){
 const current=e.completionV11, snapshot=org(state,user.id)
 // Freeze criteria when the content is first confirmed. Changes in company or course revision require fresh evidence, not a silent migration.
 if(!current||current.courseRevision!==courseRevision(c)||current.organization.companyId!==snapshot.companyId){
  const requirements=readFinalAssessmentRequirements(ctx,snapshot.companyId,c.id)
  e.completionV11={version:1,courseRevision:courseRevision(c),organization:snapshot,criteriaAt:at,requirements,content:null,event:null}
 }
 return e.completionV11
}
function finalize(e,c,state,user,ctx,at){
 const v=e.completionV11
 if(e.progress===100||!v?.content||v.courseRevision!==courseRevision(c)||v.organization.companyId!==org(state,user.id).companyId)return
 const passes=readFinalAssessmentPasses(ctx,v.requirements.map(r=>r.id),user.id)
 v.requirements=v.requirements.map(r=>({...r,passed:!!passes[r.id],attemptId:passes[r.id]?.id||null,score:passes[r.id]?.score??null}))
 if(v.requirements.some(r=>!r.passed)){e.progress=Math.max(e.progress||0,99);return}
 e.progress=100;e.completed=at
 v.event={id:'learning.course.completed:'+e.id,type:'learning.course.completed',version:1,occurredAt:at,organization:org(state,user.id),courseId:c.id,enrollmentId:e.id,evidenceType:v.content.type,assessmentCount:v.requirements.length}
}
/** Updates only the authorized enrollment. Input progress is not evidence of approval. */
export function applyProgress(state,user,input,ctx,{scormAuthorized=false,at=new Date().toISOString()}={}){
 check(input&&typeof input==='object'&&!Array.isArray(input),'Dados inválidos.')
 const {e,c}=enrollmentFor(state,user,input.id)
 if(c.type==='SCORM'){
  check(scormAuthorized,'Abra a aula SCORM e use a sessão do player.',403)
  const observed=validateCMI(input.cmi,e.cmi)
  e.cmi=observed.values
  if(e.progress===100){e.updated=at;return status(e,c)} // preserve original completion and score
  if(observed.score!==null)e.score=observed.score
  e.progress=Math.min(99,Math.max(e.progress||0,observed.percent))
  if(observed.complete){const v=prepareEvidence(e,c,state,user,ctx,at);v.content={type:'scorm',at,runtimeStatus:observed.terminalStatus,assurance:'runtime_declared'}}
  else if(e.completionV11?.content?.type==='scorm'){e.completionV11.content=null}
 }else{
  check(!scormAuthorized&&!own(input,'cmi'),'Formato de evidência incompatível.',400)
  if(e.progress===100)return status(e,c)
  if(c.type==='Questionário'){
   const a=input.answer
   check((typeof a==='number'&&Number.isInteger(a))||(typeof a==='string'&&/^\d+$/.test(a)),'Selecione uma alternativa válida.')
   check(Number(a)>=0&&Number(a)<list(c.options).length,'Alternativa inválida.')
   const correct=Number(a)===c.answer;e.score=correct?100:0;e.progress=Math.max(e.progress||0,correct?99:1)
   if(correct){const v=prepareEvidence(e,c,state,user,ctx,at);v.content={type:'quiz',at,assurance:'server_graded'}}
   else if(e.completionV11?.content?.type==='quiz')e.completionV11.content=null
  }else{
   check(MANUAL.has(c.type),'Formato de curso sem regra de conclusão.',422)
   check(typeof input.progress==='number'&&Number.isFinite(input.progress)&&input.progress>=0&&input.progress<=100,'Progresso inválido.')
   // The existing classroom sends 100 only when the user confirms completion. This remains self-attested, never an independent proof of study or passing.
   e.progress=Math.max(e.progress||0,Math.min(99,Math.floor(input.progress)))
   if(input.progress===100){const v=prepareEvidence(e,c,state,user,ctx,at);v.content={type:'manual',at,assurance:'self_attested',format:c.type}}
  }
 }
 finalize(e,c,state,user,ctx,at);e.updated=at
 return status(e,c)
}
async function mutate(req,ctx,fn){
 for(let i=0;i<8;i++){
  const raw=await ctx.BUCKET.get(STATE);check(raw,'Ambiente não inicializado.',401)
  const state=await raw.json(),user=resolveActor(req,state)
  const outcome=await fn(state,user)
  const saved=await ctx.BUCKET.put(STATE,JSON.stringify(state),{onlyIf:{etagMatches:raw.etag}})
  if(saved)return outcome
 }
 check(false,'Os dados mudaram. Tente novamente.',409)
}
async function readBody(req){let b;try{b=await req.json()}catch{check(false,'JSON inválido.')};check(b&&typeof b==='object'&&!Array.isArray(b),'Dados inválidos.');return b}
function origin(req){check(req.headers.get('origin')===new URL(req.url).origin,'Origem inválida.',403)}
/** A runtime session validator executes inside each CAS retry (including fresh ACL checks). */
export async function saveScormProgress(req,ctx,input,authorize){
 origin(req)
 return mutate(req,ctx,(state,user)=>{authorize(state,user);return applyProgress(state,user,input,ctx,{scormAuthorized:true})})
}
export async function reconcileCompletion(req,ctx,courseId){
 return mutate(req,ctx,(state,user)=>{
  const rows=list(state.enroll).filter(e=>e.person===user.id&&(!courseId||e.course===courseId)&&e.progress!==100&&e.completionV11?.content)
  const result=[]
  for(const e of rows){const c=list(state.courses).find(c=>c.id===e.course);if(!c||courseStatus(c)==='draft')continue
   try{requireLearningAccess(state,e)}catch{continue}
   finalize(e,c,state,user,ctx,new Date().toISOString());result.push(status(e,c))
  }
  return {items:result}
 })
}
export async function handleCompletionV11(req,ctx){
 const path=new URL(req.url).pathname
 if(path!=='/api/progress'&&!path.startsWith(ROOT))return null
 try{
  if(path===ROOT+'mine'&&req.method==='GET'){
   const raw=await ctx.BUCKET.get(STATE);check(raw,'Ambiente não inicializado.',401)
   const state=await raw.json(),user=resolveActor(req,state),courses=new Map(list(state.courses).map(c=>[c.id,c]))
   return json({items:list(state.enroll).filter(e=>e.person===user.id&&courses.has(e.course)).map(e=>status(e,courses.get(e.course)))})
  }
  check(req.method==='POST','Método não permitido.',405);origin(req)
  const input=await readBody(req)
  if(path==='/api/progress')return json(await mutate(req,ctx,(s,u)=>applyProgress(s,u,input,ctx)))
  if(path===ROOT+'reconcile'){check(!input.courseId||ID.test(input.courseId),'Curso inválido.');return json(await reconcileCompletion(req,ctx,input.courseId))}
  return json({error:'Rota inexistente.'},404)
 }catch(e){return json({error:e.status?e.message:'Falha ao registrar evidência de aprendizagem.'},e.status||500)}
}
