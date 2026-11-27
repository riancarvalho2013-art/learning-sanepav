/** V33: presentation only; V31 remains authoritative for recipients, timing and queue. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain=v=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,90);
const pages={'Pulse':'Pulse','Pulse Seguro':'Pulse Seguro','1:1':'Conversas 1:1','Feedback':'Feedback','PDI':'Plano de Desenvolvimento Individual','OKR':'Objetivos e Resultados-Chave','Intranet':'Intranet','Rede social':'Intranet','Catálogo LMS':'Aprendizagem','Missões':'Trilhas de aprendizagem','Elogio':'Reconhecimento','Desempenho':'Avaliação de desempenho'};
const action={'Pulse':'Responder Pulse','Pulse Seguro':'Responder pesquisa','1:1':'Consultar conversa','Feedback':'Acessar feedback','PDI':'Consultar meu PDI','OKR':'Acessar OKRs','Intranet':'Abrir Intranet','Rede social':'Abrir Intranet','Catálogo LMS':'Acessar treinamentos','Missões':'Acessar trilhas','Elogio':'Ver reconhecimento','Desempenho':'Acessar avaliações'};
// Only fixed event types, never free-form subjects, notes or survey responses.
const variants={
 weekly:['Seu Pulse semanal está aberto','Como foi sua semana? Reserve um momento para registrar seu check-in. O Pulse fica disponível até domingo.','Responder meu Pulse'],
 pulse:['Nova pesquisa Pulse disponível','Uma pesquisa foi disponibilizada para você. Acesse a plataforma e participe.','Responder pesquisa'],
 pulseFriday:['Lembrete de pesquisa Pulse','Você tem uma pesquisa pendente. Reserve um momento para participar antes do encerramento.','Responder pesquisa'],
 pdi:['Nova ação de PDI','Há uma nova ação de desenvolvimento vinculada ao seu acompanhamento. Consulte os próximos passos na plataforma.','Acessar PDI'],
 pdiUpdate:['Atualização no PDI','Uma ação de desenvolvimento que você acompanha foi atualizada. Consulte os detalhes na plataforma.','Acessar PDI'],
 meeting:['Nova conversa 1:1 agendada','Uma conversa de acompanhamento foi agendada. Consulte a data e prepare-se para o encontro.','Consultar conversa'],
 meetingUpdate:['Conversa 1:1 reagendada','A data de uma conversa de acompanhamento foi alterada. Confira o novo agendamento.','Consultar conversa'],
 feedback:['Solicitação de feedback','Você recebeu uma solicitação de feedback. Acesse sua conta para participar.','Responder feedback'],
 feedbackAnswer:['Seu feedback recebeu uma resposta','Uma solicitação de feedback que você enviou foi respondida. Consulte a resposta com privacidade.','Consultar resposta'],
 okr:['Novo OKR publicado','Um objetivo foi disponibilizado no seu escopo de acesso. Consulte os resultados-chave e os próximos passos.','Acessar OKRs'],
 okrUpdate:['OKR atualizado','Um objetivo que você acompanha teve seu escopo atualizado. Consulte os detalhes na plataforma.','Acessar OKRs'],
 okrCheck:['Novo check-in de OKR','Há uma atualização de acompanhamento em um objetivo do seu escopo. Consulte o progresso na plataforma.','Ver acompanhamento'],
 post:['Nova publicação na Intranet','Há uma nova publicação na intranet da sua empresa. Acesse para conferir as novidades.','Ver publicação'],
 comment:['Novo comentário na sua publicação','Uma publicação sua recebeu um comentário. Acesse a intranet para acompanhar.','Ver publicação'],
 reaction:['Nova reação à sua publicação','Uma publicação sua recebeu uma reação. Acesse a intranet para acompanhar.','Ver publicação'],
 course:['Novo curso atribuído','Um treinamento foi atribuído a você. Acesse o catálogo para começar sua jornada.','Iniciar treinamento'],
 trail:['Nova trilha atribuída','Uma trilha de aprendizagem foi atribuída a você. Confira as etapas e os conteúdos disponíveis.','Acessar trilha'],
 praise:['Você recebeu um reconhecimento','Há um novo reconhecimento para você na plataforma. Acesse sua conta para conferir.','Ver reconhecimento'],
 evaluation:['Nova avaliação de desempenho','Há uma nova notificação de avaliação de desempenho no seu perfil. Consulte as orientações na plataforma.','Acessar avaliações'],
 evaluationUpdate:['Avaliação de desempenho atualizada','Uma avaliação vinculada ao seu perfil foi atualizada. Consulte a plataforma.','Acessar avaliações'],
 feedbackReceived:['Você recebeu um feedback','Há um novo feedback disponível para você. Consulte o conteúdo em sua conta.','Acessar feedback'],
 feedbackUpdate:['Feedback atualizado','Há uma atualização de feedback no seu perfil. Consulte os detalhes em sua conta.','Acessar feedback'],
 praiseUpdate:['Reconhecimento atualizado','Há uma atualização de reconhecimento no seu perfil. Consulte a plataforma.','Ver reconhecimento'],
 reset:['Recupere seu acesso','Você solicitou a recuperação de acesso. Defina uma nova senha pessoal para voltar à sua jornada.','Definir nova senha'],
};
const legacy={
 'Intranet':{'Novo comentário na sua publicação':'comment','Nova reação à sua publicação':'reaction'},
 'Rede social':{'Novo comentário na sua publicação':'comment','Nova reação à sua publicação':'reaction'},
 'Catálogo LMS':{'Novo curso atribuído':'course'},'Missões':{'Nova trilha atribuída':'trail'},
 'Elogio':{'Você recebeu um elogio':'praise','Elogio atualizado':'praiseUpdate'},
 'Desempenho':{'Nova avaliação de desempenho':'evaluation','Avaliação de desempenho atualizada':'evaluationUpdate'},
 'Feedback':{'Você recebeu um feedback':'feedbackReceived','Feedback atualizado':'feedbackUpdate'},
 'PDI':{'Nova ação de PDI':'pdi','Ação de PDI atualizada':'pdiUpdate'},
 '1:1':{'Nova conversa 1:1':'meeting','Conversa 1:1 atualizada':'meetingUpdate'},
 'OKR':{'Novo OKR':'okr','OKR atualizado':'okrUpdate'},'Pulse':{'Nova pesquisa de Pulse':'pulse'}
};
export function notificationContent(job){
 const page=Object.hasOwn(pages,job.page)?job.page:'',module=pages[page]||'Notificações';
 let kind=job.kind;
 if(kind==='legacy')kind=Object.hasOwn(legacy,page)&&Object.hasOwn(legacy[page],job.legacyTitle)?legacy[page][job.legacyTitle]:'generic';
 if(kind==='meeting'&&job.label==='Conversa 1:1 reagendada')kind='meetingUpdate';
 let title,body,cta;
 if(kind==='deadline'){
  const late=String(job.label||'').endsWith('prazo vencido');
  title=late?'Prazo vencido':'Prazo próximo';body=late?'Há uma atividade com prazo vencido. Consulte sua conta para verificar as próximas ações.':'Uma atividade tem prazo próximo. Consulte sua conta e organize os próximos passos.';cta=action[page]||'Acessar Learning Academy';
 }else if(Object.hasOwn(variants,kind)){[title,body,cta]=variants[kind]}
 else{title='Você tem uma nova notificação';body='Acesse sua conta para consultar as novidades e as ações disponíveis.';cta=action[page]||'Acessar Learning Academy'}
 if(page==='Pulse Seguro'&&['pulse','pulseFriday'].includes(kind)){title=kind==='pulse'?'Nova pesquisa Pulse Seguro':'Lembrete de Pulse Seguro';body='Uma pesquisa está disponível para você. As respostas são registradas na plataforma conforme as regras de privacidade do módulo.'}
 const due=typeof job.due==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(job.due)&&Number.isFinite(Date.parse(job.due))&&new Date(job.due).toISOString().slice(0,10)===job.due?job.due.split('-').reverse().join('/'):'';
 return {module,title,body,cta,due:due?(page==='1:1'?'Data da conversa: ':'Prazo: ')+due:'',first:plain(job.first).split(/\s+/)[0],note:'Aviso automático. Consulte informações e ações somente após autenticação na plataforma.'};
}
function baseURL(origin){const u=new URL(origin);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Origem de e-mail inválida.');return u}
export function notificationPayload(job,origin){
 const base=baseURL(origin),url=new URL('/',base),c=notificationContent(job);
 if(Object.hasOwn(pages,job.page)){url.searchParams.set('view',job.page==='Rede social'?'Intranet':job.page);if(typeof job.target==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(job.target))url.searchParams.set('item',job.target)}
 return makePayload(c,url,base);
}
export function recoveryPayload(message,origin){
 const base=baseURL(origin);if(typeof message.token!=='string'||!/^[a-f0-9]{64}$/.test(message.token))throw Error('Token de recuperação inválido.');
 const url=new URL('/',base);url.hash='reset='+message.token;
 const [title,body,cta]=variants.reset;return makePayload({module:'Segurança de acesso',title,body,cta,due:'',first:'',note:'Link individual, válido por 30 minutos e de uso único. Não compartilhe. Se não solicitou a alteração, ignore este e-mail.'},url,base,'Recuperação de acesso ao Learning Academy');
}
function makePayload(c,url,base,subject='Learning Academy | '+c.title){
 return {subject,text:[c.first?'Olá, '+c.first+'!':'Olá!',c.module,c.title,c.body,c.due,c.cta+': '+url,c.note].filter(Boolean).join('\n\n'),html:render(c,url,base)};
}
const font='Inter, Arial, Helvetica, sans-serif';
function render(c,access,base){
 const url=esc(access.href),asset=n=>esc(new URL('/email-v32-'+n+'.png',base).href);
 const img=(n,w,h,alt='',style='')=>`<img src="${asset(n)}" width="${w}" height="${h}" alt="${esc(alt)}" border="0" style="display:block;border:0;outline:none;text-decoration:none;${style}">`;
 // Table-based structure and solid-color fallbacks are intentional for classic Outlook.
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>Learning Academy — Notificação</title><style>
 @media only screen and (max-width:480px){.la-body{padding:25px 20px!important}.la-greeting{font-size:29px!important}.la-copy{font-size:16px!important}.la-cta{font-size:16px!important;padding:14px 12px!important}.la-note{padding:12px!important}.la-shell{padding:12px 6px!important}}
 </style></head><body style="margin:0;padding:0;background-color:#e8f5fd;color:#081d50;font-family:${font};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#e8f5fd" style="background-color:#e8f5fd;background-image:url('${asset('background')}');background-size:cover;background-position:center top;"><tr><td class="la-shell" align="center" style="padding:30px 12px;">
 <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #d5e8f8;border-radius:17px;border-collapse:separate;overflow:hidden;">
 <tr><td bgcolor="#e7f6ff" style="background-color:#e7f6ff;padding:0;color:#081d50;font-size:24px;font-weight:bold;">${img('header',600,198,'Learning Academy — Aprendizagem e desenvolvimento','width:100%;max-width:600px;height:auto;')}</td></tr>
 <tr><td class="la-body" bgcolor="#ffffff" style="padding:26px 38px 30px;background-color:#ffffff;color:#081d50;font-family:${font};">
 <p style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#0754e7;margin:0 0 10px;">${esc(c.module)}</p>
 <h1 class="la-greeting" style="font-family:${font};font-size:32px;line-height:1.18;font-weight:800;letter-spacing:-.7px;margin:0 0 10px;color:#081d50;">${esc(c.title)}</h1>
 ${img('line',75,8,'','margin:0 0 16px;')}
 <p class="la-copy" style="font-size:18px;line-height:1.42;margin:0 0 12px;color:#081d50;">${c.first?'Olá, <strong>'+esc(c.first)+'!</strong>':'Olá!'}</p>
 <p class="la-copy" style="font-family:${font};font-size:18px;line-height:1.42;margin:0 0 15px;color:#081d50;">${esc(c.body)}</p>
 ${c.due?'<p style="font-size:16px;color:#042a65;margin:0 0 18px;font-weight:700;">'+esc(c.due)+'</p>':''}
 <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 27px;max-width:100%;"><tr><td bgcolor="#0754e7" style="background-color:#0754e7;background-image:linear-gradient(115deg,#1731f5,#0754e7 62%,#009df9);border-radius:13px;" align="center">
 <a class="la-cta" href="${url}" style="display:block;border:1px solid #0754e7;border-radius:13px;padding:15px 23px;color:#ffffff;text-decoration:none;font-family:${font};font-weight:700;font-size:19px;line-height:1.25;mso-padding-alt:0;"> <span style="mso-text-raise:10pt;">${esc(c.cta)}&nbsp; <img src="${asset('arrow')}" width="18" height="16" alt="→" style="display:inline-block;vertical-align:middle;border:0;color:#ffffff;"> </span> </a>
 </td></tr></table>
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#e8f5fd" style="width:100%;background-color:#e8f5fd;border-radius:11px;border-collapse:separate;"><tr><td class="la-note" style="padding:16px;">
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="42" valign="middle" style="width:42px;padding-right:12px;">${img('shield',29,34)}</td><td valign="middle" style="border-left:1px solid #b4d9f4;padding-left:12px;font-family:${font};font-size:14px;line-height:1.45;color:#081d50;">${esc(c.note)}</td></tr>
 <tr><td colspan="2" height="1" style="height:1px;padding-top:14px;border-bottom:1px solid #b4d9f4;font-size:1px;line-height:1px;">&nbsp;</td></tr>
 <tr><td width="42" valign="top" style="width:42px;padding:14px 12px 0 0;">${img('link',28,28)}</td><td valign="top" style="padding:14px 0 0 12px;font-family:${font};font-size:13px;line-height:1.5;color:#081d50;"><strong>Se o botão não abrir, copie este endereço:</strong><br><a href="${url}" style="color:#0754e7;text-decoration:underline;overflow-wrap:anywhere;word-break:break-all;">${url}</a></td></tr></table>
 </td></tr></table></td></tr>
 <tr><td bgcolor="#092756" style="padding:0;background-color:#092756;color:#ffffff;font-family:${font};font-size:13px;">${img('footer',600,60,'Learning Academy · Aprendizagem e desenvolvimento','width:100%;max-width:600px;height:auto;')}</td></tr>
 </table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}
export function patchV31(src){
 const imp="import {notificationPayload} from './email-notificacoes-v33.mjs';";
 if(src.includes(imp)&&src.includes('return notificationPayload(job,origin);'))return src;
 const start=src.indexOf('export function payload(job,origin){'),end=src.indexOf('\nexport function schema(',start);
 if(start<0||end<0)throw Error('V33: função de notificações incompatível.');
 let next=imp+'\n'+src.slice(0,start)+'export function payload(job,origin){return notificationPayload(job,origin);}\n'+src.slice(end);
 // Metadata is presentation only. Existing keys, recipient checks and scheduler are unchanged.
 const pairs=[['version=\'\',target=entity,priority=10','version=\'\',target=entity,priority=10,legacyTitle=\'\''],['email:active.get(recipient).email,page,label,due:','email:active.get(recipient).email,first:active.get(recipient).name,legacyTitle,page,label,due:'],["due:n.due,target:n.target,priority:4","due:n.due,target:n.target,priority:4,legacyTitle:n.title"]];
 for(const [old,value] of pairs){if(next.split(old).length!==2)throw Error('V33: contrato V31 incompatível.');next=next.replace(old,()=>value)}return next;
}
export function patchRecoveryV33(src){
 const imp="import {recoveryPayload} from './email-notificacoes-v33.mjs'";
 if(src.includes(imp)&&src.includes('recoveryPayload(message,config.origin)'))return src;
 const start=src.indexOf("  const payload=message.kind==='invite'?invitationEmail(message,config.origin):"),end=src.indexOf('\n',start);
 if(start<0||end<0||!src.slice(start,end).includes('Recuperação de acesso ao Learning Academy'))throw Error('V33: contrato de recuperação incompatível.');
 return imp+'\n'+src.slice(0,start)+"  const payload=message.kind==='invite'?invitationEmail(message,config.origin):recoveryPayload(message,config.origin)"+src.slice(end);
}
function install(){
 const files=['notificacoes-v31.mjs','recovery.mjs'];const patches=[patchV31,patchRecoveryV33];
 const outputs=files.map((f,i)=>patches[i](readFileSync(f,'utf8')));for(let i=0;i<files.length;i++)writeFileSync(files[i],outputs[i]);console.log('V33: identidade visual aplicada a notificações e recuperação; gatilhos preservados.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--install'))install();
