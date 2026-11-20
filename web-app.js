const pulseContexts=["Orgulho do time", "Metas claras", "Semana muito produtiva", "Apoio de alguém", "Carga de trabalho alta", "Falta de clareza", "Metas pouco claras", "Problemas pessoais", "Precisando de apoio"];
'use strict';
const $=id=>document.getElementById(id),app=$('app'),modal=$('modal')
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const kinds=['OKR','PDI','1:1','Feedback','Elogio','Pulse','Desempenho']
const icons=['◎','◫','◷','◇','☆','∿','▥']
let refreshSequence=0
let d,page='Painel',person='',search='',player=null,timer
const admin=()=>d.me.role==='Administrador',manager=()=>['Administrador','Líder','RH/DHO'].includes(d.me.role)
const learningAdmin=()=>['Administrador','RH/DHO'].includes(d.me.role)
const pname=id=>d.people.find(p=>p.id===id)?.name||'Pessoa'
const cname=id=>d.courses.find(c=>c.id===id)?.title||'Curso'
const btn=(label,act,id='',cls='')=>'<button type="button" class="'+cls+'" data-act="'+act+'" data-id="'+esc(id)+'">'+esc(label)+'</button>'
const opt=(list,selected)=>list.map(x=>{const [v,t]=Array.isArray(x)?x:[x,x];return '<option value="'+esc(v)+'" '+(String(v)===String(selected)?'selected':'')+'>'+esc(t)+'</option>'}).join('')
const fld=(label,name,value='',type='text',attrs='required')=>'<label>'+esc(label)+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+attrs+'></label>'
const sel=(label,name,list,selected)=>'<label>'+esc(label)+'<select name="'+name+'">'+opt(list,selected)+'</select></label>'
const area=(label,name,value='',required='')=>'<label>'+esc(label)+'<textarea name="'+name+'" '+required+'>'+esc(value)+'</textarea></label>'
const empty=t=>'<p class="empty">'+esc(t)+'</p>'
const tag=t=>'<span class="tag">'+esc(t)+'</span>'
const bar=v=>'<div class="bar"><span style="width:'+Math.min(100,Number(v)||0)+'%"></span></div>'
const when=s=>s?new Date(s.length===10?s+'T12:00:00':s).toLocaleDateString('pt-BR'):''
async function api(path,body){const r=await fetch('/api/'+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const v=await r.json();if(!r.ok){if(r.status===401&&path!=='login'){modal.close();await start()}throw Error(v.error||'Falha de comunicação.')}return v}
function toast(t){$('toast').textContent=t;$('toast').style.display='block';clearTimeout(timer);timer=setTimeout(()=>$('toast').style.display='none',3500)}
function theme(t){document.documentElement.style.setProperty('--brand',t.color);document.documentElement.style.setProperty('--accent',t.accent);document.body.classList.toggle('compact',t.layout==='Compacto');document.title=t.title}
const brand=()=>'<div class="brand"><img src="/marca.png" alt="Sanepav"><span>Learning</span></div>'
async function start(){const a=await api('access');theme(a.theme);if(location.hash.startsWith('#reset=')){passwordResetScreen(location.hash.slice(7));return}if(a.me){await enterLearning();return}
 if(a.setup&&a.activationRequired){app.innerHTML='<section class="login"><div class="loginArt"><span class="over">Universidade corporativa</span><h1>'+esc(a.theme.title)+'</h1><p>Ambiente aguardando ativação pela administração.</p></div><section class="loginForm">'+brand()+'<h2>Configuração inicial protegida</h2><p>'+(a.activationConfigured?'A administração deve informar o código próprio deste ambiente antes de criar a primeira conta.':'A administração precisa configurar a chave SETUP_KEY nas variáveis deste serviço no Railway. Não há um código de ativação padrão.')+'</p>'+(a.activationConfigured?'<a class="primary" href="/ativar">Informar código de ativação</a>':'')+'</section></section>';return}
 app.innerHTML='<section class="login"><div class="loginArt"><span class="over">Universidade corporativa</span><h1>'+esc(a.theme.title)+'</h1><p>Um espaço para aprender, conversar sobre desempenho e acompanhar seu desenvolvimento.</p></div><form class="loginForm" id="login">'+brand()+'<h2>'+(a.setup?'Ativar a plataforma':'Entrar na plataforma')+'</h2><p>'+(a.setup?'Crie a primeira conta de administração deste ambiente privado.':'Use o e-mail e a senha do seu cadastro corporativo.')+'</p>'+(a.setup?fld('Seu nome','name'):'')+fld('E-mail','email','','email','required autocomplete="username"')+fld('Senha','password','','password','required minlength="12" maxlength="150" autocomplete="'+(a.setup?'new-password':'current-password')+'"')+(a.setup?'<small>Use pelo menos 12 caracteres.</small>':'')+'<button class="primary">'+(a.setup?'Ativar e entrar':'Entrar')+'</button>'+(a.setup?'':btn('Recuperar acesso','recoverAccess',a.recoveryConfigured?'available':'unavailable','smallBtn'))+'<div class="err" role="alert"></div></form></section>'
 $('login').onsubmit=async e=>{e.preventDefault();const f=e.target;f.querySelector('button').disabled=true;try{await api('login',Object.fromEntries(new FormData(f)));await enterLearning()}catch(err){f.querySelector('.err').textContent=err.message}finally{f.querySelector('button').disabled=false}}}
async function refresh({social=true}={}){
 const sequence=++refreshSequence
 const [data,organization]=await Promise.all([api('data'+(organizationCompany?'?company='+encodeURIComponent(organizationCompany):'')),api('v2/organization')])
 if(sequence!==refreshSequence)return
 d=data;organizationData=organization;theme(d.theme)
 if(page==='Painel'&&d.me.role==='Diretoria')page='Indicadores estratégicos'
 draw();void refreshNotifications()
 if(social&&page==='Rede social')void loadSocial()
}
const nav=(p,icon)=>'<button data-act="nav" data-id="'+esc(p)+'" class="'+(p===page?'sel':'')+'"><span aria-hidden="true" class="ico">'+icon+'</span>'+esc(p)+'</button>'
function draw(){app.innerHTML='<div class="shell"><aside>'+brand()+'<nav><small>Aprendizagem</small>'+nav('Painel','▦')+nav('Catálogo LMS','▤')+nav('Missões','◎')+(manager()?nav('Relatórios','◫'):'')+'<small>Desenvolvimento</small>'+kinds.map((k,i)=>nav(k,icons[i])).join('')+'<small>Intranet</small>'+nav('Rede social','▧')+foundationNavigation()+(manager()?nav('Matriz 9 Box','▦'):'')+(admin()?'<small>Administração</small>'+nav('Pessoas','♧')+nav('Identidade visual','◈')+nav('Auditoria','☷'):'')+'</nav><div class="profile"><b>'+esc(d.me.name)+'</b><small>'+esc(d.me.role)+'</small>'+btn('Sair','logout','','smallBtn')+'</div></aside><main><header>'+btn('Menu','menu','','menuBtn')+'<span class="breadcrumb">'+esc(d.theme.title)+' &nbsp;/&nbsp; '+esc(page)+'</span>'+globalSearch()+companyContext()+notificationBell()+profileButton()+'</header><div class="inside" id="inside"></div></main></div>';body()}
function filters(q=false){return '<div class="filters">'+(manager()?'<select id="filterPerson" aria-label="Filtrar por pessoa">'+opt([['','Toda a hierarquia'],...d.people.map(p=>[p.id,p.name])],person)+'</select>':'')+(q?'<input id="query" aria-label="Pesquisar cursos" placeholder="Pesquisar curso ou trilha" value="'+esc(search)+'">':'')+'</div>'}
const visible=a=>a.filter(x=>!person||x.person===person)
const heading=(title,action='')=>'<div class="heading"><h1>'+esc(title)+'</h1>'+(action?'<div class="page-actions">'+action+'</div>':'')+'</div>'
function body(){const root=$('inside');if(foundationPages.has(page)){void renderFoundation(root);return}let h='';const rec=visible(d.records),en=visible(d.enroll)
 if(page==='Painel'){
 const done=en.filter(e=>e.progress===100).length,pdi=rec.filter(r=>r.kind==='PDI'&&r.status!=='Concluído').length
 h='<section class="hero"><span class="over">DNA do Desenvolvimento</span><h1>Olá, '+esc(d.me.name.split(' ')[0])+'.</h1><p>Acompanhe as jornadas de aprendizagem e os próximos passos de desenvolvimento.</p>'+btn('Explorar catálogo','nav','Catálogo LMS')+btn('Ver missões','nav','Missões')+'</section>'+nextLearning()+filters()+'<div class="stats">'+[['▤','Matrículas',en.length],['✓','Cursos concluídos',done],['◫','PDIs em aberto',pdi],['◎','OKRs registrados',rec.filter(r=>r.kind==='OKR').length]].map(x=>'<button class="stat" data-act="nav" data-id="'+({'Matrículas':'Catálogo LMS','Cursos concluídos':manager()?'Relatórios':'Catálogo LMS','PDIs em aberto':'PDI','OKRs registrados':'OKR'}[x[1]])+'"><i>'+x[0]+'</i><span>'+x[1]+'</span><b>'+x[2]+'</b></button>').join('')+'</div><div class="duo"><section class="card"><h2>Jornadas de aprendizagem</h2>'+ (en.slice(0,5).map(e=>'<div class="row"><div><b>'+esc(cname(e.course))+'</b><br><small>'+esc(pname(e.person))+'</small></div><strong>'+e.progress+'%</strong></div>').join('')||empty('As matrículas aparecerão aqui.'))+'</section><section class="card"><h2>Desenvolvimento</h2>'+kinds.map(k=>{const rows=rec.filter(r=>r.kind===k);let val=rows.length+' registro(s)';if(k==='Pulse'&&rows.length)val=(rows.reduce((a,r)=>a+r.rating,0)/rows.length).toFixed(1)+' / 5';if(k==='OKR'&&rows.length)val=Math.round(rows.reduce((a,r)=>a+Math.min(1,r.actual/r.target),0)/rows.length*100)+'% da meta';return '<div class="row">'+btn(k,'nav',k,'smallBtn')+'<small>'+val+'</small></div>'}).join('')+(manager()?btn('Ver matriz 9 Box','nav','Matriz 9 Box'):'')+'</section></div>'}
 else if(page==='Rede social'){h=socialPage()}
 else if(page==='Missões'){h=missionsPage()}
 else if(page==='Relatórios'&&manager()){h=learningReport(en)}
 else if(page==='Catálogo LMS'){h=learningCatalog(en)}
 else if(page==='Elogio'){h=praiseWall()}
 else if(kinds.includes(page)){const list=(page==='Pulse'?d.records:rec).filter(r=>r.kind===page).sort((a,b)=>b.updated.localeCompare(a.updated));h=heading(page==='Pulse'?'Meu histórico':page,page==='Pulse'||(page==='Desempenho'&&!manager())?'':btn(recordExperience[page][0],'record','','primary'))+(page==='Pulse'?'':filters())+'<section class="tiles">'+(list.map(r=>'<article class="card experience-card" data-direct="'+esc(r.id)+'">'+(r.kind==='Pulse'?moodBadge(r.rating):'<span class="flow-icon" aria-hidden="true">'+recordExperience[r.kind][3]+'</span>')+tag(r.status)+'<h2>'+esc(r.title)+'</h2><small>'+esc(pname(r.person))+(r.date&&!recordDeadlineKinds.includes(r.kind)?' · '+when(r.date):'')+'</small>'+deadlineBadge(r)+''+(r.note?moreFields('<p class="content">'+esc(r.note)+'</p>','Ver anotação'):'')+''+(r.kind==='Pulse'?contextBadges(r.pulseContexts):details(r))+(r.course?'<p>Curso · '+esc(cname(r.course))+'</p>':'')+(r.link?'<p>Registro vinculado · '+esc(d.records.find(x=>x.id===r.link)?.title)+'</p>':'')+(r.author===d.me.id?btn('Editar','record',r.id,'smallBtn'):'')+'</article>').join('')||empty('Nenhum registro para esta seleção.'))+'</section>'}
 else if(page==='Matriz 9 Box'){let cells='';const last=new Map();for(const r of rec.filter(r=>r.kind==='Desempenho').sort((a,b)=>(a.date||a.updated).localeCompare(b.date||b.updated)||a.updated.localeCompare(b.updated)))last.set(r.person,r);for(let pot=3;pot>=1;pot--)for(let perf=1;perf<=3;perf++){const ps=[...last.values()].filter(r=>r.performance===perf&&r.potential===pot);cells+='<div class="cell"><strong>'+['Baixo','Médio','Alto'][perf-1]+' desempenho</strong><small>Potencial '+['baixo','médio','alto'][pot-1]+'</small><p>'+esc(ps.map(r=>pname(r.person)).join(', ')||'—')+'</p></div>'}h=heading(page)+filters()+'<section class="card"><h2>Desempenho e potencial</h2><p>A avaliação mais recente de cada pessoa define sua posição. '+last.size+' pessoa(s) avaliada(s).</p><div class="nine">'+cells+'</div></section>'}
 else if(page==='Pessoas'&&admin())h=peopleDirectory()
 else if(page==='Identidade visual')h=heading(page)+'<section class="card"><h2>'+esc(d.theme.title)+'</h2><p>Personalize o nome do ambiente, as cores e o espaçamento das telas de LMS e LXP.</p>'+btn('Configurar identidade','theme','','primary')+'</section>'
 else h=heading('Auditoria')+'<div class="card"><p>Últimos 200 eventos do ambiente.</p>'+d.logs.map(l=>'<div class="row"><b>'+esc(l.event)+'</b><small>'+esc(l.who)+' · '+esc(new Date(l.at).toLocaleString('pt-BR'))+'</small></div>').join('')+'</div>'
 if(page==='Pulse'){h=weeklyPulseCard()+h;const surveys=d.pulses.filter(p=>!person||p.people.includes(person));h='<section class="card pulse-surveys"><div class="heading"><h2>Pesquisas da equipe</h2>'+(manager()?btn('Criar pesquisa','pulse','','primary'):'')+'</div>'+(surveys.map(p=>{const mine=d.records.some(r=>r.pulse===p.id&&r.person===d.me.id);return '<div class="row" data-direct="'+esc(p.id)+'"><div><b>'+esc(p.title)+'</b><br><small>Até '+when(p.date)+' · '+p.responseCount+' de '+p.people.length+' respostas</small></div>'+(p.people.includes(d.me.id)&&!mine?btn('Responder','answerPulse',p.id):'')+'</div>'}).join('')||empty('Nenhuma pesquisa publicada.'))+'</section><br>'+h}
 if(page==='Feedback')h+=sentFeedbackPanel()
 root.innerHTML=h;if($('directoryStatus'))$('directoryStatus').onchange=e=>{directoryStatus=e.target.value;body()};if($('filterPerson'))$('filterPerson').onchange=e=>{person=e.target.value;body()};if($('courseStatusFilter'))$('courseStatusFilter').onchange=e=>{learningStatusFilter=e.target.value;body()};if($('query'))$('query').oninput=e=>{search=e.target.value;body();$('query').focus()}}
function details(r){if(r.kind==='OKR')return bar(100*r.actual/r.target)+'<p>'+r.actual+' de '+r.target+'</p>';if(r.kind==='Pulse')return moodBadge(r.rating);if(r.kind==='Desempenho')return '<p>Desempenho '+r.performance+' / 3 · Potencial '+r.potential+' / 3</p>';return ''}
function form(title,html,submit,action='Salvar'){player=null;$('modalBody').innerHTML='<div class="heading"><h2>'+esc(title)+'</h2>'+btn('Fechar','close','','smallBtn')+'</div><form id="editor">'+html+'<p class="err" role="alert"></p><div class="actions"><button class="primary">'+esc(action)+'</button></div></form>';if(!modal.open)modal.showModal();const f=$('editor');f.onsubmit=async e=>{e.preventDefault();const b=f.querySelector('button.primary');b.disabled=true;try{await submit(Object.fromEntries(new FormData(f)),f);modal.close();await refresh();toast('Dados salvos.')}catch(err){f.querySelector('.err').textContent=err.message}finally{b.disabled=false}};return f}
const peopleOpts=()=>d.people.filter(p=>p.active).map(p=>[p.id,p.name])
const moods=[['😞','Muito mal'],['😕','Mal'],['😐','Mais ou menos'],['🙂','Bem'],['🤩','Muito bem']]
function moodPicker(value){
  return '<fieldset class="mood"><legend>Como você está se sentindo?</legend><div class="mood-bar">'+
    moods.map(([emoji,label],index)=>'<label><input type="radio" name="rating" required value="'+(index+1)+'"'+
      (Number(value)===index+1?' checked':'')+'><span class="mood-choice"><span class="mood-emoji" aria-hidden="true">'+emoji+
      '</span><span>'+label+'</span></span></label>').join('')+'</div></fieldset>'
}
function moodBadge(value){
  const mood=moods[Number(value)-1]
  return mood?'<p class="mood-badge"><span aria-hidden="true">'+mood[0]+'</span> '+mood[1]+'</p>':''
}
const moreFields=(html,label='Mais opções')=>'<details class="more-fields"><summary>'+esc(label)+'</summary><div>'+html+'</div></details>'
const todayLocal=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const recordDeadlineKinds=['PDI','1:1','OKR','Desempenho']
function deadlineBadge(record){
  if(!recordDeadlineKinds.includes(record.kind))return ''
  if(!record.date)return '<p class="deadline-badge">Prazo a definir</p>'
  const overdue=record.status!=='Concluído'&&record.date<todayLocal()
  return '<p class="deadline-badge'+(overdue?' overdue':'')+'">'+(overdue?'Prazo vencido · ':'Prazo · ')+esc(when(record.date))+'</p>'
}
function enrollmentDeadline(enrollment){
  if(!enrollment.due)return ''
  const overdue=enrollment.progress<100&&enrollment.due<todayLocal()
  return '<p class="deadline-badge'+(overdue?' overdue':'')+'">'+(overdue?'Prazo vencido · ':'Prazo · ')+esc(when(enrollment.due))+'</p>'
}
function weeklyPulsePeriod(){
  const today=todayLocal()
  const date=new Date(today+'T00:00:00Z')
  const day=(date.getUTCDay()+6)%7
  date.setUTCDate(date.getUTCDate()+4-day)
  const friday=date.toISOString().slice(0,10)
  date.setUTCDate(date.getUTCDate()+2)
  return {friday,sunday:date.toISOString().slice(0,10),open:day>=4}
}
function weeklyPulseCard(){
  const {friday,sunday,open}=weeklyPulsePeriod()
  const answered=d.records.some(record=>record.kind==='Pulse'&&!record.pulse&&record.person===d.me.id&&record.date>=friday&&record.date<=sunday)
  return '<section class="card weekly-pulse"><span class="flow-icon" aria-hidden="true">🙂</span><div><h2>Pulse semanal</h2><p>'+
    (answered?'Você já respondeu nesta semana.':open?'Aberto até domingo.':'Toda semana, de sexta a domingo.')+'</p></div>'+
    (open&&!answered?btn('Como estou hoje','record','','primary'):'')+'</section>'
}
function pulseExperience(survey,record){
  const title=survey?.title||record?.title||'Como você avalia sua semana de trabalho?'
  const date=record?.date||todayLocal()
  const detail=survey?'':moreFields(fld('Pergunta','title',title)+
    (record?sel('Situação','status',['Planejado','Em andamento','Concluído'],record.status):'')+
    (record?linkedFields(record,record.person):''))
  const editor=form(survey?title:'Seu check-in',moodPicker(record?.rating)+
    (survey||record?.pulse?'':pulseContextPicker(record?.pulseContexts))+
    moreFields(area('O que você gostaria de compartilhar?','note',record?.note),'Adicionar comentário')+
    detail+'<p class="privacy-note">'+(survey||record?.pulse?'Sua resposta individual fica no seu perfil. A pesquisa pode mostrar resultados agrupados.':'Seu sentimento, seus motivos e seu comentário ficam no seu perfil.')+'</p>',
    (body,form)=>api('record',{...body,pulseContexts:new FormData(form).getAll('pulseContext'),id:record?.id,kind:'Pulse',person:d.me.id,title:survey?.title||body.title||title,
      date:body.date||date,status:body.status||'Concluído',pulse:survey?.id||record?.pulse}),
    survey?'Enviar resposta':'Registrar sentimento')
  editor.classList.add('pulse-experience')
  const choices=[...editor.querySelectorAll('input[name="pulseContext"]')]
  const updateChoices=()=>{
    const limit=choices.filter(item=>item.checked).length>=3
    for(const choice of choices)choice.disabled=limit&&!choice.checked
  }
  for(const choice of choices)choice.addEventListener('change',updateChoices)
  updateChoices()
}
function pulseContextPicker(selected=[]){
  return '<fieldset class="pulse-context"><legend>O que marcou sua semana?</legend><small>Opcional. Escolha até três motivos.</small><div>'+
    pulseContexts.map(context=>'<label><input type="checkbox" name="pulseContext" value="'+esc(context)+'"'+
      (selected.includes(context)?' checked':'')+'><span>'+esc(context)+'</span></label>').join('')+'</div></fieldset>'
}
function contextBadges(contexts=[]){
  return contexts.length?'<p class="context-badges">'+contexts.map(context=>'<span>'+esc(context)+'</span>').join('')+'</p>':''
}
function linkedFields(record,personId){
  return sel('Curso relacionado','course',[['','Sem vínculo'],...d.enroll.filter(e=>e.person===personId).map(e=>[e.course,cname(e.course)])],record.course)+
    sel('Conectar a outro registro','link',[['','Sem vínculo'],...d.records.filter(item=>item.person===personId&&item.id!==record.id).map(item=>[item.id,item.kind+' · '+item.title])],record.link)
}
const recordExperience={
  OKR:['Definir objetivo','Qual é o objetivo?','Como vamos chegar lá?','◎'],
  PDI:['Planejar meu desenvolvimento','Qual habilidade vamos desenvolver?','Qual é o próximo passo?','↗'],
  '1:1':['Preparar conversa','Sobre o que vamos conversar?','Anotações e combinados','☕'],
  Feedback:['Dar feedback','Sobre o que é o feedback?','Descreva a situação e o impacto','💬'],
  Elogio:['Reconhecer alguém','O que merece reconhecimento?','Conte o que a pessoa fez','✨'],
  Desempenho:['Registrar avaliação','Qual ciclo vamos avaliar?','Evidências e observações','◈']
}
function record(id){
  const saved=d.records.find(item=>item.id===id)||(page==='Feedback'?d.sentFeedback.find(item=>item.id===id):undefined)
  const kind=page
  if(kind==='Pulse'){pulseExperience(null,saved);return}
  if(kind==='Elogio'){praiseForm(id);return}
  const item=saved||{}
  const [heading,prompt,note,icon]=recordExperience[kind]
  const target=item.person||person||d.me.id
  const personField=saved||!manager()?'':sel('Pessoa','person',peopleOpts(),target)
  const core=kind==='OKR'?'<div class="field-pair">'+fld('Meta','target',item.target??100,'number','required min="1" step="any"')+
    fld('Resultado atual','actual',item.actual??0,'number','required min="0" step="any"')+'</div>':
    kind==='Desempenho'?'<div class="field-pair">'+sel('Desempenho','performance',[[1,'Baixo'],[2,'Médio'],[3,'Alto']],item.performance||2)+
    sel('Potencial','potential',[[1,'Baixo'],[2,'Médio'],[3,'Alto']],item.potential||2)+'</div>':''
  const deadline=recordDeadlineKinds.includes(kind)
  const dateField=deadline?fld(kind==='1:1'?'Data da conversa':'Prazo','date',item.date||'','date',saved&&!item.date?'':'required'):''
  const editor=form(saved?'Editar '+kind:heading,'<span class="flow-icon" aria-hidden="true">'+icon+'</span>'+
    fld(prompt,'title',item.title)+personField+dateField+core+area(note,'note',item.note)+
    (kind==='Feedback'?'<p class="privacy-note">Só a pessoa destinatária poderá consultar este feedback.</p>':'')+
    moreFields((deadline?'':fld('Data de referência','date',item.date||todayLocal(),'date'))+
      sel('Situação','status',['Planejado','Em andamento','Concluído'],item.status||'Em andamento')+
      '<div class="record-links">'+linkedFields(item,target)+'</div>'),
    data=>api('record',{...data,id,person:saved?.person||data.person||target,kind}),
    saved?'Salvar alterações':'Registrar '+kind)
  editor.classList.add('guided-flow')
  if(editor.elements.person)editor.elements.person.onchange=()=>{
    editor.querySelector('.record-links').innerHTML=linkedFields(item,editor.elements.person.value)
  }
}
function sentFeedbackPanel(){
  const rows=d.sentFeedback.map(item=>'<div class="row"><div><strong>'+esc(item.title)+'</strong><br><small>'+
    esc(item.recipient)+'</small></div>'+btn('Editar','record',item.id,'smallBtn')+'</div>').join('')
  return rows?'<section class="card"><h2>Feedbacks que você enviou</h2>'+rows+'</section>':''
}
function praiseWall() {
  const cards=[...d.praise].sort((a,b)=>b.updated.localeCompare(a.updated)).map(item=>
    '<article class="card praise-card" data-direct="'+esc(item.id)+'"><span class="flow-icon" aria-hidden="true">✨</span>'+
    '<h2>'+esc(item.title)+'</h2><p><strong>'+esc(item.sender)+'</strong> reconheceu <strong>'+esc(item.recipient)+'</strong></p>'+
    (item.note?'<p class="content">'+esc(item.note)+'</p>':'')+
    (item.editable?btn('Editar','praise',item.id,'smallBtn'):'')+'</article>')
  return heading('Mural de elogios',btn('Elogiar colega','praise','','primary'))+
    '<div class="tiles">'+(cards.join('')||empty('Os elogios da equipe aparecem aqui.'))+'</div>'
}
function praiseForm(id) {
  const saved=d.praise.find(item=>item.id===id)
  const recipients=d.praiseRecipients.filter(([id])=>id!==d.me.id)
  if(!saved&&!recipients.length){toast('Ainda não há outro colega ativo para elogiar.');return}
  form(saved?'Editar elogio':'Elogiar colega','<span class="flow-icon" aria-hidden="true">✨</span>'+
    (saved?'':sel('Quem você quer reconhecer?','person',recipients))+
    fld('O que merece reconhecimento?','title',saved?.title)+area('Conte o que a pessoa fez','note',saved?.note)+
    '<p class="privacy-note">Todos os usuários podem ver este elogio no mural.</p>',
    body=>api('record',{...body,id,person:saved?.recipientId||body.person,kind:'Elogio',status:'Concluído',date:todayLocal()}),
    saved?'Salvar alterações':'Publicar elogio')
}

const contentFormats={
  'Leitura':[], 'Vídeo':['mp4','webm'], 'Áudio':['mp3','ogg','wav','m4a'],
  'PDF':['pdf'], 'Imagem':['jpg','jpeg','png','webp','gif'],
  'Apresentação':['pptx','ppt'], 'Documento':['docx','xlsx','csv','txt'],
  'Link':[], 'SCORM':['zip'], 'Questionário':[]
}
function courseAssetPicker(type,required=true) {
  const formats=contentFormats[type]
  if(!formats?.length)return ''
  const label=type==='SCORM'?'Pacote SCORM (.zip)':'Arquivo de '+type.toLowerCase()
  return '<section class="course-upload">'+fld(label,'file','','file',(required?'required ':'')+
    'accept="'+formats.map(extension=>'.'+extension).join(',')+'"')+
    '<small>'+formats.map(extension=>extension.toUpperCase()).join(', ')+' · até 64 MB'+
    (type==='SCORM'?' · um SCO por pacote':'')+'</small><progress class="course-upload-progress" max="100" value="0" hidden></progress>'+
    '<p class="course-upload-status" role="status"></p></section>'
}
function updateUploadStatus(form,value,message){
  const progress=form.querySelector('.course-upload-progress')
  const status=form.querySelector('.course-upload-status')
  if(progress){progress.hidden=false;progress.value=value}
  if(status)status.textContent=message
}
function upload(file,path,key,onProgress){
  return new Promise((resolve,reject)=>{
    const request=new XMLHttpRequest()
    request.open('POST','/api/upload?'+new URLSearchParams({path,id:key}))
    request.upload.onprogress=event=>{if(event.lengthComputable&&onProgress)onProgress(event.loaded/event.total)}
    request.onload=()=>{
      if(request.status>=200&&request.status<300){resolve();return}
      let message
      try{message=JSON.parse(request.responseText).error}catch{}
      reject(Error(message||'Falha no envio do arquivo (HTTP '+request.status+').'))
    }
    request.onerror=()=>reject(Error('A conexão caiu durante o envio. Tente novamente.'))
    request.onabort=()=>reject(Error('Envio cancelado.'))
    request.ontimeout=()=>reject(Error('O envio demorou demais. Tente novamente.'))
    request.timeout=180000
    request.send(file)
  })
}
async function contentFiles(body,form){
  const file=form.elements.file.files[0]
  if(!file||file.size===0||file.size>64*1024*1024)throw Error('Selecione um arquivo de até 64 MB.')
  const key=crypto.randomUUID()
  const extension=file.name.split('.').at(-1).toLowerCase()
  if(!contentFormats[body.type]?.includes(extension))throw Error('O arquivo não corresponde ao formato selecionado.')
  if(body.type!=='SCORM'){
    const entry='material.'+extension
    updateUploadStatus(form,0,'Enviando '+file.name+'…')
    await upload(file,entry,key,value=>updateUploadStatus(form,Math.round(value*100),'Enviando '+Math.round(value*100)+'%'))
    updateUploadStatus(form,100,'Arquivo enviado. Finalizando…')
    return {upload:key,entry}
  }
  updateUploadStatus(form,0,'Verificando o pacote SCORM…')
  let zip
  try{zip=await JSZip.loadAsync(file)}catch{throw Error('Não foi possível abrir o ZIP do SCORM.')}
  const files=Object.values(zip.files).filter(item=>!item.dir&&!item.name.startsWith('__MACOSX/'))
  const hasUnsafePath=files.some(item=>item.unsafeOriginalName&&item.unsafeOriginalName!==item.name)
  if(hasUnsafePath)throw Error('O pacote contém um caminho de arquivo inválido.')
  if(files.length>1800||files.reduce((sum,item)=>sum+(item._data?.uncompressedSize||0),0)>150*1024*1024){
    throw Error('O pacote excede 1.800 arquivos ou 150 MB descompactados.')
  }
  const manifest=files.find(item=>/(^|\/)imsmanifest\.xml$/i.test(item.name))
  if(!manifest)throw Error('Pacote sem imsmanifest.xml.')
  const xml=new DOMParser().parseFromString(await manifest.async('string'),'application/xml')
  if(xml.querySelector('parsererror'))throw Error('O manifesto SCORM contém XML inválido.')
  const resources=[...xml.getElementsByTagNameNS('*','resource')]
  const items=[...new Set([...xml.getElementsByTagNameNS('*','item')].map(item=>item.getAttribute('identifierref')).filter(Boolean))]
  if(items.length>1)throw Error('O LMS aceita um SCO por pacote. Exporte o curso como um SCO.')
  const resource=resources.find(item=>item.getAttribute('identifier')===items[0])||resources.find(item=>item.hasAttribute('href'))
  const href=resource?.getAttribute('href')
  if(!href)throw Error('O manifesto está sem página de lançamento.')
  const base=manifest.name.slice(0,manifest.name.lastIndexOf('/')+1)
  const launch=new URL(href,new URL(base,'https://package.invalid/'))
  if(launch.origin!=='https://package.invalid')throw Error('A página inicial deve estar dentro do ZIP.')
  const entry=decodeURIComponent(launch.pathname.slice(1))
  if(!files.some(item=>item.name===entry)||!/[.]html?$/i.test(entry))throw Error('Página inicial HTML não encontrada no pacote.')
  for(const [index,item] of files.entries()){
    const progress=value=>updateUploadStatus(form,Math.round(100*(index+value)/files.length),'Enviando arquivo '+(index+1)+' de '+files.length)
    progress(0)
    await upload(await item.async('blob'),item.name,key,progress)
  }
  updateUploadStatus(form,100,'Pacote enviado. Finalizando…')
  return {upload:key,entry}
}
function courseForm(){
  const editor=form('Criar curso','<div class="course-editor-core">'+fld('Título do curso','title')+
    sel('Formato do conteúdo','type',Object.keys(contentFormats))+'<div id="extra"></div></div>'+
    moreFields(fld('Trilha ou categoria','track','DNA do Desenvolvimento')+
      fld('Duração em minutos','minutes',10,'number','required min="1" max="10000"')+area('Descrição','description')+
      coverField(),'Capa e detalhes do curso'),async(body,element)=>{
    if(element.elements.file)Object.assign(body,await contentFiles(body,element))
    if(body.type==='Questionário'){
      body.options=body.options.split('\n').map(option=>option.trim()).filter(Boolean)
      body.answer=Number(body.answer)-1
    }
    body.cover=await uploadCover(element)
    delete body.file
    delete body.coverFile
    await api('course',body)
  },'Salvar rascunho')
  const fields=()=>{
    const type=editor.elements.type.value
    editor.querySelector('#extra').innerHTML=type==='Leitura'?area('Texto da aula','body','','required'):
      type==='Questionário'?area('Pergunta','body','','required')+area('Alternativas, uma por linha','options','','required')+
        fld('Número da alternativa correta','answer',1,'number','required min="1" max="8"'):
      type==='Link'?fld('Endereço HTTPS','url','','url'):courseAssetPicker(type)
  }
  fields()
  editor.elements.type.addEventListener('change',fields)
  editor.addEventListener('invalid',event=>{const details=event.target.closest('details');if(details)details.open=true},true)
}
function courseAttachment(course,url){
  const download='<a class="attachment-link" href="'+esc(url)+'" download>Baixar '+esc(course.type.toLowerCase())+'</a>'
  if(course.type==='PDF')return '<iframe class="course-pdf" title="PDF do curso" src="'+esc(url)+'"></iframe> <a class="attachment-link" href="'+esc(url)+'" target="_blank" rel="noopener">Abrir PDF em nova aba</a>'
  if(course.type==='Apresentação'&&/\.pptx$/i.test(course.entry))return '<section id="slideViewer" aria-label="Visualização da apresentação"><p role="status">Carregando slides…</p></section>'+download
  return download
}
async function previewSlides(url,container){
  let active=0
  try{
    const response=await fetch(url)
    if(!response.ok)throw Error('Arquivo indisponível.')
    const zip=await JSZip.loadAsync(await response.arrayBuffer())
    const slides=Object.values(zip.files).filter(item=>/^ppt\/slides\/slide\d+\.xml$/i.test(item.name))
      .sort((a,b)=>Number(a.name.match(/(\d+)\.xml$/)[1])-Number(b.name.match(/(\d+)\.xml$/)[1])).slice(0,100)
    if(!slides.length)throw Error('A apresentação está sem slides.')
    const render=async()=>{
      const index=active,item=slides[index]
      if(item._data?.uncompressedSize>2*1024*1024)throw Error('O slide é grande demais para a prévia.')
      const xml=new DOMParser().parseFromString(await item.async('string'),'application/xml')
      const paragraphs=[...xml.getElementsByTagNameNS('*','p')].map(node=>[...node.getElementsByTagNameNS('*','t')].map(text=>text.textContent).join('')).filter(Boolean)
      if(index!==active||!container.isConnected)return
      container.innerHTML='<div class="slide-preview">'+(paragraphs.length?paragraphs.map(text=>'<p>'+esc(text)+'</p>').join(''):
        '<p>Este slide é visual. Baixe a apresentação para ver o design completo.</p>')+'</div>'+
        '<div class="slide-nav"><button type="button" aria-label="Slide anterior"'+(index===0?' disabled':'')+
        '>←</button><span role="status">Slide '+(index+1)+' de '+slides.length+'</span><button type="button" aria-label="Próximo slide"'+
        (index===slides.length-1?' disabled':'')+'>→</button></div>'
      const [previous,next]=container.querySelectorAll('button')
      const move=step=>{active+=step;render().catch(showError)}
      previous.onclick=()=>move(-1)
      next.onclick=()=>move(1)
    }
    await render()
  }catch(error){showError(error)}
  function showError(error){container.textContent=error.message+' Use o arquivo original abaixo.'}
}

function learn(id){const e=d.enroll.find(x=>x.id===id),c=d.courses.find(x=>x.id===e.course),url=c.upload?'/content/'+c.id+'/'+c.entry.split('/').map(encodeURIComponent).join('/'):'',key=crypto.randomUUID()
 let html=tag(c.type)+'<p>'+esc(c.track)+'</p>';if(c.type==='Leitura')html+='<div class="content">'+esc(c.body)+'</div>'
 if(c.type==='Vídeo'||c.type==='Áudio'){const t=c.type==='Vídeo'?'video':'audio';html+='<'+t+' class="media" controls src="'+esc(url)+'"></'+t+'>'}
 if(c.type==='Imagem')html+='<img class="media" alt="'+esc(c.title)+'" src="'+esc(url)+'">'
 if(['PDF','Apresentação','Documento'].includes(c.type))html+=courseAttachment(c,url)
 if(c.type==='Link')html+='<a href="'+esc(c.url)+'" target="_blank" rel="noopener noreferrer">Acessar material</a>'
 if(c.type==='Questionário')html+='<p>'+esc(c.body)+'</p>'+sel('Sua resposta','answer',c.options.map((o,i)=>[i,o]))
 if(c.type==='SCORM'){player={id,key};$('modalBody').innerHTML='<div class="heading"><h2>'+esc(c.title)+'</h2>'+btn('Fechar','close')+'</div><iframe id="sco" sandbox="allow-scripts" title="Conteúdo SCORM" src="'+esc(url)+'?key='+key+'"></iframe><p id="scoStatus">O curso registra o progresso durante a atividade.</p>';modal.showModal();return}
 const f=form(c.title,html,async b=>{await api('progress',{id,progress:100,...b});if(c.type==='Questionário'){const updated=await api('data');if(updated.enroll.find(x=>x.id===id).score===0)throw Error('Resposta incorreta. Revise o conteúdo e tente novamente.')}},c.type==='Questionário'?'Enviar resposta':'Registrar conclusão')
 const viewer=f.querySelector('#slideViewer');if(viewer)void previewSlides(url,viewer);const mediaElement=f.querySelector('video,audio');if(mediaElement)mediaElement.addEventListener('error',()=>{f.querySelector('.err').textContent='Não foi possível reproduzir o arquivo. Para vídeo, use MP4 com H.264 e AAC ou WebM.'});const el=mediaElement;if(el&&e.progress!==100){const b=f.querySelector('.primary');b.disabled=true;el.onended=()=>{b.disabled=false};el.ontimeupdate=()=>{const p=Math.floor(100*el.currentTime/el.duration);if(p>e.progress+9&&p<100){e.progress=p;api('progress',{id,progress:p}).catch(err=>toast(err.message))}}}}
let scormQueue=Promise.resolve()
window.addEventListener('message',ev=>{const p=player;if(!p||ev.source!==$('sco')?.contentWindow||ev.data?.key!==p.key||typeof ev.data.values!=='object')return;const cmi=ev.data.values;scormQueue=scormQueue.then(async()=>{await api('progress',{id:p.id,progress:1,cmi});if($('scoStatus'))$('scoStatus').textContent='Progresso salvo às '+new Date().toLocaleTimeString('pt-BR')}).catch(err=>toast(err.message))})
modal.addEventListener('close',()=>{if(player){player=null;$('modalBody').innerHTML='';scormQueue.then(refresh).catch(err=>toast(err.message))}})
document.addEventListener('click',async ev=>{const el=ev.target.closest('[data-act]');if(!el)return;const {act,id}=el.dataset;try{
 if(act==='recoverAccess')showRecoveryRequest(id==='available')
 if(act==='menu')document.querySelector('.shell').classList.toggle('open')
 if(act==='nav'){page=id;search='';draw();window.scrollTo({top:0,behavior:'instant'});if(page==='Rede social')void loadSocial()}
 if(act==='close')modal.close()
 if(act==='notifications')toggleNotifications()
 if(act==='readAlerts')await markNotifications({all:true})
 if(act==='openAlert')await openNotification(id)
 if(act==='profilePhoto')profilePhoto()
 if(act==='composeSocial')composeSocial(id)
 if(act==='socialReact')await reactSocial(id,el.dataset.reaction)
 if(act==='socialRefresh')await loadSocial()
 if(act==='socialMore')await loadSocial(true)
 if(act==='logout'){await api('logout',{});page='Painel';person='';d=null;notifications=[];notificationOpen=false;resetSocial();await start()}
 if(act==='record')record(id)
 if(act==='praise')praiseForm(id)
 if(act==='pulse')form('Criar pesquisa pulse',fld('Pergunta','title')+sel('Público','person',[['','Toda a hierarquia ativa'],...peopleOpts()])+fld('Receber respostas até','date',weeklyPulsePeriod().sunday,'date'),b=>api('pulse',b),'Publicar pesquisa')
 if(act==='answerPulse')pulseExperience(d.pulses.find(x=>x.id===id),null)
 if(act==='newCourse')courseForm()
 if(act==='newMission')missionForm(id)
 if(act==='editCourse')editCourse(id)
 if(act==='courseState')courseStateForm(id,el.dataset.status)
 if(act==='courseHistory')courseHistory(id)
 if(act==='exportLearning')exportLearning(visible(d.enroll))
 if(act==='exportIndicators'&&admin())exportIndicators(id)
 if(act==='openMission')openMission(id)
 if(act==='missionAssign')form('Atribuir missão',sel('Participante','person',peopleOpts(),person||d.me.id)+fld('Prazo de conclusão (opcional)','date','','date',''),b=>api('missionAssign',{...b,id}),'Atribuir missão')
 if(act==='selfAssign'){await api('assign',{course:id,person:d.me.id});await refresh();learn(d.enroll.find(e=>e.course===id&&e.person===d.me.id).id)}
 if(act==='learn')learn(id)
 if(act==='assign')form('Atribuir curso',sel('Curso','course',d.courses.filter(c=>c.status==='published').map(c=>[c.id,c.title]))+sel('Participante','person',peopleOpts(),person)+fld('Prazo de conclusão (opcional)','date','','date',''),b=>api('assign',b),'Matricular')
 if(act==='user')userForm(id)
 if(act==='theme')form('Identidade visual',fld('Nome da plataforma','title',d.theme.title)+fld('Cor institucional','color',d.theme.color,'color')+fld('Cor de destaque','accent',d.theme.accent,'color')+sel('Espaçamento','layout',['Compacto','Confortável'],d.theme.layout),b=>api('theme',b))
 }catch(err){toast(err.message)}})
const coverExtensions = new Set(['jpg','jpeg','png','webp','gif'])
function coverField() {
  return fld('Imagem de capa (opcional)','coverFile','','file','accept=".jpg,.jpeg,.png,.webp,.gif"')
}
async function uploadCover(form) {
  const file = form.elements.coverFile.files[0]
  if (!file) return
  const extension = file.name.split('.').pop().toLowerCase()
  if (!coverExtensions.has(extension) || file.size > 8 * 1024 * 1024) {
    throw Error('Use uma imagem JPG, PNG, WebP ou GIF de até 8 MB.')
  }
  const cover = {upload: crypto.randomUUID(), entry: 'cover.' + extension}
  await upload(file, cover.entry, cover.upload)
  return cover
}
function coverImage(kind, item) {
  const source = item.cover ? '/cover/' + kind + '/' + encodeURIComponent(item.id) : '/waves.webp'
  return '<img class="learning-cover" alt="" loading="lazy" src="'+esc(source)+'">'
}
function editCourse(id) {
  const course=d.courses.find(item=>item.id===id)
  if(!course)return
  form('Editar curso',
    fld('Título do curso','title',course.title)+fld('Trilha ou categoria','track',course.track)+
    fld('Duração em minutos','minutes',course.minutes,'number','required min="1" max="10000"')+
    area('Descrição do curso','description',course.description)+
    (course.type==='Leitura'?area('Texto da aula','body',course.body,'required'):course.type==='Link'?fld('Endereço HTTPS','url',course.url,'url'):'')+coverField()+
    (contentFormats[course.type]?.length?moreFields(courseAssetPicker(course.type,false),'Substituir arquivo do curso'):''),
    async(body,element)=>{
      const cover=await uploadCover(element)
      const replacement=element.elements.file?.files[0]?await contentFiles({type:course.type},element):{}
      delete body.file
      delete body.coverFile
      await api('courseEdit',{...body,...replacement,id,cover,revision:course.revision})
    },'Salvar curso')
}
function nextLearning() {
  const own=d.enroll.filter(e=>e.person===d.me.id&&e.progress<100)
  const started=own.filter(e=>e.progress>0).sort((a,b)=>String(b.updated||'').localeCompare(String(a.updated||'')))
  const next=started[0]||own[0]
  const course=d.courses.find(item=>item.id===next?.course)
  if(!course)return ''
  return '<section class="card next-learning">'+coverImage('course',course)+'<div>'+tag(started.length?'Em andamento':'Na sua lista')+
    '<h2>'+esc(course.title)+'</h2><p>'+esc(course.description||course.track)+'</p>'+bar(next.progress)+'</div>'+
    btn(next.progress?'Continuar curso':'Começar curso','learn',next.id,'primary')+'</section>'
}
function missionProgress(mission) {
  const own = d.enroll.filter(e=>e.person===d.me.id)
  return mission.courses.map(course=>own.find(e=>e.course===course))
}
function missionsPage() {
  const cards = d.missions.map(mission=>{
    const steps = missionProgress(mission)
    const completed = steps.filter(step=>step?.progress===100).length
    return '<article class="card learning-card" data-direct="'+esc(mission.id)+'">'+coverImage('mission',mission)+tag('Missão')+
      '<h2>'+esc(mission.title)+'</h2><p>'+esc(mission.description||'')+'</p>'+
      '<p>'+mission.courses.length+' etapas'+(steps.some(Boolean)?' · '+completed+' concluídas':'')+'</p>'+
      (steps.some(Boolean)?bar(100*completed/steps.length):'')+
      '<div class="actions">'+btn('Ver etapas','openMission',mission.id,'primary')+
      (learningAdmin()?btn('Editar','newMission',mission.id)+btn('Atribuir','missionAssign',mission.id):'')+'</div></article>'
  })
  return heading('Missões',learningAdmin()?btn('Criar missão','newMission','','primary'):'')+
    '<div class="tiles">'+(cards.join('')||empty(learningAdmin()?'Crie uma missão para organizar cursos em sequência.':'Suas missões atribuídas aparecerão aqui.'))+'</div>'
}
function openMission(id) {
  const mission = d.missions.find(item=>item.id===id)
  const steps = missionProgress(mission)
  const rows = mission.courses.map((course,index)=>{
    const enrollment = steps[index]
    return '<li><div><strong>'+esc(cname(course))+'</strong><small>'+ (enrollment?enrollment.progress+'% concluído':'Aguardando matrícula')+'</small>'+
      (enrollment?enrollmentDeadline(enrollment):'')+'</div>'+
      (enrollment?btn(enrollment.progress===100?'Revisar':'Acessar','learn',enrollment.id):'')+'</li>'
  })
  $('modalBody').innerHTML='<div class="heading"><h2>'+esc(mission.title)+'</h2>'+btn('Fechar','close','','smallBtn')+
    '</div><p>'+esc(mission.description||'')+'</p><ol class="mission-steps">'+rows.join('')+'</ol>'
  if(!modal.open)modal.showModal()
}
function missionForm(id) {
  if(!d.courses.length){toast('Publique um curso antes de criar a missão.');return}
  const mission = d.missions.find(item=>item.id===id)
  const courses = [...(mission?.courses||[])]
  const options = d.courses.map(course=>[course.id,course.title])
  const f = form(mission?'Editar missão':'Criar missão',
    fld('Nome da missão','title',mission?.title)+area('Descrição','description',mission?.description)+
    coverField()+sel('Escolher curso para adicionar','candidate',options)+
    '<button type="button" id="addStep">Adicionar etapa</button><ol class="mission-steps" id="missionOrder"></ol>',
    async(body,element)=>{
      if(!courses.length)throw Error('Adicione pelo menos uma etapa.')
      const cover=await uploadCover(element)
      await api('mission',{id,title:body.title,description:body.description,courses,cover})
    },'Salvar missão')
  const order = f.querySelector('#missionOrder')
  const render = ()=>{
    order.innerHTML=courses.map((course,index)=>'<li><strong>'+esc(cname(course))+'</strong><div class="step-actions">'+
      (index?'<button type="button" data-step="'+index+'" data-dir="-1" aria-label="Subir etapa">↑</button>':'')+
      (index<courses.length-1?'<button type="button" data-step="'+index+'" data-dir="1" aria-label="Descer etapa">↓</button>':'')+
      '<button type="button" data-step="'+index+'" data-dir="0">Remover</button></div></li>').join('')
  }
  f.querySelector('#addStep').onclick=()=>{
    const chosen=f.elements.candidate.value
    if(courses.includes(chosen)){toast('Este curso já faz parte da missão.');return}
    if(courses.length>=30){toast('Uma missão comporta até 30 etapas.');return}
    courses.push(chosen)
    render()
  }
  order.onclick=event=>{
    const control=event.target.closest('[data-step]')
    if(!control)return
    const index=Number(control.dataset.step),direction=Number(control.dataset.dir)
    if(direction){const destination=index+direction;[courses[index],courses[destination]]=[courses[destination],courses[index]]}
    else courses.splice(index,1)
    render()
  }
  render()
}

function learningReport(enrollments) {
  const completed=enrollments.filter(e=>e.progress===100).length
  const started=enrollments.filter(e=>e.progress>0&&e.progress<100).length
  const rows=enrollments.map(e=>'<tr><td>'+esc(pname(e.person))+'</td><td>'+esc(cname(e.course))+'</td><td>'+e.progress+'%</td><td>'+
    (e.completed?new Date(e.completed).toLocaleDateString('pt-BR'):'—')+'</td></tr>')
  return heading('Relatórios',btn('Exportar matrículas','exportLearning','','primary')+
    (admin()?btn('Exportar todos os indicadores','exportIndicators'):''))+
    (admin()?indicatorsPanel():'')+filters()+'<h2>Matrículas e progresso</h2>'+
    '<div class="stats">'+[['Matrículas',enrollments.length],['Em andamento',started],['Concluídas',completed]].map(([label,total])=>'<div class="stat"><span>'+label+'</span><b>'+total+'</b></div>').join('')+'</div>'+
    (rows.length?'<section class="card report-table"><table><thead><tr><th scope="col">Pessoa</th><th scope="col">Curso</th><th scope="col">Progresso</th><th scope="col">Conclusão</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></section>':empty('Nenhuma matrícula para exibir.'))
}
function exportLearning(enrollments) {
  downloadReport('sanepav-matriculas.csv',[['Pessoa','Curso','Progresso (%)','Concluído em'],
    ...enrollments.map(e=>[pname(e.person),cname(e.course),e.progress,e.completed||''])])
}
function downloadReport(filename,rows) {
  const cell=value=>{
    const text=String(value??'')
    const safe=/^[\s]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text)?"'"+text:text
    return '"'+safe.replaceAll('"','""')+'"'
  }
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}))
  const link=document.createElement('a')
  link.href=url
  link.download=filename
  link.click()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}

