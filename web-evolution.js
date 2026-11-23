/* Learning Sanepav · DNA do Desenvolvimento — UI and product extension.
   No external scripts or copied Open edX components. Works with the existing vanilla JS app. */
(() => {
'use strict'
const companyBrandFallback={title:'Learning Sanepav',subtitle:'DNA do Desenvolvimento',color:'#176bc1',accent:'#61c5f8',logoVersion:''}
let dnaBrand={...companyBrandFallback},dnaCompany='',dnaTemplateTrack='',dnaBrandRequest=0
const iconPaths={
 'Painel':'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
 'Catálogo LMS':'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
 'Missões':'<path d="M4 4h16M4 4v16m0-2h16M8 8h9M8 12h6"/><path d="m16 17 2 2 3-4"/>',
 'Relatórios':'<path d="M4 20V10m6 10V4m6 16v-7m5 7H3"/>',
 'PDI':'<path d="M5 20h14M7 16l5-10 5 10M8.5 13h7"/>',
 'OKR':'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 '1:1':'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
 'Feedback':'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-1 3v-6A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 10h8M8 14h5"/>',
 'Elogio':'<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 3 1.1-6.2L3 9.7l6.2-.9Z"/>',
 'Pulse':'<path d="M2 12h4l3-6 5 12 3-6h5"/>',
 'Desempenho':'<path d="m3 17 6-6 4 3 8-9M16 5h5v5"/><path d="M3 21h18"/>',
 'Rede social':'<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M8 9h8M8 13h5"/>',
 'Meu perfil':'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 'Indicadores estratégicos':'<path d="M3 3v18h18M7 15l4-4 3 2 5-7"/>',
 'Organograma':'<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v5H5v5m7-5h7v5"/>',
 'Estrutura organizacional':'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
 'Evolução da plataforma':'<path d="M4 19h16M6 16l4-5 3 2 5-8M14 5h4v4"/>',
 'Matriz 9 Box':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m6-18v18M3 9h18M3 15h18"/>',
 'Pessoas':'<circle cx="9" cy="7" r="4"/><path d="M2 20v-2a7 7 0 0 1 14 0v2M19 7v6M16 10h6"/>',
 'Identidade visual':'<path d="M12 3a9 9 0 1 0 0 18 2 2 0 0 0 2-3 2 2 0 0 1 2-3h2a3 3 0 0 0 3-3 9 9 0 0 0-9-9Z"/><circle cx="7" cy="11" r="1"/><circle cx="11" cy="7" r="1"/><circle cx="17" cy="9" r="1"/>',
 'Auditoria':'<path d="M8 3h8l4 4v14H4V3h4M8 11h8M8 15h8M8 7h3"/>',
 'Caderno de notas':'<path d="M4 5h16v14H4zM4 10h16M10 10v9M14 10v9"/>',
 'Certificados':'<rect x="4" y="3" width="16" height="14" rx="2"/><path d="m9 17-1 5 4-2 4 2-1-5M8 8h8M8 12h6"/>',
 'Marca por empresa':'<path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z"/><path d="M3 7l9 5 9-5M12 12v10"/>'
}
function svg(name){return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">'+(iconPaths[name]||iconPaths['Painel'])+'</svg>'}
function currentCompany(){
 if(typeof organizationCompany==='string'&&organizationCompany)return organizationCompany
 const mine=typeof currentAssignment==='function'?currentAssignment():null
 return mine?.company_id||organizationData?.companies?.[0]?.id||''
}
function brandCss(){
 const primary= /^#[\da-f]{6}$/i.test(dnaBrand.color)?dnaBrand.color:'#176bc1'
 const accent= /^#[\da-f]{6}$/i.test(dnaBrand.accent)?dnaBrand.accent:'#61c5f8'
 document.documentElement.style.setProperty('--brand',primary)
 document.documentElement.style.setProperty('--accent',accent)
 document.documentElement.style.setProperty('--dna-primary',primary)
 document.documentElement.style.setProperty('--dna-accent',accent)
}
function brandMedia(company){return '/api/evo/brand/logo?company='+encodeURIComponent(company)+'&v='+encodeURIComponent(dnaBrand.logoVersion||'')}
function applyBrand(){
 brandCss()
 if(!document.querySelector('.shell'))return
 const el=document.querySelector('aside .brand')
 if(el){
   el.innerHTML=(dnaBrand.logoVersion&&dnaCompany?'<img src="'+esc(brandMedia(dnaCompany))+'" alt="Logo" onerror="this.src=\'/marca.png\'">':'<img src="/marca.png" alt="Logo">')+
     '<span class="dna-brand-copy"><strong>'+esc(dnaBrand.title)+'</strong><small>'+esc(dnaBrand.subtitle||'DNA do Desenvolvimento')+'</small></span>'
 }
 const head=document.querySelector('header .breadcrumb')
 if(head)head.textContent=(dnaBrand.title||'Learning Sanepav')+' / '+page
 document.title=(dnaBrand.title||'Learning Sanepav')+' · '+page
}
async function syncBrand(target=currentCompany()){
 if(!d?.me||!target){dnaBrand={...companyBrandFallback};dnaCompany='';applyBrand();return}
 const req=++dnaBrandRequest
 try{
  const response=await api('evo/brand?company='+encodeURIComponent(target))
  if(req!==dnaBrandRequest)return
  dnaBrand=response;dnaCompany=target;applyBrand()
 }catch(e){if(req===dnaBrandRequest){dnaBrand={...companyBrandFallback};dnaCompany='';applyBrand()}}
}
function decorateNav(){
 const navEl=document.querySelector('aside nav')
 if(!navEl)return
 // One canonical enterprise branding entry replaces the legacy global-theme editor.
 for(const old of navEl.querySelectorAll('button[data-id="Identidade visual"]'))old.remove()
 function append(label){
   if([...navEl.querySelectorAll('button')].some(node=>node.dataset.id===label))return
   const button=document.createElement('button')
   button.dataset.act='nav';button.dataset.id=label
   button.className=page===label?'sel':''
   button.innerHTML='<span class="ico"></span>'+esc(label)
   navEl.appendChild(button)
 }
 append('Certificados')
 if(typeof manager==='function'&&manager())append('Caderno de notas')
 if(d?.me?.role==='Administrador')append('Marca por empresa')
 for(const button of navEl.querySelectorAll('button')){
  const label=button.dataset.id
  if(!label)continue
  const ico=button.querySelector('.ico')
  if(ico)ico.innerHTML=svg(label)
  if(label==='Missões'){
    const texts=[...button.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE)
    if(texts.length)texts.at(-1).textContent='Trilhas de aprendizagem'
  }
 }
}
function enhanceCourses(){
 if(page!=='Catálogo LMS'||d?.me?.role!=='Administrador')return
 for(const card of document.querySelectorAll('.learning-card[data-direct]')){
   if(card.querySelector('[data-act="evo-delete-course"]'))continue
   const course=d.courses.find(c=>c.id===card.dataset.direct)
   if(!course)continue
   const wrap=document.createElement('div');wrap.className='dna-admin-actions'
   wrap.innerHTML='<button type="button" data-act="evo-delete-course" data-id="'+esc(course.id)+'" data-revision="'+esc(course.revision||0)+'">Excluir curso sem vínculos</button>'
   card.appendChild(wrap)
 }
}
function afterDraw(){decorateNav();applyBrand();enhanceCourses()}
const originalDraw=draw
draw=function(){originalDraw();afterDraw()}
const originalBody=body
body=function(){
 if(page==='Painel'){renderDNAHome();return}
 if(page==='Certificados'){void renderDNACertificates();return}
 if(page==='Caderno de notas'&&manager()){renderDNAGradebook();return}
 if(page==='Marca por empresa'&&d?.me?.role==='Administrador'){void renderDNASettings();return}
 originalBody();enhanceCourses()
}
const originalRefresh=refresh
refresh=async function(...args){const result=await originalRefresh(...args);await syncBrand();return result}
const originalTheme=theme
theme=function(t){originalTheme(t);brandCss()}

function renderDNAHome(){
 const root=$('inside');if(!root||!d?.me)return
 const myEnrollments=d.enroll.filter(e=>e.person===d.me.id)
 const complete=myEnrollments.filter(e=>e.progress===100)
 const ongoing=myEnrollments.filter(e=>e.progress<100)
 const next=ongoing.find(e=>d.courses.some(c=>c.id===e.course&&!c.blockedBy?.length))||ongoing[0]
 const pct=myEnrollments.length?Math.round(complete.length/myEnrollments.length*100):0
 const name=d.me.name?.split(' ')[0]||'Você'
 const overdue=ongoing.filter(e=>e.due&&e.due<new Date().toISOString().slice(0,10)).length
 const featured=d.courses.filter(c=>c.status==='published').slice(0,3)
 let h='<div class="dna-home"><section class="dna-hero"><div><span class="dna-eyebrow">✦ DNA DO DESENVOLVIMENTO</span><h1>Seu próximo passo começa aqui, '+esc(name)+'.</h1><p>Um espaço para descobrir novas habilidades, construir sua trajetória e compartilhar conquistas com o time.</p><div class="dna-hero-actions">'+btn('Explorar cursos','nav','Catálogo LMS','primary')+btn('Minhas trilhas','nav','Missões')+'</div></div><div class="dna-hero-orbit" aria-hidden="true"><div class="orbit orbit-a"></div><div class="orbit orbit-b"></div><span>'+pct+'<small>%</small></span><em>jornada concluída</em></div></section>'+
 '<div class="dna-metrics"><article class="dna-metric"><span class="dna-metric-icon">'+svg('Catálogo LMS')+'</span><small>Na sua jornada</small><strong>'+myEnrollments.length+'</strong><span>cursos atribuídos</span></article><article class="dna-metric"><span class="dna-metric-icon">'+svg('Certificados')+'</span><small>Conquistas</small><strong>'+complete.length+'</strong><span>conclusões elegíveis</span></article><article class="dna-metric"><span class="dna-metric-icon">'+svg('Desempenho')+'</span><small>Em andamento</small><strong>'+ongoing.length+'</strong><span>oportunidades de aprender</span></article><article class="dna-metric"><span class="dna-metric-icon">'+svg('Pulse')+'</span><small>Seu ritmo</small><strong>'+overdue+'</strong><span>prazo(s) vencido(s)</span></article></div>'+
 '<div class="dna-home-columns"><section class="dna-surface"><div class="dna-section-head"><div><span class="dna-eyebrow">SEU FOCO</span><h2>Continue de onde parou</h2></div></div>'+
 (next?(()=>{const c=d.courses.find(item=>item.id===next.course);return '<div class="dna-next"><div class="dna-next-icon">'+svg('Missões')+'</div><div><small>'+esc(c?.track||'Aprendizagem')+'</small><h3>'+esc(c?.title||'Curso')+'</h3><p>'+esc(c?.type||'Conteúdo')+' · '+(c?.minutes||0)+' minutos</p>'+bar(next.progress)+'<small>'+next.progress+'% concluído</small></div><div>'+btn(c?.blockedBy?.length?'Ver trilha':'Retomar','nav',c?.blockedBy?.length?'Missões':'Catálogo LMS','primary')+'</div></div>'})(): '<div class="dna-empty-illustration">'+svg('Catálogo LMS')+'<h3>Uma nova jornada está por vir</h3><p>Seus cursos atribuídos aparecerão aqui, com acesso rápido a cada etapa.</p>'+btn('Visitar catálogo','nav','Catálogo LMS')+'</div>')+
 '</section><section class="dna-surface dna-community"><span class="dna-eyebrow">EVOLUÇÃO CONTÍNUA</span><h2>Desenvolver é transformar</h2><p>Aprendizagem, conversas significativas e reconhecimento fazem parte da mesma jornada.</p><div class="dna-quicklinks">'+[['PDI','Meu plano de desenvolvimento'],['1:1','Conversas com a liderança'],['Certificados','Minhas conquistas']].map(([target,label])=>'<button type="button" data-act="nav" data-id="'+esc(target)+'">'+svg(target)+'<span>'+esc(label)+'</span><b aria-hidden="true">→</b></button>').join('')+'</div></section></div>'+
 '<section class="dna-featured"><div class="dna-section-head"><div><span class="dna-eyebrow">EXPLORE</span><h2>Aprenda algo novo</h2></div>'+btn('Ver catálogo completo','nav','Catálogo LMS')+'</div><div class="dna-featured-grid">'+(featured.map(c=>'<article class="dna-featured-card"><span class="dna-course-visual">'+svg('Catálogo LMS')+'</span><small>'+esc(c.track||'Aprendizagem')+'</small><h3>'+esc(c.title)+'</h3><p>'+esc(c.description||c.type)+' · '+c.minutes+' min</p>'+btn('Conhecer curso','nav','Catálogo LMS')+'</article>').join('')||'<p>As novidades do catálogo aparecerão aqui assim que forem publicadas.</p>')+'</div></section></div>'
 root.innerHTML=h
}
function dnaLogoPreview(){return dnaBrand.logoVersion&&dnaCompany?'<img class="dna-logo-img" src="'+esc(brandMedia(dnaCompany))+'" alt="Logo atual">':'<div class="dna-logo-placeholder">'+svg('Marca por empresa')+'<span>Sem logo personalizada</span></div>'}
function dnaCompanies(){return organizationData?.companies||[]}
function dnaCompanySelector(selected=dnaCompany||currentCompany()){
 return '<label class="dna-label">Empresa vinculada <select id="dnaCompanySelect">'+dnaCompanies().map(c=>'<option value="'+esc(c.id)+'"'+(c.id===selected?' selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></label>'
}
async function renderDNASettings(companyOverride){
 const root=$('inside');if(!root||page!=='Marca por empresa')return
 const companies=dnaCompanies(),selected=companyOverride||dnaCompany||currentCompany()||companies[0]?.id
 if(!selected){root.innerHTML='<h1>Identidade por empresa</h1><p>Cadastre uma empresa em Estrutura organizacional para configurar a marca.</p>';return}
 root.innerHTML='<section class="dna-surface"><p>Carregando personalização…</p></section>'
 let brand,tracks=d.courses.map(c=>c.track||'Catálogo geral').filter(Boolean)
 const unique=[...new Set(tracks)].sort((a,b)=>a.localeCompare(b,'pt-BR'))
 try{brand=await api('evo/brand?company='+encodeURIComponent(selected))}catch(err){root.textContent=err.message;return}
 if(page!=='Marca por empresa')return
 const previewLogo=brand.logoVersion?'<img src="/api/evo/brand/logo?company='+encodeURIComponent(selected)+'&v='+encodeURIComponent(brand.logoVersion)+'" alt="Logo atual">':'<span>Carregue a identidade visual da empresa</span>'
 root.innerHTML='<div class="dna-page-heading"><div><span class="dna-eyebrow">CONFIGURAÇÕES</span><h1>Identidade de cada empresa</h1><p>Nome, cores e logo independentes para cada organização.</p></div></div>'+
 '<div class="dna-settings-layout"><section class="dna-surface"><div class="dna-section-head"><h2>Personalização da plataforma</h2></div>'+dnaCompanySelector(selected)+'<form id="dnaBrandForm">'+
 '<label class="dna-label">Nome do Learning<input name="title" value="'+esc(brand.title)+'" maxlength="60" required></label>'+
 '<label class="dna-label">Texto complementar<input name="subtitle" value="'+esc(brand.subtitle)+'" maxlength="90"></label>'+
 '<div class="dna-settings-colors"><label class="dna-label">Cor principal<input type="color" name="color" value="'+esc(brand.color)+'"></label><label class="dna-label">Cor de destaque<input type="color" name="accent" value="'+esc(brand.accent)+'"></label></div>'+
 '<button class="primary" type="submit">Salvar identidade da empresa</button><p class="dna-inline-status" id="dnaBrandStatus" role="status"></p></form>'+
 '<div class="dna-upload-zone"><strong>Logo da organização</strong><p>PNG, JPG ou WebP. Até 4 MB. A alteração será exibida automaticamente aos usuários vinculados.</p><div class="dna-brand-logo-preview" id="dnaBrandLogo">'+previewLogo+'</div><label class="dna-upload-button">Selecionar logo<input type="file" id="dnaLogoFile" accept=".png,.jpg,.jpeg,.webp"></label><p id="dnaLogoStatus" role="status"></p></div></section>'+
 '<aside class="dna-surface dna-preview-surface"><span class="dna-eyebrow">PRÉVIA</span><div class="dna-brand-live"><span>✦ DNA DO DESENVOLVIMENTO</span><h2>'+esc(brand.title)+'</h2><p>'+esc(brand.subtitle)+'</p><div class="dna-brand-colorblocks"><i style="background:'+esc(brand.color)+'"></i><i style="background:'+esc(brand.accent)+'"></i></div></div><p class="dna-help">A escolha da empresa no cabeçalho altera a marca exibida, sem modificar a identidade das outras organizações.</p></aside></div>'+
 '<section class="dna-surface dna-template-section"><div class="dna-section-head"><div><span class="dna-eyebrow">CERTIFICAÇÃO</span><h2>Modelos por trilha de aprendizagem</h2></div></div><p>Defina fundos e identidade diferentes para cada trilha. Os certificados serão emitidos para cursos concluídos.</p>'+
 (unique.length?'<label class="dna-label">Trilha <select id="dnaTemplateTrack">'+unique.map(t=>'<option '+(t===dnaTemplateTrack?'selected ':'')+'value="'+esc(t)+'">'+esc(t)+'</option>').join('')+'</select></label><div id="dnaTemplateEditor" role="region" aria-label="Editor de certificados"></div>':'<p>Cadastre um curso e informe sua trilha para começar.</p>')+'</section>'
 const companyInput=$('dnaCompanySelect')
 if(companyInput)companyInput.onchange=()=>{dnaTemplateTrack='';void renderDNASettings(companyInput.value)}
 const form=$('dnaBrandForm')
 form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;try{
  await api('evo/brand?company='+encodeURIComponent(selected),Object.fromEntries(new FormData(form)))
  $('dnaBrandStatus').textContent='Identidade salva para esta empresa.'
  if(currentCompany()===selected)await syncBrand(selected)
 }catch(err){$('dnaBrandStatus').textContent=err.message}finally{button.disabled=false}}
 const preview=form.querySelectorAll('input');for(const input of preview)input.addEventListener('input',()=>{
  const v=Object.fromEntries(new FormData(form));const target=root.querySelector('.dna-brand-live')
  if(target)target.innerHTML='<span>✦ DNA DO DESENVOLVIMENTO</span><h2>'+esc(v.title)+'</h2><p>'+esc(v.subtitle)+'</p><div class="dna-brand-colorblocks"><i style="background:'+esc(v.color)+'"></i><i style="background:'+esc(v.accent)+'"></i></div>'
 })
 const logoFile=$('dnaLogoFile');logoFile.onchange=async()=>{
  const file=logoFile.files?.[0];if(!file)return
  if(file.size>4*1024*1024){$('dnaLogoStatus').textContent='A logo deve ter no máximo 4 MB.';return}
  const ext=file.name.split('.').at(-1).toLowerCase()
  $('dnaLogoStatus').textContent='Enviando logo…'
  try{const result=await fetch('/api/evo/brand/logo?'+new URLSearchParams({company:selected,ext}),{method:'POST',body:file})
   const response=await result.json();if(!result.ok)throw Error(response.error||'Falha no upload')
   $('dnaLogoStatus').textContent='Nova logo aplicada com sucesso.'
   $('dnaBrandLogo').innerHTML='<img src="/api/evo/brand/logo?company='+encodeURIComponent(selected)+'&v='+encodeURIComponent(response.logoVersion)+'" alt="Logo atual">'
   if(currentCompany()===selected)await syncBrand(selected)
  }catch(err){$('dnaLogoStatus').textContent=err.message}}
 const trackInput=$('dnaTemplateTrack')
 if(trackInput){if(!unique.includes(dnaTemplateTrack))dnaTemplateTrack=unique[0];trackInput.value=dnaTemplateTrack;trackInput.onchange=()=>{dnaTemplateTrack=trackInput.value;void renderDNATemplate(selected,dnaTemplateTrack)};void renderDNATemplate(selected,dnaTemplateTrack)}
}
async function renderDNATemplate(company,track){
 const element=$('dnaTemplateEditor');if(!element||!track)return
 element.innerHTML='<p>Carregando modelo…</p>'
 try{
  const data=await api('evo/certificate/template?'+new URLSearchParams({company,track}))
  if(page!=='Marca por empresa'||$('dnaTemplateTrack')?.value!==track)return
  element.innerHTML='<div class="dna-template-preview"><div><span class="dna-eyebrow">'+esc(track)+'</span><h3>Certificado de Conclusão</h3><p>Prévia do modelo de fundo</p>'+
  (data.backgroundVersion?'<img src="/api/evo/certificate/background?'+new URLSearchParams({company,track})+'&v='+encodeURIComponent(data.backgroundVersion)+'" alt="Fundo da trilha">':'<p>Sem imagem de fundo: padrão minimalista azul e branco</p>')+'</div></div><form id="dnaTemplateForm">'+
  '<label class="dna-label">Descrição do certificado<input name="subtitle" value="'+esc(data.subtitle)+'" maxlength="100" required></label><label class="dna-label">Assinatura institucional<input name="signatory" value="'+esc(data.signatory)+'" maxlength="120" required></label><label class="dna-label">Cor da trilha<input type="color" name="color" value="'+esc(data.color)+'"></label><button type="submit" class="primary">Salvar modelo da trilha</button><p id="dnaTemplateStatus" role="status"></p></form>'+
  '<div class="dna-upload-zone"><strong>Fundo personalizado do certificado</strong><p>Arquivo PNG, JPG ou WebP até 8 MB. Prefira formato horizontal.</p><label class="dna-upload-button">Selecionar imagem de fundo<input type="file" id="dnaCertificateBackground" accept=".png,.jpg,.jpeg,.webp"></label><p id="dnaBackgroundStatus" role="status"></p></div>'
  const form=$('dnaTemplateForm')
  form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;try{await api('evo/certificate/template?company='+encodeURIComponent(company),{...Object.fromEntries(new FormData(form)),track});$('dnaTemplateStatus').textContent='Modelo salvo.'}catch(error){$('dnaTemplateStatus').textContent=error.message}finally{button.disabled=false}}
  const file=$('dnaCertificateBackground')
  file.onchange=async()=>{
   const entry=file.files?.[0];if(!entry)return
   if(entry.size>8*1024*1024){$('dnaBackgroundStatus').textContent='Máximo de 8 MB.';return}
   $('dnaBackgroundStatus').textContent='Salvando fundo…'
   const ext=entry.name.split('.').at(-1).toLowerCase()
   try{const response=await fetch('/api/evo/certificate/background?'+new URLSearchParams({company,track,ext}),{method:'POST',body:entry});const value=await response.json();if(!response.ok)throw Error(value.error||'Falha no envio');$('dnaBackgroundStatus').textContent='Fundo salvo para esta trilha.';void renderDNATemplate(company,track)}catch(err){$('dnaBackgroundStatus').textContent=err.message}
  }
 }catch(err){element.textContent=err.message}
}
async function renderDNACertificates(){
 const root=$('inside');if(!root)return
 root.innerHTML='<div class="dna-page-heading"><div><span class="dna-eyebrow">CONQUISTAS</span><h1>Meus certificados</h1><p>Cada conhecimento concluído merece ser celebrado.</p></div></div><section class="dna-surface" id="dnaCertificateList">Carregando conquistas…</section>'
 try{
  const result=await api('evo/certificates')
  if(page!=='Certificados')return
  $('dnaCertificateList').innerHTML=result.items.length?'<div class="dna-cert-grid">'+result.items.map(item=>'<article class="dna-cert-card"><div class="dna-cert-icon">'+svg('Certificados')+'</div><small>'+esc(item.track)+'</small><h2>'+esc(item.courseTitle)+'</h2><p>'+esc(item.minutes)+' minutos · Concluído</p>'+
    (item.issued?'<a class="dna-btn-link" href="/api/evo/certificates/print?id='+encodeURIComponent(item.enrollmentId)+'" target="_blank" rel="noopener">Visualizar e imprimir</a>':'<button type="button" class="primary" data-act="evo-issue" data-id="'+esc(item.enrollmentId)+'">Emitir certificado</button>')+'</article>').join('')+'</div>':'<div class="dna-empty-illustration">'+svg('Certificados')+'<h2>Suas conquistas começam com a primeira aula</h2><p>Conclua um curso para liberar seu certificado.</p>'+btn('Explorar conteúdos','nav','Catálogo LMS')+'</div>'
 }catch(err){const root=$('dnaCertificateList');if(root)root.textContent=err.message}
}

function renderDNAGradebook(){
 const root=$('inside');if(!root)return
 const scores=d.enroll.map(e=>{const course=d.courses.find(c=>c.id===e.course);return {...e,courseTitle:course?.title||'Curso indisponível',track:course?.track||'Catálogo geral',personName:typeof pname==='function'?pname(e.person):e.person}})
 const total=scores.length,done=scores.filter(e=>e.progress===100).length,graded=scores.filter(e=>Number.isFinite(e.score))
 const mean=graded.length?Math.round(graded.reduce((a,b)=>a+b.score,0)/graded.length):null
 root.innerHTML='<div class="dna-page-heading"><div><span class="dna-eyebrow">ACADEMIA DE APRENDIZAGEM</span><h1>Caderno de notas</h1><p>Matrículas, conclusão, pontuação registrada e acompanhamento do grupo autorizado.</p></div><button type="button" id="dnaExportGrades">Exportar CSV</button></div>'+
 '<div class="dna-metrics dna-grade-metrics"><article class="dna-metric"><small>Matrículas</small><strong>'+total+'</strong><span>no escopo atual</span></article><article class="dna-metric"><small>Concluídos</small><strong>'+done+'</strong><span>cursos concluídos</span></article><article class="dna-metric"><small>Taxa de conclusão</small><strong>'+(total?Math.round(100*done/total):0)+'%</strong><span>sobre as matrículas</span></article><article class="dna-metric"><small>Nota média</small><strong>'+(mean===null?'—':mean)+'</strong><span>somente cursos com nota</span></article></div>'+
 '<section class="dna-surface"><div class="dna-section-head"><div><h2>Acompanhamento das matrículas</h2><p>Notas são exibidas apenas quando já existem no LMS. Não representa histórico de tentativas.</p></div></div><label class="dna-label">Buscar curso ou pessoa<input type="search" id="dnaGradeSearch" placeholder="Digite para filtrar…"></label><div class="table-scroll"><table class="dna-grade-table"><thead><tr><th>Pessoa</th><th>Curso</th><th>Progresso</th><th>Nota</th><th>Situação</th></tr></thead><tbody id="dnaGradeRows"></tbody></table></div></section>'
 const tbody=$('dnaGradeRows'),search=$('dnaGradeSearch')
 const refreshTable=()=>{const term=(search.value||'').toLocaleLowerCase('pt-BR');tbody.innerHTML=scores.filter(row=>(row.personName+' '+row.courseTitle+' '+row.track).toLocaleLowerCase('pt-BR').includes(term)).slice(0,1500).map(row=>'<tr><td>'+esc(row.personName)+'</td><td><b>'+esc(row.courseTitle)+'</b><br><small>'+esc(row.track)+'</small></td><td>'+row.progress+'%</td><td>'+(Number.isFinite(row.score)?row.score:'—')+'</td><td>'+(row.progress===100?'Concluído':row.progress>0?'Em andamento':'Não iniciado')+'</td></tr>').join('')||'<tr><td colspan="5">Nenhuma matrícula encontrada.</td></tr>'}
 search.oninput=refreshTable;refreshTable()
 $('dnaExportGrades').onclick=()=>{
  const headers=['Pessoa','Curso','Trilha','Progresso','Nota','Situação']
  const rows=[headers,...scores.map(row=>[row.personName,row.courseTitle,row.track,row.progress,Number.isFinite(row.score)?row.score:'',row.progress===100?'Concluído':row.progress>0?'Em andamento':'Não iniciado'])]
  const safeCell=value=>{let text=String(value??'');if(/^[\t\r\n ]*[=+\-@]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'}
  const blob=new Blob(['\ufeff'+rows.map(row=>row.map(safeCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'})
  const href=URL.createObjectURL(blob),link=document.createElement('a');link.href=href;link.download='learning-caderno-de-notas.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),1000)
 }
}

// Existing action dispatcher does not know these actions. Delegate separately.
document.addEventListener('click',async e=>{
 const button=e.target.closest('[data-act^="evo-"]');if(!button)return
 const {act,id}=button.dataset
 try{
  if(act==='evo-issue'){
    button.disabled=true;button.textContent='Emitindo…'
    const result=await api('evo/certificates/issue',{enrollmentId:id})
    toast('Certificado emitido. Abra o documento e selecione imprimir ou salvar como PDF.')
    await renderDNACertificates()
  }
  if(act==='evo-delete-course'){
    const course=d.courses.find(c=>c.id===id);if(!course)return
    if(!confirm('Excluir definitivamente o cadastro do curso “'+course.title+'”? A operação só é permitida se não existirem matrículas ou trilhas vinculadas.'))return
    button.disabled=true
    await api('evo/delete',{type:'course',id,revision:course.revision||0,confirm:true})
    toast('Curso sem vínculos removido do catálogo. Dados de mídia antigos serão tratados na rotina de limpeza.')
    await refresh()
  }
 }catch(err){toast(err.message);button.disabled=false;button.textContent=act==='evo-issue'?'Emitir certificado':button.textContent}
})
window.addEventListener('load',()=>{if(d?.me){afterDraw();void syncBrand()}})
})();
