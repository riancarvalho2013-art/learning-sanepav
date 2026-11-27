import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { emailConfiguration, sendTransactional } from './email-provider.mjs';
const cfg=emailConfiguration({EMAIL_PROVIDER:'brevo',BREVO_API_KEY:'fake-test-key',EMAIL_FROM:'sender@example.test',EMAIL_FROM_NAME:'Learning Academy',APP_ORIGIN:'https://learning.example.test'});
assert.equal(cfg.provider,'brevo');
assert.equal(cfg.origin,'https://learning.example.test');
assert.equal(emailConfiguration({EMAIL_PROVIDER:'brevo',EMAIL_FROM:'sender@example.test',BREVO_API_KEY:'fake-test-key'}),null);
assert.equal(emailConfiguration({EMAIL_PROVIDER:'brevo',EMAIL_FROM:'Learning <sender@example.test>',BREVO_API_KEY:'fake-test-key',APP_ORIGIN:'https://learning.example.test'}),null);
const fakeMessage={id:'test-id',email:'recipient@example.test'};
let call;
const stub=async(url,options)=>{call={url,options,body:JSON.parse(options.body)};return {ok:true,status:201}};
await sendTransactional(fakeMessage,cfg,{subject:'Convite',html:'<p>Teste</p>',text:'Teste'},stub);
assert.equal(call.url,'https://api.brevo.com/v3/smtp/email');
assert.equal(call.options.headers['api-key'],'fake-test-key');
assert.deepEqual(call.body.sender,{email:'sender@example.test',name:'Learning Academy'});
assert.deepEqual(call.body.to,[{email:'recipient@example.test'}]);
assert.equal(call.body.htmlContent,'<p>Teste</p>');
await sendTransactional(fakeMessage,cfg,{subject:'Recuperação',text:'Teste'},stub);
assert.equal(call.body.textContent,'Teste');
assert.ok(!('htmlContent' in call.body));
await assert.rejects(()=>sendTransactional(fakeMessage,cfg,{subject:'Teste',text:'Teste'},async()=>({ok:false,status:401})),/HTTP 401/);
const resend=emailConfiguration({RESEND_API_KEY:'fake-test-key',EMAIL_FROM:'Learning <sender@example.test>',APP_ORIGIN:'https://learning.example.test'});
await sendTransactional(fakeMessage,resend,{subject:'Teste',text:'Teste'},stub);
assert.equal(call.url,'https://api.resend.com/emails');
console.log('Testes simulados dos provedores: OK. Nenhum e-mail real enviado.');
const updates=new Map();
function edit(file,pairs){let s=updates.get(file)??readFileSync(file,'utf8');for(const [a,b] of pairs){if(s.split(a).length!==2)throw Error('Base incompatível: '+file+' / '+a.slice(0,100));s=s.replace(a,()=>b);}updates.set(file,s);}
edit('recovery.mjs',[
["import {hashPassword} from './credentials.mjs'","import {hashPassword} from './credentials.mjs'\nimport {emailConfiguration,sendTransactional} from './email-provider.mjs'"],
["function configuration(){\n try{\n  const key=process.env.RESEND_API_KEY?.trim(),from=process.env.EMAIL_FROM?.trim()\n  const origin=process.env.APP_ORIGIN||'https://learning-sanepav-production.up.railway.app'\n  if(!key||!from||/[\\r\\n]/.test(from)||new URL(origin).protocol!=='https:')return null\n  return {key,from,origin:new URL(origin).origin,invitationOrigin:process.env.APP_ORIGIN?new URL(origin).origin:null}\n }catch{return null}\n}", "const configuration=()=>emailConfiguration()"],
["  const result=await fetch('https://api.resend.com/emails',{\n   method:'POST',headers:{authorization:'Bearer '+config.key,'content-type':'application/json','idempotency-key':message.id},\n   body:JSON.stringify({from:config.from,to:[message.email],...payload}),signal:AbortSignal.timeout(15000)\n  })\n  if(!result.ok)throw new Error('Não foi possível enviar o e-mail.')", "  await sendTransactional(message,config,payload)"],
["Configure APP_ORIGIN, EMAIL_FROM e RESEND_API_KEY para este ambiente.","Configure APP_ORIGIN, EMAIL_FROM e a chave do provedor de e-mail para este ambiente."],
["  if(!settings)return reply({error:'Recuperação por e-mail indisponível. Solicite apoio à administração.'},503)","  if(!settings||(settings.provider&&settings.origin!==new URL(request.url).origin))return reply({error:'Recuperação por e-mail indisponível. Solicite apoio à administração.'},503)"]]);
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
edit('web-lxp-v2.js',[
[ '<p id="bulkStatus" role="status"></p>', '<label class="check-row"><input id="bulkNotifyEmail" type="checkbox"> Enviar e-mails de primeiro acesso aos usuários importados</label><p id="bulkStatus" role="status"></p>' ],
[ "file=$('bulkExcel'),emails=importRows.map", "file=$('bulkExcel'),notifyEmail=$('bulkNotifyEmail')?.checked===true,emails=importRows.map" ],
[ "if(run!==importRun)return;el.textContent='Acessos criados. Enviando convites corporativos…';", "if(run!==importRun)return;if(!notifyEmail){clearImport();$('modal').close();notify(result.created+' usuários importados · nenhum convite enviado.');await refresh();return}el.textContent='Acessos criados. Enviando convites corporativos…';" ]]);
// Check generated source before touching the working tree.
for(const [file,source] of updates){execFileSync(process.execPath,['--check','--input-type=module'],{input:source,stdio:['pipe','pipe','pipe']});}
for(const [file,source] of updates){writeFileSync(file,source);console.log('Alterado: '+file);}
console.log('Integração aplicada no ambiente de build; a suíte do Dockerfile validará a aplicação.');