function indicatorGroups() {
  const sections={LMS:[],LXP:[],Plataforma:[]}
  const add=(section,theme,name,value,unit='quantidade')=>sections[section].push([theme,name,value,unit])
  const avg=values=>values.length?Math.round(values.reduce((sum,value)=>sum+value,0)/values.length*10)/10:0
  const count=(list,condition)=>list.filter(condition).length
  const active=d.people.filter(person=>person.active)
  const enroll=d.enroll
  add('LMS','Catálogo','Cursos publicados',d.courses.length)
  for(const type of ['Leitura','Vídeo','Áudio','PDF','Imagem','Link','SCORM','Questionário']){
    add('LMS','Catálogo','Cursos de '+type,count(d.courses,course=>course.type===type))
  }
  add('LMS','Aprendizagem','Matrículas',enroll.length)
  add('LMS','Aprendizagem','Matrículas não iniciadas',count(enroll,e=>e.progress===0))
  add('LMS','Aprendizagem','Matrículas em andamento',count(enroll,e=>e.progress>0&&e.progress<100))
  add('LMS','Aprendizagem','Matrículas concluídas',count(enroll,e=>e.progress===100))
  add('LMS','Aprendizagem','Taxa de conclusão',avg(enroll.map(e=>e.progress===100?100:0)),'%')
  add('LMS','Aprendizagem','Progresso médio',avg(enroll.map(e=>e.progress)),'%')
  add('LMS','Aprendizagem','Pessoas matriculadas',new Set(enroll.map(e=>e.person)).size)
  const courseIndex=new Map(d.courses.map(course=>[course.id,course]))
  add('LMS','Aprendizagem','Carga horária concluída',enroll.reduce((minutes,e)=>minutes+(e.progress===100?(courseIndex.get(e.course)?.minutes||0):0),0),'minutos')
  for(const course of d.courses){
    const current=enroll.filter(e=>e.course===course.id)
    add('LMS',course.title,'Matrículas',current.length)
    add('LMS',course.title,'Conclusões',count(current,e=>e.progress===100))
    add('LMS',course.title,'Progresso médio',avg(current.map(e=>e.progress)),'%')
    const scores=current.map(e=>e.score).filter(Number.isFinite)
    if(scores.length)add('LMS',course.title,'Nota média registrada',avg(scores),'pontos')
  }
  add('LMS','Missões','Missões cadastradas',d.missions.length)
  const enrollByPerson=new Map()
  for(const e of enroll){
    if(!enrollByPerson.has(e.person))enrollByPerson.set(e.person,new Map())
    enrollByPerson.get(e.person).set(e.course,e.progress)
  }
  for(const mission of d.missions){
    const progress=[...enrollByPerson.values()].filter(byCourse=>mission.courses.every(course=>byCourse.has(course)))
      .map(byCourse=>mission.courses.map(course=>byCourse.get(course)))
    add('LMS',mission.title,'Etapas',mission.courses.length)
    add('LMS',mission.title,'Pessoas com todas as etapas atribuídas',progress.length)
    add('LMS',mission.title,'Pessoas com missão concluída',count(progress,steps=>steps.every(value=>value===100)))
  }
  for(const kind of kinds){
    if(kind==='Pulse')continue
    if(kind==='Feedback'||kind==='Elogio'){
      add('LXP',kind,'Registros',kind==='Feedback'?d.platform.privateFeedbackCount:d.platform.publicPraiseCount)
      continue
    }
    const items=d.records.filter(record=>record.kind===kind)
    add('LXP',kind,'Registros',items.length)
    add('LXP',kind,'Pessoas com registros',new Set(items.map(row=>row.person)).size)
    for(const status of new Set(items.map(row=>row.status||'Sem situação'))){
      add('LXP',kind,status,count(items,row=>(row.status||'Sem situação')===status))
    }
    if(kind==='PDI')add('LXP',kind,'Ações vinculadas a cursos',count(items,row=>Boolean(row.course)))
    if(kind==='OKR'&&items.length)add('LXP',kind,'Atingimento médio da meta',avg(items.map(row=>100*Math.min(1,row.actual/row.target))),'%')
    if(kind==='Desempenho'&&items.length){
      add('LXP',kind,'Desempenho médio',avg(items.map(row=>row.performance)),'de 3')
      add('LXP',kind,'Potencial médio',avg(items.map(row=>row.potential)),'de 3')
    }
  }
  add('LXP','Pulse','Pesquisas publicadas',d.pulses.length)
  for(const pulse of d.pulses){
    add('LXP',pulse.title,'Pessoas convidadas',pulse.people.length)
    add('LXP',pulse.title,'Respostas',pulse.responseCount)
    if(Number.isFinite(pulse.averageRating))add('LXP',pulse.title,'Percepção média agrupada',pulse.averageRating,'de 5')
  }
  add('Plataforma','Pessoas','Usuários cadastrados',d.people.length)
  add('Plataforma','Pessoas','Usuários ativos',active.length)
  add('Plataforma','Pessoas','Usuários bloqueados',d.people.length-active.length)
  for(const role of ['Administrador','Líder','Colaborador'])add('Plataforma','Pessoas',role+' · ativos',count(active,row=>row.role===role))
  for(const area of new Set(active.map(row=>row.area||'Sem área')))add('Plataforma','Áreas',area,count(active,row=>(row.area||'Sem área')===area))
  if(d.platform){
    add('Plataforma','Notificações','Envio de e-mails',d.platform.emailConfigured?'Configurado':'Aguardando remetente e credencial','situação')
    add('Plataforma','Uso','Entradas nos últimos 30 dias registradas na auditoria',d.platform.logins30)
    add('Plataforma','Uso','Tentativas recusadas nos últimos 30 dias registradas na auditoria',d.platform.refused30)
    add('Plataforma','Uso','Sessões válidas',d.platform.activeSessions)
    add('Plataforma','Auditoria','Eventos retidos',d.platform.auditEvents)
    add('Plataforma','Rede social','Publicações',d.platform.socialPosts)
    add('Plataforma','Rede social','Comentários',d.platform.socialComments)
    add('Plataforma','Rede social','Reações ativas',d.platform.socialReactions)
  }
  return sections
}
function indicatorsPanel() {
  return '<section class="indicators" aria-label="Indicadores administrativos"><h2>Indicadores gerais da organização</h2>'+
    Object.entries(indicatorGroups()).map(([section,rows])=>'<details class="card report-table"><summary>'+esc(section)+' · '+rows.length+' indicadores</summary>'+
      '<div class="actions">'+btn('Exportar '+section,'exportIndicators',section)+'</div>'+
      '<table><thead><tr><th scope="col">Grupo</th><th scope="col">Indicador</th><th scope="col">Valor</th></tr></thead><tbody>'+
      rows.map(([group,label,value,unit])=>'<tr><td>'+esc(group)+'</td><td>'+esc(label)+'</td><td>'+esc(value)+(unit==='quantidade'?'':' '+esc(unit))+'</td></tr>').join('')+
      '</tbody></table></details>').join('')+'</section>'
}
function exportIndicators(section) {
  const groups=indicatorGroups()
  const rows=Object.entries(groups).filter(([category])=>!section||section===category)
    .flatMap(([category,items])=>items.map(item=>[category,...item]))
  downloadReport('sanepav-indicadores'+(section?'-'+section.toLowerCase():'')+'.csv',
    [['Área do relatório','Grupo','Indicador','Valor','Unidade'],...rows])
}

