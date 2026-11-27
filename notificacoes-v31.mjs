// Learning Academy V31 — transactional notifications, server-side only.
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {emailConfiguration,sendTransactional} from './email-provider.mjs';
const DAY=86400000, MIN=60000, WINDOW=7*DAY;
const hash=v=>createHash('sha256').update(String(v)).digest('hex');
const arr=v=>Array.isArray(v)?v:[];
const local=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
const hour=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'});
const day=t=>local.format(new Date(t));
const shift=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*DAY).toISOString().slice(0,10);
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d));
const time=v=>typeof v==='string'?Date.parse(v):NaN;
const isEmail=v=>typeof v==='string'&&v.length<=300&&/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(v);
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titles={weekly:'Seu Pulse semanal está aberto',pulse:'Nova pesquisa Pulse disponível',pulseFriday:'Lembrete de pesquisa Pulse',pdi:'Nova ação de PDI',pdiUpdate:'Atualização no PDI',meeting:'Nova conversa 1:1 agendada',meetingUpdate:'Conversa 1:1 reagendada',feedback:'Solicitação de feedback',feedbackAnswer:'Seu feedback recebeu uma resposta',okr:'Novo OKR publicado',okrUpdate:'OKR atualizado',okrCheck:'Novo check-in de OKR',post:'Nova publicação na Intranet',legacy:'Nova notificação no Learning'};
const pages={weekly:'Pulse',pulse:'Pulse',pulseFriday:'Pulse',pdi:'PDI',pdiUpdate:'PDI',meeting:'1:1',meetingUpdate:'1:1',feedback:'Feedback',feedbackAnswer:'Feedback',okr:'OKR',okrUpdate:'OKR',okrCheck:'OKR',post:'Intranet'};
const legacyPages=new Set(['OKR','PDI','1:1','Feedback','Elogio','Desempenho','Pulse','Catálogo LMS','Missões','Intranet','Rede social']);
export function candidates({state={},lxp={},assignments=[],companies=[],departments=[],secure=[]},now,since){
 const t=+now,d=day(t),h=Number(hour.format(new Date(t))),weekday=new Date(d+'T00:00:00Z').getUTCDay();
 const friday=shift(d,-((weekday+2)%7)),weeklyOpen=[5,6,0].includes(weekday)&&(weekday!==5||h>=9);
 const active=new Map(arr(state.users).filter(u=>u.active).map(u=>[u.id,u]));
 const links=new Map(assignments.map(a=>[a.person_id,a]));
 const orgs=new Set(companies.filter(c=>c.active!==0&&c.active!==false).map(c=>c.id));
 const company=id=>{const c=links.get(id)?.company_id;return orgs.has(c)?c:null};
 const same=(a,b)=>Boolean(active.has(a)&&active.has(b)&&company(a)&&company(a)===company(b));
 const eligible=id=>active.has(id)&&company(id)&&isEmail(active.get(id).email);
 const manager=id=>{const m=active.get(id)?.manager;return same(id,m)&&active.get(m)?.role==='Líder'?m:null};
 const descends=(id,leader)=>{const seen=new Set();while(id&&same(id,leader)&&!seen.has(id)){if(id===leader)return true;seen.add(id);id=active.get(id)?.manager}return false};
 const result=new Map();
 const add=(kind,entity,recipient,at,{page=pages[kind],label=titles[kind],due='',version='',target=entity,priority=10}={})=>{
  if(!eligible(recipient)||!Number.isFinite(at)||at>t||at<Math.max(since,t-WINDOW)||!label||!page)return;
  const key=hash(JSON.stringify([kind,entity,recipient,version]));
  result.set(key,{key,kind,recipient,email:active.get(recipient).email,page,label,due:validDate(due)?due:'',target:uuid(target)?target:'',at,priority});
 };
 const events=arr(lxp.events);
 // The native weekly check-in opens Friday and closes Sunday. Never send after response.
 if(weeklyOpen)for(const id of active.keys()){
  if(arr(state.records).some(r=>r.kind==='Pulse'&&r.person===id&&!r.pulse&&r.date>=friday&&r.date<=shift(friday,2)))continue;
  add('weekly',friday,id,Math.max(since,Date.parse(friday+'T09:00:00-03:00')),{target:'',due:shift(friday,2),priority:0});
 }
 // Surveys are assigned by the existing authorized modules, not by this mailer.
 const surveys=[...arr(lxp.pulses).map(s=>({id:s.id,company:s.companyId,starts:s.startDate,ends:s.endDate,status:s.status,created:s.createdAt,people:arr(s.participants).filter(id=>!arr(lxp.pulseResponses).some(r=>r.surveyId===s.id&&r.userId===id)),page:'Pulse'})),
 ...arr(secure).map(s=>({id:s.id,company:s.company_id,starts:s.starts_on,ends:s.ends_on,status:s.status,created:s.created_at,people:arr(s.people),page:'Pulse Seguro'})),
 ...arr(state.pulses).map(s=>({id:s.id,company:company(s.author),starts:null,ends:s.date,status:'published',created:null,people:arr(s.people).filter(id=>!arr(state.records).some(r=>r.pulse===s.id&&r.person===id)),page:'Pulse'}))];
 for(const s of surveys){
  if(!orgs.has(s.company)||s.status!=='published'||!validDate(s.ends)||s.ends<d||(s.starts&&s.starts>d))continue;
  // Legacy surveys lack creation dates; the legacy notification below handles the initial invitation.
  const start=Math.max(time(s.created)||0,s.starts?Date.parse(s.starts+'T00:00:00-03:00'):0);
  for(const id of s.people){if(company(id)!==s.company)continue;
   if(s.created&&start>=since)add('pulse',s.id,id,start,{page:s.page,due:s.ends,priority:1});
   if(weeklyOpen&&day(start||0)<friday&&!arr(state.notifications?.[id]).some(n=>n.page==='Pulse'&&n.target===s.id&&day(time(n.at)||0)===friday))add('pulseFriday',s.id,id,Math.max(since,Date.parse(friday+'T09:00:00-03:00')),{page:s.page,due:s.ends,version:friday,priority:1});
  }
 }
 for(const a of arr(lxp.pdiActions)){
  if(!eligible(a.personId)||!a.companyId||company(a.personId)!==a.companyId)continue;
  const recipients=new Set([a.personId,manager(a.personId)]);
  if(a.status!=='done')for(const id of recipients)if(id&&id!==a.createdBy)add('pdi',a.id,id,time(a.createdAt),{due:a.dueDate,priority:2});
  for(const ev of events)if(ev.entity===a.id&&ev.action==='pdi.update'&&(ev.userId===a.personId||same(ev.userId,a.personId)||active.get(ev.userId)?.role==='Administrador')){
   for(const id of recipients)if(id&&id!==ev.userId)add('pdiUpdate',a.id,id,time(ev.at),{due:a.dueDate,version:ev.at,priority:2});
  }
 }
 for(const m of arr(lxp.meetings)){
  const [a,b]=arr(m.participants);if(!same(a,b)||!validDate(m.date)||m.date<d)continue;
  const other=[a,b].find(id=>id!==m.createdBy);
  // One notification per participant and scheduled date; same-date edits do not replay an already sent invitation.
  const changed=m.mailScheduleChangedAt&&[a,b].includes(m.mailScheduleChangedBy);
  const actor=changed?m.mailScheduleChangedBy:m.createdBy;
  const target=[a,b].find(id=>id!==actor)||other;
  if(target)add('meeting',m.id,target,time(changed?m.mailScheduleChangedAt:m.createdAt),{label:changed?titles.meetingUpdate:titles.meeting,due:m.date,version:m.date,priority:2});
 }
 for(const f of arr(lxp.feedbackRequests)){
  if(!same(f.fromId,f.toId))continue;
  if(f.status==='requested')add('feedback',f.id,f.toId,time(f.createdAt),{priority:2});
  if(f.status==='answered')add('feedbackAnswer',f.id,f.fromId,time(f.updatedAt),{priority:2});
 }
 function okrAudience(o){
  if(!orgs.has(o.companyId))return [];
  const people=[...active.values()].filter(p=>company(p.id)===o.companyId);
  if((o.scope||'individual')==='individual'){
   if(company(o.ownerId)!==o.companyId||o.departmentId&&links.get(o.ownerId)?.department_id!==o.departmentId)return [];
   return [o.ownerId,manager(o.ownerId)].filter(Boolean);
  }
  if(o.scope==='company')return people.filter(p=>p.role==='Diretoria').map(p=>p.id);
  if(o.scope==='department'&&!departments.some(x=>x.id===o.departmentId&&x.company_id===o.companyId&&x.active!==0&&x.active!==false))return [];
  if(o.scope==='department')return people.filter(p=>links.get(p.id)?.department_id===o.departmentId||p.role==='Diretoria'||p.role==='Líder'&&people.some(q=>links.get(q.id)?.department_id===o.departmentId&&descends(q.id,p.id))).map(p=>p.id);
  return [];
 }
 for(const o of arr(lxp.okrsV13)){
  if(o.status!=='active')continue;
  const audience=okrAudience(o),history=arr(o.scopeHistory),last=history.at(-1);
  // A retarget must not replay the original publication to its newly assigned audience.
  const changed=last&&time(last.at)>time(o.publishedAt);
  const publisher=events.find(e=>e.entity===o.id&&e.action==='okr.publish')?.userId||o.createdBy;
  for(const id of audience)if(id!==(changed?last.actorId:publisher))add(changed?'okrUpdate':'okr',o.id,id,time(changed?last.at:o.publishedAt),{due:o.endsOn,version:changed?last.at:'',priority:2});
  for(const kr of arr(o.results))for(const c of arr(kr.checkins)){
   // Check-ins are sent only between the individual owner and their authorized direct leader.
   if((o.scope||'individual')!=='individual'||!audience.includes(c.actorId))continue;
   for(const id of audience)if(id!==c.actorId)add('okrCheck',o.id,id,time(c.at),{version:c.requestId,priority:2});
  }
 }
 // New Intranet posts: same active company only; no author, text, attachments or cross-company broadcast.
 for(const p of arr(state.socialPosts))if(time(p.at)>=Math.max(since,t-WINDOW)&&time(p.at)<=t)for(const id of active.keys())if(id!==p.author&&same(id,p.author))add('post',p.id,id,time(p.at),{priority:8});
 // Preserve the previous legacy module notifications, with generic content and live scope checks.
 for(const [id,items] of Object.entries(state.notifications||{})){
  if(!eligible(id))continue;
  for(const n of arr(items)){
   if(!legacyPages.has(n.page))continue;
   let allowed=false;
   if(['PDI','OKR','1:1','Feedback','Elogio','Desempenho'].includes(n.page)){
    const r=arr(state.records).find(r=>r.id===n.target);allowed=Boolean(r&&r.person===id&&(same(r.author,id)||r.author===id||active.get(r.author)?.role==='Administrador'));
   }else if(n.page==='Pulse')allowed=surveys.some(s=>s.id===n.target&&s.company===company(id)&&s.status==='published'&&s.ends>=d&&s.people.includes(id));
   else if(['Intranet','Rede social'].includes(n.page))allowed=arr(state.socialPosts).some(p=>p.id===n.target&&p.author===id);
   else if(n.page==='Catálogo LMS')allowed=arr(state.enroll).some(e=>e.person===id&&e.course===n.target);
   else if(n.page==='Missões')allowed=arr(state.missionEnrollments).some(e=>e.person===id&&(e.mission===n.target||e.id===n.target))||arr(state.missionAssignments).some(e=>e.person===id&&(e.mission===n.target||e.id===n.target));
   if(allowed)add('legacy',n.id,id,time(n.at),{page:n.page==='Rede social'?'Intranet':n.page,label:'Você tem uma nova notificação em '+(n.page==='Rede social'?'Intranet':n.page),due:n.due,target:n.target,priority:4});
  }
 }
 // Keep deadline notices for the original modules and current PDI/OKR assignments.
 function deadline(entity,id,page,due){
  if(!validDate(due)||due>shift(d,3)||due<shift(d,-1))return;
  const slot=due<d?shift(due,1):shift(due,-3),start=Date.parse(slot+'T09:00:00-03:00');
  if(start>t)return;
  add('deadline',entity,id,Math.max(start,since),{page,label:page+(due<d?' · prazo vencido':' · prazo próximo'),due,version:due+(due<d?'-late':''),priority:3});
 }
 for(const r of arr(state.records))if(['PDI','1:1','OKR','Desempenho'].includes(r.kind)&&r.status!=='Concluído'&&(r.author===r.person||same(r.author,r.person)||active.get(r.author)?.role==='Administrador'))deadline(r.id,r.person,r.kind,r.date);
 for(const e of arr(state.enroll))if(e.progress!==100&&arr(state.courses).some(c=>c.id===e.course))deadline(e.course,e.person,'Catálogo LMS',e.due);
 for(const a of arr(lxp.pdiActions))if(a.status!=='done'&&company(a.personId)===a.companyId)deadline(a.id,a.personId,'PDI',a.dueDate);
 for(const o of arr(lxp.okrsV13))if(o.status==='active'&&(o.scope||'individual')==='individual'&&okrAudience(o).includes(o.ownerId))deadline(o.id,o.ownerId,'OKR',o.endsOn);
 return [...result.values()].sort((a,b)=>a.priority-b.priority||a.at-b.at||a.key.localeCompare(b.key));
}
export function payload(job,origin){
 const url=new URL('/',origin);url.searchParams.set('view',job.page);if(job.target)url.searchParams.set('item',job.target);
 const intro=job.kind==='weekly'?'Registre como foi sua semana. O Pulse semanal fica disponível até domingo.':'Acesse sua conta para consultar a novidade e realizar a ação, quando aplicável.';
 const date=job.due?'Data / prazo: '+job.due.split('-').reverse().join('/') : '';
 const subject='Learning Academy | '+job.label;
 return {subject,text:[job.label,intro,date,'Acessar Learning Academy: '+url].filter(Boolean).join('\n\n'),html:'<!doctype html><html lang="pt-BR"><body style="margin:0;background:#eef4fa;font-family:Arial,sans-serif;color:#173b60"><table role="presentation" width="100%" style="max-width:580px;margin:24px auto;background:white;border-radius:12px;overflow:hidden"><tr><td style="padding:24px;background:#174d85;color:white"><strong>Learning Academy</strong><p>Aprenda, evolua, desenvolva competências.</p></td></tr><tr><td style="padding:28px"><h2>'+escape(job.label)+'</h2><p>'+escape(intro)+'</p>'+(date?'<p>'+escape(date)+'</p>':'')+'<p><a href="'+escape(url)+'" style="display:inline-block;background:#216ab4;color:white;padding:14px 22px;border-radius:8px;text-decoration:none">Acessar Learning Academy</a></p><p style="font-size:12px;color:#53677a">Aviso automático. Informações de desenvolvimento são acessíveis somente após autenticação.</p></td></tr></table></body></html>'};
}
export function schema(db){db.exec(`PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS learning_mail_v31_meta(k TEXT PRIMARY KEY,v INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS learning_mail_v31_jobs(id TEXT PRIMARY KEY,status TEXT NOT NULL,attempts INTEGER NOT NULL,next_at INTEGER NOT NULL,first_uncertain INTEGER NOT NULL,email_hash TEXT NOT NULL,created INTEGER NOT NULL,code INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS learning_mail_v31_daily(day TEXT PRIMARY KEY,attempts INTEGER NOT NULL);`);}
function tx(db,fn){db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v}catch(e){db.exec('ROLLBACK');throw e}}
function object(db,key){const r=db.prepare('SELECT body FROM objects WHERE key=?').get(key);return r?JSON.parse(Buffer.from(r.body).toString()):null}
export function snapshot(db){
 db.exec('BEGIN');try{
  const state=object(db,'system/state-v1')||{},lxp=object(db,'lxp/v2/state')||{};
  const assignments=db.prepare('SELECT person_id,company_id,department_id FROM person_organizations').all(),companies=db.prepare('SELECT id,active FROM companies').all(),departments=db.prepare('SELECT id,company_id,active FROM departments').all();
  const secure=[];if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='pulse_v5_invites'").get()){
   const rows=db.prepare("SELECT s.id,s.company_id,s.starts_on,s.ends_on,s.status,s.created_at,i.user_id FROM pulse_v5_surveys s JOIN pulse_v5_invites i ON i.survey_id=s.id WHERE s.status='published' AND i.responded=0").all(),map=new Map();
   for(const r of rows){if(!map.has(r.id))map.set(r.id,{...r,people:[]});map.get(r.id).people.push(r.user_id)}secure.push(...map.values());
  }
  db.exec('COMMIT');return {state,lxp,assignments,companies,departments,secure};
 }catch(e){db.exec('ROLLBACK');throw e}
}
export function reserve(db,j,now,cap){return tx(db,()=>{
 const t=+now,d=day(t),emailHash=hash(j.email.toLowerCase()),old=db.prepare('SELECT * FROM learning_mail_v31_jobs WHERE id=?').get(j.key);
 if(old&&(['accepted','failed','uncertain','cancelled'].includes(old.status)||old.next_at>t))return false;
 if(old&&(old.email_hash!==emailHash||old.attempts>=12||(old.first_uncertain&&t-old.first_uncertain>10*MIN))){db.prepare("UPDATE learning_mail_v31_jobs SET status=? WHERE id=?").run(old.first_uncertain?'uncertain':'cancelled',j.key);return false}
 const count=db.prepare('SELECT attempts FROM learning_mail_v31_daily WHERE day=?').get(d)?.attempts||0;if(count>=cap)return false;
 db.prepare('INSERT INTO learning_mail_v31_daily VALUES(?,1) ON CONFLICT(day) DO UPDATE SET attempts=attempts+1').run(d);
 db.prepare("INSERT INTO learning_mail_v31_jobs VALUES(?,'sending',1,?,?,?, ?,0) ON CONFLICT(id) DO UPDATE SET status='sending',attempts=attempts+1,next_at=excluded.next_at,first_uncertain=CASE WHEN first_uncertain=0 THEN excluded.first_uncertain ELSE first_uncertain END").run(j.key,t+2*MIN,t,emailHash,t);
 return true;
})}
export function finish(db,key,t,status,duplicate=false){
 // Unknown outcomes are retried only inside the provider's conservative idempotency window.
 let state='retry',next=t+2*MIN,uncertain=true;
 if(duplicate||status>=200&&status<300){state='accepted';next=0;uncertain=false}
 else if([400,404,422].includes(status)){state='failed';next=0;uncertain=false}
 else if([401,403,429].includes(status)){next=t+60*MIN;uncertain=false}
 db.prepare('UPDATE learning_mail_v31_jobs SET status=?,next_at=?,first_uncertain=CASE WHEN ? THEN first_uncertain ELSE 0 END,code=? WHERE id=?').run(state,next,uncertain?1:0,status||0,key);
}
export async function tick(db,config,{now=new Date(),fetcher=globalThis.fetch,cap=250,batch=12}={}){
 const t=+now;
 db.prepare("INSERT OR IGNORE INTO learning_mail_v31_meta VALUES('since',?)").run(t);
 const since=db.prepare("SELECT v FROM learning_mail_v31_meta WHERE k='since'").get().v;
 const paused=db.prepare("SELECT v FROM learning_mail_v31_meta WHERE k='pause_until'").get()?.v||0;if(paused>t)return 0;
 db.prepare('DELETE FROM learning_mail_v31_jobs WHERE created<?').run(t-45*DAY);
 db.prepare('DELETE FROM learning_mail_v31_daily WHERE day<?').run(shift(day(t),-45));
 const jobs=candidates(snapshot(db),now,since);
 let attempted=0;
 for(const j of jobs){
  if(attempted>=batch)break;
  const previous=db.prepare('SELECT status,next_at FROM learning_mail_v31_jobs WHERE id=?').get(j.key);
  if(previous&&(['accepted','failed','uncertain','cancelled'].includes(previous.status)||previous.next_at>t))continue;
  if((db.prepare('SELECT attempts FROM learning_mail_v31_daily WHERE day=?').get(day(t))?.attempts||0)>=cap)break;
  // Re-read state before each dispatch; disabled accounts, completed surveys and scope changes cancel eligibility.
  const live=candidates(snapshot(db),now,since).find(x=>x.key===j.key&&x.email===j.email);if(!live)continue;
  if(!reserve(db,live,now,cap))continue;
  attempted++;
  let status=0,duplicate=false;
  try{await sendTransactional({id:live.key,email:live.email},config,payload(live,config.origin),async(url,options)=>{
    const response=await fetcher(url,options);status=response.status;
    if(status===400||status===409){try{const json=await response.clone().json();duplicate=json.code==='duplicate_parameter'&&/idempotency/i.test(String(json.message||''))}catch{}}
    return response;
  })}catch{}
  finish(db,live.key,+now,status,duplicate);
  if([401,403,429].includes(status)){db.prepare("INSERT INTO learning_mail_v31_meta VALUES('pause_until',?) ON CONFLICT(k) DO UPDATE SET v=max(v,excluded.v)").run(t+60*MIN);break;}
 }
 return attempted;
}
export function start(){
 const config=emailConfiguration();if(!config||process.env.LEARNING_NOTIFICATIONS_ENABLED==='false')return;
 const path=process.env.LEARNING_DB||'data/learning.sqlite';if(path===':memory:')return;
 const cap=Math.max(1,Math.min(10000,Number(process.env.LEARNING_NOTIFICATION_DAILY_LIMIT)||250));
 const db=new DatabaseSync(path);schema(db);let running=false;
 const cycle=async()=>{if(running)return;running=true;try{await tick(db,config,{cap})}catch{console.warn('Learning V31: fila de notificações indisponível; nova tentativa automática.')}finally{running=false}};
 void cycle();setInterval(cycle,60000).unref();console.info('Learning V31: notificações automáticas habilitadas.');
}
function install(){
 const edits=[['platform.mjs',"if(emailSettings()) import('./storage.mjs').then(({BUCKET})=>startEmailDelivery(BUCKET)).catch(()=>console.warn('Não foi possível iniciar a fila de e-mails.'))","// V31: legacy Resend-only worker superseded by the provider-aware server scheduler."],['serve.mjs',"server.listen(listenPort,devMode?'127.0.0.1':'0.0.0.0')","server.once('listening',()=>{import('./notificacoes-v31.mjs').then(m=>m.start()).catch(()=>console.warn('Learning V31: falha ao iniciar notificações.'))})\nserver.listen(listenPort,devMode?'127.0.0.1':'0.0.0.0')"],['lxp-v2.mjs',"Object.assign(m,payload,{updatedAt:now()});m.privateNotes??={};","if(m.date!==payload.date){m.mailScheduleChangedAt=now();m.mailScheduleChangedBy=user.id}Object.assign(m,payload,{updatedAt:now()});m.privateNotes??={};"],['web-app.js',"const directPages=['OKR','PDI','1:1','Feedback','Elogio','Desempenho','Pulse','Catálogo LMS','Missões','Intranet','Rede social']","const directPages=['OKR','PDI','1:1','Feedback','Elogio','Desempenho','Pulse','Pulse Seguro','Catálogo LMS','Missões','Intranet','Rede social']"]];
 const prepared=edits.map(([file,old,replacement])=>{const src=readFileSync(file,'utf8');if(src.includes(replacement))return [file,src];if(src.split(old).length!==2)throw Error('V31: base incompatível em '+file);return [file,src.replace(old,replacement)]});
 for(const [file,src] of prepared)writeFileSync(file,src);console.log('V31: integração de notificações aplicada.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--install'))install();
