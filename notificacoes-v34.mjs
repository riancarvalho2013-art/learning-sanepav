/** V34: persisted learning/development events, shared V31 queue and V33 presentation. */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const DAY=86400000, WINDOW=7*DAY;
const arr=v=>Array.isArray(v)?v:[];
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const local=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
const day=t=>local.format(new Date(t));
const dateOK=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const shift=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*DAY).toISOString().slice(0,10);
const time=v=>typeof v==='string'?Date.parse(v):NaN;
const at9=d=>Date.parse(d+'T09:00:00-03:00');
const at0=d=>Date.parse(d+'T00:00:00-03:00');
const idOK=v=>typeof v==='string'&&v.length>0&&v.length<=180;
const emailOK=v=>typeof v==='string'&&v.length<=300&&/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(v);
export const pageV34={'Certificados':'Certificados','Avaliações educacionais':'Avaliações de aprendizagem','Eficácia dos treinamentos':'Eficácia dos treinamentos · Kirkpatrick'};
export const actionV34={'Certificados':'Acessar certificados','Avaliações educacionais':'Acessar avaliações','Eficácia dos treinamentos':'Acessar avaliações de eficácia'};
export const variantsV34={
 courseCompleted:['Treinamento concluído','Parabéns! A conclusão de um treinamento foi registrada na plataforma. Confira sua jornada e os próximos passos.','Consultar meus treinamentos'],
 certificateIssued:['Seu certificado foi emitido','Um certificado de conclusão foi emitido para você. Acesse sua conta para consultar, imprimir ou salvar o documento.','Acessar meus certificados'],
 assessmentAvailable:['Nova avaliação de aprendizagem','Uma avaliação está disponível em sua jornada. Acesse a plataforma e confira as orientações antes de iniciar.','Acessar avaliação'],
 assessmentReminder:['Avaliação de aprendizagem pendente','O prazo de uma avaliação de aprendizagem está próximo. Organize um momento para participar.','Responder avaliação'],
 assessmentSubmitted:['Avaliação de aprendizagem registrada','Sua tentativa foi registrada. Consulte o resultado e as orientações disponíveis em sua conta.','Consultar resultado'],
 cycleAssigned:['Ciclo de desempenho disponível','Você possui uma ou mais avaliações atribuídas em um ciclo de desempenho. Acesse sua conta para participar.','Acessar ciclo'],
 cycleReminder:['Avaliações de desempenho pendentes','Há atividades pendentes em um ciclo de desempenho próximo do encerramento. Consulte suas avaliações.','Consultar pendências'],
 cycleCalibration:['Ciclo em etapa de calibração','A coleta de um ciclo foi encerrada e a etapa de calibração está disponível para a gestão autorizada.','Acessar calibração'],
 cycleClosed:['Ciclo de desempenho encerrado','Um ciclo de desempenho do qual você participa foi encerrado. Os resultados só estarão disponíveis após a liberação autorizada.','Consultar ciclo'],
 cycleResults:['Resultados de desempenho liberados','Os resultados de um ciclo de desempenho foram liberados. Acesse sua conta para consultá-los com privacidade.','Consultar meus resultados'],
 cycleSubmitted:['Avaliação de desempenho registrada','Uma avaliação que você respondeu foi registrada com sucesso. Consulte o ciclo para acompanhar suas demais atividades.','Consultar avaliações'],
 kpReaction:['Avalie sua experiência de aprendizagem','Após a conclusão de um treinamento, registre sua percepção sobre a experiência de aprendizagem.','Responder avaliação de reação'],
 kpTransferAssigned:['Acompanhamento de eficácia atribuído','Uma avaliação de transferência de aprendizagem foi atribuída a você. Consulte a data de abertura do acompanhamento.','Consultar acompanhamento'],
 kpTransferDue:['Avaliação de transferência disponível','Chegou o momento de acompanhar a aplicação da aprendizagem na prática. Acesse sua conta para registrar a avaliação atribuída.','Responder avaliação de eficácia'],
 kpTransferSubmitted:['Acompanhamento de eficácia registrado','Uma avaliação de transferência que você respondeu foi registrada. Consulte seus acompanhamentos na plataforma.','Consultar acompanhamentos'],
 kpOutcome:['Novo registro de eficácia disponível','Um registro de resultados de treinamento foi adicionado no escopo da sua gestão. Consulte o relatório autorizado na plataforma.','Acessar relatórios de eficácia'],
};
const specs={courseCompleted:'Catálogo LMS',certificateIssued:'Certificados',assessmentAvailable:'Avaliações educacionais',assessmentReminder:'Avaliações educacionais',assessmentSubmitted:'Avaliações educacionais',cycleAssigned:'Desempenho',cycleReminder:'Desempenho',cycleCalibration:'Desempenho',cycleClosed:'Desempenho',cycleResults:'Desempenho',cycleSubmitted:'Desempenho',kpReaction:'Eficácia dos treinamentos',kpTransferAssigned:'Eficácia dos treinamentos',kpTransferDue:'Eficácia dos treinamentos',kpTransferSubmitted:'Eficácia dos treinamentos',kpOutcome:'Eficácia dos treinamentos'};
export const specsV34=Object.freeze(specs);
const table=(db,n)=>Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(n));
/** Called inside the existing V31 read transaction. Only metadata, never scores, answers, comments or evidence. */
export function readSnapshotV34(db){
 const since=db.prepare("SELECT v FROM learning_mail_v31_meta WHERE k='v34_since'").get()?.v;
 if(!Number.isFinite(since))return null;
 const out={since,certificates:[],forms:[],attempts:[],sessions:[],reactions:[],transfers:[],outcomes:[],grants:[]};
 const certRows=db.prepare("SELECT key,body FROM objects WHERE key GLOB 'evolution/v1/issued/*'").all();
 const verified=db.prepare('SELECT 1 FROM objects WHERE key=?');
 for(const row of certRows){let c;try{c=JSON.parse(Buffer.from(row.body).toString())}catch{continue}if(c&&idOK(c.code)&&verified.get('evolution/v1/verification/'+c.code)&&row.key==='evolution/v1/issued/'+c.enrollmentId)out.certificates.push({enrollmentId:c.enrollmentId,personId:c.personId,company:c.company,courseId:c.courseId,issuedAt:c.issuedAt});}
 if(table(db,'assessment_v6_forms'))out.forms=db.prepare('SELECT id,company_id,course_id,kind,max_attempts,starts_on,ends_on,status,published_at FROM assessment_v6_forms WHERE status=\'published\'').all();
 if(table(db,'assessment_v6_attempts'))out.attempts=db.prepare('SELECT id,form_id,user_id,submitted_at FROM assessment_v6_attempts').all();
 if(table(db,'assessment_v7_sessions'))out.sessions=db.prepare('SELECT id,form_id,user_id,status,expires_at_ms FROM assessment_v7_sessions').all();
 if(table(db,'kirkpatrick_reactions_v7'))out.reactions=db.prepare('SELECT enrollment_id,user_id FROM kirkpatrick_reactions_v7').all();
 if(table(db,'kirkpatrick_transfer_v7'))out.transfers=db.prepare('SELECT id,company_id,course_id,enrollment_id,subject_id,reviewer_id,offset_days,due_on,status,created_at,submitted_at FROM kirkpatrick_transfer_v7').all();
 if(table(db,'kirkpatrick_outcomes_v7'))out.outcomes=db.prepare('SELECT id,company_id,course_id,created_by,created_at FROM kirkpatrick_outcomes_v7').all();
 if(table(db,'company_access'))out.grants=db.prepare('SELECT person_id,company_id FROM company_access').all();
 return out;
}
export function candidatesV34({state={},lxp={},assignments=[],companies=[],extra=null},now){
 if(!extra||!Number.isFinite(extra.since))return [];
 const t=+now,d=day(t),since=Math.max(extra.since,t-WINDOW),result=new Map();
 const users=new Map(arr(state.users).filter(u=>u.active).map(u=>[u.id,u]));
 const links=new Map(assignments.map(a=>[a.person_id,a.company_id]));
 const orgs=new Set(companies.filter(c=>c.active!==0&&c.active!==false).map(c=>c.id));
 const company=id=>orgs.has(links.get(id))?links.get(id):null;
 const eligible=(id,c)=>Boolean(c&&company(id)===c&&users.has(id)&&emailOK(users.get(id).email));
 const courses=new Map(arr(state.courses).map(c=>[c.id,c]));
 const enrolls=arr(state.enroll),byId=new Map(enrolls.map(e=>[e.id,e]));
 const enrollment=(p,c)=>enrolls.find(e=>e.person===p&&e.course===c);
 const published=c=>courses.has(c)&&(courses.get(c).status||'published')==='published';
 const unlocked=e=>e&&arr(e.prerequisites).every(c=>enrollment(e.person,c)?.progress===100);
 const adminAudience=c=>[...users.values()].filter(u=>eligible(u.id,c)&&['Administrador','RH/DHO'].includes(u.role)).map(u=>u.id);
 const add=(kind,entity,recipient,c,at,{due='',version='',priority=3}={})=>{
  if(!eligible(recipient,c)||!idOK(entity)||!Number.isFinite(at)||at<since||at>t||!Object.hasOwn(specs,kind))return;
  const key=hash(['v34',kind,entity,recipient,version]);
  result.set(key,{key,kind,recipient,email:users.get(recipient).email,first:users.get(recipient).name,page:specs[kind],label:variantsV34[kind][0],due:dateOK(due)?due:'',target:'',at,priority});
 };
 // Completion is an explicit V11 event, not merely the client progress percentage.
 for(const e of enrolls){const v=e.completionV11?.event,c=v?.organization?.companyId;
  if(e.progress!==100||v?.type!=='learning.course.completed'||v.enrollmentId!==e.id||v.courseId!==e.course||!eligible(e.person,c)||!courses.has(e.course))continue;
  add('courseCompleted',e.id,e.person,c,time(v.occurredAt),{priority:3});
  if(courses.get(e.course).status!=='draft'&&!arr(extra.reactions).some(r=>r.enrollment_id===e.id))add('kpReaction',e.id,e.person,c,time(v.occurredAt),{priority:4});
 }
 // A certificate must be issued and its verification record exist; no certificate inferred from completion.
 for(const c of arr(extra.certificates)){const e=byId.get(c.enrollmentId);if(e?.progress===100&&e.person===c.personId&&e.course===c.courseId&&courses.has(c.courseId))add('certificateIssued',c.enrollmentId,c.personId,c.company,time(c.issuedAt));}
 const forms=new Map(arr(extra.forms).map(f=>[f.id,f]));
 for(const f of forms.values()){
  if(f.status!=='published'||!published(f.course_id)||!dateOK(f.starts_on)||!dateOK(f.ends_on)||d<f.starts_on||d>f.ends_on)continue;
  for(const e of enrolls.filter(e=>e.course===f.course_id)){
   if(!eligible(e.person,f.company_id)||!unlocked(e))continue;
   const attempts=arr(extra.attempts).filter(a=>a.form_id===f.id&&a.user_id===e.person);
   const sessions=arr(extra.sessions).filter(a=>a.form_id===f.id&&a.user_id===e.person);
   const used=sessions.length+attempts.filter(a=>!sessions.some(s=>s.id===a.id)).length;
   // Do not pressure people who have already submitted an attempt, or have exhausted slots.
   if(attempts.length||!(sessions.some(s=>s.status==='active'&&s.expires_at_ms>t)||used<f.max_attempts))continue;
   const start=Math.max(time(f.published_at),at0(f.starts_on));
   add('assessmentAvailable',f.id,e.person,f.company_id,start,{due:f.ends_on,priority:2});
   const reminder=at9(shift(f.ends_on,-3));
   if(d>=shift(f.ends_on,-3)&&start<reminder)add('assessmentReminder',f.id,e.person,f.company_id,Math.max(reminder,extra.since),{due:f.ends_on,priority:2,version:f.ends_on});
  }
 }
 for(const a of arr(extra.attempts)){const f=forms.get(a.form_id);if(f?.status==='published'&&published(f.course_id)&&enrollment(a.user_id,f.course_id))add('assessmentSubmitted',a.id,a.user_id,f.company_id,time(a.submitted_at));}
 const events=arr(lxp.events),reviews=arr(lxp.reviews);
 for(const c of arr(lxp.cycles)){
  const tenant=c.companyId;if(!orgs.has(tenant)||c.status==='draft')continue;
  const participants=arr(c.participants).filter(p=>eligible(p,tenant));
  const tasks=reviews.filter(r=>r.cycleId===c.id&&participants.includes(r.subjectId)&&eligible(r.reviewerId,tenant));
  if(c.status==='published'&&dateOK(c.startDate)&&dateOK(c.endDate)&&d>=c.startDate&&d<=c.endDate){
   const pending=[...new Set(tasks.filter(r=>r.status!=='submitted').map(r=>r.reviewerId))];
   const opens=Math.max(time(c.publishedAt),at0(c.startDate));
   for(const id of pending){add('cycleAssigned',c.id,id,tenant,opens,{due:c.endDate,priority:1});const reminder=at9(shift(c.endDate,-3));if(d>=shift(c.endDate,-3)&&opens<reminder)add('cycleReminder',c.id,id,tenant,Math.max(reminder,extra.since),{due:c.endDate,version:c.endDate,priority:1});}
  }
  // A submitted review is acknowledged only to its own reviewer; do not expose who assessed whom.
  for(const r of tasks)if(r.status==='submitted')add('cycleSubmitted',r.id,r.reviewerId,tenant,time(r.submittedAt));
  if(c.status==='calibration')for(const id of adminAudience(tenant))add('cycleCalibration',c.id,id,tenant,time(c.collectionClosedAt),{priority:2});
  if(c.status==='closed'){
   for(const id of participants)add('cycleClosed',c.id,id,tenant,time(c.closedAt));
   const released=events.find(e=>e.entity===c.id&&e.action==='performance.release');
   if(c.releaseResults===true&&released)for(const id of participants)add('cycleResults',c.id,id,tenant,time(released.at),{priority:2});
  }
 }
 for(const k of arr(extra.transfers)){
  const e=byId.get(k.enrollment_id),u=users.get(k.subject_id);
  // Conservative live scope: do not notify an old reviewer after management/tenant change.
  if(!e||e.progress!==100||e.person!==k.subject_id||e.course!==k.course_id||!courses.has(k.course_id)||!eligible(k.subject_id,k.company_id)||!eligible(k.reviewer_id,k.company_id)||u?.manager!==k.reviewer_id||!dateOK(k.due_on))continue;
  if(k.status==='pending'){
   if(d<k.due_on||t<at9(k.due_on))add('kpTransferAssigned',k.id,k.reviewer_id,k.company_id,time(k.created_at),{priority:2});
   if(d>=k.due_on){const start=Math.max(at9(k.due_on),time(k.created_at));add('kpTransferDue',k.id,k.reviewer_id,k.company_id,start,{priority:2});}
  }else if(k.status==='submitted')add('kpTransferSubmitted',k.id,k.reviewer_id,k.company_id,time(k.submitted_at));
 }
 for(const o of arr(extra.outcomes))if(courses.has(o.course_id))for(const id of adminAudience(o.company_id))if(id!==o.created_by)add('kpOutcome',o.id,id,o.company_id,time(o.created_at));
 return [...result.values()];
}
function swap(src,old,next){if(src.includes(next))return src;if(src.split(old).length!==2)throw Error('V34: contrato incompatível: '+old.slice(0,90));return src.replace(old,()=>next);}
export function patchQueue(src){
 const imp="import {readSnapshotV34,candidatesV34} from './notificacoes-v34.mjs';";
 if(!src.includes(imp))src=imp+'\n'+src;
 src=swap(src,'departments=[],secure=[]},now,since){','departments=[],secure=[],extra=null},now,since){');
 src=swap(src,' return [...result.values()].sort((a,b)=>a.priority-b.priority||a.at-b.at||a.key.localeCompare(b.key));',' for(const j of candidatesV34({state,lxp,assignments,companies,extra},now))result.set(j.key,j);\n return [...result.values()].sort((a,b)=>a.priority-b.priority||a.at-b.at||a.key.localeCompare(b.key));');
 src=swap(src,"  db.exec('COMMIT');return {state,lxp,assignments,companies,departments,secure};","  const extra=readSnapshotV34(db);\n  db.exec('COMMIT');return {state,lxp,assignments,companies,departments,secure,extra};");
 src=swap(src," db.prepare(\"INSERT OR IGNORE INTO learning_mail_v31_meta VALUES('since',?)\").run(t);"," db.prepare(\"INSERT OR IGNORE INTO learning_mail_v31_meta VALUES('since',?)\").run(t);\n db.prepare(\"INSERT OR IGNORE INTO learning_mail_v31_meta VALUES('v34_since',?)\").run(t);");
 return src;
}
export function patchPresentation(src){
 const imp="import {pageV34,actionV34,variantsV34} from './notificacoes-v34.mjs';";
 if(!src.includes(imp))src=imp+'\n'+src;
 return swap(src,'const legacy={','Object.assign(pages,pageV34);Object.assign(action,actionV34);Object.assign(variants,variantsV34);\nconst legacy={');
}
export function patchNavigation(src){
 const old="const directPages=['OKR','PDI','1:1','Feedback','Elogio','Desempenho','Pulse','Pulse Seguro','Catálogo LMS','Missões','Intranet','Rede social']";
 return swap(src,old,old.slice(0,-1)+",'Certificados','Avaliações educacionais','Eficácia dos treinamentos']");
}
function install(){const changes=[['notificacoes-v31.mjs',patchQueue],['email-notificacoes-v33.mjs',patchPresentation],['web-app.js',patchNavigation]];const all=changes.map(([f,fn])=>[f,fn(readFileSync(f,'utf8'))]);for(const [f,s] of all)writeFileSync(f,s);console.log('V34: eventos de conclusão, certificados, avaliações, ciclos e eficácia integrados à fila V31 e ao design V33.');}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--install'))install();