let notifications=[]
let notificationOpen=false
let notificationPending=false
function notificationBell() {
  const unread=notifications.filter(item=>!item.read).length
  return '<div class="notification-area" id="notificationArea"><button class="bell" type="button" data-act="notifications" aria-label="Notificações'+
    (unread?' · '+unread+' não lidas':'')+'" aria-expanded="'+notificationOpen+'" aria-controls="notificationList">'+
    '<span aria-hidden="true">🔔</span>'+(unread?'<span class="bell-count" aria-hidden="true">'+(unread>99?'99+':unread)+'</span>':'')+
    '</button><section id="notificationList" class="notification-list" aria-label="Notificações"'+(notificationOpen?'':' hidden')+'>'+
    '<div class="notification-title"><h2>Notificações</h2>'+(unread?btn('Marcar todas como lidas','readAlerts','','smallBtn'):'')+'</div>'+
    (notifications.length?'<ul>'+notifications.map(item=>'<li><button type="button" data-act="openAlert" data-id="'+esc(item.id)+'" class="'+
      (item.read?'':'unread')+'"><strong>'+esc(item.title)+'</strong><span>'+esc(item.subject)+'</span><small>'+
      esc(new Date(item.at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}))+
      (item.read?'':' · Nova')+'</small></button></li>').join('')+'</ul>':empty('Nenhuma novidade por aqui.'))+'</section></div>'
}
function renderNotifications(focus=false) {
  const area=$('notificationArea')
  if(!area)return
  area.outerHTML=notificationBell()
  if(focus)$('notificationArea').querySelector('.bell').focus()
}
function toggleNotifications() {
  notificationOpen=!notificationOpen
  renderNotifications(true)
  if(notificationOpen)void refreshNotifications()
}
async function refreshNotifications() {
  if(!d?.me||document.hidden||notificationPending)return
  notificationPending=true
  try{
    const response=await fetch('/api/notifications',{cache:'no-store'})
    if(!response.ok)return
    const items=await response.json()
    if(JSON.stringify(items)!==JSON.stringify(notifications)){
      const focused=$('notificationArea')?.querySelector('.bell')===document.activeElement
      notifications=items
      renderNotifications(focused)
    }
  }catch{}finally{notificationPending=false}
}
async function markNotifications(selection) {
  await api('notifications',selection)
  notifications=notifications.map(item=>selection.all||selection.id===item.id?{...item,read:true}:item)
  renderNotifications(true)
}
async function openNotification(id) {
  const item=notifications.find(entry=>entry.id===id)
  if(!item)return
  if(!item.read)await markNotifications({id})
  notificationOpen=false
  await openDirect(item.page,item.target)
  window.scrollTo(0,0)
}
document.addEventListener('click',event=>{
  if(notificationOpen&&!event.target.closest('#notificationArea')&&!event.target.closest('[data-act="notifications"]')){
    notificationOpen=false
    renderNotifications()
  }
})
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&notificationOpen){notificationOpen=false;renderNotifications(true)}
})
document.addEventListener('visibilitychange',refreshNotifications)
setInterval(refreshNotifications,45000)

