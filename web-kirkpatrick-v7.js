/* Learning Sanepav — Painel de eficácia de treinamento · Kirkpatrick N1–N4 V7 */
(() => {
 'use strict'
 const PAGE='Eficácia dos treinamentos'
 const escText=x=>esc(x)
 const action=(title,act,id='',className='')=>`<button type="button" class="kp7-btn ${className}" data-kp7="${act}" data-id="${escText(id)}">${escText(title)}</button>`
 const loading='<div class="kp7-loading">Carregando registros autorizados…</div>'
 const empty=(message)=>`<div class="kp7-empty">${escText(message)}</div>`
 const statusText={not_measured:'Não medido',no_paired_data:'Sem dados pareados',not_comparable:'Não comparável',insufficient_data:'Dados insuficientes',available:'Disponível',recorded_observations:'Observações registradas'}
 const ui=()=>document.getElementById('inside')
 let activeCompany='',activeCourse='',optionsCache=null
 function frame(content){return `<section class="kp7-root"><div class="kp7-hero"><div><small>DNA DO DESENVOLVIMENTO · EVIDÊNCIAS DE APRENDIZAGEM</small><h1>Eficácia dos treinamentos</h1><p>Quatro níveis de análise, das percepções ao resultado observado. Indicadores somente quando existem dados confiáveis.</p></div></div>${content}</section>`}
 function select(name,options,value){return `<select id="${name}" aria-label="${name}">${options.map(x=>`<option value="${escText(x.id)}" ${x.id===value?'selected':''}>${escText(x.name||x.title)}</option>`).join('')}</select>`}
 function tile(title,value,detail){return `<article class="kp7-stat"><span>${escText(title)}</span><strong>${escText(value)}</strong><small>${escText(detail)}</small></article>`}
 async function load(){
  const target=ui();if(!target)return
  target.innerHTML=frame(loading)
  try{
   const options=await api('kirkpatrick/v7/options');if(page!==PAGE)return
   optionsCache=options
   const companies=options.companies||[],courses=options.courses||[]
   if(!companies.length){target.innerHTML=frame(empty('Seu perfil não possui uma empresa autorizada.'));return}
   if(!companies.some(x=>x.id===activeCompany))activeCompany=companies[0].id
   if(!courses.some(x=>x.id===activeCourse))activeCourse=courses[0]?.id||''
   let html='<div class="kp7-heading"><h2>Seu acompanhamento</h2><span class="kp7-meta">Registros reais · Sem inferência automática de causalidade</span></div>'
   if(options.canManage){html+='<section class="kp7-panel"><h3>Recorte autorizado</h3><div class="kp7-grid-two"><label>Empresa'+select('kp7-company',companies,activeCompany)+'</label><label>Treinamento'+select('kp7-course',courses,activeCourse)+'</label></div></section>'}
   html+='<div id="kp7-summary">'+loading+'</div>'
   const myCourses=(options.enrollments||[]).map(e=>courses.find(x=>x.id===e.courseId)).filter(Boolean)
   if(myCourses.length){html+='<section class="kp7-panel"><h3>Nível 1 — Avaliação de reação</h3><p>Disponível depois da conclusão válida. A participação é identificada; os relatórios usam agregados com limiar de divulgação.</p><form id="kp7-reaction-form"><div class="kp7-grid-two"><label>Curso concluído'+select('kp7-reaction-course',myCourses,myCourses[0].id)+'</label>'+[['clarity','Clareza do conteúdo'],['relevance','Relevância para o trabalho'],['applicability','Aplicabilidade percebida']].map(([key,title])=>'<label>'+title+'<select name="'+key+'">'+[1,2,3,4,5].map(i=>'<option value="'+i+'">'+i+' / 5</option>').join('')+'</select></label>').join('')+'<label>Probabilidade de recomendar (0–10)<select name="recommendation">'+Array.from({length:11},(_,i)=>'<option value="'+i+'">'+i+'</option>').join('')+'</select></label></div><label>Comentário opcional<textarea name="comment" maxlength="600" rows="2" placeholder="O que foi mais útil?" ></textarea></label><button class="kp7-btn kp7-primary" type="submit">Enviar reação</button><p class="kp7-note" id="kp7-reaction-message" role="status"></p></form></section>'}
   const tasks=await api('kirkpatrick/v7/transfer/tasks')
   if(page!==PAGE)return
   if(tasks.items?.length){html+='<section class="kp7-panel"><h3>Nível 3 — Transferência ao trabalho</h3><p>Registre a aplicação prática observada. Estas notas são acessíveis somente aos participantes autorizados.</p>'+tasks.items.map(t=>'<article class="kp7-task"><div><b>'+escText(t.subject)+'</b><small>Acompanhamento '+t.offsetDays+' dias · '+escText(t.dueOn)+' · '+escText(t.status)+'</small></div>'+(t.status==='pending'?(t.canAnswer?action('Avaliar aplicação','transfer',t.id,'kp7-primary'):'<span class="kp7-state">Aguardando prazo</span>'):'<span class="kp7-state">Concluído</span>')+'</article>').join('')+'</section>'}
   if(options.canManage){html+='<section class="kp7-panel"><h3>Gestão — acompanhamento posterior</h3><p>Crie tarefas para líderes dos participantes que concluíram o treinamento; atribuições repetidas não geram tarefas duplicadas.</p><form id="kp7-assign-form" class="kp7-inline"><label>Prazo do acompanhamento<select name="offsetDays"><option value="30">30 dias</option><option value="60">60 dias</option><option value="90">90 dias</option></select></label><button class="kp7-btn kp7-primary" type="submit">Atribuir aos líderes</button></form><p class="kp7-note" id="kp7-assign-message" role="status"></p></section>'}
   if(options.canManage){html+='<section class="kp7-panel"><h3>Nível 4 — Registrar observação operacional</h3><p>Informe a fonte e o método de análise. Este registro não comprova que o treinamento causou a mudança observada.</p><form id="kp7-outcome-form"><div class="kp7-grid-two"><label>Indicador<input name="metricName" placeholder="Ex.: índice de retrabalho" maxlength="160" required></label><label>Unidade<input name="unit" placeholder="Ex.: %" maxlength="40" required></label><label>Valor anterior<input name="baseline" type="number" step="any" required></label><label>Valor observado<input name="observed" type="number" step="any" required></label><label>Início do período<input name="periodStart" type="date" required></label><label>Fim do período<input name="periodEnd" type="date" required></label></div><label>Fonte do indicador<input name="source" maxlength="300" placeholder="Ex.: Sistema de qualidade — relatório de novembro" required></label><label>Método<input name="method" maxlength="800" placeholder="Ex.: comparação descritiva por período" required></label><label>Limitações<textarea name="caveat" maxlength="800" rows="2" required>Associação observada. Sem grupo de controle, não há evidência de causalidade.</textarea></label><button class="kp7-btn kp7-primary" type="submit">Registrar observação</button></form><p class="kp7-note" id="kp7-outcome-message" role="status"></p></section>'}
   target.innerHTML=frame(html)
   if(options.canManage)await refreshSummary()
   else document.getElementById('kp7-summary')?.replaceChildren()
  }catch(err){if(page===PAGE)target.innerHTML=frame(empty(err.message))}
 }
 async function refreshSummary(){
  const target=document.getElementById('kp7-summary');if(!target||!activeCompany||!activeCourse)return
  target.innerHTML=loading
  try{
   const data=await api('kirkpatrick/v7/summary?company='+encodeURIComponent(activeCompany)+'&course='+encodeURIComponent(activeCourse))
   if(page!==PAGE)return
   const q=data.n1,p=data.n2,t=data.n3,r=data.n4
   const stats='<div class="kp7-stats">'+tile('N1 · Reação',q.meanClarity===null?'Protegido':q.meanClarity+' / 5','Clareza — '+(statusText[q.state]||q.state))+tile('N1 · NPS',q.nps===null?'—':q.nps,'Promotores − detratores')+tile('N2 · Aprendizagem',p.changePoints===null?'—':(p.changePoints>0?'+':'')+p.changePoints+' p.p.',statusText[p.status]||p.status)+tile('N3 · Aplicação',t.meanApplication===null?'—':t.meanApplication+' / 5',t.submitted+' de '+t.assigned+' registros')+'</div>'
   const outcomes=(r.observations||[]).map(x=>'<div class="kp7-observation"><strong>'+escText(x.metric_name)+'</strong><span>'+escText(x.baseline)+' → '+escText(x.observed)+' '+escText(x.unit)+'</span><small>Fonte: '+escText(x.source)+' · '+escText(x.method)+'</small><small>'+escText(x.caveat)+'</small></div>').join('')
   target.innerHTML='<section class="kp7-panel"><h3>Indicadores e evidências · Kirkpatrick</h3>'+stats+'<p class="kp7-note">N1 só libera agregados com 7+ respostas; N2 compara apenas instrumentos compatíveis; N3 mede percepção do gestor; N4 documenta observações sem afirmar causalidade.</p><div class="kp7-observations"><h4>Nível 4 — Resultados observados</h4>'+(outcomes||empty('Ainda não foram cadastrados indicadores operacionais deste treinamento.'))+'</div></section>'
  }catch(error){target.innerHTML=empty(error.message)}
 }
 async function openTransfer(id){
  const target=ui(),original=target.innerHTML
  const markup='<section class="kp7-root"><section class="kp7-panel"><h1>Acompanhamento da aplicação ao trabalho</h1><p>Registre apenas fatos observados, preservando informações confidenciais.</p><form id="kp7-transfer-form" data-id="'+escText(id)+'"><label>Aplicação observada (1 a 5)<select name="application">'+[1,2,3,4,5].map(x=>'<option value="'+x+'">'+x+' / 5</option>').join('')+'</select></label><label>Barreiras<textarea name="barrier" maxlength="700" rows="2"></textarea></label><label>Evidências<textarea name="evidence" maxlength="1500" rows="3"></textarea></label><label>Próxima ação<textarea name="action" maxlength="700" rows="2"></textarea></label><div class="kp7-actions">'+action('Cancelar','back')+'<button class="kp7-btn kp7-primary" type="submit">Concluir acompanhamento</button></div></form><p role="status" id="kp7-transfer-message"></p></section></section>'
  target.innerHTML=markup
  target.scrollIntoView({behavior:'smooth',block:'start'})
 }
 const oldDraw=draw
 draw=function(...args){const result=oldDraw(...args);const nav=document.querySelector('aside nav');if(nav&&!nav.querySelector('button[data-id="'+PAGE+'"]')){const button=document.createElement('button');button.dataset.act='nav';button.dataset.id=PAGE;button.textContent='◉  '+PAGE;nav.append(button)}return result}
 const oldBody=body
 body=function(...args){if(page===PAGE){void load();return}return oldBody(...args)}
 document.addEventListener('click',event=>{const button=event.target.closest('[data-kp7]');if(!button)return;event.preventDefault();event.stopPropagation();if(button.dataset.kp7==='transfer')void openTransfer(button.dataset.id);if(button.dataset.kp7==='back')void load()},true)
 document.addEventListener('change',event=>{if(event.target.id==='kp7-company'){activeCompany=event.target.value;void refreshSummary()}if(event.target.id==='kp7-course'){activeCourse=event.target.value;void refreshSummary()}},true)
 document.addEventListener('submit',event=>{
  const form=event.target
  if(!['kp7-reaction-form','kp7-assign-form','kp7-outcome-form','kp7-transfer-form'].includes(form.id))return
  event.preventDefault();const send=form.querySelector('button[type="submit"]');send.disabled=true
  const f=Object.fromEntries(new FormData(form))
  let path,body,message
  if(form.id==='kp7-reaction-form'){path='reaction';body={courseId:form.querySelector('#kp7-reaction-course').value,clarity:Number(f.clarity),relevance:Number(f.relevance),applicability:Number(f.applicability),recommendation:Number(f.recommendation),comment:f.comment||''};message='kp7-reaction-message'}
  else if(form.id==='kp7-assign-form'){path='transfer/assign';body={companyId:activeCompany,courseId:activeCourse,offsetDays:Number(f.offsetDays)};message='kp7-assign-message'}
  else if(form.id==='kp7-outcome-form'){path='outcomes';body={companyId:activeCompany,courseId:activeCourse,metricName:f.metricName,unit:f.unit,baseline:Number(f.baseline),observed:Number(f.observed),periodStart:f.periodStart,periodEnd:f.periodEnd,source:f.source,method:f.method,caveat:f.caveat};message='kp7-outcome-message'}
  else{path='transfer/submit';body={id:form.dataset.id,application:Number(f.application),barrier:f.barrier||'',evidence:f.evidence||'',action:f.action||''};message='kp7-transfer-message'}
  void api('kirkpatrick/v7/'+path,body).then(result=>{
   if(form.id==='kp7-transfer-form'){toast('Acompanhamento concluído.');void load();return}
   if(message){document.getElementById(message).textContent=form.id==='kp7-assign-form'?result.created+' atribuições realizadas; '+result.skipped+' sem líder elegível.':'Registro salvo com sucesso.'}
   if(form.id==='kp7-outcome-form'){form.reset();void refreshSummary()}
  }).catch(error=>{if(message)document.getElementById(message).textContent=error.message}).finally(()=>{send.disabled=false})
 },true)
})()
