/* Learning Sanepav | DNA SCORM Classroom V3
 * Adds a dedicated player without replacing the existing learning/certification UI.
 */
(() => {
 'use strict'
 const $=id=>document.getElementById(id)
 const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))
 const glyph=(name)=>'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+({
  arrow:'<path d="m14 18-6-6 6-6"/>',refresh:'<path d="M3 12a9 9 0 1 0 3-7M3 3v6h6"/>',
  shield:'<path d="M12 2 3 6v6c0 5 3 8 9 10 6-2 9-5 9-10V6Z"/><path d="m8 12 3 3 5-6"/>',
  check:'<path d="m4 12 5 5 11-11"/>',warning:'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v1"/>',
  book:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8m-8 4h8"/>',
  chart:'<path d="M4 20v-7m6 7V9m6 11V4m4 16H2"/>',fullscreen:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>'
 }[name]||'')+'</svg>'
 const wait=label=>'<span class="scorm-v3-spin" aria-hidden="true"></span> '+escapeHTML(label)
 const route='/api/scorm/v3/'
 const state={enrollment:null,course:null,launch:null,pending:null,queue:Promise.resolve(),timer:null,keepalive:null,opened:false,completion:0,version:0,events:0}
 const getCourse=id=>{
  const enrol=(typeof d!=='undefined'?d?.enroll||[]:[]).find(en=>en.id===id)
  const course=(typeof d!=='undefined'?d?.courses||[]:[]).find(c=>c.id===enrol?.course)
  return {enrol,course}
 }
 const asApi=async path=>{
  const response=await fetch(route+path,{credentials:'same-origin',cache:'no-store'})
  const data=await response.json().catch(()=>({error:'Resposta inesperada do Learning.'}))
  if(!response.ok)throw Error(data.error||'Não foi possível carregar o curso.')
  return data
 }
 function updateState(text,bad=false){
  const status=$('scormV3Status')
  if(status){status.textContent=text;status.classList.toggle('scorm-v3-error',bad)}
 }
 function updateProgress(progress){
  const n=Math.max(0,Math.min(100,Number(progress)||0))
  state.completion=n
  const label=$('scormV3Progress');if(label)label.textContent=n+'% concluído'
  const bar=$('scormV3ProgressBar');if(bar)bar.style.width=n+'%'
 }
 function button(id,label,icon){return '<button type="button" class="scorm-v3-btn" data-scorm-action="'+id+'">'+glyph(icon)+'<span>'+escapeHTML(label)+'</span></button>'}
 function pageHTML(course,enrol){
  const title=course?.title||'Conteúdo SCORM'
  return '<div class="lxp-lesson-top" style="display:none!important" aria-hidden="true"></div><section class="scorm-v3-room" aria-label="Sala de aula SCORM">'+
   '<header class="scorm-v3-top"><div class="scorm-v3-eyebrow">DNA DO DESENVOLVIMENTO <span>/</span> SALA DE AULA</div>'+
   '<div class="scorm-v3-top-grid"><div><p class="scorm-v3-kicker">Aprenda no seu ritmo</p><h1>'+escapeHTML(title)+'</h1><p class="scorm-v3-meta">'+escapeHTML(course?.track||'Trilha de aprendizagem')+' · '+escapeHTML(course?.minutes||'—')+' min de duração</p></div>'+
   '<div class="scorm-v3-progress"><span id="scormV3Progress">'+(enrol?.progress||0)+'% concluído</span><div class="scorm-v3-bar"><i id="scormV3ProgressBar" style="width:'+(enrol?.progress||0)+'%"></i></div></div></div></header>'+
   '<div class="scorm-v3-toolbar"><div class="scorm-v3-toolbar-left"><span class="scorm-v3-module">'+glyph('book')+' Conteúdo interativo</span><span class="scorm-v3-safe">'+glyph('shield')+' Aprendizagem protegida</span></div>'+button('diagnose','Diagnóstico','chart')+button('reload','Recarregar aula','refresh')+button('close','Voltar ao Learning','arrow')+'</div>'+
   '<div class="scorm-v3-canvas"><div class="scorm-v3-loader" id="scormV3Loading">'+wait('Preparando ambiente da aula…')+'<small>Validando o pacote e seus materiais</small></div><iframe id="scormV3Frame" title="'+escapeHTML(title)+'" sandbox="allow-scripts allow-forms" allow="fullscreen; autoplay" referrerpolicy="no-referrer" hidden></iframe></div>'+
   '<footer class="scorm-v3-bottom"><div class="scorm-v3-status" id="scormV3Status" role="status">O progresso será registrado conforme o conteúdo enviar os resultados.</div><span>SCORM 1.2 / 2004 · DNA Learning</span></footer>'+ 
   '<details class="scorm-v3-help" id="scormV3Help"><summary>O treinamento não abriu corretamente?</summary><p>Use Diagnóstico para verificar os arquivos essenciais do pacote. Se uma aula não relatar conclusão, confirme se a exportação do conteúdo utiliza um SCO e a comunicação SCORM 1.2 ou 2004. Algumas ferramentas exigem configurações específicas na exportação.</p><div id="scormV3Diagnostics"></div></details></section>'
 }
 async function getLaunch(){
  const stateAtLaunch=state.version
  try{
   const data=await asApi('launch?enrollment='+encodeURIComponent(state.enrollment.id))
   if(!state.opened||stateAtLaunch!==state.version)return
   state.launch=data
   const frame=$('scormV3Frame')
   if(!frame)return
   frame.onload=()=>{
    if(!state.opened||stateAtLaunch!==state.version)return
    const loading=$('scormV3Loading');if(loading)loading.hidden=true
    frame.hidden=false
    updateState('Aula aberta. Aguardando comunicação de progresso do SCORM.')
   }
   frame.src=data.url
   state.keepalive=setInterval(async()=>{
    if(!state.opened||!state.launch)return
    try{await asApi('keepalive?token='+encodeURIComponent(state.launch.url.split('/')[3]))}catch(error){updateState('Sessão expirada. Recarregue a aula para continuar.',true)}
   },9*60*1000)
  }catch(error){
   if(!state.opened)return
   const loading=$('scormV3Loading')
   if(loading)loading.innerHTML='<div class="scorm-v3-failure">'+glyph('warning')+'<h3>Não foi possível abrir o pacote</h3><p>'+escapeHTML(error.message)+'</p>'+button('reload','Tentar novamente','refresh')+'</div>'
   updateState(error.message,true)
  }
 }
 function flush(){
  if(state.timer){clearTimeout(state.timer);state.timer=null}
  const values=state.pending;state.pending=null
  if(!values||!state.opened||state.launch?.preview||!state.enrollment)return state.queue
  const launch=state.launch,enrollmentId=state.enrollment.id,version=state.version
  if(!launch)return state.queue
  state.queue=state.queue.catch(()=>{}).then(async()=>{
   const payload=JSON.stringify(values)
   if(payload.length>88000)throw Error('O progresso SCORM ultrapassou o limite de armazenamento.')
   const result=await api('scorm/v3/commit',{id:enrollmentId,token:launch.url.split('/')[3],key:launch.key,cmi:values})
   if(state.version!==version||!state.opened)return
   updateProgress(result.progress)
   updateState('Progresso sincronizado às '+new Date().toLocaleTimeString('pt-BR')+(result.pendingAssessment?' · Avaliação final pendente':result.progress===100?' · Curso concluído':'')+'.')
  }).catch(error=>{if(state.version===version&&state.opened){if(!state.pending)state.pending=values;updateState('Não foi possível salvar o progresso: '+error.message+'. Tente novamente antes de fechar.',true)}})
  return state.queue
 }
 function queueCMI(value,urgent){
  state.pending=value
  if(state.timer)clearTimeout(state.timer)
  if(urgent)void flush()
  else state.timer=setTimeout(flush,420)
 }
 window.addEventListener('message',ev=>{
  if(!state.opened||!state.launch)return
  if(ev.origin!=='null'&&ev.origin!==location.origin)return
  const frame=$('scormV3Frame');if(!frame?.contentWindow||!ev.source)return
  let source=ev.source,belongs=false;try{for(let i=0;i<16;i++){if(source===frame.contentWindow){belongs=true;break}const parent=source.parent;if(!parent||parent===source)break;source=parent}}catch{}
  if(!belongs)return
  if(!ev.data||ev.data.key!==state.launch.key)return
  if(ev.data.type==='DNA_SCORM_READY_V3'){
   state.events++;updateState('Runtime SCORM conectado. Execute as atividades para registrar o progresso.')
  }
  if(ev.data.type==='DNA_SCORM_COMMIT_V3'){
   if(!ev.data.values||typeof ev.data.values!=='object'||Array.isArray(ev.data.values))return
   const safe={}
   for(const [key,value] of Object.entries(ev.data.values))if(key.startsWith('cmi.')&&key.length<=160&&typeof value==='string'&&value.length<=(key==='cmi.suspend_data'?64000:4000))safe[key]=value
   state.events++;queueCMI(safe,ev.data.op==='commit')
  }
 })
 async function closeRoom(){
  if(!state.opened)return
  await flush()
  if(state.pending){updateState('Há progresso não sincronizado. Tente recarregar a aula somente após salvar.',true);return}
  if(state.keepalive){clearInterval(state.keepalive);state.keepalive=null}
  state.opened=false;state.version++
  state.launch=null;state.enrollment=null;state.course=null;state.pending=null
  const modal=$('modal');if(modal?.open)modal.close()
  try{if(typeof refresh==='function')await refresh()}catch(err){if(typeof toast==='function')toast(err.message)}
 }
 async function openRoom(id){
  const {enrol,course}=getCourse(id)
  if(!enrol||!course||course.type!=='SCORM')return false
  if(course.blockedBy?.length){if(typeof toast==='function')toast('Conclua as etapas anteriores para abrir este treinamento.');return true}
  if(state.opened){await closeRoom();if(state.opened)return true}
  state.opened=true;state.version++
  state.enrollment=enrol;state.course=course;state.launch=null;state.pending=null;state.queue=Promise.resolve();state.events=0
  const modal=$('modal');if(!modal)return true
  modal.classList.add('lxp-immersive','scorm-v3-dialog')
  document.body.classList.add('lxp-reading')
  $('modalBody').innerHTML=pageHTML(course,enrol)
  if(!modal.open)modal.showModal()
  void getLaunch()
  return true
 }
 const previousLearn=typeof learn==='function'?learn:null
 if(previousLearn){
  learn=function(id){
   const {course}=getCourse(id)
   if(course?.type==='SCORM'){void openRoom(id);return}
   return previousLearn(id)
  }
 }
 async function diagnostics(){
  if(!state.course)return
  const box=$('scormV3Diagnostics'),details=$('scormV3Help')
  if(details)details.open=true
  if(box)box.innerHTML='<p>'+wait('Verificando arquivos…')+'</p>'
  try{
   const d=await asApi('diagnostics?course='+encodeURIComponent(state.course.id))
   if(!box)return
   box.innerHTML='<p><strong>Versão:</strong> '+escapeHTML(d.version)+'</p><p><strong>Arquivo inicial:</strong> '+escapeHTML(d.entry)+(d.entryExists?' ✓':' (não encontrado)')+'</p>'+ 
    '<p><strong>Manifesto:</strong> '+(d.manifestExists?'encontrado':'não encontrado')+'</p>'+ 
    (d.missingResources.length?'<p class="scorm-v3-error">Recursos não encontrados: '+escapeHTML(d.missingResources.join(', '))+'</p>':'<p>Não foram encontrados recursos ausentes nas referências diretas do HTML inicial.</p>')+
    '<small>'+escapeHTML(d.advisory)+'</small>'
  }catch(err){if(box)box.textContent=err.message}
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-scorm-action]')
  if(!button)return
  event.preventDefault()
  const {scormAction}=button.dataset
  if(scormAction==='close')void closeRoom()
  if(scormAction==='reload'){if(state.opened){const frame=$('scormV3Frame');if(frame){frame.hidden=true;frame.src='about:blank'}const loading=$('scormV3Loading');if(loading){loading.hidden=false;loading.innerHTML=wait('Reiniciando conteúdo…')}if(state.keepalive)clearInterval(state.keepalive);void flush().then(getLaunch)}}
  if(scormAction==='diagnose')void diagnostics()
 })
 $('modal')?.addEventListener('close',()=>{
  if(state.opened){void flush().finally(()=>{state.opened=false;state.version++;if(state.keepalive)clearInterval(state.keepalive);state.launch=null})}
  $('modal')?.classList.remove('scorm-v3-dialog')
 })
 window.addEventListener('pagehide',()=>{if(state.opened)void flush()})
})()