const reactionChoices=[['👍','Curtir'],['❤️','Amei'],['🎉','Celebro'],['🤝','Apoio'],['💡','Útil']]
const socialAccept='.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm'
let feedItems=[],feedCursor=null,feedReady=false,feedBusy=false,feedError='',feedVersion=0
const openComments=new Set()
function resetSocial(){
  feedVersion++
  feedItems=[];feedCursor=null;feedReady=false;feedBusy=false;feedError=''
  openComments.clear()
}
function avatar(person){
  const version=person.avatar?.id||person.avatar
  const letters=person.name.trim().split(/\s+/).slice(0,2).map(word=>[...word][0]).join('').toUpperCase()
  return '<span class="social-avatar" aria-hidden="true">'+(version?
    '<img src="/social/avatar/'+encodeURIComponent(person.id)+'?v='+encodeURIComponent(version)+'" alt="">':esc(letters||'•'))+'</span>'
}
function profileButton(){
  return '<button type="button" class="avatar-trigger" data-act="profilePhoto" aria-label="Alterar foto de perfil" title="Alterar foto de perfil">'+avatar(d.me)+'</button>'
}
function profilePhoto(){
  const editor=form('Foto de perfil','<div class="photo-panel">'+avatar(d.me)+'</div>'+
    fld('Escolher uma foto','file','','file','required accept=".jpg,.jpeg,.png,.webp,.gif"')+
    '<p class="privacy-note">Visível aos usuários da Sanepav. Até 8 MB.</p>',
    async(body,element)=>{
      const upload=await sendSocialMedia(element.elements.file.files[0],true)
      await api('avatar',{upload})
    },'Salvar foto')
  bindPreview(editor,'.photo-panel')
}
function composeSocial(id){
  const saved=feedItems.find(item=>item.id===id)
  const editor=form(saved?'Editar publicação':'Criar publicação',
    '<div class="social-author">'+avatar(d.me)+'<strong>'+esc(d.me.name)+'</strong></div>'+
    area('O que você quer compartilhar?','text',saved?.text,'maxlength="3000"')+
    (saved?'':fld('Adicionar foto ou vídeo','file','','file','accept="'+socialAccept+'"')+
      '<div class="attachment-preview"></div><p class="privacy-note">Foto até 8 MB ou vídeo até 64 MB.</p>'),
    async(body,element)=>{
      const file=element.elements.file?.files[0]
      if(!file&&!String(body.text||'').trim()&&!saved?.media)throw Error('Escreva algo ou adicione uma foto ou vídeo.')
      const upload=file?await sendSocialMedia(file):undefined
      await api('socialPost',{id:saved?.id,text:body.text,upload})
    },saved?'Salvar alterações':'Publicar')
  if(!saved)bindPreview(editor,'.attachment-preview')
}
function bindPreview(editor,selector){
  const preview=editor.querySelector(selector)
  const initial=preview.innerHTML
  let url=''
  const reset=()=>{
    if(url)URL.revokeObjectURL(url)
    url=''
  }
  editor.elements.file.addEventListener('change',()=>{
    reset()
    const file=editor.elements.file.files[0]
    if(!file){preview.innerHTML=initial;return}
    if(file.type.startsWith('image/')||file.type.startsWith('video/')){
      url=URL.createObjectURL(file)
      preview.innerHTML=file.type.startsWith('image/')?
        '<img src="'+esc(url)+'" alt="Prévia do arquivo selecionado">':
        '<video controls playsinline preload="metadata" src="'+esc(url)+'"></video>'
    }else preview.textContent=file.name
  })
  modal.addEventListener('close',reset,{once:true})
}
async function sendSocialMedia(file,photoOnly=false){
  if(!file)throw Error('Escolha um arquivo.')
  const extension=file.name.split('.').at(-1).toLowerCase()
  const video=['mp4','webm'].includes(extension)
  if(!['jpg','jpeg','png','webp','gif'].includes(extension)&&(photoOnly||!video)){
    throw Error(photoOnly?'Escolha uma foto JPG, PNG, WebP ou GIF.':'Use JPG, PNG, WebP, GIF, MP4 ou WebM.')
  }
  const limit=video?64:8
  if(file.size>limit*1024*1024)throw Error('Arquivo acima de '+limit+' MB.')
  const res=await fetch('/api/socialUpload?'+new URLSearchParams({extension}),{method:'POST',body:file})
  const response=await res.json().catch(()=>null)
  if(!res.ok)throw Error(response?.error||'Não foi possível enviar o arquivo.')
  return response.id
}
const socialTime=stamp=>new Date(stamp).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})
function socialComments(post){
  const rows=post.comments.map(comment=>'<li>'+avatar(comment.owner)+'<div><strong>'+esc(comment.owner.name)+
    '</strong><small>'+esc(socialTime(comment.at))+'</small><p>'+esc(comment.text)+'</p></div></li>').join('')
  return '<details class="social-comments" data-comments="'+esc(post.id)+'"'+(openComments.has(post.id)?' open':'')+
    '><summary>'+post.comments.length+(post.comments.length===1?' comentário':' comentários')+'</summary>'+
    (rows?'<ul>'+rows+'</ul>':'')+
    '<form class="comment-form" data-post="'+esc(post.id)+'"><label>Escreva um comentário<input name="text" maxlength="800" required></label>'+
    '<button type="submit" class="primary">Enviar</button><p class="err" role="alert"></p></form></details>'
}
function socialCard(post){
  const source='/social/post/'+encodeURIComponent(post.id)
  const attachment=post.media?(post.media.type.startsWith('image/')?
    '<img loading="lazy" class="social-media" src="'+source+'" alt="Foto de '+esc(post.owner.name)+'">':
    '<video controls preload="metadata" playsinline class="social-media" src="'+source+'" aria-label="Vídeo de '+esc(post.owner.name)+'"></video>'):''
  const reactions=reactionChoices.map(([emoji,label])=>'<button type="button" data-act="socialReact" data-id="'+esc(post.id)+
    '" data-reaction="'+esc(label)+'" aria-pressed="'+(post.reaction===label)+'" title="'+esc(label)+'"><span aria-hidden="true">'+emoji+
    '</span> '+esc(label)+(post.reactions[label]?' · '+post.reactions[label]:'')+'</button>').join('')
  return '<article class="card social-card" data-social-card="'+esc(post.id)+'"><div class="social-post-header"><div class="social-author">'+avatar(post.owner)+
    '<div><strong>'+esc(post.owner.name)+'</strong><small>'+esc(socialTime(post.at))+(post.edited?' · Editado':'')+'</small></div></div>'+
    (post.canEdit?btn('Editar','composeSocial',post.id,'smallBtn'):'')+'</div>'+
    (post.text?'<p class="social-text">'+esc(post.text)+'</p>':'')+attachment+
    '<div class="social-reactions" aria-label="Reações">'+reactions+'</div>'+socialComments(post)+'</article>'
}
function feedContent(){
  const error=feedError?'<p class="err" role="alert">'+esc(feedError)+'</p>':''
  if(!feedReady)return error||'<p role="status" class="empty">Carregando publicações…</p>'
  if(!feedItems.length)return error+'<div class="card social-empty"><span aria-hidden="true">🌱</span><h2>A primeira publicação começa aqui</h2>'+
    btn('Criar publicação','composeSocial','','primary')+'</div>'
  return error+feedItems.map(socialCard).join('')+
    (feedCursor?'<div class="social-more">'+btn(feedBusy?'Carregando…':'Ver mais publicações','socialMore')+'</div>':'')
}
function socialPage(){
  return '<div class="social-hub"><section class="social-hero"><div><h1>Rede social</h1><p>Compartilhe conquistas, novidades e o dia a dia da Sanepav.</p></div>'+
    '<div class="social-post-header">'+btn('Atualizar','socialRefresh')+btn('Criar publicação','composeSocial','','primary')+
    '</div></section><div class="social-feed" id="socialFeed">'+feedContent()+'</div></div>'
}
async function loadSocial(more=false){
  if(feedBusy||!d?.me||page!=='Rede social')return
  if(more&&!feedCursor)return
  const view=feedVersion
  feedBusy=true
  try{
    const result=await api('socialFeed'+(more?'?after='+encodeURIComponent(feedCursor):''))
    if(view!==feedVersion)return
    feedItems=more?[...new Map([...feedItems,...result.items].map(item=>[item.id,item])).values()]:result.items
    feedCursor=result.next
    feedReady=true
    feedError=''
  }catch(err){if(view===feedVersion)feedError=err.message}
  finally{
    if(view===feedVersion){
      feedBusy=false
      const target=$('socialFeed')
      if(target)target.innerHTML=feedContent()
    }
  }
}
async function socialChange(id,operation,body){
  await api(operation,{...body,id})
  const result=await api('socialFeed?post='+encodeURIComponent(id))
  const updated=result.items.find(item=>item.id===id)
  if(!updated)return
  feedItems=feedItems.map(item=>item.id===id?updated:item)
  const card=document.querySelector('[data-social-card="'+CSS.escape(id)+'"]')
  if(card){
    const draft=operation==='socialReaction'?card.querySelector('input[name=text]')?.value:''
    card.outerHTML=socialCard(updated)
    if(draft)document.querySelector('[data-social-card="'+CSS.escape(id)+'"] input[name=text]').value=draft
  }
}
async function reactSocial(id,reaction){
  await socialChange(id,'socialReaction',{reaction})
  document.querySelector('[data-social-card="'+CSS.escape(id)+'"] [data-reaction="'+CSS.escape(reaction)+'"]')?.focus()
}
document.addEventListener('toggle',event=>{
  const id=event.target.dataset?.comments
  if(!id)return
  if(event.target.open)openComments.add(id)
  else openComments.delete(id)
},true)
document.addEventListener('submit',async event=>{
  const form=event.target
  if(!form.matches('.comment-form'))return
  event.preventDefault()
  const button=form.querySelector('button')
  button.disabled=true
  try{
    openComments.add(form.dataset.post)
    await socialChange(form.dataset.post,'socialComment',{text:form.elements.text.value})
  }catch(err){form.querySelector('.err').textContent=err.message}
  finally{button.disabled=false}
})

