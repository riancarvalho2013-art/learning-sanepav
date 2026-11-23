/* DNA do Desenvolvimento — Descobertas LXP V4.
   Os eventos nunca carregam termos pesquisados, nomes ou dados pessoais. */
(() => {
 'use strict'
 const pageSaved='Minha lista',pageMetrics='Descobertas LXP'
 let mine=null,loading=false,metricData=null
 const isManager=()=>['Administrador','RH/DHO','Líder','Diretoria'].includes(d?.me?.role)
 const safe=v=>esc(v)
 const glyph=(name)=>({bookmark:'♡',saved:'♥',star:'★',open:'↗',chart:'◫'})[name]||'•'
 async function send(type,courseId){
  if(!d?.me)return
  try{await fetch('/api/discovery/v4/events',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',
   body:JSON.stringify({type,courseId,eventId:crypto.randomUUID()}),keepalive:true})}catch{} // telemetria nunca bloqueia a aprendizagem
 }
 const myEnrollment=courseId=>d?.enroll?.find(item=>item.course===courseId&&item.person===d.me.id)
 function actionFor(courseId){
  const en=myEnrollment(courseId)
  return en?'<button type="button" class="d4-button" data-act="learn" data-id="'+safe(en.id)+'">Continuar curso '+glyph('open')+'</button>':
   '<button type="button" class="d4-button" data-act="selfAssign" data-id="'+safe(courseId)+'">Começar curso '+glyph('open')+'</button>'
 }
 function favorite(courseId,isSaved,compact=false){
  return '<button type="button" class="d4-bookmark '+(isSaved?'is-saved':'')+'" data-d4="bookmark" data-course="'+safe(courseId)+'" data-saved="'+(isSaved?'true':'false')+'" aria-label="'+(isSaved?'Remover dos salvos':'Salvar curso')+'" title="'+(isSaved?'Remover dos salvos':'Salvar para depois')+'">'+glyph(isSaved?'saved':'bookmark')+(compact?'':' <span>'+(isSaved?'Salvo':'Salvar')+'</span>')+'</button>'
 }
 function courseCard(course){
  const badge=course.completed?'<span class="d4-status">Concluído</span>':''
  const track=course.track||'DNA do Desenvolvimento'
  return '<article class="d4-course"><div class="d4-course-top"><span class="d4-kicker">'+safe(track)+'</span>'+favorite(course.id,course.bookmarked,true)+'</div>'+badge+
   '<h3>'+safe(course.title)+'</h3><p>'+safe(course.type||'Conteúdo')+(course.minutes?' · '+safe(course.minutes)+' min':'')+'</p><div class="d4-actions">'+actionFor(course.id)+'</div></article>'
 }
 const empty=(title,subtitle)=>'<section class="d4-empty"><span aria-hidden="true">✧</span><h3>'+safe(title)+'</h3><p>'+safe(subtitle)+'</p></section>'
 const header=(title,subtitle)=>'<div class="d4-header"><div><span class="d4-over">DNA DO DESENVOLVIMENTO · LXP</span><h1>'+safe(title)+'</h1><p>'+safe(subtitle)+'</p></div><button type="button" data-act="nav" data-id="Catálogo LMS" class="d4-outline">Explorar catálogo ↗</button></div>'
 async function loadMine(){return await api('discovery/v4/mine')}
 async function renderMine(){
  const root=document.getElementById('inside');if(!root)return
  root.innerHTML='<section class="d4-screen">'+header('Minha lista','Seus conteúdos salvos, recomendações por afinidade de trilha e avaliações de aprendizagem.')+'<div class="d4-loading">Carregando sua jornada…</div></section>'
  try{
   mine=await loadMine()
   if(page!==pageSaved)return
   const indexed=new Map(mine.catalog.map(c=>[c.id,c]))
   const saved=mine.bookmarks.map(b=>indexed.get(b.courseId)).filter(Boolean)
   const recommended=mine.recommendations.map(x=>indexed.get(x.courseId)).filter(Boolean)
   const rated=mine.catalog.filter(c=>c.completed)
   root.innerHTML='<section class="d4-screen">'+header('Minha lista','Seu espaço de descobertas e aprendizagem autônoma.')+
    '<section class="d4-section"><div class="d4-section-head"><h2>Salvos para depois</h2><span>'+saved.length+' curso(s)</span></div>'+
      (saved.length?'<div class="d4-grid">'+saved.map(courseCard).join('')+'</div>':empty('Sua lista está vazia','No catálogo, selecione o coração para guardar um curso.'))+'</section>'+
    '<section class="d4-section"><div class="d4-section-head"><h2>Explore novos conteúdos</h2><span>Por afinidade de trilhas já concluídas</span></div>'+
     (recommended.length?'<div class="d4-grid">'+recommended.map(courseCard).join('')+'</div>':empty('Sem novas sugestões','As recomendações aparecerão quando houver novos cursos publicados.'))+'</section>'+
    '<section class="d4-section"><div class="d4-section-head"><h2>Avalie o que aprendeu</h2><span>Somente cursos concluídos</span></div>'+
      (rated.length?'<div class="d4-rating-list">'+rated.map(c=>'<div class="d4-rating-row"><div><strong>'+safe(c.title)+'</strong><small>Seu feedback ajuda a melhorar os conteúdos</small></div><div class="d4-stars" role="group" aria-label="Avalie '+safe(c.title)+' de 1 a 5">'+Array.from({length:5},(_,i)=>'<button type="button" data-d4="rate" data-course="'+safe(c.id)+'" data-score="'+(i+1)+'" aria-label="'+(i+1)+' estrela(s)" class="'+(c.myRating>=i+1?'selected':'')+'">★</button>').join('')+'</div></div>').join('')+'</div>':empty('Nenhuma conclusão registrada','Conclua um curso para poder avaliá-lo.'))+'</section></section>'
  }catch(error){if(page===pageSaved)root.innerHTML='<section class="d4-screen">'+header('Minha lista','')+empty('Não foi possível carregar',error.message)+'</section>'}
 }
 const nf=n=>new Intl.NumberFormat('pt-BR').format(n||0)
 const colors={catalog_viewed:'Visualizações do catálogo',search_performed:'Pesquisas feitas',lesson_launch_requested:'Cliques para abrir aulas'}
 async function renderMetrics(){
  const root=document.getElementById('inside');if(!root)return
  if(!isManager()){root.innerHTML=empty('Acesso restrito','Somente gestores autorizados podem consultar indicadores da LXP.');return}
  const from=new Date(Date.now()-29*86400000).toISOString().slice(0,10),to=new Date().toISOString().slice(0,10)
  root.innerHTML='<section class="d4-screen">'+header('Descobertas e engajamento','Eventos de aprendizagem registrados a partir da instalação desta versão.')+
   '<form id="d4-metrics-filter" class="d4-filter"><label>De<input type="date" name="from" value="'+from+'" required></label><label>Até<input type="date" name="to" value="'+to+'" required></label><button class="d4-button" type="submit">Aplicar filtros</button></form><div id="d4-metrics">Carregando indicadores…</div></section>'
  await loadMetrics(from,to)
 }
 async function loadMetrics(from,to){
  const area=document.getElementById('d4-metrics');if(!area)return
  area.textContent='Consultando eventos autorizados…'
  try{
   const qs=new URLSearchParams({from,to})
   // Respeita o contexto organizacional escolhido na navegação existente.
   if(typeof organizationCompany==='string'&&organizationCompany)qs.set('company',organizationCompany)
   metricData=await api('discovery/v4/metrics?'+qs.toString())
   if(page!==pageMetrics)return
   if(metricData.suppressed){area.innerHTML=empty('Amostra insuficiente',metricData.reason);return}
   const m=metricData.metrics;const byType=m.eventsByType||{}
   const cells=[['Pessoas com interação',m.activePeople],['Visualizações de catálogo',byType.catalog_viewed?.events||0],['Cliques para abrir aulas',byType.lesson_launch_requested?.events||0],['Favoritos ativos',m.bookmarksCurrent],['Avaliações registradas',m.ratingsCurrent],['Nota média',m.averageRating===null?'Sem dados':m.averageRating+' / 5']]
   area.innerHTML='<div class="d4-kpis">'+cells.map(([title,value])=>'<article><small>'+safe(title)+'</small><b>'+safe(typeof value==='number'?nf(value):value)+'</b></article>').join('')+'</div>'+
    '<section class="d4-section"><div class="d4-section-head"><h2>Eventos por tipo</h2><span>Fonte: dados de interação efetivamente registrados</span></div><div class="d4-table-wrap"><table class="d4-table"><thead><tr><th>Evento</th><th>Ocorrências</th><th>Pessoas únicas</th></tr></thead><tbody>'+
     Object.entries(colors).map(([key,label])=>'<tr><td>'+safe(label)+'</td><td>'+nf(byType[key]?.events||0)+'</td><td>'+nf(byType[key]?.people||0)+'</td></tr>').join('')+'</tbody></table></div></section>'+
    '<section class="d4-section"><div class="d4-section-head"><h2>Histórico de engajamento</h2><span>UTC · sem identificação individual</span></div><div class="d4-table-wrap"><table class="d4-table"><thead><tr><th>Data</th><th>Interações</th><th>Pessoas únicas</th></tr></thead><tbody>'+(metricData.trend.length?metricData.trend.map(x=>'<tr><td>'+safe(x.day)+'</td><td>'+nf(x.events)+'</td><td>'+nf(x.people)+'</td></tr>').join(''):'<tr><td colspan="3">Ainda não há eventos nesse período.</td></tr>')+'</tbody></table></div></section>'+
    '<p class="d4-disclaimer">A série começa na instalação do módulo. Não são fabricados eventos históricos. A composição das equipes considera vínculos organizacionais atuais. Recortes com menos de cinco pessoas são ocultados.</p>'
  }catch(error){area.innerHTML=empty('Falha na consulta',error.message)}
 }
 function addNav(){
  const nav=document.querySelector('aside nav');if(!nav||!d?.me)return
  for(const [label,icon] of [[pageSaved,'♡'],...(isManager()?[[pageMetrics,'◫']]:[])]){
   if(nav.querySelector('button[data-id="'+label+'"]'))continue
   const button=document.createElement('button');button.type='button';button.dataset.act='nav';button.dataset.id=label
   button.className=page===label?'sel':'';button.innerHTML='<span class="ico" aria-hidden="true">'+icon+'</span>'+safe(label)
   nav.append(button)
  }
 }
 function decorateCatalog(){
  if(page!=='Catálogo LMS')return
  for(const card of document.querySelectorAll('.learning-card[data-direct]')){
   if(card.querySelector('[data-d4="bookmark"]'))continue
   const id=card.dataset.direct
   if(!d?.courses?.some(c=>c.id===id&&(c.status||'published')==='published'))continue
   const fav=mine?.bookmarks?.some(x=>x.courseId===id)
   const wrap=document.createElement('div');wrap.className='d4-card-bookmark';wrap.innerHTML=favorite(id,Boolean(fav),true)
   card.appendChild(wrap)
  }
 }
 const oldBody=body
 body=function(...args){
  if(page===pageSaved){void renderMine();return}
  if(page===pageMetrics){void renderMetrics();return}
  const result=oldBody(...args)
  if(page==='Catálogo LMS'){decorateCatalog();void loadMine().then(x=>{mine=x;if(page==='Catálogo LMS')for(const btn of document.querySelectorAll('.d4-card-bookmark button')){const fav=mine.bookmarks.some(r=>r.courseId===btn.dataset.course);btn.dataset.saved=String(fav);btn.classList.toggle('is-saved',fav);btn.textContent=fav?'♥':'♡';btn.setAttribute('aria-label',fav?'Remover dos salvos':'Salvar curso')}}).catch(()=>{})}
  return result
 }
 const oldDraw=draw
 draw=function(...args){const result=oldDraw(...args);addNav();return result}
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-d4]')
  if(button){event.preventDefault();event.stopPropagation();const id=button.dataset.course
   if(button.dataset.d4==='bookmark'){
    if(loading)return;loading=true
    void api('discovery/v4/bookmarks',{courseId:id,bookmarked:button.dataset.saved!=='true'})
     .then(()=>loadMine()).then(data=>{mine=data;if(page===pageSaved)void renderMine();else{const saved=mine.bookmarks.some(x=>x.courseId===id);for(const b of document.querySelectorAll('[data-d4="bookmark"][data-course="'+id+'"]')){b.dataset.saved=String(saved);b.classList.toggle('is-saved',saved);b.textContent=saved?'♥':'♡'}}})
     .catch(e=>toast(e.message)).finally(()=>{loading=false})
   }
   if(button.dataset.d4==='rate'){
    void api('discovery/v4/ratings',{courseId:id,score:Number(button.dataset.score)}).then(()=>renderMine()).catch(e=>toast(e.message))
   }
   return
  }
  const nav=event.target.closest('[data-act="nav"]');if(nav?.dataset.id==='Catálogo LMS')void send('catalog_viewed')
  const launch=event.target.closest('[data-act="learn"]');if(launch){const courseId=d?.enroll?.find(x=>x.id===launch.dataset.id)?.course;if(courseId)void send('lesson_launch_requested',courseId)}
 },true)
 document.addEventListener('submit',event=>{if(event.target.id!=='d4-metrics-filter')return;event.preventDefault();const data=new FormData(event.target);void loadMetrics(String(data.get('from')),String(data.get('to')))},true)
 document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.id==='query'&&event.target.value.trim())void send('search_performed')},true)
})()
