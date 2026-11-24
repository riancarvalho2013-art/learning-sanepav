/* Learning 4.0 — Pesquisa de Pulso Protegida.
 * Dedicated screens: authenticated audience controls + private answer capture.
 * Legacy Pulse (identified responses) is deliberately not relabeled anonymous.
 */
(() => {
 'use strict'
 const PAGE='Pulse Seguro'
 let optionsCache=null,current=[],busy=false,renderSequence=0
 const html=v=>esc(String(v??''))
 const isManager=()=>['Administrador','RH/DHO','Líder'].includes(d?.me?.role)
 const button=(label,act,id='',extra='')=>'<button type="button" data-p5="'+act+'" data-id="'+html(id)+'" class="p5-button '+extra+'">'+html(label)+'</button>'
 const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'})
 const future=days=>{const d=new Date(Date.now()+days*86400000);return d.toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'})}
 const badge=status=>status==='open'?'<span class="p5-tag p5-open">Em andamento</span>':status==='scheduled'?'<span class="p5-tag">Agendada</span>':'<span class="p5-tag p5-closed">Encerrada</span>'
 function nav(){
  const root=document.querySelector('aside nav');if(!root||!d?.me)return
  const legacy=root.querySelector('button[data-id="Pulse"]')
  if(legacy&&!legacy.dataset.p5Labeled){
    legacy.dataset.p5Labeled='true'
    // Keep data-id intact; explicitly distinguish legacy identified survey history.
    const textNodes=[...legacy.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE)
    if(textNodes.length)textNodes.at(-1).textContent='Pulse de sentimentos'
  }
  if(root.querySelector('button[data-id="'+PAGE+'"]'))return
  const el=document.createElement('button');el.type='button';el.dataset.act='nav';el.dataset.id=PAGE;el.className=page===PAGE?'sel':''
  el.innerHTML='<span class="ico" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M2 12h4l3-6 5 12 3-6h5"/></svg></span>Pulse Seguro'
  root.append(el)
 }
 const intro=()=>'<div class="p5-hero"><div><span class="p5-eyebrow">DNA DO DESENVOLVIMENTO · CLIMA & ENGAJAMENTO</span><h1>Pulse Seguro</h1><p>Escute as pessoas, acompanhe tendências e proteja as respostas individuais.</p></div><div class="p5-hero-mark" aria-hidden="true">∿</div></div>'
 const notice=()=>'<div class="p5-notice"><strong>Privacidade por padrão.</strong> Este módulo não identifica respostas individuais no banco de respostas. Resultados aparecem apenas após encerrar a pesquisa e atingir 7 participações. Pesquisas antigas, que gravavam o participante, continuam identificadas e não são convertidas retroativamente.</div>'
 function question(q,i){
  const type=q.type==='recommend10'?'Recomendação (0–10)':'Concordância (1–5)'
  return '<fieldset class="p5-question"><legend>'+html(String(i+1)+'. '+q.title)+'</legend><div class="p5-scale"><label for="p5-r-'+i+'">'+html(type)+'</label><select required id="p5-r-'+i+'" name="answer-'+i+'"><option value="">Selecione sua resposta</option>'+Array.from({length:q.type==='recommend10'?11:5},(_,j)=>{const v=q.type==='recommend10'?j:j+1;return '<option value="'+v+'">'+v+'</option>'}).join('')+'</select></div></fieldset>'
 }
 const surveyCard=s=>'<article class="p5-card"><div class="p5-card-top"><span class="p5-kicker">PESQUISA CORPORATIVA</span>'+badge(s.status)+'</div><h3>'+html(s.title)+'</h3>'+(s.description?'<p>'+html(s.description)+'</p>':'')+'<small>De '+html(s.startDate)+' até '+html(s.endDate)+' · '+s.questions.length+' pergunta(s)</small><div class="p5-actions">'+
  (s.mine&&!s.answered&&s.status==='open'?button('Responder pesquisa','answer-open',s.id,'p5-primary'):'')+
  (s.mine&&s.answered?'<span class="p5-tag p5-done">Sua participação foi registrada</span>':'')+
  (s.canManage?button('Consultar resultados','result',s.id)+ (s.status!=='closed'?button('Encerrar pesquisa','close',s.id,'p5-danger'):''):'')+'</div></article>'
 async function render(){
  const root=document.getElementById('inside');if(!root)return
  const ticket=++renderSequence
  root.innerHTML='<section class="p5-screen">'+intro()+notice()+'<div class="p5-loading">Carregando pesquisas…</div></section>'
  try{
   const result=await api('pulse/v5/list')
   if(page!==PAGE||!root.isConnected||ticket!==renderSequence)return
   current=result.items||[]
   const mine=current.filter(x=>x.mine),managed=current.filter(x=>x.canManage)
   root.innerHTML='<section class="p5-screen">'+intro()+notice()+
    '<div class="p5-topline"><h2>Suas pesquisas</h2>'+(isManager()?button('Nova pesquisa','create-open','','p5-primary'):'')+'</div>'+
    (mine.length?'<div class="p5-grid">'+mine.map(surveyCard).join('')+'</div>':'<div class="p5-empty">Você ainda não possui pesquisas atribuídas.</div>')+
    (isManager()?'<div class="p5-topline p5-space"><h2>Pesquisas sob gestão</h2><small>Resultados apenas agregados</small></div>'+
      (managed.length?'<div class="p5-grid">'+managed.map(surveyCard).join('')+'</div>':'<div class="p5-empty">Crie uma pesquisa para começar.</div>'):'')+
    '<div id="p5-workspace" aria-live="polite"></div></section>'
  }catch(e){if(page===PAGE&&root.isConnected&&ticket===renderSequence)root.innerHTML='<section class="p5-screen">'+intro()+'<div class="p5-error">Falha ao abrir as pesquisas: '+html(e.message)+'</div></section>'}
 }
 async function showCreate(){
  const box=document.getElementById('p5-workspace');if(!box)return
  try{
   optionsCache=await api('pulse/v5/options')
   const companies=optionsCache.companies||[],people=optionsCache.people||[]
   if(!companies.length)throw Error('Seu perfil não possui uma empresa ativa para configurar pesquisas.')
   const defaultCompany=typeof organizationCompany==='string'&&companies.some(x=>x.id===organizationCompany)?organizationCompany:companies[0].id
   box.innerHTML='<section class="p5-editor" id="p5-editor"><div class="p5-work-head"><h2>Configurar pesquisa com agregação protegida</h2>'+button('Fechar','dismiss')+'</div><p class="p5-muted">Os participantes são convidados nominalmente, mas as respostas são armazenadas sem ligação com a identidade. Disponível para públicos de 7 a 3.000 pessoas.</p><form id="p5-create-form" class="p5-form"><div class="p5-form-grid"><label>Nome da pesquisa<input name="title" maxlength="150" minlength="3" placeholder="Ex.: Clima e bem-estar — dezembro" required></label><label>Empresa<select name="companyId" id="p5-company">'+companies.map(x=>'<option value="'+html(x.id)+'" '+(x.id===defaultCompany?'selected':'')+'>'+html(x.name)+'</option>').join('')+'</select></label><label>Início<input name="startDate" type="date" value="'+today()+'" min="'+today()+'" required></label><label>Encerramento<input name="endDate" type="date" value="'+future(7)+'" min="'+today()+'" required></label></div><label>Objetivo ou contexto<textarea name="description" maxlength="500" rows="2" placeholder="Qual decisão esta pesquisa vai apoiar?"></textarea></label><div class="p5-section-head"><h3>Público-alvo</h3><small>Selecione pelo menos 7 participantes</small></div><div class="p5-audience-tools">'+button('Selecionar todos da empresa','select-all')+button('Limpar seleção','clear-all')+'</div><div class="p5-people" id="p5-people"></div><div class="p5-section-head"><h3>Perguntas</h3>'+button('Adicionar pergunta','add-question')+'</div><div id="p5-questions"></div><div class="p5-footer"><span>Sem respostas abertas nesta versão: reduz riscos de identificação por texto.</span><button class="p5-button p5-primary" type="submit">Publicar pesquisa</button></div></form></section>'
   function showPeople(){const list=people.filter(p=>p.companyId===document.getElementById('p5-company').value);document.getElementById('p5-people').innerHTML=list.map(p=>'<label class="p5-person"><input type="checkbox" name="participant" value="'+html(p.id)+'"> '+html(p.name)+'</label>').join('')||'<p>Nenhuma pessoa ativa nesta empresa.</p>'}
   document.getElementById('p5-company').onchange=showPeople;showPeople();addQuestion()
   box.scrollIntoView({behavior:'smooth',block:'start'})
  }catch(e){box.innerHTML='<div class="p5-error">'+html(e.message)+'</div>'}
 }
 function addQuestion(){
  const box=document.getElementById('p5-questions');if(!box)return
  if(box.children.length>=8){toast('Limite de 8 perguntas por pesquisa.');return}
  const item=document.createElement('div');item.className='p5-question-editor';item.innerHTML='<label>Texto da pergunta<input name="qtitle" required minlength="5" maxlength="200" placeholder="Ex.: Tenho clareza sobre minhas prioridades de trabalho"></label><label>Escala<select name="qtype"><option value="likert5">Concordância (1–5)</option><option value="recommend10">Recomendação (0–10)</option></select></label>'+button('Remover','remove-question','','p5-danger')
  box.append(item)
 }
 function showAnswer(s){
  const box=document.getElementById('p5-workspace');if(!box)return
  box.innerHTML='<section class="p5-editor"><div class="p5-work-head"><div><h2>'+html(s.title)+'</h2><p class="p5-muted">Responda com liberdade. O RH só receberá resultados agregados após o encerramento.</p></div>'+button('Fechar','dismiss')+'</div><form id="p5-answer-form" data-survey="'+html(s.id)+'">'+s.questions.map(question).join('')+'<div class="p5-footer"><span>Sua resposta não poderá ser editada após o envio.</span><button class="p5-button p5-primary" type="submit">Enviar respostas</button></div></form></section>'
  box.scrollIntoView({behavior:'smooth',block:'start'})
 }
 async function showResult(id){
  const box=document.getElementById('p5-workspace');if(!box)return
  box.innerHTML='<div class="p5-loading">Consultando resultado agregado…</div>'
  try{
   const result=await api('pulse/v5/summary?id='+encodeURIComponent(id))
   if(!result.summary){box.innerHTML='<section class="p5-editor"><div class="p5-work-head"><h2>Resultado protegido</h2>'+button('Fechar','dismiss')+'</div><p>'+html(result.reason)+'</p><small>Nenhuma resposta individual foi disponibilizada.</small></section>';return}
   const s=result.summary
   box.innerHTML='<section class="p5-editor"><div class="p5-work-head"><h2>Resultados — '+html(s.title)+'</h2>'+button('Fechar','dismiss')+'</div><div class="p5-kpis"><div><small>Convidados</small><b>'+s.invited+'</b></div><div><small>Participações</small><b>'+s.responded+'</b></div><div><small>Taxa de resposta</small><b>'+s.responseRate+'%</b></div></div>'+s.questions.map(q=>'<article class="p5-result"><div class="p5-result-title"><h3>'+html(q.title)+'</h3><strong>'+q.mean+' / '+(q.type==='likert5'?5:10)+'</strong></div>'+(q.nps!==null?'<p>eNPS: '+q.nps+'</p>':'')+q.distribution.map(v=>'<div class="p5-dist"><span>'+v.value+'</span><div class="p5-track"><i style="width:'+Math.max(0,Math.min(100,Math.round(v.count/q.count*100)))+'%"></i></div><span>'+v.count+'</span></div>').join('')+'</article>').join('')+'<p class="p5-muted">Sem filtros por pessoa ou departamento, sem respostas nominativas e sem exportação individual.</p></section>'
   box.scrollIntoView({behavior:'smooth',block:'start'})
  }catch(e){box.innerHTML='<div class="p5-error">'+html(e.message)+'</div>'}
 }
 const originalBody=body
 body=function(...args){if(page===PAGE){void render();return}return originalBody(...args)}
 const originalDraw=draw
 draw=function(...args){const result=originalDraw(...args);nav();return result}
 document.addEventListener('click',event=>{
  const node=event.target.closest('[data-p5]');if(!node||busy)return
  event.preventDefault();event.stopPropagation()
  const action=node.dataset.p5,id=node.dataset.id
  if(action==='create-open'){void showCreate();return}
  if(action==='dismiss'){document.getElementById('p5-workspace')?.replaceChildren();return}
  if(action==='add-question'){addQuestion();return}
  if(action==='remove-question'){node.closest('.p5-question-editor')?.remove();return}
  if(action==='select-all'||action==='clear-all'){document.querySelectorAll('#p5-people [name="participant"]').forEach(i=>i.checked=action==='select-all');return}
  if(action==='answer-open'){const s=current.find(x=>x.id===id);if(s)showAnswer(s);return}
  if(action==='result'){void showResult(id);return}
  if(action==='close'){
   if(!confirm('Encerrar esta pesquisa? Não serão aceitas novas respostas.'))return
   busy=true;void api('pulse/v5/close',{id}).then(()=>render()).catch(e=>toast(e.message)).finally(()=>busy=false)
  }
 },true)
 document.addEventListener('submit',event=>{
  if(!['p5-create-form','p5-answer-form'].includes(event.target.id))return
  event.preventDefault();if(busy)return
  const form=event.target, fd=new FormData(form), isCreate=form.id==='p5-create-form'
  const payload=isCreate?{
   title:String(fd.get('title')),companyId:String(fd.get('companyId')),description:String(fd.get('description')||''),startDate:String(fd.get('startDate')),endDate:String(fd.get('endDate')),
   participantIds:fd.getAll('participant').map(String),
   questions:[...form.querySelectorAll('.p5-question-editor')].map(el=>({title:el.querySelector('[name="qtitle"]').value,type:el.querySelector('[name="qtype"]').value}))
  }:{id:form.dataset.survey,values:current.find(s=>s.id===form.dataset.survey)?.questions.map((_,i)=>Number(fd.get('answer-'+i)))||[]}
  busy=true
  const btn=form.querySelector('[type="submit"]');btn.disabled=true
  void api(isCreate?'pulse/v5/create':'pulse/v5/answer',payload).then(()=>{toast(isCreate?'Pesquisa publicada com sucesso.':'Participação registrada.');return render()}).catch(e=>{toast(e.message);btn.disabled=false}).finally(()=>{busy=false})
 },true)
})()