const directPages=['OKR','PDI','1:1','Feedback','Elogio','Desempenho','Pulse','Catálogo LMS','Missões','Rede social']
const directId=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/
const entrySearch=new URLSearchParams(location.search)
let directEntry=directPages.includes(entrySearch.get('view'))?{
  page:entrySearch.get('view'),id:directId.test(entrySearch.get('item')||'')?entrySearch.get('item'):''
}:null
async function openDirect(pageName,itemId){
  page=pageName
  person=''
  search=''
  await refresh({social:pageName!=='Rede social'||!itemId})
  if(!itemId)return
  if(pageName==='Rede social'){
    const result=await api('socialFeed?post='+encodeURIComponent(itemId))
    openComments.add(itemId)
    if(result.items.length){
      feedItems=[...new Map([...result.items,...feedItems].map(item=>[item.id,item])).values()]
      const target=$('socialFeed')
      if(target){
        target.innerHTML='<button type="button" data-act="socialRefresh">Voltar ao feed</button>'+socialCard(result.items[0])
        target.querySelector('article').classList.add('direct-focus')
      }
    }else await loadSocial()
    return
  }
  const card=[...document.querySelectorAll('[data-direct]')].find(element=>element.dataset.direct===itemId)
  if(card){
    card.classList.add('direct-focus')
    card.setAttribute('tabindex','-1')
    card.focus({preventScroll:true})
    card.scrollIntoView({block:'center'})
  }
}
async function enterLearning(){
  const entry=directEntry
  directEntry=null
  if(entry){await openDirect(entry.page,entry.id);return}
  await refresh()
}

