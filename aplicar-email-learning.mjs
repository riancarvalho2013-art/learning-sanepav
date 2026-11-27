import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const branch=execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim();
if(branch!=='work/learning-email-access')throw Error('Execute somente na branch work/learning-email-access.');
if(execFileSync('git',['status','--porcelain','--','recovery.mjs','web-foundation.js','web-lxp-v2.js'],{encoding:'utf8'}).trim())throw Error('Há alterações locais nos arquivos-alvo. Preserve-as antes de aplicar.');
const updates=new Map();
function edit(file,pairs){let s=readFileSync(file,'utf8');for(const [a,b] of pairs){if(s.split(a).length!==2)throw Error('Base incompatível: '+file+' / '+a.slice(0,100));s=s.replace(a,()=>b);}updates.set(file,s);}
edit('recovery.mjs',[
["const origin=process.env.APP_ORIGIN||'https://learning-sanepav-production.up.railway.app'","const origin=process.env.APP_ORIGIN?.trim()"],
["if(!key||!from||/[\\r\\n]/.test(from)||new URL(origin).protocol!=='https:')return null","if(!key||!from||!origin||/[\\r\\n]/.test(from)||new URL(origin).protocol!=='https:')return null"],
["invitationOrigin:process.env.APP_ORIGIN?new URL(origin).origin:null","invitationOrigin:new URL(origin).origin"]]);
edit('web-foundation.js',[
[`(!id?'<p class="form-hint">Ao criar o acesso, a plataforma enviará automaticamente um convite para o e-mail corporativo. A pessoa definirá a própria senha no primeiro acesso.</p>':'')+`,`(!id?'<label class="check-row"><input type="checkbox" name="notifyEmail" value="1"> Enviar e-mail para notificar a criação da conta</label><p class="form-hint">Se selecionado, enviaremos um convite de primeiro acesso ao e-mail cadastrado. A pessoa definirá a própria senha pelo link.</p>':'')+`],
["   if(!id){\n    const current=await api('v2/organization'),created=","   if(!id&&body.notifyEmail==='1'){\n    const current=await api('v2/organization'),created="],
["   return {message:'Cadastro e vínculo atualizados.'}\n  },id?","   return {message:id?'Cadastro e vínculo atualizados.':'Acesso criado. Nenhum convite enviado.'}\n  },id?"],
["  if(act==='analyticsCompany')","  if(act==='changeOwnPassword'){const access=await api('access');if(!access.me?.email)throw Error('Entre novamente para continuar.');showRecoveryRequest(access.recoveryConfigured,access.me.email)}\n  if(act==='analyticsCompany')"],
["function showRecoveryRequest(available){","function showRecoveryRequest(available,ownEmail=null){"],
[" if(!available)return\n $('recoverForm').onsubmit="," if(!available)return\n if(ownEmail){const input=$('recoverForm').elements.email;input.value=ownEmail;input.readOnly=true;const heading=$('modalBody').querySelector('h2');if(heading)heading.textContent='Alterar minha senha'}\n $('recoverForm').onsubmit="],
["email:editor.elements.email.value","email:ownEmail||editor.elements.email.value"]]);
edit('web-lxp-v2.js',[
["  if(data.canManage)content+=panel('Ferramentas de gestão'",`  content+=panel('Segurança da conta','<p class="lxp-note">Solicite um link de uso único no e-mail cadastrado para alterar sua senha.</p><button type="button" class="primary" data-act="changeOwnPassword">Alterar minha senha</button>')\n  if(data.canManage)content+=panel('Ferramentas de gestão'`]]);
// Check generated source before touching the working tree.
for(const [file,source] of updates){execFileSync(process.execPath,['--check','--input-type=module'],{input:source,stdio:['pipe','pipe','pipe']});}
for(const [file,source] of updates){writeFileSync(file,source);console.log('Alterado: '+file);}
console.log('Execute npm test e npm run test:security com Node >=24 antes de publicar. Nenhum commit ou deploy realizado.');
