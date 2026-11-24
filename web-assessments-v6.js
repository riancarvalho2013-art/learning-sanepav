/* Learning Sanepav · Avaliações educacionais V6 — progressively enhanced native UI */
(() => {
 'use strict'
 const PAGE='Avaliações educacionais'
 const isManage=()=>['Administrador','RH/DHO'].includes(d?.me?.role)
 const safe=x=>esc(x)
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const btn=(label,action,id='',cls='')=>'<button type="button" class="a6-btn '+cls+'" data-a6="'+action+'" data-id="'+safe(id)+'">'+safe(label)+'</button>'
 const option=(rows,value)=>rows.map(x=>'<option value="'+safe(x.id)+'" '+(String(x.id)===String(value)?'selected':'')+'>'+safe(x.name||x.title)+'</option>').join('')
 let items=[], optionsCache=null, busy=false
 let countdown=null, saveDelay=null
 const stopQuiz=()=>{clearInterval(countdown);clearTimeout(saveDelay);countdown=null;saveDelay=null}
 const currentAnswers=form=>[...form.querySelectorAll('.a6-answer-field')].map((_,i)=>{const value=new FormData(form).get('question-'+i);return value===null?null:Number(value)})
 function scheduleSave(){
  const current=document.getElementById('a6-answer-form')
  if(!current)return
  if(current.dataset.saving==='1'){current.dataset.pending='1';return}
  clearTimeout(saveDelay)
  saveDelay=setTimeout(async()=>{
   const form=document.getElementById('a6-answer-form');if(!form||form.dataset.saving==='1')return
   form.dataset.saving='1'
   const message=document.getElementById('a6-save-status')
   try{
    const result=await api('assessment/v6/save',{id:form.dataset.id,attemptId:form.dataset.attempt,revision:Number(form.dataset.revision),answers:currentAnswers(form)})
    if(document.getElementById('a6-answer-form')!==form)return
    form.dataset.revision=String(result.revision)
    if(message)message.textContent='Respostas parciais salvas no servidor.'
   }catch(error){if(message)message.textContent='Não foi possível salvar automaticamente: '+error.message}
   finally{form.dataset.saving='0';if(form.dataset.pending==='1'){form.dataset.pending='0';scheduleSave()}}
  },800)
 }
 function beginCountdown(expiry,serverNow){
  const offset=Date.parse(serverNow||new Date().toISOString())-Date.now()
  clearInterval(countdown)
  const tick=()=>{
   const el=document.getElementById('a6-time-remaining'),form=document.getElementById('a6-answer-form');if(!el||!form){clearInterval(countdown);return}
   const seconds=Math.max(0,Math.floor((Date.parse(expiry)-(Date.now()+offset))/1000))
   el.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0')
   if(seconds===0){clearInterval(countdown);form.querySelector('button[type="submit"]').disabled=true;document.getElementById('a6-save-status').textContent='O tempo terminou. Esta tentativa não poderá ser enviada.'}
  }
  tick();countdown=setInterval(tick,1000)
 }
 function root(){return document.getElementById('inside')}
 function section(title,description,body){return '<section class="a6-root"><header class="a6-hero"><div><span class="a6-kicker">DNA DO DESENVOLVIMENTO · CONHECIMENTO</span><h1>'+safe(title)+'</h1><p>'+safe(description)+'</p></div>'+btn('Voltar ao catálogo','catalog','','a6-light')+'</header>'+body+'</section>'}
 function status(item){return ({draft:'Rascunho',published:'Publicada',archived:'Arquivada'})[item.status]||item.status}
 const types={pre:'Pré-avaliação',post:'Pós-avaliação',final:'Avaliação final'}
 const warning=t=>'<div class="a6-warning" role="status">'+safe(t)+'</div>'
 const empty=(title,sub)=>'<div class="a6-empty"><h2>'+safe(title)+'</h2><p>'+safe(sub)+'</p></div>'
 function card(item){
  const tries=item.attempts?.length||0,highest=item.attempts?.reduce((n,a)=>Math.max(n,a.score),0)||0
  const actions=item.canManage?btn('Configurar','detail',item.id)+btn('Resultados','results',item.id)+(item.status==='draft'?btn('Publicar','publish',item.id,'a6-primary'):'')+btn('Duplicar','duplicate',item.id)+(item.status==='published'?btn('Arquivar','archive',item.id,'a6-alert'):'')+(item.canAnswer?btn('Responder como participante','answer',item.id,'a6-primary'):''):
    (item.canAnswer?btn('Responder avaliação','answer',item.id,'a6-primary'):item.attempts.length?'<span class="a6-tag">'+tries+' tentativa(s) · melhor nota '+highest+'%</span>':'<span class="a6-tag">Indisponível no momento</span>')
  return '<article class="a6-card"><div class="a6-card-meta"><span>'+safe(types[item.kind]||item.kind)+'</span><strong class="a6-status a6-'+safe(item.status)+'">'+safe(status(item))+'</strong></div><h2>'+safe(item.title)+'</h2><p>Nota mínima: '+safe(item.minScore)+'% · Até '+safe(item.maxAttempts)+' tentativas · '+safe(item.durationMinutes)+' min de duração máxima</p><p class="a6-dates">'+safe(item.startsOn)+' até '+safe(item.endsOn)+' · '+safe(item.questionsCount)+' questões</p><div class="a6-actions">'+actions+'</div></article>'
 }
 async function render(){
  stopQuiz()
  const el=root();if(!el)return
  el.innerHTML=section(PAGE,'Instrumentos de aprendizagem com correção no servidor, histórico de tentativas e resultados verificáveis.','<div class="a6-loading">Carregando avaliações autorizadas…</div>')
  try{
   const data=await api('assessment/v6/list')
   if(page!==PAGE)return
   items=data.items||[]
   el.innerHTML=section(PAGE,'Pré e pós-testes, avaliações finais e evidências de aprendizagem, sem conclusões fictícias no LMS.',
    '<div class="a6-toolbar"><h2>'+(isManage()?'Avaliações sob gestão':'Suas avaliações')+'</h2>'+(isManage()?btn('Nova avaliação','create','','a6-primary'):'')+'</div>'+
    (items.length?'<div class="a6-grid">'+items.map(card).join('')+'</div>':empty('Nenhuma avaliação disponível','O RH pode criar uma avaliação vinculada a um curso publicado; colaboradores matriculados poderão respondê-la quando for publicada.'))+
    '<div id="a6-workspace" aria-live="polite"></div>')
  }catch(e){el.innerHTML=section(PAGE,'',warning(e.message))}
 }
 function questionEditor(q,i){const opts=q?.options||['','','',''];const correct=q?.correctIndex??0
  return '<div class="a6-question" data-a6-question><div class="a6-question-head"><strong>Questão '+(i+1)+'</strong>'+btn('Remover','removeQuestion','','a6-danger')+'</div><label>Enunciado<textarea name="prompt" maxlength="500" minlength="5" rows="2" required>'+safe(q?.prompt||'')+'</textarea></label><div class="a6-option-grid">'+opts.map((o,j)=>'<label>Alternativa '+(j+1)+'<input type="text" data-option="'+j+'" value="'+safe(o)+'" maxlength="240" required></label>').join('')+'</div><div class="a6-fields"><label>Alternativa correta<select name="correctIndex">'+opts.map((_,j)=>'<option value="'+j+'" '+(j===correct?'selected':'')+'>'+(j+1)+'</option>').join('')+'</select></label><label>Peso da questão<input type="number" name="weight" min="1" max="5" value="'+safe(q?.weight||1)+'" required></label></div></div>'
 }
 function addQuestion(q){const el=document.getElementById('a6-questions');if(!el)return;if(el.children.length>=40){toast('Limite de 40 questões.');return}const holder=document.createElement('div');holder.innerHTML=questionEditor(q,el.children.length);el.append(holder.firstElementChild)}
 async function editor(id){
  const box=document.getElementById('a6-workspace');if(!box)return
  box.innerHTML='<div class="a6-loading">Preparando editor…</div>'
  try{
   const [opts,item]=await Promise.all([optionsCache||api('assessment/v6/options'),id?api('assessment/v6/detail?id='+encodeURIComponent(id)):Promise.resolve(null)])
   optionsCache=opts
   if(item&&!item.canEdit){box.innerHTML=warning('Esta avaliação já foi publicada. Para alterar perguntas, duplique-a e publique uma nova versão.');return}
   const companies=opts.companies||[],courses=opts.courses||[]
   if(!companies.length||!courses.length)throw Error('Cadastre uma empresa ativa e publique um curso antes de criar avaliações.')
   const company=item?.companyId||((typeof organizationCompany==='string'&&companies.some(x=>x.id===organizationCompany))?organizationCompany:companies[0].id)
   box.innerHTML='<section class="a6-editor"><div class="a6-work-head"><h2>'+(item?'Editar rascunho':'Criar avaliação educacional')+'</h2>'+btn('Fechar','dismiss')+'</div><form id="a6-editor-form" data-id="'+safe(id||'')+'" data-revision="'+safe(item?.revision||'')+'"><div class="a6-fields"><label>Título da avaliação<input name="title" required minlength="3" maxlength="160" placeholder="Ex.: Pré-teste de segurança" value="'+safe(item?.title||'')+'"></label><label>Empresa<select name="companyId" '+(item?'disabled':'')+'>'+option(companies,company)+'</select></label><label>Curso publicado<select name="courseId">'+option(courses,item?.courseId||courses[0].id)+'</select></label><label>Tipo<select name="kind">'+Object.entries(types).map(([id,label])=>'<option value="'+id+'" '+(item?.kind===id?'selected':'')+'>'+label+'</option>').join('')+'</select></label><label>Nota mínima (%)<input type="number" name="minScore" min="0" max="100" value="'+safe(item?.minScore??70)+'" required></label><label>Limite de tentativas<input type="number" name="maxAttempts" min="1" max="10" value="'+safe(item?.maxAttempts??2)+'" required></label><label>Tempo máximo da prova (min)<input type="number" name="durationMinutes" min="1" max="240" value="'+safe(item?.durationMinutes??20)+'" required></label><label>Início<input type="date" name="startsOn" value="'+safe(item?.startsOn||today())+'" required></label><label>Fim<input type="date" name="endsOn" value="'+safe(item?.endsOn||'2027-12-31')+'" required></label></div><div class="a6-heading"><h3>Questões de múltipla escolha</h3>'+btn('Adicionar questão','addQuestion','','a6-outline')+'</div><p class="a6-help">Uma alternativa correta por questão. O gabarito permanece no servidor e nunca é enviado ao aluno.</p><div id="a6-questions"></div><footer class="a6-form-footer"><small>Rascunhos podem ser editados. A publicação bloqueia alterações retroativas.</small><button class="a6-btn a6-primary" type="submit">Salvar '+(item?'alterações':'rascunho')+'</button></footer></form></section>'
   const qs=item?.questions?.length?item.questions:[{prompt:'',options:['','','',''],correctIndex:0,weight:1}]
   qs.forEach(addQuestion)
   box.scrollIntoView({behavior:'smooth',block:'start'})
  }catch(e){box.innerHTML=warning(e.message)}
 }
 async function detail(id){const box=document.getElementById('a6-workspace');if(!box)return;try{const item=await api('assessment/v6/detail?id='+encodeURIComponent(id));const labels=await api('assessment/v6/list');
  box.innerHTML='<section class="a6-editor"><div class="a6-work-head"><h2>'+safe(item.title)+'</h2>'+btn('Fechar','dismiss')+'</div><p class="a6-help">'+safe(types[item.kind])+' · '+safe(status(item))+' · '+item.questions.length+' questões</p>'+item.questions.map((q,i)=>'<article class="a6-review"><b>'+(i+1)+'. '+safe(q.prompt)+'</b><ol>'+q.options.map((o,j)=>'<li>'+safe(o)+(item.canManage&&q.correctIndex===j?' <strong class="a6-answer">(correta)</strong>':'')+'</li>').join('')+'</ol></article>').join('')+'<div class="a6-actions">'+(item.canEdit?btn('Editar rascunho','edit',id,'a6-primary'):'')+btn('Consultar resultados','results',id)+'</div></section>'
  box.scrollIntoView({behavior:'smooth',block:'start'})
 }catch(e){box.innerHTML=warning(e.message)}}
 async function answer(id){
  const box=document.getElementById('a6-workspace');if(!box)return
  box.innerHTML='<div class="a6-loading">Iniciando sessão segura de avaliação…</div>'
  try{
   const item=await api('assessment/v6/detail?id='+encodeURIComponent(id));if(!item.canAnswer)throw Error('A avaliação não está disponível para novas tentativas.')
   const session=await api('assessment/v6/start',{id})
   stopQuiz()
   box.innerHTML='<section class="a6-editor a6-immersive"><div class="a6-work-head"><div><span class="a6-kicker">SALA DE AVALIAÇÃO · DNA DO DESENVOLVIMENTO</span><h2>'+safe(item.title)+'</h2><p>Nota mínima '+item.minScore+'% · '+item.questions.length+' questões · prazo controlado pelo servidor</p></div><div class="a6-timer" role="timer" aria-label="Tempo restante">Tempo restante <strong id="a6-time-remaining">--:--</strong></div>'+btn('Fechar','dismiss')+'</div><form id="a6-answer-form" data-id="'+safe(id)+'" data-attempt="'+safe(session.attemptId)+'" data-revision="'+safe(session.revision)+'">'+item.questions.map((q,i)=>'<fieldset class="a6-answer-field"><legend>'+(i+1)+'. '+safe(q.prompt)+'</legend>'+q.options.map((o,j)=>'<label><input type="radio" name="question-'+i+'" value="'+j+'" required '+(session.answers[i]===j?'checked':'')+'> '+safe(o)+'</label>').join('')+'</fieldset>').join('')+'<footer class="a6-form-footer"><small id="a6-save-status">'+(session.resumed?'Sessão retomada.':'Sessão iniciada.')+' As alterações serão salvas automaticamente.</small><button class="a6-btn a6-primary" type="submit">Finalizar e enviar avaliação</button></footer></form></section>'
   beginCountdown(session.expiresAt,session.serverNow)
   box.scrollIntoView({behavior:'smooth',block:'start'})
  }catch(e){box.innerHTML=warning(e.message)}
 }
 async function results(id,pageNumber=1){const box=document.getElementById('a6-workspace');if(!box)return;box.innerHTML='<div class="a6-loading">Consultando registros…</div>'
  try{const [result,analysis]=await Promise.all([api('assessment/v6/results?id='+encodeURIComponent(id)+'&page='+pageNumber),api('assessment/v6/question-analysis?id='+encodeURIComponent(id))])
   box.innerHTML='<section class="a6-editor"><div class="a6-work-head"><h2>Resultados · '+safe(result.formTitle)+'</h2>'+btn('Fechar','dismiss')+'</div><div class="a6-kpis"><div><small>Respondentes</small><strong>'+result.participants+'</strong></div><div><small>Tentativas</small><strong>'+result.attempts+'</strong></div><div><small>Aprovados</small><strong>'+result.passed+'</strong></div><div><small>Taxa de aprovação</small><strong>'+(result.passRate===null?'Sem dados':result.passRate+'%')+'</strong></div></div><div class="a6-table-scroll"><table class="a6-table"><thead><tr><th>Colaborador</th><th>Tentativas</th><th>Maior nota</th><th>Aprovado</th><th>Último envio</th></tr></thead><tbody>'+(result.rows.length?result.rows.map(r=>'<tr><td>'+safe(r.name)+'</td><td>'+r.attempts+'</td><td>'+r.bestScore+'%</td><td>'+(r.passed?'Sim':'Não')+'</td><td>'+safe(r.lastAttemptAt?.slice(0,19)||'')+'</td></tr>').join(''):'<tr><td colspan="5">Sem respostas registradas.</td></tr>')+'</tbody></table></div><div class="a6-actions">'+btn('Exportar CSV','csv',id,'a6-primary')+(result.page>1?btn('Página anterior','resultPagePrev',id):'')+(result.page*result.pageSize<result.total?btn('Próxima página','resultPageNext',id):'')+'</div><h3>Análise de acerto por questão</h3><div class="a6-question-summary">'+analysis.questions.map(q=>'<div><strong>'+safe(q.position+'. '+q.prompt)+'</strong><span>'+q.correct+' de '+q.respondents+' acertos · '+(q.accuracy===null?'Sem respostas':q.accuracy+'%')+'</span></div>').join('')+'</div><p class="a6-help">Fonte: tentativas registradas no servidor. Dados individuais disponíveis apenas a gestores autorizados da empresa.</p></section>'
   box.dataset.resultPage=String(result.page)
   box.scrollIntoView({behavior:'smooth',block:'start'})
  }catch(e){box.innerHTML=warning(e.message)}
 }
 function harvest(form){const fd=new FormData(form);const previous=items.find(x=>x.id===form.dataset.id)
  const all=[...form.querySelectorAll('[data-a6-question]')].map(q=>({prompt:q.querySelector('[name="prompt"]').value,options:[...q.querySelectorAll('[data-option]')].map(i=>i.value),correctIndex:Number(q.querySelector('[name="correctIndex"]').value),weight:Number(q.querySelector('[name="weight"]').value)}))
  return {title:String(fd.get('title')),companyId:previous?.companyId||String(fd.get('companyId')),courseId:String(fd.get('courseId')),kind:String(fd.get('kind')),minScore:Number(fd.get('minScore')),maxAttempts:Number(fd.get('maxAttempts')),durationMinutes:Number(fd.get('durationMinutes')),startsOn:String(fd.get('startsOn')),endsOn:String(fd.get('endsOn')),questions:all,...(form.dataset.id?{id:form.dataset.id,revision:Number(form.dataset.revision)}:{})}
 }
 function addNav(){const nav=document.querySelector('aside nav');if(!nav||!d?.me)return
  if(nav.querySelector('button[data-id="'+PAGE+'"]'))return
  const button=document.createElement('button');button.dataset.act='nav';button.dataset.id=PAGE;button.className=page===PAGE?'sel':''
  button.innerHTML='<span aria-hidden="true" class="ico">▤</span>'+safe(PAGE);nav.append(button)
 }
 const originalDraw=draw
 draw=function(...args){const value=originalDraw(...args);addNav();return value}
 const originalBody=body
 body=function(...args){if(page===PAGE){void render();return}return originalBody(...args)}
 document.addEventListener('click',event=>{
  const node=event.target.closest('[data-a6]');if(!node||busy)return
  event.preventDefault();event.stopPropagation()
  const {a6:action,id}=node.dataset
  if(action==='catalog'){document.querySelector('aside nav button[data-id="Catálogo LMS"]')?.click();return}
  if(action==='dismiss'){stopQuiz();document.getElementById('a6-workspace')?.replaceChildren();return}
  if(action==='create'){void editor();return}
  if(action==='edit'){void editor(id);return}
  if(action==='addQuestion'){addQuestion();return}
  if(action==='removeQuestion'){if(document.querySelectorAll('[data-a6-question]').length>1)node.closest('[data-a6-question]')?.remove();else toast('Mantenha pelo menos uma questão.');return}
  if(action==='detail'){void detail(id);return}
  if(action==='answer'){void answer(id);return}
  if(action==='results'){void results(id);return}
  if(action==='resultPageNext'||action==='resultPagePrev'){const p=Number(document.getElementById('a6-workspace')?.dataset.resultPage)||1;void results(id,Math.max(1,p+(action==='resultPageNext'?1:-1)));return}
  if(action==='csv'){window.location.href='/api/assessment/v6/export.csv?id='+encodeURIComponent(id);return}
  if(['publish','archive','duplicate'].includes(action)){
   const item=items.find(x=>x.id===id);if(!item)return
   if(!confirm(action==='publish'?'Publicar avaliação? Perguntas e gabarito ficarão bloqueados.':action==='archive'?'Arquivar a avaliação? O histórico será preservado.':'Duplicar como novo rascunho?'))return
   busy=true
   void api('assessment/v6/'+action,{id,...(action==='duplicate'?{}:{revision:item.revision})}).then(()=>render()).catch(e=>toast(e.message)).finally(()=>busy=false)
  }
 },true)
 document.addEventListener('change',event=>{if(event.target.closest('#a6-answer-form'))scheduleSave()},true)
 document.addEventListener('submit',event=>{
  const form=event.target
  if(!['a6-editor-form','a6-answer-form'].includes(form.id))return
  event.preventDefault();if(busy)return
  busy=true
  const button=form.querySelector('button[type="submit"]');button.disabled=true
  if(form.id==='a6-editor-form'){
   const payload=harvest(form)
   void api(payload.id?'assessment/v6/update':'assessment/v6/create',payload).then(()=>{toast('Rascunho salvo.');return render()}).catch(e=>{toast(e.message);button.disabled=false}).finally(()=>busy=false)
  }else{
   clearTimeout(saveDelay)
   const answers=currentAnswers(form)
   if(answers.some(x=>x===null)){toast('Responda todas as questões antes de enviar.');button.disabled=false;busy=false;return}
   const payload={id:form.dataset.id,attemptId:form.dataset.attempt,answers}
   void api('assessment/v6/submit',payload).then(result=>{toast('Tentativa registrada. Nota: '+result.score+'% · '+(result.passed?'Aprovado':'Não aprovado'));return render()}).catch(e=>{toast(e.message);button.disabled=false}).finally(()=>busy=false)
  }
 },true)
})()