start().catch(err=>{app.textContent=err.message})


let learningStatusFilter=''
const learningStatusLabels={draft:'Rascunho',published:'Publicado',archived:'Arquivado'}
function learningCatalog(en){
 const rows=d.courses.filter(c=>(!person||en.some(e=>e.course===c.id))&&
  (!learningAdmin()||!learningStatusFilter||c.status===learningStatusFilter)&&
  (c.title+' '+c.track).toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
 const statusFilter=learningAdmin()?'<label class="learning-status-filter">Status do curso<select id="courseStatusFilter">'+
  opt([['','Todos os status'],...Object.entries(learningStatusLabels)],learningStatusFilter)+'</select></label>':''
 return heading('Catálogo LMS',(learningAdmin()?btn('Criar curso','newCourse','','primary'):'')+
  (manager()?btn('Atribuir curso','assign'):''))+filters(true)+statusFilter+'<div class="tiles">'+
  (rows.map(c=>{
   const e=d.enroll.find(e=>e.course===c.id&&e.person===d.me.id)
   const published=c.status==='published'
   let actions=e?bar(e.progress)+enrollmentDeadline(e)+'<small>'+e.progress+'% concluído</small><div class="actions">'+
    btn(e.progress===100?'Revisar':'Acessar','learn',e.id,'primary')+'</div>':
    learningAdmin()&&published?'<div class="actions">'+btn('Matricular e acessar','selfAssign',c.id,'primary')+'</div>':
    published?'<small>Disponível para atribuição</small>':''
   if(learningAdmin())actions+='<div class="actions">'+btn('Editar curso','editCourse',c.id)+
    '<button type="button" data-act="courseState" data-id="'+esc(c.id)+'" data-status="'+(published?'archived':'published')+'">'+
    (published?'Arquivar':c.status==='archived'?'Reativar e publicar':'Publicar')+'</button>'+btn('Histórico','courseHistory',c.id,'smallBtn')+'</div>'
   return '<article class="card learning-card" data-direct="'+esc(c.id)+'">'+coverImage('course',c)+tag(c.type)+' '+
    tag(learningStatusLabels[c.status]||'Publicado')+'<h2>'+esc(c.title)+'</h2><p>'+esc(c.track)+' · '+c.minutes+' min</p>'+
    (c.description?'<p>'+esc(c.description)+'</p>':'')+
    (c.status==='draft'?'<p>Revise o conteúdo antes de publicar. O rascunho não está disponível para matrículas.</p>':'')+
    (c.status==='archived'?'<p>As matrículas existentes mantêm o acesso. Novas matrículas estão suspensas.</p>':'')+actions+'</article>'
  }).join('')||empty('Nenhum curso neste filtro.'))+'</div>'
}
function courseStateForm(id,status){
 const course=d.courses.find(c=>c.id===id)
 if(!course||!['published','archived'].includes(status))return
 const action=status==='published'?'Publicar curso':'Arquivar curso'
 form(action,'<p><b>'+esc(course.title)+'</b></p><p>'+(status==='published'?
  'O curso ficará disponível para novas matrículas. Confirme que o conteúdo e a duração foram revisados.':
  'Novas matrículas serão suspensas. Os dados e o acesso dos participantes já matriculados serão preservados.')+'</p>',
  ()=>api('courseState',{id,status,revision:course.revision}),action)
}
function courseHistory(id){
 const course=d.courses.find(c=>c.id===id)
 if(!course)return
 const events={created:'Rascunho criado',edited:'Curso editado',published:'Curso publicado',archived:'Curso arquivado'}
 $('modalBody').innerHTML='<div class="heading"><h2>Histórico do curso</h2>'+btn('Fechar','close')+'</div><h3>'+esc(course.title)+'</h3>'+
  '<p>Status: '+esc(learningStatusLabels[course.status])+' · Revisão '+course.revision+'</p>'+
  ((course.history||[]).slice().reverse().map(row=>'<div class="row"><div><b>'+esc(events[row.event]||row.event)+'</b><br><small>'+
   esc(pname(row.person))+' · '+esc(new Date(row.at).toLocaleString('pt-BR'))+'</small></div><span>Revisão '+row.revision+'</span></div>').join('')||
   empty('Curso anterior ao controle de versões. As próximas alterações serão registradas.'))
 modal.showModal()
}
