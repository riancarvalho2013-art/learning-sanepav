import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import {invitationEmail} from './recovery.mjs'
const document={title:''},auth=vm.runInNewContext(readFileSync('web-auth-v20.js','utf8')+';academyAuth',{document})
let n=0;const check=(ok,msg)=>{assert(ok,msg);n++}
const login=auth.login({setup:false,recoveryConfigured:true,theme:{title:'Sanepav',color:'red'}})
check(login.includes('Learning <span>Academy</span>'),'marca independente')
check(!/Sanepav|marca\.png/.test(login),'não revelar identidade de cliente no acesso')
for(const name of ['email','password'])check(login.includes('name="'+name+'"'),'contrato de login preservado')
check(login.includes('id="login"'),'formulário existente');check(login.includes('data-act="recoverAccess" data-id="available"'),'recuperação funcional')
check(login.includes('autocomplete="current-password"'),'gerenciador de senhas')
check(!login.includes('name="name"'),'sem cadastro acidental em ambiente inicializado')
check(auth.login({setup:true}).includes('name="name"'),'primeira conta permanece protegida pelo setup')
check(auth.activation({activationConfigured:true}).includes('href="/ativar"'),'fluxo de ativação preservado')
check(!auth.activation({activationConfigured:false}).includes('href="/ativar"'),'sem ativação enganosa')
check(auth.reset().includes('name="confirmation"'),'confirmação da nova senha')
check(auth.reset().includes('autocomplete="new-password"'),'primeiro acesso e recuperação')
check(auth.recovery(true).includes('id="recoverForm"'),'contrato de recuperação')
check(!auth.recovery(false).includes('id="recoverForm"'),'provedor desativado honesto')
const attributes={'aria-controls':'academy-password'},password={type:'password',name:'password'},control={getAttribute:key=>attributes[key],setAttribute:(key,value)=>attributes[key]=value,addEventListener:(event,callback)=>control.click=callback},label={textContent:'Entrar',dataset:{}},classes=new Set(),submit={querySelector:()=>label,classList:{toggle:(key,value)=>value?classes.add(key):classes.delete(key)}},form={elements:{password},querySelectorAll:()=>[control],querySelector:()=>submit,setAttribute:(key,value)=>attributes[key]=value}
auth.bind(form);check(document.title==='Learning Academy · Acesso','título próprio');control.click();check(password.type==='text'&&attributes['aria-pressed']==='true','exibir senha acessível');control.click();check(password.type==='password'&&attributes['aria-pressed']==='false','ocultar senha');auth.busy(form,true);check(submit.disabled&&attributes['aria-busy']==='true'&&label.textContent==='Aguarde…','estado de carregamento');auth.busy(form,false);check(!submit.disabled&&attributes['aria-busy']==='false'&&label.textContent==='Entrar','restaurar após erro')
const mail=invitationEmail({name:'Pessoa',company:'Empresa preservada',platform:'Learning Sanepav',token:'TOKEN_TESTE'},'https://qa.example.test');check(mail.subject.includes('Learning Academy'),'marca padrão no convite');check(mail.html.includes('Empresa preservada'),'empresa preservada no convite');check(!mail.html.includes('DNA DO DESENVOLVIMENTO'),'identidade institucional independente');check(invitationEmail({name:'Pessoa',platform:'Universidade da Empresa'},'https://qa.example.test').subject.includes('Universidade da Empresa'),'personalização de cliente preservada')
const html=readFileSync('web-index.html','utf8'),manifest=JSON.parse(readFileSync('asset-manifest.json'))
for(const asset of ['/auth-v20.js','/auth-v20.css','/academy-mark.svg'])check(html.includes(asset)&&manifest[asset],'recurso incluído no build: '+asset)
check(html.indexOf('/auth-v20.js')<html.indexOf('/app.js'),'componente disponível antes do login')
function lum(hex){return hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((v,x,i)=>v+x*[.2126,.7152,.0722][i],0)}
for(const color of ['235ed5','0064dc','526783','173359'])check(1.05/(lum(color)+.05)>=4.5,'contraste de texto em fundo branco: '+color)
console.log('PASS V20: '+n+' verificações de apresentação, contratos, carregamento, acessibilidade, contraste e identidade. Sem validação visual em navegador nesta suíte.')
