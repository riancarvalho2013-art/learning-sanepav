/** V41-A: permanent deletion of an unused, already blocked account. Historical/audit data retained. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
const stateKey='system/state-v1';
const marker='/* V41-A account deletion */';
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const hash=v=>createHash('sha256').update(v).digest('hex');
const fail=(ok,message,status=400)=>{if(!ok)throw Object.assign(Error(message),{status});};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'private,no-store'}});
const quote=s=>'"'+String(s).replaceAll('"','""')+'"';
const hasTable=(db,name)=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
const stateFrom=db=>{const raw=db.prepare('SELECT body,etag FROM objects WHERE key=?').get(stateKey);fail(raw,'Ambiente indisponível.',503);return {raw,state:JSON.parse(Buffer.from(raw.body).toString())};};
function adminFrom(state,request,identity,now){
 const token=(request.headers.get('cookie')||'').match(/(?:^|; )learning=([^;]+)/)?.[1];
 fail(token&&identity,'Entre para continuar.',401);
 const digest=hash(token),session=state.sessions.find(x=>x.digest===digest&&x.identity===identity&&x.until>now);
 const user=state.users.find(x=>x.id===session?.person&&x.active);
 fail(user,'Entre para continuar.',401);fail(user.role==='Administrador','Acesso restrito à administração.',403);return user;
}
const stamp=u=>JSON.stringify([u.id,u.email,u.role,u.active,u.salt,u.digest,u.iterations]);
const contains=(value,id,email)=>{const s=JSON.stringify(value).toLowerCase();return s.includes(id)||(email&&s.includes(email));};
// Conservative reference scan, under the same write transaction. Unknown tables are NOT automatically exempted.
// Retained audit/history are explicit exceptions; this is account deletion, not legal erasure of all personal data.
const retained=new Set(['domain_audit','org_assignment_history_v11','org_manager_history_v11','password_reset_requests']);
const accountTables=new Set(['people','person_organizations','company_access','password_resets','admin_delete_v41a_attempts']);
export function referenceBlockersV41A(db,state,target){
 const id=target.id.toLowerCase(),email=String(target.email||'').toLowerCase(),blocks=new Set();
 if(target.avatar)blocks.add('Mídia de perfil');
 const remaining={...state,users:state.users.filter(x=>x.id!==target.id),sessions:state.sessions.filter(x=>x.person!==target.id)};
 delete remaining.logs;
 if(remaining.notifications){remaining.notifications={...remaining.notifications};delete remaining.notifications[target.id];}
 // Credential/rate history is not a business relationship. Never delete security rate history by guessing hashes.
 delete remaining.fails;
 for(const [name,value] of Object.entries(remaining))if(contains(value,id,email))blocks.add(name==='users'?'Liderança ou cadastro relacionado':'Registros operacionais');
 // Binary media has no relational meaning; its ownership/association is tracked by structured data. Object keys are still checked.
 const hit=db.prepare(`SELECT 1 FROM objects WHERE key<>? AND (instr(lower(key),?)>0 OR (?<>'' AND instr(lower(key),?)>0) OR (
 key NOT GLOB 'files/*' AND key NOT GLOB 'social/*' AND key NOT GLOB 'social-video/*' AND key NOT GLOB 'evolution/v1/logos/*' AND key NOT GLOB 'evolution/v1/backgrounds/*'
 AND (instr(lower(CAST(body AS TEXT)),?)>0 OR (?<>'' AND instr(lower(CAST(body AS TEXT)),?)>0)))) LIMIT 1`).get(stateKey,id,email,email,id,email,email);
 if(hit)blocks.add('Dados de módulos ou notificações');
 for(const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()){
  if(name==='objects'||retained.has(name)||accountTables.has(name))continue;
  // Own invitation rows are removable together with their reset tokens. Issuer references for other accounts are not.
  if(name==='first_access_invites_v17'){
   if(db.prepare('SELECT 1 FROM first_access_invites_v17 WHERE actor_id=? AND person_id<>? LIMIT 1').get(target.id,target.id))blocks.add('Convites emitidos para outras pessoas');
   continue;
  }
  const cols=db.prepare('PRAGMA table_info('+quote(name)+')').all().map(c=>c.name);
  if(!cols.length)continue;
  const checks=cols.map(c=>`(instr(lower(CAST(${quote(c)} AS TEXT)),?)>0 OR (?<>'' AND instr(lower(CAST(${quote(c)} AS TEXT)),?)>0))`).join(' OR ');
  const args=cols.flatMap(()=>[id,email,email]);
  if(db.prepare('SELECT 1 FROM '+quote(name)+' WHERE '+checks+' LIMIT 1').get(...args))blocks.add('Vínculos em módulos especializados');
 }
 return [...blocks];
}
export function createAccountDeletionV41A(db,{verifyPassword,recordManagerHistory,clock=Date.now}={}){
 if(typeof verifyPassword!=='function'||typeof recordManagerHistory!=='function')throw TypeError('Dependências de exclusão ausentes.');
 let inFlight=0;
 return async function deleteAccount(request,identity){
  try{
   fail(request.method==='POST','Método não permitido.',405);fail(request.headers.get('origin')===new URL(request.url).origin,'Origem inválida.',403);
   let body;try{body=await request.json()}catch{return reply({error:'Dados inválidos.'},400);}
   fail(body&&typeof body==='object'&&!Array.isArray(body)&&typeof body.id==='string'&&uuid.test(body.id)&&typeof body.email==='string'&&body.email.length<=300&&typeof body.password==='string'&&body.password.length>=12&&body.password.length<=150&&body.confirmation==='EXCLUIR','Confirme o e-mail, a senha administrativa e a exclusão.',400);
   const initial=stateFrom(db).state,admin=adminFrom(initial,request,identity,clock());
   fail(admin.id!==body.id,'Não é permitido excluir a própria conta.',403);
   fail(inFlight<2,'Aguarde e tente novamente.',429);
   const now=clock();db.exec('BEGIN IMMEDIATE');try{
    db.exec('CREATE TABLE IF NOT EXISTS admin_delete_v41a_attempts (actor_id TEXT NOT NULL, at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS admin_delete_v41a_attempts_actor ON admin_delete_v41a_attempts(actor_id,at);');
    db.prepare('DELETE FROM admin_delete_v41a_attempts WHERE at<=?').run(now-900000);
    fail(db.prepare('SELECT count(*) n FROM admin_delete_v41a_attempts WHERE actor_id=?').get(admin.id).n<5,'Limite de confirmações atingido. Aguarde 15 minutos.',429);
    db.prepare('INSERT INTO admin_delete_v41a_attempts(actor_id,at) VALUES(?,?)').run(admin.id,now);db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e;}
   inFlight++;let valid;try{valid=await verifyPassword(body.password,admin);}finally{inFlight--;}
   fail(valid,'Senha administrativa incorreta.',403);
   db.exec('BEGIN IMMEDIATE');try{
    const {state,raw}=stateFrom(db),actor=adminFrom(state,request,identity,clock());
    fail(stamp(actor)===stamp(admin),'A autorização mudou. Entre novamente.',409);
    const target=state.users.find(x=>x.id===body.id);fail(target,'Conta inexistente.',404);
    fail(target.id!==actor.id,'Não é permitido excluir a própria conta.',403);
    fail(target.active===false,'Bloqueie a conta antes de solicitar a exclusão definitiva.',409);
    fail(String(target.email).toLowerCase()===body.email.trim().toLowerCase(),'O e-mail de confirmação não corresponde à conta.',400);
    fail(state.users.some(x=>x.id!==target.id&&x.active&&x.role==='Administrador'),'Preserve um administrador ativo.',409);
    const blockers=referenceBlockersV41A(db,state,target);
    fail(!blockers.length,'Exclusão indisponível: '+blockers.join('; ')+'. Preserve o histórico e mantenha a conta bloqueada.',409);
    if(hasTable(db,'first_access_invites_v17'))db.prepare('DELETE FROM first_access_invites_v17 WHERE person_id=?').run(target.id);
    db.prepare('DELETE FROM password_resets WHERE person_id=?').run(target.id);
    db.prepare('DELETE FROM company_access WHERE person_id=?').run(target.id);
    db.prepare('DELETE FROM person_organizations WHERE person_id=?').run(target.id);
    db.prepare('DELETE FROM people WHERE id=?').run(target.id);
    db.prepare('DELETE FROM admin_delete_v41a_attempts WHERE actor_id=?').run(target.id);
    state.users=state.users.filter(x=>x.id!==target.id);
    state.sessions=state.sessions.filter(x=>x.person!==target.id);
    if(state.notifications)delete state.notifications[target.id];
    state.logs??=[];state.logs.unshift({at:new Date(clock()).toISOString(),who:actor.name,event:'Conta sem vínculos excluída definitivamente'});state.logs=state.logs.slice(0,5000);
    recordManagerHistory(db,state);
    db.prepare('INSERT INTO domain_audit(actor_id,entity_type,entity_id,event,at,before_json,after_json) VALUES(?,?,?,?,?,NULL,NULL)').run(actor.id,'account',target.id,'account_deleted_v41a',new Date(clock()).toISOString());
    const update=db.prepare('UPDATE objects SET body=?,etag=? WHERE key=? AND etag=?').run(Buffer.from(JSON.stringify(state)),randomUUID(),stateKey,raw.etag);
    fail(update.changes===1,'Os dados mudaram. Tente novamente.',409);
    db.exec('COMMIT');return reply({ok:true,message:'Conta excluída definitivamente. Registros de auditoria e backups são preservados.'});
   }catch(e){db.exec('ROLLBACK');throw e;}
  }catch(e){return reply({error:e.status?e.message:'Não foi possível excluir a conta com segurança.'},e.status||500);}
 };
}
function swap(s,a,b){if(s.split(a).length!==2)throw Error('V41-A: estrutura incompatível: '+a);return s.replace(a,()=>b);}
export function patchStorage(s){
 if(s.includes(marker))return s;
 const anchor='export const DOMAIN = createDomain(db)';
 return swap(s,anchor,marker+"\n"+anchor+"\nDOMAIN.deleteAccountV41A=createAccountDeletionV41A(db,{verifyPassword:verifyDeletionPasswordV41A,recordManagerHistory})").replace(/^/,"import {createAccountDeletionV41A} from './contas-v41-a.mjs'\nimport {verifyPassword as verifyDeletionPasswordV41A} from './credentials.mjs'\n");
}
export function patchPlatform(s){
 if(s.includes(marker))return s;
 const a=' const u=actor(state,digest,identity)';
 return swap(s,a,a+`\n ${marker}\n if(path==='/api/admin/delete-account'){assertAdmin(u);requireOk(typeof env.DOMAIN?.deleteAccountV41A==='function','Exclusão indisponível.',503);return env.DOMAIN.deleteAccountV41A(req,identity)}`);
}
const frontend=String.raw`/* V41-A account deletion */
function deleteAccountFormV41A(id){
 if(!admin()||id===d.me.id)return;
 const target=organizationData.people.find(p=>p.id===id);if(!target)return;
 if(target.active){toast('Bloqueie a conta em Editar antes de excluí-la definitivamente.');return;}
 form('Excluir usuário definitivamente',
 '<p class="notice"><strong>Atenção:</strong> esta ação não poderá ser desfeita. A conta e os acessos serão removidos. Se houver registros vinculados, a exclusão será recusada. Auditoria e backups são preservados.</p><p><strong>'+esc(target.name)+'</strong><br>'+esc(target.email)+'</p>'+
 '<label>Confirme o e-mail da pessoa<input name="email" type="email" required autocomplete="off"></label>'+
 '<label>Digite EXCLUIR<input name="confirmation" required autocomplete="off" pattern="EXCLUIR"></label>'+
 '<label>Sua senha de administrador<input name="password" type="password" required minlength="12" maxlength="150" autocomplete="current-password"></label>',
 body=>api('admin/delete-account',{id,email:body.email,confirmation:body.confirmation,password:body.password}),'Excluir definitivamente');
}
`;
export function patchWeb(s){
 if(s.includes(marker))return s;
 const a="+btn('Editar','user',person.id,'smallBtn')+";
 s=swap(s,a,a+"(admin()&&person.id!==d.me.id?btn('Excluir definitivamente','deleteAccountV41A',person.id,'smallBtn la41-delete-account'):'')+");
 s=swap(s,"  if(act==='organizationAccess')organizationAccess(id)","  if(act==='organizationAccess')organizationAccess(id)\n  if(act==='deleteAccountV41A')deleteAccountFormV41A(id)");
 return s+'\n'+frontend;
}
export function patchIndex(s){const a='/foundation.js"',b='/foundation.js?v=41-a"';return s.includes(b)?s:swap(s,a,b);}
export function patchCss(s){if(s.includes(marker))return s;return s+`\n${marker}\n#app #inside .directory-panel button.la41-delete-account{border:1px solid #f1c7c4;background:#fff4f3;color:#982c2c;border-radius:9px;min-height:36px;white-space:normal;line-height:1.3;padding:7px 10px;}\n#app #inside .directory-panel button.la41-delete-account:hover{background:#ffe6e3;}\n@media(pointer:coarse){#app #inside .directory-panel button.la41-delete-account{min-height:44px;}}\n`;}
export function patchIntegrationTest(s){
 if(s.includes('// V41-A account deletion integration'))return s;
 if(!s.includes('// V41 session revocation regression'))throw Error('V41-A requer regressão de segurança V41.');
 return s+`\n// V41-A account deletion integration: real platform, SQLite, organization and session routes.\nawait good('user',admin,input('deletablev41a',first,{active:false}));\nconst deletableV41A=await find('deletablev41a');assert.equal(deletableV41A.active,false);\nconst deletionV41A={id:deletableV41A.id,email:deletableV41A.email,confirmation:'EXCLUIR',password};\nassert.equal((await call('admin/delete-account',newV41,deletionV41A)).status,403);\nassert.equal((await good('admin/delete-account',admin,deletionV41A)).data.ok,true);\nassert.equal(await find('deletablev41a'),undefined);\nassert.equal((await call('login','',{email:deletableV41A.email,password})).status,401);\nconsole.log('OK V41-A: exclusão de conta sem vínculos, autorização e login recusado.');\n`;
}
export function install(root='.'){
 const p=f=>resolve(root,f),read=f=>readFileSync(p(f),'utf8');
 const edits=[['storage.mjs',patchStorage],['platform.mjs',patchPlatform],['web-foundation.js',patchWeb],['web-index.html',patchIndex],['web-topbar-v40-1.css',patchCss],['verify-user-company.mjs',patchIntegrationTest]].map(([f,fn])=>[f,fn(read(f))]);
 // Cache-bust only the already integrated CSS asset.
 const index=edits.find(x=>x[0]==='web-index.html');if(!index[1].includes('/topbar-v40-1.css?v=41-a'))index[1]=swap(index[1],'/topbar-v40-1.css?v=40.5','/topbar-v40-1.css?v=41-a');
 for(const [f,s] of edits)writeFileSync(p(f),s);return edits.length;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--install'))console.log('V41-A: exclusão administrativa protegida ('+install()+' arquivos).');
