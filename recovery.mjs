import {randomBytes,randomUUID,createHash} from 'node:crypto'
import {hashPassword} from './credentials.mjs'
const digest=value=>createHash('sha256').update(value).digest('hex')
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store'}})
const generic={ok:true,message:'Se o cadastro estiver ativo, você receberá as orientações no e-mail informado.'}
function configuration(){
 try{
  const key=process.env.RESEND_API_KEY?.trim(),from=process.env.EMAIL_FROM?.trim()
  const origin=process.env.APP_ORIGIN||'https://learning-sanepav-production.up.railway.app'
  if(!key||!from||/[\r\n]/.test(from)||new URL(origin).protocol!=='https:')return null
  return {key,from,origin:new URL(origin).origin,invitationOrigin:process.env.APP_ORIGIN?new URL(origin).origin:null}
 }catch{return null}
}
export const recoveryConfigured=()=>Boolean(configuration())
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const headerText=v=>String(v||'').replace(/[\r\n\u0000-\u001f]/g,' ').trim().slice(0,120)
const stamp=(db,p)=>digest(JSON.stringify([p.email,p.role,p.salt,p.digest,p.iterations,db.prepare('SELECT company_id FROM person_organizations WHERE person_id=?').get(p.id)?.company_id||null]))
const hasInvites=db=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='first_access_invites_v17'").get()
function inviteSchema(db){db.exec(`CREATE TABLE IF NOT EXISTS first_access_invites_v17 (
 token_hash TEXT PRIMARY KEY REFERENCES password_resets(token_hash) ON DELETE CASCADE,
 person_id TEXT NOT NULL, actor_id TEXT NOT NULL, credential_stamp TEXT NOT NULL,
 request_id TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, sent_at INTEGER,
 redeemed_at INTEGER, status TEXT NOT NULL CHECK(status IN ('pending','sent','failed','revoked','redeemed')));
 CREATE INDEX IF NOT EXISTS first_access_person_v17 ON first_access_invites_v17(person_id,created_at);
 CREATE INDEX IF NOT EXISTS first_access_actor_v17 ON first_access_invites_v17(actor_id,created_at);`)}
