#!/usr/bin/env node
// Learning Academy V26 — local-only, guarded source transformations.
import {readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
const args=process.argv.slice(2), mode=args[0];
if(!['--check','--apply'].includes(mode)){console.error('Uso: node aplicar-v26.mjs --check|--apply CAMINHO_DO_REPOSITORIO');process.exit(2)}
const root=resolve(args[1]||'.'), files=new Map();
function file(path){if(!files.has(path)){const full=join(root,path);const original=readFileSync(full,'utf8');files.set(path,{original,current:original})}return files.get(path)}
function one(path,before,after){const f=file(path),i=f.current.indexOf(before);if(i<0||f.current.indexOf(before,i+before.length)>=0)throw Error(`${path}: âncora ausente ou ambígua: ${before.slice(0,100)}`);f.current=f.current.slice(0,i)+after+f.current.slice(i+before.length)}
function between(path,start,end,replacement){const f=file(path),i=f.current.indexOf(start),j=f.current.indexOf(end,i+start.length);if(i<0||j<0||f.current.indexOf(start,i+start.length)>=0)throw Error(`${path}: delimitadores incompatíveis: ${start}`);f.current=f.current.slice(0,i)+replacement+f.current.slice(j)}
function append(path,content){const f=file(path);if(f.current.includes('Learning Academy V26 —'))throw Error(`${path}: V26 já aplicada`);f.current+='\n'+content+'\n'}
function all(path,before,after,min=1){const f=file(path),count=f.current.split(before).length-1;if(count<min)throw Error(`${path}: âncora não encontrada: ${before}`);f.current=f.current.replaceAll(before,after)}
function git(...a){const p=spawnSync('git',['-C',root,...a],{encoding:'utf8'});if(p.status!==0)throw Error(p.stderr||'Falha no Git');return p.stdout.trim()}
try{
 if(!existsSync(join(root,'package.json')))throw Error('Diretório não é a raiz do Learning Academy.');
 if(mode==='--apply'){const branch=git('branch','--show-current');if(!branch||['main','master','homologacao-dna'].includes(branch))throw Error('Crie uma branch local de revisão antes de aplicar.');if(git('status','--porcelain'))throw Error('A árvore de trabalho deve estar limpa antes da aplicação.');}
 // 1. Relatórios: nav global era responsável pela disposição vertical. Mantém delegação data-r3.
 one('web-reports-v3.js','<nav class="r3-tabs" aria-label="Módulos analíticos">','<div class="r3-tabs" role="group" aria-label="Módulos analíticos">');
 one('web-reports-v3.js',"+'</nav>'+savedToolbar()+form()","+'</div>'+savedToolbar()+form()");
 one('web-reports-v3.js',`+'" data-r3="tab" data-id="'+esc(id)+'">'`,`+'" aria-pressed="'+String(section===id)+'" data-r3="tab" data-id="'+esc(id)+'">'`);
 // 2. Intranet: preserve route and notification identifiers; accept new alias at deep links.
 one('web-app.js',"+esc(p)+'</button>'","+esc(p==='Rede social'?'Intranet':p)+'</button>'");
 one('web-app.js',"+esc(page)+'</span>'+globalSearch()","+esc(page==='Rede social'?'Intranet':page)+'</span>'+globalSearch()");
 one('web-app.js','<h1>Rede social</h1>','<h1>Intranet</h1>');
 one('web-app.js','<small>Intranet</small>','<small>Comunicação</small>');
 all('web-app.js',"add('Plataforma','Rede social',","add('Plataforma','Intranet',",3);
 one('web-app.js',"let directEntry=directPages.includes(entrySearch.get('view'))?{\n  page:entrySearch.get('view'),", "const intranetRoute26=value=>value==='Intranet'?'Rede social':value\nlet directEntry=directPages.includes(intranetRoute26(entrySearch.get('view')))?{\n  page:intranetRoute26(entrySearch.get('view')),");
 one('web-app.js','async function openDirect(pageName,itemId){\n  page=pageName','async function openDirect(pageName,itemId){\n  pageName=intranetRoute26(pageName)\n  page=pageName');
 one('web-app.js',"if(act==='nav'){page=id;","if(act==='nav'){page=id==='Intranet'?'Rede social':id;");
 // 3. Remove only decorative source symbols, retaining semantic recognition functionality.
 all('web-evolution.js','✦ DNA DO DESENVOLVIMENTO','DNA DO DESENVOLVIMENTO',3);
 one('web-design-v22.js',"'Elogio':['praise','star'","'Elogio':['praise','award'");
 one('web-design-v21.js',"'Elogio':'star'","'Elogio':'award'");
 one('web-app.js',"'◇','☆','∿'","'◇','✓','∿'");
 all('web-app.js','✨','✓',3);
 // 4. OKR: real authorized objects, grouped rows, all pre-existing action handlers.
 between('web-lxp-v2.js',' const cards=items.map(o=>panel(o.title,',' const legacy=',` const statusLabels26={draft:'Rascunho',active:'Ativo',closed:'Encerrado'}
 const cards=items.map(o=>{
  const results=(o.results||[]).map(k=>'<div class="okr26-kr"><div class="okr26-kr-title"><strong>'+e(k.title)+'</strong><small>Resultado-chave · peso '+e(k.weight)+'</small></div><div><small>Inicial → meta</small><b>'+e(k.baseline)+' → '+e(k.target)+' '+e(k.unit)+'</b></div><div><small>Atual</small><b>'+e(k.current??k.baseline)+' '+e(k.unit)+'</b></div><div class="okr26-meter"><small>'+e(k.progress)+'%</small><progress max="100" value="'+e(k.progress)+'" aria-label="Progresso do resultado-chave"></progress></div><div class="okr26-kr-action">'+(o.canCheckin?okrAction('checkin',o.id,o.revision,k.id):'')+'</div><div class="okr26-history">'+(k.canSeeHistory?'<details><summary>Histórico ('+e(k.checkinCount)+')</summary>'+(k.checkins||[]).map(c=>'<p>'+e(shortDate(c.businessDate))+' · '+e(c.value)+' '+e(k.unit)+' — '+e(c.note)+(c.actorName?' · '+e(c.actorName):'')+'</p>').join('')+'</details>':'<small>Atualizações: '+e(k.checkinCount)+' · evidências restritas ao responsável e à gestão autorizada.</small>')+'</div></div>').join('')
  const actions=(o.canRetarget?okrAction('retarget',o.id,o.revision):'')+(o.canManage&&o.status==='draft'?okrAction('publish',o.id,o.revision):'')+(o.canManage&&o.status==='active'?okrAction('close',o.id,o.revision):'')
  const audit=o.audit?'<details class="okr-audit"><summary>Auditoria administrativa</summary><p>Criado por: '+e(o.audit.createdBy||'Não informado')+' · '+e(o.audit.createdAt||'')+'</p>'+(o.audit.closedAt?'<p>Encerrado por: '+e(o.audit.closedBy||'Não informado')+' · '+e(o.audit.closingNote||'')+'</p>':'')+'<p>Alterações de atribuição: '+e(o.audit.scopeHistory?.length||0)+'</p>'+(o.audit.scopeHistory||[]).map(h=>'<p>'+e(h.at)+' · '+e(okrLabels[h.scope]||h.scope)+' · '+e(h.actorName||'')+'</p>').join('')+'</details>':''
  return '<section class="lxp-panel okr26-objective"><div class="okr26-objective-row"><div><small>'+e(okrLabels[o.scope]||'Colaborador(a)')+'</small><h2>'+e(o.title)+'</h2><small>'+e([o.companyName,o.departmentName].filter(Boolean).join(' · ')||'—')+'</small></div><div><small>Responsável</small><b>'+e(o.ownerName||'Não informado')+'</b></div><div><small>Prazo</small><b>'+e(shortDate(o.endsOn))+'</b><small>Início: '+e(shortDate(o.startsOn))+'</small></div><div><small>Situação</small><b class="okr26-status">'+e(statusLabels26[o.status]||o.status||'—')+'</b></div><div class="okr26-meter"><small>'+e(o.progress)+'%</small><progress max="100" value="'+e(o.progress)+'" aria-label="Progresso do objetivo"></progress></div></div><details class="okr26-results" open><summary>Resultados-chave ('+e((o.results||[]).length)+')</summary>'+ (results||'<p>Nenhum resultado-chave cadastrado.</p>')+'</details>'+(actions?'<div class="lxp-heading-actions okr26-actions">'+actions+'</div>':'')+audit+'</section>'
 })
`);
 // 5. 9Box: no expansion of backend privacy; use only existing scoped records and valid integer positions.
 between('web-app.js'," else if(page==='Matriz 9 Box'){"," else if(page==='Pessoas'&&admin())",` else if(page==='Matriz 9 Box'){
  if(!manager()){h=heading(page)+empty('Esta visão é restrita a perfis de gestão autorizados.')}
  else{const allowed=new Set(d.people.map(p=>p.id));const last=new Map();for(const r of rec.filter(r=>r.kind==='Desempenho'&&allowed.has(r.person)&&[1,2,3].includes(r.performance)&&[1,2,3].includes(r.potential)).sort((a,b)=>String(a.date||a.updated||'').localeCompare(String(b.date||b.updated||''))||String(a.updated||'').localeCompare(String(b.updated||''))))last.set(r.person,r);let cells='';for(let pot=3;pot>=1;pot--)for(let perf=1;perf<=3;perf++){const ps=[...last.values()].filter(r=>r.performance===perf&&r.potential===pot);cells+='<div class="cell nine26-cell" data-performance="'+perf+'" data-potential="'+pot+'"><div class="nine26-cell-title"><strong>'+['Baixo','Médio','Alto'][perf-1]+' desempenho</strong><span>'+ps.length+'</span></div><small>Potencial '+['baixo','médio','alto'][pot-1]+'</small><div class="nine26-people">'+(ps.map(r=>'<div class="nine26-person">'+esc(pname(r.person))+'</div>').join('')||'<small>Sem pessoas neste quadrante</small>')+'</div></div>'}h=heading(page)+filters()+'<section class="card nine26-panel"><div class="nine26-head"><div><h2>Desempenho e potencial</h2><p>Último registro válido por pessoa, dentro do escopo autorizado.</p></div><strong>'+last.size+' pessoa(s) avaliada(s)</strong></div><div class="nine26-axis">Potencial: alto → baixo</div><div class="nine">'+cells+'</div><div class="nine26-x">Desempenho: baixo → alto</div>'+(!last.size?'<p class="nine26-note">Não há registros de desempenho e potencial disponíveis para este perfil e recorte. A matriz não utiliza dados simulados.</p>':'')+'</section>'}
 }
`);
 // 6. User creation: server-side random inaccessible credential, opt-in, never for new admins.
 one('platform.mjs',"function update(s,u,op,b){\n const admin=", "function update(s,u,op,b){\n let createdPersonId26=null\n const admin=");
 one('platform.mjs',"p={id:id()};s.users.push(p)}Object.assign(p,", "p={id:id()};s.users.push(p);createdPersonId26=p.id}Object.assign(p,");
 one('platform.mjs',"[op])\n}\n\n\nconst media=", "[op])\n if(op==='user'&&b.inviteOnCreate===true&&createdPersonId26)return {personId:createdPersonId26}\n}\n\n\nconst media=");
 one('platform.mjs',"if(op==='user'&&b.password){assertAdmin(u);b.secret=await password(b.password)}delete b.password", "if(op==='user'&&b.password){assertAdmin(u);b.secret=await password(b.password)}else if(op==='user'&&!b.id&&b.inviteOnCreate===true&&b.role!=='Administrador'&&b.organization){assertAdmin(u);b.secret=await password(crypto.randomUUID()+crypto.randomUUID())}delete b.password");
 one('platform.mjs',"await change(env,async s=>{const user=actor(s,digest,identity);const prepared=await prepareVideoPolicy(env.BUCKET,s,user,op,b);return update(s,user,op,prepared)});return response({ok:true})", "const result=await change(env,async s=>{const user=actor(s,digest,identity);const prepared=await prepareVideoPolicy(env.BUCKET,s,user,op,b);return update(s,user,op,prepared)});return response({ok:true,...(result||{})})");
 // The generic form must display callback outcome instead of masking invitation outcome.
 one('web-app.js',"await submit(Object.fromEntries(new FormData(f)),f);modal.close();await refresh();toast('Dados salvos.')", "const outcome=await submit(Object.fromEntries(new FormData(f)),f);modal.close();await refresh();toast(typeof outcome==='string'?outcome:'Dados salvos.')");
 one('web-foundation.js',"fld(id?'Nova senha (opcional)':'Senha inicial','password','','password',(id?'':'required ')+'minlength=\"12\" maxlength=\"150\" autocomplete=\"new-password\"')+", "'<div data-v26-password>'+fld(id?'Nova senha (opcional)':'Senha inicial (somente administrador)','password','','password','minlength=\"12\" maxlength=\"150\" autocomplete=\"new-password\"')+'</div>'+(!id?'<p class=\"notice\" data-v26-invite-note>Após salvar um usuário ativo, o sistema tentará enviar o convite de primeiro acesso para o e-mail cadastrado. Se o envio falhar, use o botão de reenvio em Pessoas.</p>':'')+");
 one('web-foundation.js',"await api('user',{id,name:body.name,email:body.email,role:body.role,active:body.active==='1',manager:body.manager,\n    password:body.password,area:department?.name||existing.area||'',organization})\n   if(id===d.me.id&&body.password){modal.close();await start()}",`const inviteOnCreate=!id&&body.role!=='Administrador'
   const result=await api('user',{id,name:body.name,email:body.email,role:body.role,active:body.active==='1',manager:body.manager,
    password:inviteOnCreate?'':body.password,area:department?.name||existing.area||'',organization,...(inviteOnCreate?{inviteOnCreate:true}:{})})
   if(id===d.me.id&&body.password){modal.close();await start()}
   if(inviteOnCreate){
    if(body.active!=='1')return 'Usuário criado. Convite não enviado: conta bloqueada.'
    if(!result.personId)return 'Usuário criado. Convite pendente: envie em Pessoas.'
    try{const invite=await api('first-access/invite',{personId:result.personId,requestId:crypto.randomUUID()});return invite.accepted?'Usuário criado. Convite aceito pelo provedor de e-mail.':'Usuário criado. Convite pendente: envie em Pessoas.'}
    catch{return 'Usuário criado. Convite pendente: verifique o e-mail ou reenvie em Pessoas.'}
   }`);
 one('web-foundation.js',"},id?'Salvar cadastro e empresa':'Criar usuário')\n bindOrganizationFields(editor,person)",`},id?'Salvar cadastro e empresa':'Criar usuário')
 bindOrganizationFields(editor,person)
 if(!id){const sync26=()=>{const adminRole=editor.elements.role.value==='Administrador',password=editor.elements.password;password.required=adminRole;password.disabled=!adminRole;if(!adminRole)password.value='';editor.querySelector('[data-v26-password]').hidden=!adminRole;editor.querySelector('[data-v26-invite-note]').hidden=adminRole};editor.elements.role.addEventListener('change',sync26);sync26()}`);
 // 7. CSS appended to the last design layer, scope to authenticated content only.
 append('web-design-v23.css',`/* Learning Academy V26 — consistent module surfaces, reports, OKR, 9Box. */
#app .shell.la23-shell[data-la22-route] .inside .la22-hero{box-sizing:border-box;min-height:184px;padding:24px clamp(20px,2.5vw,38px);margin:0 0 18px;border-radius:18px;gap:16px;background-color:#073a95;background-image:linear-gradient(115deg,#08265e 0%,#0753af 58%,#0086ad 100%);background-size:cover;box-shadow:0 5px 16px #124d9724}
#app .shell.la23-shell[data-la22-route] .inside .la22-hero :is(.dna-hero-orbit,.orbit,.r3-hero-mark,.p5-hero-mark){display:none!important}
#app .shell.la23-shell[data-la22-route] .inside .la22-hero h1{font-size:clamp(27px,2.65vw,40px);line-height:1.15;margin:0 0 6px}
#app .shell.la23-shell[data-la22-route] .inside .la22-hero p{font-size:14px;line-height:1.45;margin:0 0 6px}
#app .shell.la23-shell[data-la22-route] .inside .r3-wrapper>.r3-tabs{display:flex;flex-direction:row;flex-wrap:nowrap;align-items:center;justify-content:flex-start;gap:8px;width:100%;overflow-x:auto;overflow-y:hidden;padding:8px 4px 12px;margin:0;scrollbar-width:thin}
#app .shell.la23-shell[data-la22-route] .inside .r3-tabs>.r3-tab{flex:0 0 auto;width:auto;min-height:42px;white-space:nowrap;border-radius:10px;padding:10px 15px;text-align:center}
#app .shell.la23-shell[data-la22-route] .inside #okrCards{display:grid;gap:14px}
#app .shell.la23-shell[data-la22-route] .inside #okrCards .okr26-objective{padding:0;overflow:hidden;background:#fff}
.okr26-objective-row,.okr26-kr{display:grid;grid-template-columns:minmax(170px,2.2fr) minmax(105px,1fr) minmax(100px,1fr) minmax(90px,.8fr) minmax(120px,1fr);gap:14px;align-items:center;padding:18px;min-width:0}
.okr26-objective-row>div,.okr26-kr>div{min-width:0;overflow-wrap:anywhere}.okr26-objective-row h2{margin:4px 0!important;font-size:17px!important}.okr26-objective-row small,.okr26-kr small{display:block;color:#58718f;font-size:12px;line-height:1.4}.okr26-objective-row b,.okr26-kr b{display:block;font-size:13px;color:#193e72}.okr26-status{display:inline-block!important;padding:5px 9px;background:#eaf3ff;border-radius:7px}.okr26-meter progress{width:100%;height:12px;accent-color:#0754e7;display:block;margin-top:5px}.okr26-results{border-top:1px solid #d6e6f8;background:#f7fbff}.okr26-results>summary{cursor:pointer;padding:12px 18px;font-weight:700;color:#184d87}.okr26-kr{margin:0 12px;border-top:1px solid #dbe8f4;padding:13px 6px}.okr26-kr-title strong{font-size:13px;display:block}.okr26-history{grid-column:1/-1}.okr26-history p{font-size:12px}.okr26-actions,.okr26-objective>.okr-audit{padding:12px 18px;margin:0}.okr26-actions{border-top:1px solid #e2edf8}
.nine26-panel .nine{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.nine26-head{display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap}.nine26-head h2{margin:0 0 6px}.nine26-axis,.nine26-x{text-align:center;font-weight:650;font-size:12px;color:#527394;padding:10px}.nine26-cell{min-height:145px;border:1px solid #c7d9ee;border-radius:13px;padding:13px;background:#f2f7fd;overflow-wrap:anywhere}.nine26-cell[data-potential="3"]{background:#e7f6f9}.nine26-cell[data-performance="3"][data-potential="3"]{background:#ddf3eb}.nine26-cell-title{display:flex;justify-content:space-between;gap:7px;align-items:start}.nine26-cell-title span{background:#fff;border:1px solid #cddfed;border-radius:6px;min-width:24px;text-align:center;padding:2px 5px}.nine26-people{display:grid;gap:5px;margin-top:12px}.nine26-person{padding:6px 8px;background:#fff;border:1px solid #d5e4f2;border-radius:7px;font-size:12px;color:#1d4377}.nine26-note{font-size:13px;color:#526e89}
@media(max-width:1100px){.okr26-objective-row,.okr26-kr{grid-template-columns:repeat(2,minmax(0,1fr))}.okr26-objective-row>div:first-child,.okr26-kr-title{grid-column:1/-1}}
@media(max-width:650px){#app .shell.la23-shell[data-la22-route] .inside .la22-hero{min-height:168px;padding:18px 16px;gap:10px}.okr26-objective-row,.okr26-kr{grid-template-columns:1fr 1fr;gap:9px;padding:12px}.nine26-panel{overflow-x:auto}.nine26-panel .nine{min-width:570px}.nine26-axis,.nine26-x{min-width:570px}}
@media print{#app .shell.la23-shell[data-la22-route] .inside .r3-tabs{display:none!important}}
`);
 const temp=mkdtempSync(join(tmpdir(),'learning-v26-'));
 try{for(const [name,{current}] of files){if(!/\.(mjs|js)$/.test(name))continue;const target=join(temp,name);writeFileSync(target,current);const p=spawnSync(process.execPath,['--check',target],{encoding:'utf8'});if(p.status!==0)throw Error(`${name}: ${p.stderr||'erro de sintaxe'}`)}}finally{rmSync(temp,{recursive:true,force:true})}
 console.log('Âncoras e sintaxe JS verificadas. Arquivos:');for(const [name,{original,current}] of files){if(original!==current)console.log(` - ${name}`)}
 if(mode==='--check'){console.log('Simulação: nenhum arquivo alterado.');process.exit(0)}
 const written=[];try{for(const [name,{original,current}] of files){if(original===current)continue;written.push(name);writeFileSync(join(root,name),current)}git('diff','--check')}catch(error){for(const name of written)writeFileSync(join(root,name),files.get(name).original);throw error}
 console.log('V26 aplicada localmente. Nenhum commit, push, merge ou deploy foi realizado. Revise git diff e rode npm test.');
}catch(error){console.error('V26 interrompida: '+error.message);process.exitCode=1}
