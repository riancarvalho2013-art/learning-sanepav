/** V35: administrative dispatch of eligible events, using the existing V31 durable queue. */
import {createHash,timingSafeEqual} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {emailConfiguration} from './email-provider.mjs';
const arr=x=>Array.isArray(x)?x:[];
const hash=x=>createHash('sha256').update(String(x)).digest('hex');
const HEX=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const emailOK=x=>typeof x==='string'&&x.length<=300&&/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(x);
const fail=(ok,message,status=400)=>{if(!ok)throw Object.assign(new Error(message),{status})};
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'private,no-store'}});
const tx=(db,fn)=>{db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v}catch(e){db.exec('ROLLBACK');throw e}};
export function manualSchema(db){db.exec(`CREATE TABLE IF NOT EXISTS learning_mail_v35_manual(request_id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,recipient_id TEXT NOT NULL,base_key TEXT NOT NULL,send_key TEXT NOT NULL,email_hash TEXT NOT NULL,created INTEGER NOT NULL);CREATE INDEX IF NOT EXISTS mail_v35_base ON learning_mail_v35_manual(base_key,created);CREATE INDEX IF NOT EXISTS mail_v35_actor ON learning_mail_v35_manual(actor_id,created);`)}
export function requireAdmin(req,state,t=Date.now()){
 const token=(req.headers.get('cookie')||'').match(/(?:^|;\s*)learning=([^;]+)/)?.[1],identity=req.headers.get('oai-authenticated-user-id');
 fail(token&&identity,'Entre para continuar.',401);const d=hash(token);
 const session=arr(state.sessions).find(s=>typeof s.digest==='string'&&HEX.test(s.digest)&&timingSafeEqual(Buffer.from(s.digest),Buffer.from(d))&&s.identity===identity&&s.until>t);
 const user=arr(state.users).find(u=>u.id===session?.person&&u.active);fail(user,'Entre para continuar.',401);fail(user.role==='Administrador','Envio manual exclusivo da administração.',403);return user;
}
const terminal=new Set(['accepted','failed','uncertain','cancelled']);
const statusOf=(db,k)=>db.prepare('SELECT status,created,next_at FROM learning_mail_v31_jobs WHERE id=?').get(k);
export function mergeManual(db,base,state,now){
 const t=+now,byKey=new Map(base.map(j=>[j.key,j])),out=new Map(byKey),admins=new Set(arr(state.users).filter(u=>u.active&&u.role==='Administrador').map(u=>u.id));
 for(const r of db.prepare('SELECT * FROM learning_mail_v35_manual WHERE created>=? ORDER BY created').all(t-7*86400000)){
  const j=byKey.get(r.base_key);if(!j||j.recipient!==r.recipient_id||hash(j.email.toLowerCase())!==r.email_hash||!admins.has(r.actor_id))continue;
  // An accepted/failed/uncertain manual attempt is never replayed.
  if(terminal.has(statusOf(db,r.send_key)?.status))continue;
  out.set(r.send_key,{...j,key:r.send_key,priority:-1});
 }
 return [...out.values()].sort((a,b)=>a.priority-b.priority||a.at-b.at||a.key.localeCompare(b.key));
}
export function requestManual(db,{actor,job,requestId,now=Date.now()}){
 fail(actor?.active&&actor.role==='Administrador','Envio manual exclusivo da administração.',403);
 fail(UUID.test(requestId||'')&&job&&HEX.test(job.key)&&emailOK(job.email),'Evento ou requisição inválida.');
 return tx(db,()=>{
  const prior=db.prepare('SELECT * FROM learning_mail_v35_manual WHERE request_id=?').get(requestId);
  if(prior){fail(prior.actor_id===actor.id&&prior.base_key===job.key,'Requisição incompatível.',409);return {ok:true,queued:true,idempotent:true};}
  const old=statusOf(db,job.key),last=db.prepare('SELECT * FROM learning_mail_v35_manual WHERE base_key=? ORDER BY created DESC LIMIT 1').get(job.key);
  if(last){const status=statusOf(db,last.send_key)?.status;fail(status==='accepted'&&now-last.created>=86400000,'Já existe um disparo manual recente, pendente ou sem confirmação. Consulte o histórico.',409);}
  fail(!old||!['failed','uncertain','cancelled'].includes(old.status),'Envio anterior falhou ou está incerto. Verifique os logs do provedor antes de reenviar.',409);
  fail(!old||old.status!=='accepted'||now-old.created>=10*60000,'Aguarde pelo menos 10 minutos após o disparo anterior.',429);
  fail(db.prepare('SELECT count(*) n FROM learning_mail_v35_manual WHERE actor_id=? AND created>?').get(actor.id,now-3600000).n<50,'Limite de 50 solicitações manuais por hora.',429);
  // Pending automatic jobs keep their original identity and are only prioritized. Explicit resend after acceptance gets a new key.
  const sendKey=old?.status==='accepted'?hash('manual-v35:'+requestId):job.key;
  db.prepare('INSERT INTO learning_mail_v35_manual VALUES(?,?,?,?,?,?,?)').run(requestId,actor.id,job.recipient,job.key,sendKey,hash(job.email.toLowerCase()),now);
  return {ok:true,queued:true,idempotent:false};
 });
}
let shared;
export async function handleMailV35(req,{mailDb}={}){
 try{
  const path=new URL(req.url),method=req.method;
  if(!mailDb){const file=process.env.LEARNING_DB||'data/learning.sqlite';fail(file!==':memory:','Banco persistente necessário.',503);shared??=new DatabaseSync(file);}
  const db=mailDb||shared;
  const q=await import('./notificacoes-v31.mjs');q.schema(db);manualSchema(db);
  const raw=q.snapshot(db),actor=requireAdmin(req,raw.state),now=new Date();
  const since=db.prepare("SELECT v FROM learning_mail_v31_meta WHERE k='since'").get()?.v;
  if(path.pathname==='/api/mail/v35/people'&&method==='GET'){
   const activeCompanies=new Set(raw.companies.filter(c=>c.active!==0&&c.active!==false).map(c=>c.id));const eligible=new Set(raw.assignments.filter(a=>activeCompanies.has(a.company_id)).map(a=>a.person_id));
   return json({items:arr(raw.state.users).filter(u=>u.active&&eligible.has(u.id)&&emailOK(u.email)).map(u=>({id:u.id,name:u.name,email:u.email})).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),enabled:Boolean(emailConfiguration())&&process.env.LEARNING_NOTIFICATIONS_ENABLED!=='false'});
  }
  fail(Number.isFinite(since),'A fila de notificações ainda não foi iniciada.',503);
  const jobs=q.candidates(raw,now,since);
  if(path.pathname==='/api/mail/v35/events'&&method==='GET'){
   const person=path.searchParams.get('person');fail(UUID.test(person||''),'Selecione um colaborador.');
   const events=jobs.filter(j=>j.recipient===person).map(j=>{const last=db.prepare('SELECT * FROM learning_mail_v35_manual WHERE base_key=? ORDER BY created DESC LIMIT 1').get(j.key);const orig=statusOf(db,j.key),st=last?statusOf(db,last.send_key):orig;const status=st?.status||(last?'queued':'pending');let allowed=!['failed','uncertain','cancelled'].includes(orig?.status)&&(!last||st?.status==='accepted'&&+now-last.created>=86400000)&&(!orig||orig.status!=='accepted'||+now-orig.created>=600000);return {key:j.key,page:j.page,title:q.payload(j,'https://learning.example.test').subject.replace(/^Learning Academy \| /,''),at:j.at,due:j.due,status,allowed,resend:orig?.status==='accepted'};});
   return json({items:events.slice(0,300),total:events.length});
  }
  if(path.pathname==='/api/mail/v35/send'&&method==='POST'){
   fail(req.headers.get('origin')===path.origin,'Origem inválida.',403);fail(emailConfiguration()&&process.env.LEARNING_NOTIFICATIONS_ENABLED!=='false','Fila de e-mails indisponível.',503);
   let body;try{body=await req.json()}catch{fail(false,'Dados inválidos.');}fail(body&&typeof body==='object'&&!Array.isArray(body)&&HEX.test(body.key||'')&&UUID.test(body.requestId||''),'Dados inválidos.');
   const job=jobs.find(j=>j.key===body.key);fail(job,'Evento indisponível, expirado ou já concluído. Atualize a lista.',409);
   return json(requestManual(db,{actor,job,requestId:body.requestId,now:+now}),202);
  }
  return json({error:'Operação inexistente.'},404);
 }catch(e){return json({error:e.status?e.message:'Não foi possível processar o disparo.'},e.status||500)}
}
export function queueCandidatesV35(db,q,now,since){const raw=q.snapshot(db);return mergeManual(db,q.candidates(raw,now,since),raw.state,now);}
export function directFeedbackItem({actor,recipient,companyId,topic,answer,requestId,at}){
 fail(UUID.test(requestId||'')&&actor&&recipient&&actor.id!==recipient.id&&companyId,'Dados de feedback inválidos.');
 return {id:requestId,fromId:actor.id,toId:recipient.id,companyId,topic,answer,kind:'direct',status:'sent',createdAt:at,updatedAt:at};
}
function swap(s,old,next){if(s.includes(next))return s;if(s.split(old).length!==2)throw Error('V35: contrato incompatível: '+old.slice(0,100));return s.replace(old,()=>next)}
export function patchQueueV35(s){
 const imp="import {manualSchema,queueCandidatesV35} from './notificacoes-v35.mjs';";if(!s.includes(imp))s=imp+'\n'+s;
 s=swap(s,"const jobs=candidates(snapshot(db),now,since);","manualSchema(db);\n db.prepare('DELETE FROM learning_mail_v35_manual WHERE created<?').run(t-45*DAY);\n const jobs=queueCandidatesV35(db,{snapshot,candidates},now,since);");
 s=swap(s,'const live=candidates(snapshot(db),now,since).find(x=>x.key===j.key&&x.email===j.email);','const live=queueCandidatesV35(db,{snapshot,candidates},now,since).find(x=>x.key===j.key&&x.email===j.email);');
 s=swap(s,"if(f.status==='requested')add('feedback',f.id,f.toId,time(f.createdAt),{priority:2});","if(f.kind==='direct'){if(f.status==='sent'&&company(f.fromId)===f.companyId)add('feedbackReceived',f.id,f.toId,time(f.createdAt),{page:'Feedback',label:'Você recebeu um feedback',priority:2});continue;}\n  if(f.status==='requested')add('feedback',f.id,f.toId,time(f.createdAt),{priority:2});");
 s=swap(s,"if(o.status!=='active')continue;\n  const audience=okrAudience(o),history=arr(o.scopeHistory),last=history.at(-1);","if(o.status==='closed'){if(o.mailClosedV35At)for(const id of okrAudience(o))if(id!==o.closedBy)add('okrClosed',o.id,id,time(o.mailClosedV35At),{page:'OKR',label:'OKR encerrado',priority:2});continue;}\n  if(o.status!=='active')continue;\n  const audience=okrAudience(o),history=arr(o.scopeHistory),last=history.at(-1);");
 s=swap(s,"if(target)add('meeting',m.id,target,time(changed?m.mailScheduleChangedAt:m.createdAt),{label:changed?titles.meetingUpdate:titles.meeting,due:m.date,version:m.date,priority:2});","if(target)add('meeting',m.id,target,time(changed?m.mailScheduleChangedAt:m.createdAt),{label:changed?titles.meetingUpdate:titles.meeting,due:m.date,version:m.date,priority:2});\n  if(m.mailSharedChangedAt&&[a,b].includes(m.mailSharedChangedBy)&&time(m.mailSharedChangedAt)>Math.max(time(m.createdAt)||0,time(m.mailScheduleChangedAt)||0)){const recipient=[a,b].find(id=>id!==m.mailSharedChangedBy);add('meetingSharedUpdate',m.id,recipient,time(m.mailSharedChangedAt),{page:'1:1',label:'Conversa 1:1 atualizada',due:m.date,version:m.mailSharedChangedAt,priority:2});}");
 return s;
}
export function patchPresentationV35(s){return swap(s,'Object.assign(pages,pageV34);Object.assign(action,actionV34);Object.assign(variants,variantsV34);',"Object.assign(variants,{okrClosed:['OKR encerrado','Um objetivo que você acompanha foi encerrado. Consulte os resultados autorizados na plataforma.','Consultar OKR'],meetingSharedUpdate:['Conversa 1:1 atualizada','Os combinados ou a pauta de uma conversa foram atualizados. Confira os detalhes na sua conta.','Consultar conversa']});\nObject.assign(pages,pageV34);Object.assign(action,actionV34);Object.assign(variants,variantsV34);");}
export function patchOKRV35(s){return swap(s,"o.closedAt=timestamp();o.closedBy=u.id;","o.closedAt=timestamp();o.mailClosedV35At=o.closedAt;o.closedBy=u.id;");}
export function patchServerV35(s){const imp="import {handleMailV35} from './notificacoes-v35.mjs'";if(!s.includes(imp))s=imp+'\n'+s;return swap(s,'const routeRequest=createRouteRegistry([',"const routeRequest=createRouteRegistry([\n {prefix:'/api/mail/v35/',handler:request=>handleMailV35(request,context)},");}
export function patchLxpV35(s){
 const imp="import {directFeedbackItem} from './notificacoes-v35.mjs'";if(!s.includes(imp))s=imp+'\n'+s;
 s=swap(s,"if(m.date!==payload.date){m.mailScheduleChangedAt=now();m.mailScheduleChangedBy=user.id}Object.assign(m,payload,{updatedAt:now()});", "if(m.date!==payload.date){m.mailScheduleChangedAt=now();m.mailScheduleChangedBy=user.id}else if(m.agenda!==payload.agenda||m.action!==payload.action){m.mailSharedChangedAt=now();m.mailSharedChangedBy=user.id}Object.assign(m,payload,{updatedAt:now()});");
 s=swap(s,"db.feedbackRequests.filter(x=>feedbackVisible(user,x)).map", "db.feedbackRequests.filter(x=>feedbackVisible(user,x)&&(x.kind!=='direct'||x.companyId===company(state,x.fromId)&&x.companyId===company(state,x.toId)&&own(state,x.fromId)&&own(state,x.toId))).map");
 s=swap(s," if(path==='feedback'&&method==='POST'){",` if(path==='feedback/people'&&method==='GET'){
  const tenant=company(state,user.id);return reply({items:tenant?state.users.filter(p=>p.active&&p.id!==user.id&&company(state,p.id)===tenant).map(p=>({id:p.id,name:p.name})).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')):[]})
 }
 if(path==='feedback/send'&&method==='POST'){
  const b=await request();err(b&&typeof b==='object'&&!Array.isArray(b)&&uuid(b.requestId)&&uuid(b.toId),'Dados inválidos.');
  const topic=text(b.topic,300),answer=text(b.answer,3500);
  for(let attempt=0;attempt<4;attempt++){
   const raw=await BUCKET.get(LEGACY);err(raw,'Ambiente não inicializado.',503);const fresh=await raw.json(),actor=getUser(req,fresh),recipient=own(fresh,b.toId),tenant=company(fresh,actor.id);
   err(recipient&&recipient.id!==actor.id&&tenant&&tenant===company(fresh,recipient.id),'Selecione um colega da sua empresa.',403);
   const {etag,state:s}=await data(BUCKET);const prior=s.feedbackRequests.find(x=>x.id===b.requestId);
   if(prior){err(prior.kind==='direct'&&prior.fromId===actor.id&&prior.toId===recipient.id&&prior.companyId===tenant&&prior.topic===topic&&prior.answer===answer,'Requisição incompatível.',409);return reply({id:prior.id,idempotent:true},200)}
   checkCapacity(s,'feedbackRequests');const item=directFeedbackItem({actor,recipient,companyId:tenant,topic,answer,requestId:b.requestId,at:now()});s.feedbackRequests.push(item);audit(s,actor,'feedback.send',item.id);
   if(await BUCKET.put(STORE,JSON.stringify(s),{onlyIf:etag?{etagMatches:etag}:{etagDoesNotMatch:'*'},requireStateEtag:raw.etag,requireOrganizationRevision:fresh.organization?.revision}))return reply({id:item.id,idempotent:false},201)
  }
  err(false,'A estrutura ou o cadastro mudou. Atualize a página.',409)
 }
 if(path==='feedback'&&method==='POST'){`);
 return s;
}
export function patchFrontendV35(s){
 s=swap(s,"const entries=[['Minha jornada','growth'],['Academia de práticas','growth'],['Meu acesso','person']]","const entries=[['Minha jornada','growth'],['Academia de práticas','growth'],['Meu acesso','person']];if(d?.me?.role==='Administrador')entries.push(['Central de e-mails','bell'])");
 s=swap(s,"if(page==='Meu acesso'){void renderAccess();return}","if(page==='Meu acesso'){void renderAccess();return}\n if(page==='Central de e-mails'&&d?.me?.role==='Administrador'){void renderMailV35();return}");
 s=swap(s,"answered:'Respondido',requested:'Solicitado'","answered:'Respondido',sent:'Enviado',requested:'Solicitado'");
 s=swap(s,"const incoming=items.filter(x=>x.toId===d.me.id&&x.status==='requested').length,received=items.filter(x=>x.fromId===d.me.id&&x.status==='answered').length","const incoming=items.filter(x=>x.toId===d.me.id&&x.status==='requested').length,received=items.filter(x=>x.fromId===d.me.id&&x.status==='answered'||x.toId===d.me.id&&x.kind==='direct').length");
 s=swap(s,"metric('Respostas recebidas',received,'solicitações feitas por você')","metric('Feedbacks recebidos',received,'respostas e feedbacks espontâneos')");
 s=swap(s,"e(item.from.name)+' pediu a '+e(item.to.name)","e(item.from.name)+(item.kind==='direct'?' enviou feedback a ':' pediu a ')+e(item.to.name)");
 s=swap(s,"(item.status==='answered'?'<p>'+e(item.answer)","(['answered','sent'].includes(item.status)?'<p>'+e(item.answer)");
 s=swap(s,"button('Solicitar feedback','feedback-new','','primary')+button('Abrir reconhecimento público'","button('Enviar feedback','feedback-send','','primary')+button('Solicitar feedback','feedback-new')+button('Abrir reconhecimento público'");
 s=swap(s,"+side+'</div></div>',button('Solicitar feedback','feedback-new','','primary')))","+side+'</div></div>',button('Enviar feedback','feedback-send','','primary')+button('Solicitar feedback','feedback-new')))");
 s=swap(s,"async function showFeedbackNew(){\n const people=personOptions().filter(p=>p.company_id===companyPick()||!p.company_id)","async function showFeedbackNew(){\n const {items:people}=await apiLxp('feedback/people')");
 s=swap(s," 'feedback-new':showFeedbackNew,'feedback-answer'", " 'feedback-send':showFeedbackSendV35,'mail-center':()=>{mailPageV35=id||'';page='Central de e-mails';draw()},'feedback-new':showFeedbackNew,'feedback-answer'");
 s=swap(s,"<div class=\"lxp-heading-actions\">'+actions+'</div>","<div class=\"lxp-heading-actions\">'+actions+(d?.me?.role==='Administrador'&&['Pulse','Pulse Seguro','Desempenho','PDI','1:1','Feedback','OKR','Intranet','Elogio','Catálogo LMS','Missões','Certificados','Avaliações educacionais','Eficácia dos treinamentos'].includes(page)?button('Enviar e-mails','mail-center',page):'')+'</div>");
 s=swap(s,"async function showFeedbackAnswer(id){",FRONTEND+'\nasync function showFeedbackAnswer(id){');return s;
}
const FRONTEND=`
async function showFeedbackSendV35(){
 const {items:people}=await apiLxp('feedback/people');
 const content=people.length?panel('Feedback privado','<form id="lxpDirectFeedback35">'+select('Para quem?','toId',people.map(p=>[p.id,p.name]))+field('Assunto','topic','','text','required maxlength="300"')+textarea('Seu feedback','answer','','required maxlength="3500"')+'<p class="lxp-note">O conteúdo ficará disponível apenas para os participantes. Um aviso por e-mail será processado automaticamente, sem incluir o conteúdo.</p><div class="lxp-form-actions">'+button('Cancelar','feedback-back')+'<button type="submit" class="lxp-btn primary">Enviar feedback</button></div></form>'):empty('Nenhum colega disponível','Verifique seu vínculo empresarial.');
 enterScreen(screen('Cultura de feedback','Enviar feedback','Compartilhe observações objetivas e sugestões de desenvolvimento.',content));
 const form=$('lxpDirectFeedback35');if(!form)return;form.dataset.requestId=crypto.randomUUID();form.onsubmit=async ev=>{ev.preventDefault();const b=form.querySelector('[type="submit"]');if(b.disabled)return;b.disabled=true;try{await apiLxp('feedback/send',{...Object.fromEntries(new FormData(form)),requestId:form.dataset.requestId});notify('Feedback registrado. O aviso por e-mail será processado automaticamente.');void renderFeedback()}catch(ex){notify(ex.message);b.disabled=false}};
}
let mailPageV35='',mailPersonV35='';
async function renderMailV35(){
 if(d?.me?.role!=='Administrador')return;
 await asyncScreen(screen('Administração','Central de e-mails','Disparos manuais de notificações reais da plataforma.',load()),async current=>{
  const data=await api('mail/v35/people');if(!current())return;const people=data.items||[];
  const content=panel('Destinatário',select('Colaborador e e-mail cadastrado','mailPerson35',[['','Selecione'],...people.map(p=>[p.id,p.name+' · '+p.email])],mailPersonV35)+field('Filtrar módulo','mailFilter35',mailPageV35,'search')+'<p class="lxp-note">A central mostra eventos recentes ainda elegíveis. A fila aplica o mesmo controle de acesso, limite e identidade visual dos disparos automáticos. Convites de acesso ficam em Pessoas; a recuperação de senha é individual.</p>'+(!data.enabled?error('Provedor ou fila de notificações indisponível.'):'')+'<button type="button" class="lxp-btn" id="mailRefresh35">Atualizar status</button><div id="mailEvents35" role="region" aria-label="Notificações disponíveis"></div>');
  enterScreen(screen('Administração','Central de e-mails','Envie ou reenvie notificações personalizadas sem expor conteúdos privados.',content));
  const sel=root().querySelector('[name="mailPerson35"]'),filter=root().querySelector('[name="mailFilter35"]'),host=$('mailEvents35');let seq=0;
  const labels={pending:'Disponível',queued:'Na fila',sending:'Em processamento',retry:'Nova tentativa pendente',accepted:'Aceito pelo provedor',failed:'Falhou',uncertain:'Entrega incerta',cancelled:'Cancelado'};
  let rows=[];
  const paint=()=>{if(!host.isConnected)return;const term=filter.value.trim().toLocaleLowerCase('pt-BR');const visible=rows.filter(x=>!term||(x.page+' '+x.title).toLocaleLowerCase('pt-BR').includes(term));host.innerHTML=visible.length?'<div class="lxp-stack">'+visible.map(x=>'<article class="lxp-line"><div><strong>'+e(x.title)+'</strong><small>'+e(x.page)+' · '+e(new Date(x.at).toLocaleString('pt-BR'))+' · '+e(labels[x.status]||x.status)+'</small></div><button type="button" class="lxp-btn" data-mail35="'+e(x.key)+'"'+(!x.allowed||!data.enabled?' disabled':'')+'>'+e(x.resend?'Reenviar e-mail':'Enviar e-mail')+'</button></article>').join('')+'</div>':empty('Nenhum evento disponível','Selecione outro colaborador ou aguarde um evento válido.');};
  const reload=async()=>{const n=++seq;mailPersonV35=sel.value;rows=[];if(!sel.value){paint();return}host.innerHTML=load();try{const v=await api('mail/v35/events?person='+encodeURIComponent(sel.value));if(n!==seq||!host.isConnected)return;rows=v.items||[];paint()}catch(ex){if(n===seq&&host.isConnected)host.innerHTML=error(ex.message)}};
  sel.onchange=reload;$('mailRefresh35').onclick=reload;filter.oninput=()=>{mailPageV35=filter.value;paint()};host.onclick=async ev=>{const b=ev.target.closest('[data-mail35]');if(!b||b.disabled)return;const row=rows.find(x=>x.key===b.dataset.mail35),p=people.find(x=>x.id===sel.value);if(!row||!p||!confirm((row.resend?'Reenviar':'Enviar')+' '+row.title+' para '+p.email+'?'))return;b.disabled=true;try{await api('mail/v35/send',{key:row.key,requestId:crypto.randomUUID()});notify('Solicitação registrada na fila. O aceite do provedor não garante entrega na caixa de entrada.');await reload()}catch(ex){notify(ex.message);b.disabled=false}};
  await reload();
 });
}
`;
export function patchLxpTestV35(s){
 const marker="console.log('LXP V2: fluxos críticos de autorização, avaliação, Pulse, PDI, 1:1 e feedback passaram.')";
 return swap(s,marker,`// V35 regression: exercise the real LXP route, not only the mailer.
const direct35={toId:workers[1],topic:'Contribuição na entrega',answer:'Conteúdo privado do feedback espontâneo',requestId:rid()};
r=await call('feedback/people',{as:workers[0]});assert(r.items.some(p=>p.id===workers[1]));assert(!r.items.some(p=>p.id===outsider||p.id===workers[0]));
r=await call('feedback/send',{as:workers[0],method:'POST',body:direct35});assert.equal(r.httpStatus,201);assert.equal(r.id,direct35.requestId);
r=await call('feedback/send',{as:workers[0],method:'POST',body:direct35});assert.equal(r.httpStatus,200);assert.equal(r.idempotent,true);
r=await call('feedback/send',{as:workers[0],method:'POST',body:{...direct35,answer:'Alteração indevida'}});deny(r,409);
r=await call('feedback/send',{as:workers[0],method:'POST',body:{...direct35,toId:outsider,requestId:rid()}});deny(r,403);
r=await call('feedback/send',{as:workers[0],method:'POST',origin:'https://evil.test',body:{...direct35,requestId:rid()}});deny(r,403);
r=await call('feedback',{as:workers[1]});assert.equal(r.items.find(x=>x.id===direct35.requestId).answer,direct35.answer);
r=await call('feedback',{as:admin});assert(!r.items.some(x=>x.id===direct35.requestId));
r=await call('feedback',{as:outsider});assert(!r.items.some(x=>x.id===direct35.requestId));
r=await call('feedback/answer',{as:workers[1],method:'POST',body:{id:direct35.requestId,answer:'Resposta não solicitada'}});deny(r,409);
console.log('V35: feedback direto, idempotência, origem e privacidade validados pelo handler LXP.');
`+marker);
}
function install(){const edits=[['notificacoes-v31.mjs',patchQueueV35],['email-notificacoes-v33.mjs',patchPresentationV35],['serve.mjs',patchServerV35],['okr-v13.mjs',patchOKRV35],['lxp-v2.mjs',patchLxpV35],['web-lxp-v2.js',patchFrontendV35],['verify-lxp-v2.mjs',patchLxpTestV35]];const outputs=edits.map(([f,fn])=>[f,fn(readFileSync(f,'utf8'))]);for(const [f,s] of outputs)writeFileSync(f,s);console.info('V35: central administrativa, feedback direto e eventos adicionais integrados.');}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--install'))install();