const fail=(ok,message,status=400)=>{if(!ok)throw Object.assign(new Error(message),{status})}
const stateFrom=db=>{const raw=db.prepare('SELECT body FROM objects WHERE key=?').get('system/state-v1');return raw?JSON.parse(Buffer.from(raw.body).toString()):{users:[],sessions:[],logs:[]}}
const activeSession=(s,id)=>s.sessions?.some(x=>x.person===id&&x.until>Date.now())
function inviteActor(req,identity,state){const cookie=(req.headers.get('cookie')||'').match(/(?:^|;\s*)learning=([^;]+)/)?.[1];fail(cookie&&identity,'Entre para continuar.',401);const session=state.sessions?.find(x=>x.digest===digest(cookie)&&x.identity===identity&&x.until>Date.now()),actor=state.users.find(x=>x.id===session?.person&&x.active);fail(actor,'Entre para continuar.',401);fail(actor.role==='Administrador','Convites restritos à administração.',403);return actor}
export function invitationEmail({name,company,platform,token},origin){
 const first=headerText(name).split(/\s+/)[0]||'colaborador(a)',title=['Learning Sanepav','Sanepav Learning',''].includes(headerText(platform))?'Learning Academy':headerText(platform),org=headerText(company)||'sua empresa',link=origin+'/#reset='+token
 const subject='Boas-vindas ao '+title+' — seu primeiro acesso'
 const text=`Olá, ${first}!\n\nSeja bem-vindo(a) ao ${title}, nossa plataforma de aprendizagem e desenvolvimento da ${org}.\n\nSeu cadastro foi preparado. Defina uma senha pessoal pelo link abaixo e, em seguida, entre com seu e-mail corporativo.\n${link}\n\nEste convite individual é válido por 48 horas e só pode ser utilizado uma vez. Não compartilhe o link. Se você não esperava este convite, procure a administração do Learning.\n\nLearning Academy | Aprendizagem e desenvolvimento`
 const html=`<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f1f6fc;font-family:Arial,sans-serif;color:#163a60"><div style="max-width:600px;margin:24px auto;background:#fff;border:1px solid #d5e4f4;border-radius:16px;overflow:hidden"><div style="background:#174d85;color:#fff;padding:28px"><div style="font-size:12px;letter-spacing:1px">LEARNING ACADEMY</div><h1 style="font-size:26px;margin:10px 0 0">${escapeHtml(title)}</h1></div><div style="padding:28px"><h2 style="font-size:22px">Olá, ${escapeHtml(first)}!</h2><p>Seja bem-vindo(a) à plataforma de aprendizagem e desenvolvimento da <strong>${escapeHtml(org)}</strong>.</p><p>Seu cadastro está preparado. Crie sua senha pessoal e acesse com seu e-mail corporativo para começar sua jornada.</p><p style="margin:28px 0"><a style="display:inline-block;background:#216ab4;color:white;padding:15px 24px;border-radius:9px;text-decoration:none;font-weight:bold" href="${escapeHtml(link)}">Realizar meu primeiro acesso</a></p><p style="font-size:13px;color:#45627d">Link individual, válido por 48 horas e de uso único. Não compartilhe. Caso não reconheça este convite, procure a administração.</p><p style="font-size:12px;overflow-wrap:anywhere">Se o botão não abrir, copie este endereço: ${escapeHtml(link)}</p></div><div style="padding:18px 28px;background:#eef5fd;font-size:13px">Learning Academy · Aprendizagem e desenvolvimento</div></div></body></html>`
 return {subject,text,html}
}
function markInvitation(db,hash,status){db.exec('BEGIN IMMEDIATE');try{db.prepare("UPDATE first_access_invites_v17 SET status=?,sent_at=CASE WHEN ?='sent' THEN ? ELSE sent_at END WHERE token_hash=? AND status='pending'").run(status,status,Date.now(),hash);if(status!=='sent')db.prepare('UPDATE password_resets SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL').run(Date.now(),hash);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}}
export function createRecovery(database,delivery){
 const send=delivery||(async(message,config)=>{
  const payload=message.kind==='invite'?invitationEmail(message,config.origin):{subject:'Recuperação de acesso ao Learning Academy',text:'Você solicitou a recuperação do seu acesso. Defina sua senha pelo link abaixo em até 30 minutos.\n\n'+config.origin+'/#reset='+message.token+'\n\nSe você não solicitou esta ação, ignore esta mensagem.'}
  const result=await fetch('https://api.resend.com/emails',{
   method:'POST',headers:{authorization:'Bearer '+config.key,'content-type':'application/json','idempotency-key':message.id},
   body:JSON.stringify({from:config.from,to:[message.email],...payload}),signal:AbortSignal.timeout(15000)
  })
  if(!result.ok)throw new Error('Não foi possível enviar o e-mail.')
 })
 async function invite(request,identity,settings,body){
  try{
   const url=new URL(request.url);fail(request.method==='POST','Método não permitido.',405);fail(request.headers.get('origin')===url.origin,'Origem inválida.',403)
   // Authenticate before exposing even provider-configuration status.
   inviteActor(request,identity,stateFrom(database));fail(settings?.invitationOrigin===url.origin&&settings.origin===url.origin,'Configure APP_ORIGIN, EMAIL_FROM e RESEND_API_KEY para este ambiente.',503)
   fail(typeof body.personId==='string'&&body.personId.length<=100&&typeof body.requestId==='string'&&/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(body.requestId),'Identificador inválido.')
   let message,tokenHash;const time=Date.now()
   database.exec('BEGIN IMMEDIATE')
   try{
    const state=stateFrom(database),actor=inviteActor(request,identity,state),person=state.users.find(x=>x.id===body.personId&&x.active)
    fail(person&&person.id!==actor.id&&person.role!=='Administrador','Convite indisponível para esta conta.',403)
    fail(typeof person.email==='string'&&person.email.length<=300&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email),'E-mail cadastrado inválido.')
    inviteSchema(database)
    const prior=database.prepare('SELECT * FROM first_access_invites_v17 WHERE request_id=?').get(body.requestId)
    if(prior){fail(prior.actor_id===actor.id&&prior.person_id===person.id,'Requisição incompatível.',409);fail(prior.status==='sent','Convite já processado ou em processamento. Atualize a página.',409);database.exec('COMMIT');return reply({ok:true,accepted:true,idempotent:true,message:'Convite já aceito pelo provedor.'})}
    fail(!activeSession(state,person.id)&&!database.prepare("SELECT 1 FROM first_access_invites_v17 WHERE person_id=? AND status='redeemed'").get(person.id),'Esta conta já possui acesso registrado. Utilize recuperação de senha.',409)
    fail(!database.prepare('SELECT 1 FROM first_access_invites_v17 WHERE person_id=? AND created_at>?').get(person.id,time-60000),'Aguarde 60 segundos antes de reenviar.',429)
    fail(database.prepare('SELECT count(*) n FROM first_access_invites_v17 WHERE actor_id=? AND created_at>?').get(actor.id,time-3600000).n<100,'Limite de convites por hora atingido.',429)
    const token=randomBytes(32).toString('hex');tokenHash=digest(token)
    database.prepare("UPDATE password_resets SET consumed_at=? WHERE token_hash IN (SELECT token_hash FROM first_access_invites_v17 WHERE person_id=? AND status IN ('pending','sent')) AND consumed_at IS NULL").run(time,person.id)
    database.prepare("UPDATE first_access_invites_v17 SET status='revoked' WHERE person_id=? AND status IN ('pending','sent')").run(person.id)
    database.prepare('INSERT INTO password_resets(token_hash,person_id,expires_at) VALUES(?,?,?)').run(tokenHash,person.id,time+48*3600000)
    database.prepare("INSERT INTO first_access_invites_v17(token_hash,person_id,actor_id,credential_stamp,request_id,created_at,status) VALUES(?,?,?,?,?,?,'pending')").run(tokenHash,person.id,actor.id,stamp(database,person),body.requestId,time)
    const org=database.prepare('SELECT c.name FROM person_organizations a JOIN companies c ON c.id=a.company_id WHERE a.person_id=?').get(person.id)
    message={id:body.requestId,kind:'invite',token,email:person.email,name:person.name,company:org?.name,platform:state.theme?.title}
    database.exec('COMMIT')
   }catch(e){database.exec('ROLLBACK');throw e}
   try{await send(message,settings)}catch{markInvitation(database,tokenHash,'failed');return reply({error:'O provedor não confirmou o envio. Confira a configuração e tente novamente.'},502)}
   // Provider acceptance is not inbox delivery. Do not log token, URL, or e-mail body.
   database.exec('BEGIN IMMEDIATE')
   try{
    const state=stateFrom(database),entry=database.prepare('SELECT * FROM first_access_invites_v17 WHERE token_hash=?').get(tokenHash),person=state.users.find(x=>x.id===entry?.person_id&&x.active)
    let actor;try{actor=inviteActor(request,identity,state)}catch{}
    const valid=entry?.status==='pending'&&person&&stamp(database,person)===entry.credential_stamp&&!activeSession(state,person.id)&&actor?.id===entry.actor_id
    if(!valid){database.prepare("UPDATE first_access_invites_v17 SET status='revoked' WHERE token_hash=? AND status='pending'").run(tokenHash);database.prepare('UPDATE password_resets SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL').run(Date.now(),tokenHash);database.exec('COMMIT');return reply({error:'O cadastro ou acesso mudou durante o envio. O link foi invalidado.'},409)}
    database.prepare("UPDATE first_access_invites_v17 SET status='sent',sent_at=? WHERE token_hash=?").run(Date.now(),tokenHash)
    state.logs??=[];state.logs.unshift({at:new Date().toISOString(),who:actor.name,event:'Convite de primeiro acesso aceito pelo provedor'});state.logs=state.logs.slice(0,5000)
    database.prepare('UPDATE objects SET body=?,etag=? WHERE key=?').run(Buffer.from(JSON.stringify(state)),randomUUID(),'system/state-v1');database.exec('COMMIT')
   }catch(e){database.exec('ROLLBACK');throw e}
   return reply({ok:true,accepted:true,message:'Convite aceito pelo provedor de e-mail. Link válido por 48 horas.'})
  }catch(e){return reply({error:e.status?e.message:'Não foi possível gerar o convite.'},e.status||500)}
 }
 return async function recovery(request,identity,settings=configuration()){
  let body;try{body=await request.json()}catch{return reply({error:'Dados inválidos.'},400)}
  if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'Dados inválidos.'},400)
  if(new URL(request.url).pathname==='/api/first-access/invite')return invite(request,identity,settings,body)
  if(new URL(request.url).pathname.endsWith('/reset-password')){
   if(typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token))return reply({error:'Link inválido ou expirado.'},400)
   const tokenHash=digest(body.token)
   const token=database.prepare('SELECT * FROM password_resets WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?').get(tokenHash,Date.now())
   if(!token)return reply({error:'Link inválido ou expirado.'},400)
   const secret=await hashPassword(body.password)
   database.exec('BEGIN IMMEDIATE')
   try{
    const consume=database.prepare('UPDATE password_resets SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?').run(Date.now(),tokenHash,Date.now())
    if(!consume.changes)throw Object.assign(new Error('Link inválido ou expirado.'),{status:400})
    const state=stateFrom(database)
    const person=state.users.find(user=>user.id===token.person_id&&user.active)
    if(!person)throw Object.assign(new Error('Link inválido ou expirado.'),{status:400})
    const invitation=hasInvites(database)?database.prepare('SELECT * FROM first_access_invites_v17 WHERE token_hash=?').get(tokenHash):null
    if(invitation){fail(invitation.status==='sent'&&stamp(database,person)===invitation.credential_stamp&&!activeSession(state,person.id),'Link inválido ou expirado. Solicite um novo convite.',400);database.prepare("UPDATE first_access_invites_v17 SET status='redeemed',redeemed_at=? WHERE token_hash=?").run(Date.now(),tokenHash)}
    Object.assign(person,secret)
    state.sessions=state.sessions.filter(session=>session.person!==person.id)
    state.logs.unshift({at:new Date().toISOString(),who:person.name,event:invitation?'Primeiro acesso: senha definida':'Senha redefinida e sessões revogadas'})
    state.logs=state.logs.slice(0,5000)
    database.prepare('UPDATE password_resets SET consumed_at=? WHERE person_id=? AND consumed_at IS NULL').run(Date.now(),person.id)
    database.prepare('UPDATE objects SET body=?,etag=? WHERE key=?').run(Buffer.from(JSON.stringify(state)),randomUUID(),'system/state-v1')
    database.exec('COMMIT')
    return reply({ok:true,message:invitation?'Senha definida. Bem-vindo(a)! Entre com seu e-mail e a nova senha.':'Senha redefinida. Entre com sua nova senha.'})
   }catch(error){database.exec('ROLLBACK');if(error.status)return reply({error:error.message},error.status);throw error}
  }
  if(!settings)return reply({error:'Recuperação por e-mail indisponível. Solicite apoio à administração.'},503)
  const email=String(body.email||'').trim().toLowerCase()
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>300)return reply({error:'Informe um e-mail válido.'},400)
  const rateKey=digest(identity+'|'+(request.headers.get('cf-connecting-ip')||''))
  const now=Date.now(),since=now-15*60*1000
  let message
  database.exec('BEGIN IMMEDIATE')
  try{
   const count=database.prepare('SELECT count(*) AS total FROM password_reset_requests WHERE rate_key=? AND requested_at>?').get(rateKey,since).total
   if(count>=5){database.exec('ROLLBACK');return reply({error:'Muitas solicitações. Aguarde 15 minutos.'},429)}
   database.prepare('DELETE FROM password_reset_requests WHERE requested_at<?').run(now-86400000)
   // Redeemed invitations remain as first-access evidence. Other expired tokens may be pruned.
   const keep=hasInvites(database)?" AND token_hash NOT IN (SELECT token_hash FROM first_access_invites_v17 WHERE status='redeemed')":''
   database.prepare('DELETE FROM password_resets WHERE expires_at<?'+keep).run(now-86400000)
   database.prepare('INSERT INTO password_reset_requests(rate_key,requested_at) VALUES(?,?)').run(rateKey,now)
   const state=stateFrom(database)
   const person=state.users.find(user=>user.email===email&&user.active)
   if(person){
    const token=randomBytes(32).toString('hex'),id=randomUUID()
    database.prepare('INSERT INTO password_resets(token_hash,person_id,expires_at) VALUES(?,?,?)').run(digest(token),person.id,now+30*60*1000)
    message={token,email,id}
   }
   database.exec('COMMIT')
  }catch(error){database.exec('ROLLBACK');throw error}
  if(message){
   try{await send(message,settings)}catch{
    database.prepare('UPDATE password_resets SET consumed_at=? WHERE token_hash=?').run(Date.now(),digest(message.token))
    console.warn('Falha na entrega de recuperação de acesso. Confira a configuração do provedor de e-mail.')
   }
  }
  return reply(generic)
 }
}
