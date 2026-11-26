let foundationRequest=0
let organizationSort='name'
let organizationData=null
let organizationCompany=''
let organizationQuery=''
let organizationPage=1
const foundationPages=new Set(['Estrutura organizacional','Meu perfil','Organograma','Indicadores estratégicos','Evolução da plataforma'])
const organizationName=(list,id)=>list.find(item=>item.id===id)?.name||'Não informado'
const currentAssignment=()=>organizationData?.people.find(person=>person.id===d.me.id)

function foundationNavigation(){
 let links='<small>Pessoas e organização</small>'+nav('Meu perfil','◉')
 if(d.permissions?.analytics)links+=nav('Indicadores estratégicos','▥')+nav('Organograma','♧')
 if(admin())links+=nav('Estrutura organizacional','▦')
 if(['Administrador','RH/DHO'].includes(d.me.role))links+=nav('Evolução da plataforma','↗')
 return links
}
function companyContext(){
 if(!organizationData)return ''
 const companies=organizationData.companies
 return '<label class="company-context"><span>Empresa</span><select id="companyContext">'+
 opt([['',companies.length>1?'Escopo consolidado':'Escopo autorizado'],...companies.map(item=>[item.id,item.name])],organizationCompany)+
 '</select></label>'
}
function organizationPeople(){
 return organizationData.people.filter(person=>(!organizationCompany||person.company_id===organizationCompany)&&
  [person.name,person.email,person.position].join(' ').toLocaleLowerCase('pt-BR').includes(organizationQuery.toLocaleLowerCase('pt-BR')))
}
function organizationFilters(){
 return '<div class="filters"><label>Buscar pessoa<input id="organizationQuery" value="'+esc(organizationQuery)+'" type="search" placeholder="Nome, e-mail ou cargo"></label></div>'
}
function organizationTable(){
 const people=organizationPeople().sort((a,b)=>{const value=person=>organizationSort==='company'?organizationName(organizationData.companies,person.company_id):organizationSort==='position'?person.position||'':person.name;return value(a).localeCompare(value(b),'pt-BR')})
 const pages=Math.max(1,Math.ceil(people.length/15))
 organizationPage=Math.min(organizationPage,pages)
 const rows=people.slice((organizationPage-1)*15,organizationPage*15)
 return organizationFilters()+'<div class="table-scroll"><table class="organization-table"><caption>Vínculos profissionais</caption><thead><tr><th scope="col">Pessoa</th><th scope="col">Empresa</th><th scope="col">Unidade e área</th><th scope="col">Cargo</th><th scope="col">Ações</th></tr></thead><tbody>'+rows.map(person=>
 '<tr><td><b>'+esc(person.name)+'</b><br><span>'+esc(person.role)+'</span></td><td>'+esc(organizationName(organizationData.companies,person.company_id))+'</td><td>'+esc(organizationName(organizationData.units,person.unit_id))+'<br>'+esc(organizationName(organizationData.departments,person.department_id))+'</td><td>'+esc(person.position||'Não informado')+'</td><td>'+btn('Ver perfil','professionalProfile',person.id)+(admin()?btn('Definir vínculo','organizationAssignment',person.id):'')+(['RH/DHO','Diretoria'].includes(person.role)&&admin()?btn('Escopo de acesso','organizationAccess',person.id):'')+'</td></tr>').join('')+
 '</tbody></table></div>'+(rows.length?'':empty('Nenhuma pessoa encontrada.'))+
 '<div class="pagination">'+btn('Anterior','organizationPrevious','','smallBtn')+'<span>Página '+organizationPage+' de '+pages+' · '+people.length+' pessoa(s)</span>'+btn('Próxima','organizationNext','','smallBtn')+'</div>'
}
function organizationPageContent(){
 const actions=btn('Cadastrar empresa','organizationEntity','company','primary')+btn('Cadastrar unidade','organizationEntity','unit')+btn('Cadastrar área','organizationEntity','department')+btn('Exportar vínculos CSV','organizationExport')
 const companyCards=(organizationData.companyRegistry||organizationData.companies).map(company=>'<article class="card"><h2>'+esc(company.name)+(company.active?'':' · Arquivada')+'</h2><p>'+organizationData.people.filter(person=>person.company_id===company.id).length+' pessoa(s) vinculada(s)</p>'+btn('Editar empresa','organizationEntity','company:'+company.id)+'</article>').join('')
 return heading('Estrutura organizacional',actions)+(organizationData.unassigned?'<p class="notice">'+organizationData.unassigned+' cadastro(s) aguardam vínculo com empresa. A atribuição precisa ser feita pela administração.</p>':'')+
 '<div class="tiles">'+companyCards+'</div><section class="card">'+organizationTable()+'</section><div class="duo">'+['units','departments'].map(key=>'<section class="card"><h2>'+(key==='units'?'Unidades':'Áreas')+'</h2>'+(organizationData[key==='units'?'unitRegistry':'departmentRegistry']||organizationData[key]).filter(row=>!organizationCompany||row.company_id===organizationCompany).map(row=>'<div class="row"><div><b>'+esc(row.name)+(row.active?'':' · Arquivado')+'</b><br><small>'+esc(organizationName(organizationData.companies,row.company_id))+'</small></div>'+btn('Editar','organizationEntity',(key==='units'?'unit':'department')+':'+row.id)+'</div>').join('')+'</section>').join('')+'</div>'
}
function profileContent(personId){
 const person=organizationData.people.find(item=>item.id===personId)
 if(!person)return empty('Perfil indisponível no seu escopo de acesso.')
 const enrollments=d.enroll.filter(item=>item.person===person.id)
 const records=d.records.filter(item=>item.person===person.id)
 const completed=enrollments.filter(item=>item.progress===100)
 return '<section class="card profile-details"><div class="heading"><div><span class="over">Perfil profissional</span><h2>'+esc(person.name)+'</h2></div>'+(admin()?btn('Editar cadastro e empresa','user',person.id,'primary'):'')+'</div><dl>'+[
 ['Perfil de acesso',person.role],['Empresa',organizationName(organizationData.companies,person.company_id)],
 ['Unidade',organizationName(organizationData.units,person.unit_id)],['Área',organizationName(organizationData.departments,person.department_id)],
 ['Cargo',person.position||'Não informado'],['Liderança',organizationData.people.find(item=>item.id===person.manager)?.name||'Não informada'],
 ['Admissão',when(person.hired_at)||'Não informada'],['E-mail',person.email]
 ].map(([label,value])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl></section>'+
 '<section class="card"><h2>Aprendizagem no escopo autorizado</h2><p>'+completed.length+' curso(s) concluído(s) · '+(completed.reduce((sum,item)=>sum+Number(d.courses.find(course=>course.id===item.course)?.minutes||0),0)/60).toFixed(1)+' h de carga horária concluída.</p>'+enrollments.map(item=>'<div class="row"><span>'+esc(cname(item.course))+'</span><b>'+item.progress+'%</b></div>').join('')+(enrollments.length?'':empty('Nenhuma matrícula disponível para consulta.'))+'</section>'+
 '<section class="card"><h2>Desenvolvimento no escopo autorizado</h2>'+records.map(item=>'<div class="row"><div>'+esc(item.kind)+' · '+esc(item.title)+'</div><span>'+esc(item.status)+'</span></div>').join('')+(records.length?'':empty('Nenhum registro disponível para consulta.'))+'</section>'
}
async function renderFoundation(root){
 const requestedPage=page
 const request=++foundationRequest
 if(!organizationData){root.innerHTML='<p role="status">Carregando estrutura organizacional…</p>';return}
 if(page==='Estrutura organizacional')root.innerHTML=organizationPageContent()
 if(page==='Evolução da plataforma')root.innerHTML=platformEvolution()
 if(page==='Meu perfil')root.innerHTML=heading('Meu perfil')+profileContent(d.me.id)
 if(page==='Organograma'){
  const people=organizationPeople()
  root.innerHTML=heading('Organograma',btn('Exportar estrutura CSV','organizationExport'))+organizationFilters()+'<section class="card"><p>Estrutura de liderança no escopo autorizado.</p><ul class="organization-chart">'+people.map(person=>'<li><b>'+esc(person.name)+'</b><span>'+esc(person.position||person.role)+'</span><small>Liderança · '+esc(organizationData.people.find(item=>item.id===person.manager)?.name||'Não informada')+'</small>'+btn('Ver perfil','professionalProfile',person.id)+'</li>').join('')+'</ul>'+(people.length?'':empty('Nenhuma pessoa neste escopo.'))+'</section>'
 }
 if(page==='Indicadores estratégicos'){
  root.innerHTML=heading('Indicadores estratégicos')+'<p role="status">Calculando indicadores do escopo autorizado…</p>'
  try{
   const result=await api('v2/analytics'+(organizationCompany?'?company='+encodeURIComponent(organizationCompany):''))
   if(page!==requestedPage||request!==foundationRequest)return
   root.innerHTML=heading('Indicadores estratégicos',btn('Exportar indicadores CSV','analyticsExport'))+
    '<div class="stats foundation-stats">'+result.indicators.map(item=>'<button class="stat" data-act="indicatorDefinition" data-id="'+esc(item.id)+'"><span>'+esc(item.label)+'</span><b>'+(item.value===null?'Indisponível':esc(Number(item.value.toFixed(1)))+' '+esc(item.unit||''))+'</b></button>').join('')+'</div>'+
    '<section class="card"><h2>Distribuição por empresa</h2>'+result.byCompany.map(item=>'<button class="company-chart-row" data-act="analyticsCompany" data-id="'+esc(item.id)+'"><span>'+esc(item.name)+'</span><meter min="0" max="'+Math.max(1,...result.byCompany.map(row=>row.value))+'" value="'+item.value+'" aria-label="'+esc(item.name)+'"></meter><b>'+item.value+'</b></button>').join('')+'</section>'
   root.foundationIndicators=result.indicators
  }catch(error){if(page===requestedPage&&request===foundationRequest)root.innerHTML=heading('Indicadores estratégicos')+'<p class="err" role="alert">'+esc(error.message)+'</p>'+btn('Tentar novamente','nav','Indicadores estratégicos')}
 }
 const query=$('organizationQuery')
 if(query)query.oninput=event=>{
  const position=event.target.selectionStart
  organizationQuery=event.target.value;organizationPage=1
  void renderFoundation(root)
  $('organizationQuery')?.focus();$('organizationQuery')?.setSelectionRange(position,position)
 }
}
function organizationEntity(encoded){
 const [kind,id]=encoded.split(':')
 const list={company:organizationData.companyRegistry||organizationData.companies,unit:organizationData.unitRegistry||organizationData.units,department:organizationData.departmentRegistry||organizationData.departments}[kind]
 const previous=list?.find(item=>item.id===id)||{}
 const titles={company:'empresa',unit:'unidade',department:'área'}
 form((id?'Editar ':'Cadastrar ')+titles[kind],fld('Nome','name',previous.name,'text','required maxlength="120"')+
  (kind==='company'?'':sel('Empresa','company_id',organizationData.companies.map(item=>[item.id,item.name]),previous.company_id||organizationCompany))+
  (id?sel('Situação','active',[['1','Ativo'],['0','Arquivar']],previous.active?'1':'0'):''),
  body=>api('v2/'+kind,{...body,id,active:body.active!=='0'}))
}
function organizationFields(person){
 return '<fieldset class="professional-fields"><legend>Vínculo profissional</legend><div class="professional-grid">'+
  sel('Empresa','company_id',[['','Selecione a empresa'],...organizationData.companies.map(item=>[item.id,item.name])],person.company_id)+
  sel('Unidade','unit_id',[])+sel('Área / departamento','department_id',[])+fld('Cargo','position',person.position,'text','maxlength="120"')+
  fld('Admissão','hired_at',person.hired_at,'date','')+fld('Desligamento','ended_at',person.ended_at,'date','')+'</div></fieldset>'
}
function bindOrganizationFields(editor,person){
 editor.elements.company_id.required=true
 const update=()=>{
  const company=editor.elements.company_id.value
  for(const [field,list] of [['unit_id',organizationData.units],['department_id',organizationData.departments]]){
   const previous=editor.elements[field].value||person[field]
   const choices=list.filter(item=>item.company_id===company)
   editor.elements[field].innerHTML=opt([['','Não definido'],...choices.map(item=>[item.id,item.name])],choices.some(item=>item.id===previous)?previous:'')
  }
  if(editor.elements.manager){
   const previous=editor.elements.manager.value||person.manager||''
   const choices=organizationData.people.filter(item=>item.id!==person.id&&item.active&&item.role!=='Colaborador'&&
    (item.company_id===company||item.id===person.manager&&!item.company_id))
   editor.elements.manager.innerHTML=opt([['','Sem liderança'],...choices.map(item=>[item.id,item.name+(item.company_id?'':' · vínculo pendente')])],choices.some(item=>item.id===previous)?previous:'')
  }
 }
 editor.elements.company_id.onchange=update;update()
}
function organizationAssignment(id){
 const person=organizationData.people.find(item=>item.id===id)
 if(!person)return
 const editor=form('Vínculo de '+person.name,organizationFields(person),
  body=>api('v2/assignment',{...body,person_id:id,revision:person.revision||0}))
 bindOrganizationFields(editor,person)
}
function userForm(id){
 if(!admin())return
 const person=organizationData.people.find(item=>item.id===id)||{}
 const existing=d.people.find(item=>item.id===id)||{}
 const editor=form(id?'Editar cadastro e empresa':'Criar usuário',
  '<p class="form-intro">Cadastro de acesso e vínculo profissional são salvos juntos. A empresa define o escopo organizacional da pessoa.</p>'+
  '<fieldset class="professional-fields"><legend>Dados e acesso</legend><div class="professional-grid">'+
  fld('Nome completo','name',person.name)+fld('E-mail','email',person.email,'email')+
  sel('Perfil','role',['Colaborador','Líder','RH/DHO','Diretoria','Administrador'],person.role||'Colaborador')+
  sel('Acesso','active',[['1','Ativo'],['0','Bloqueado']],person.active===false?'0':'1')+'</div></fieldset>'+
  organizationFields(person)+sel('Liderança imediata','manager',[['','Sem liderança']],person.manager)+
  fld(id?'Nova senha (opcional)':'Senha provisória (opcional)','password','','password','minlength="12" maxlength="150" autocomplete="new-password"')+
  (!id?'<p class="form-hint">Ao criar o acesso, a plataforma enviará automaticamente um convite para o e-mail corporativo. A pessoa definirá a própria senha no primeiro acesso.</p>':'')+
  (!organizationData.companies.length?'<p class="notice">Cadastre uma empresa em Estrutura organizacional antes de criar ou alterar o vínculo.</p>':''),
  async body=>{
   const organization={company_id:body.company_id,unit_id:body.unit_id,department_id:body.department_id,position:body.position,
    hired_at:body.hired_at,ended_at:body.ended_at,revision:person.revision||0}
   const department=organizationData.departments.find(item=>item.id===body.department_id)
   await api('user',{id,name:body.name,email:body.email,role:body.role,active:body.active==='1',manager:body.manager,
    password:body.password,area:department?.name||existing.area||'',organization})
   if(id===d.me.id&&body.password){modal.close();await start()}
   if(!id){
    const current=await api('v2/organization'),created=current.people.find(item=>item.email?.toLowerCase()===body.email.trim().toLowerCase())
    if(!created)return {message:'Acesso criado. Atualize a lista para enviar o convite.'}
    try{const invitation=await api('first-access/invite',{personId:created.id,requestId:crypto.randomUUID()});return {message:'Acesso criado. '+invitation.message}}
    catch(error){return {message:'Acesso criado; convite pendente: '+error.message}}
   }
   return {message:'Cadastro e vínculo atualizados.'}
  },id?'Salvar cadastro e empresa':'Criar usuário')
 bindOrganizationFields(editor,person)
}
function organizationAccess(id){
 const person=organizationData.people.find(item=>item.id===id)
 const granted=new Set(organizationData.grants.filter(item=>item.person_id===id).map(item=>item.company_id))
 form('Escopo de '+person.name,'<p>Autorize as empresas que este perfil de '+esc(person.role)+' pode consolidar.</p>'+organizationData.companies.map(company=>'<label class="check-row"><input type="checkbox" name="companies" value="'+esc(company.id)+'" '+(granted.has(company.id)?'checked':'')+'>'+esc(company.name)+'</label>').join(''),
  (body,editor)=>api('v2/access',{person_id:id,company_ids:new FormData(editor).getAll('companies')}))
}
document.addEventListener('change',async event=>{
 if(event.target.name==='organizationSort'){organizationSort=event.target.value;organizationPage=1;await renderFoundation($('inside'));return}
 if(event.target.id!=='companyContext')return
 organizationCompany=event.target.value;person='';organizationPage=1
 try{await refresh()}catch(error){toast(error.message)}
})
document.addEventListener('click',async event=>{
 const control=event.target.closest('[data-act]')
 if(!control)return
 const {act,id}=control.dataset
 try{
  if(act==='analyticsCompany'){organizationCompany=id;person='';await refresh()}
  if(act==='searchCourse'){const enrollment=d.enroll.find(item=>item.course===id&&item.person===d.me.id);if(enrollment)learn(enrollment.id);else {page='Catálogo LMS';search=d.courses.find(item=>item.id===id)?.title||'';draw()}}
  if(act==='searchRecord'){const item=d.records.find(record=>record.id===id);if(item)await openDirect(item.kind,id)}
  if(act==='organizationEntity')organizationEntity(id)
  if(act==='organizationAssignment')organizationAssignment(id)
  if(act==='organizationAccess')organizationAccess(id)
  if(act==='professionalProfile'){
   $('modalBody').innerHTML='<div class="heading"><h2>Perfil profissional</h2>'+btn('Fechar','close')+'</div>'+profileContent(id)
   if(!modal.open)modal.showModal()
  }
  if(act==='organizationPrevious'){organizationPage=Math.max(1,organizationPage-1);await renderFoundation($('inside'))}
  if(act==='organizationNext'){organizationPage++;await renderFoundation($('inside'))}
  if(act==='organizationExport')downloadReport('estrutura-organizacional.csv',[
   ['Nome','Empresa','Unidade','Área','Cargo','Liderança'],...organizationPeople().map(person=>[person.name,organizationName(organizationData.companies,person.company_id),organizationName(organizationData.units,person.unit_id),organizationName(organizationData.departments,person.department_id),person.position,organizationData.people.find(item=>item.id===person.manager)?.name||''])])
  if(act==='indicatorDefinition'){
   const indicator=$('inside').foundationIndicators.find(item=>item.id===id)
   $('modalBody').innerHTML='<div class="heading"><h2>'+esc(indicator.label)+'</h2>'+btn('Fechar','close')+'</div><p>'+esc(indicator.definition)+'</p>'
   if(!modal.open)modal.showModal()
  }
  if(act==='analyticsExport')downloadReport('indicadores-organizacionais.csv',[['Indicador','Valor','Unidade','Definição'],...$('inside').foundationIndicators.map(item=>[item.label,item.value??'Indisponível',item.unit||'',item.definition])])
 }catch(error){toast(error.message)}
})

function showRecoveryRequest(available){
 modal.classList.add('academy-auth-recovery')
 modal.addEventListener('close',()=>modal.classList.remove('academy-auth-recovery'),{once:true})
 $('modalBody').innerHTML='<div class="academy-recovery-close">'+btn('Fechar','close')+'</div><div class="academy-auth">'+academyAuth.recovery(available)+'</div>'
 if(!modal.open)modal.showModal()
 if(!available)return
 $('recoverForm').onsubmit=async event=>{
  event.preventDefault()
  const editor=event.target,button=editor.querySelector('[type=submit]')
  if(button.disabled)return
  academyAuth.busy(editor,true)
  try{
   const result=await api('request-password-reset',{email:editor.elements.email.value})
   $('recoveryStatus').textContent=result.message
  }catch(error){editor.querySelector('.err').textContent=error.message;academyAuth.busy(editor,false)}
 }
}
function passwordResetScreen(token){
 app.innerHTML=academyAuth.reset();academyAuth.bind($('resetForm'))
 $('resetForm').onsubmit=async event=>{
  event.preventDefault()
  const editor=event.target,button=editor.querySelector('[type=submit]')
  editor.querySelector('.err').textContent=''
  if(editor.elements.password.value!==editor.elements.confirmation.value){editor.querySelector('.err').textContent='As senhas precisam ser iguais.';return}
  if(button.disabled)return
  academyAuth.busy(editor,true)
  try{
   const result=await api('reset-password',{token,password:editor.elements.password.value})
   history.replaceState(null,'',location.pathname)
   await start();toast(result.message)
  }catch(error){editor.querySelector('.err').textContent=error.message;academyAuth.busy(editor,false)}
 }
}

function globalSearch(){
 return '<div class="global-search"><label><span class="sr-only">Pesquisa global no escopo autorizado</span><input type="search" id="globalSearch" autocomplete="off" aria-controls="globalSearchResults" aria-expanded="false" placeholder="Buscar pessoas, cursos e registros"></label><div id="globalSearchResults" class="global-search-results" hidden></div></div>'
}
document.addEventListener('input',event=>{
 if(event.target.id!=='globalSearch')return
 const query=event.target.value.trim().toLocaleLowerCase('pt-BR')
 const results=$('globalSearchResults')
 results.hidden=!query
 event.target.setAttribute('aria-expanded',String(Boolean(query)))
 if(!query)return
 const matches=value=>value.toLocaleLowerCase('pt-BR').includes(query)
 const companies=organizationCompany?organizationData.people.filter(person=>person.company_id===organizationCompany):organizationData.people
 const people=companies.filter(person=>matches(person.name)).slice(0,4).map(person=>btn(person.name+' · Pessoa','professionalProfile',person.id))
 const courses=d.courses.filter(course=>matches(course.title)).slice(0,4).map(course=>btn(course.title+' · Curso','searchCourse',course.id))
 const records=d.records.filter(record=>matches(record.title)).slice(0,4).map(record=>btn(record.title+' · '+record.kind,'searchRecord',record.id))
 results.innerHTML=[...people,...courses,...records].slice(0,8).join('')||empty('Nenhum resultado autorizado para esta busca.')
})
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'){
  const results=$('globalSearchResults')
  if(results)results.hidden=true
  $('globalSearch')?.setAttribute('aria-expanded','false')
 }
 if(event.target.id==='globalSearch'&&event.key==='ArrowDown'){
  $('globalSearchResults')?.querySelector('button')?.focus()
  event.preventDefault()
 }
})

function platformEvolution(){
 if(!['Administrador','RH/DHO'].includes(d.me.role))return empty('Acompanhamento disponível para a administração e RH.')
 const modules=[
 ['Home e dashboards','Parcial','Painel, tarefas e indicadores iniciais por escopo. Faltam todas as jornadas e métricas por perfil.','Painel'],
 ['LMS/LXP','Em evolução','Cursos, mídias, trilhas sequenciais, pré-requisitos, atribuição coletiva e publicação. Faltam aulas estruturadas, tentativas e certificados verificáveis.','Catálogo LMS'],
 ['Avaliação de desempenho','Base legada','Registros simples. Faltam ciclos, avaliadores, formulários, pesos e calibração.','Desempenho'],
 ['9Box e talentos','Base legada','Matriz simples. Faltam critérios configuráveis, calibração e histórico de posicionamentos.','Matriz 9 Box'],
 ['PDI','Base legada','Registros com vínculos. Faltam ações estruturadas, competências, 70-20-10 e evidências.','PDI'],
 ['Reuniões 1:1','Base legada','Histórico privado dos participantes. Faltam agenda, recorrência e tarefas.','1:1'],
 ['Feedback e reconhecimento','Parcial','Feedback privado e mural de elogios. Faltam solicitações e modelos estruturados.','Feedback'],
 ['Clima e engajamento','Base legada','Pulse identificada com limite de sete respostas para média. Pesquisa anônima ainda pendente.','Pulse'],
 ['Objetivos e OKRs','Base legada','Metas simples. Faltam ciclos, alinhamento e múltiplos resultados-chave.','OKR'],
 ['People Analytics','Parcial','Indicadores reais por escopo e CSV. Faltam séries temporais, XLSX, PDF e efetividade.','Indicadores estratégicos'],
 ['Perfil integrado','Parcial','Dados profissionais e histórico autorizado. Competências e certificados ainda pendentes.','Meu perfil'],
 ['Organograma e sucessão','Parcial','Estrutura de liderança. Mapa de sucessão e prontidão ainda pendentes.','Organograma'],
 ['Inteligência artificial','Desativada','Sem provedor configurado. Nenhum dado de RH é enviado e nenhuma resposta é simulada.',''],
 ['Programas DNA','Base legada','Missões e conteúdos preservados. Gestão completa das jornadas e avaliações ainda pendente.','Missões'],
 ['Administração','Parcial','Empresas, unidades, áreas, vínculos e escopos. Faltam importação, grupos, calendários e retenção.',admin()?'Estrutura organizacional':'']
 ]
 return heading('Evolução da plataforma')+'<section class="hero"><span class="over">Sanepav Learning 2.0</span><h1>Fundação + Learning 02</h1><p>Acompanhe o que já está implementado nesta versão e os próximos incrementos. Os 15 módulos ainda não atendem integralmente aos critérios de aceite.</p></section>'+
 '<section class="card"><h2>Entrega atual</h2><p>Estrutura organizacional, cinco perfis, autorização por empresa, recuperação de acesso configurável e ciclo de publicação de cursos. Novos ambientes exigem ativação protegida. Recuperação por e-mail depende da configuração de provedor.</p><p>Esta página descreve as funcionalidades incluídas no código em execução. Disponibilidade operacional e configuração dos serviços precisam ser verificadas em cada ambiente.</p></section>'+
 '<div class="table-scroll"><table class="organization-table"><caption>Situação dos 15 módulos — versão 2.0 Learning 02</caption><thead><tr><th scope="col">Módulo</th><th scope="col">Situação</th><th scope="col">Entregas e pendências</th><th scope="col">Acessar</th></tr></thead><tbody>'+modules.map(([name,status,details,target])=>'<tr><th scope="row">'+esc(name)+'</th><td>'+tag(status)+'</td><td>'+esc(details)+'</td><td>'+(target?btn('Abrir módulo','nav',target,'smallBtn'):'—')+'</td></tr>').join('')+'</tbody></table></div>'
}

let directoryStatus=''
function peopleDirectory(){
 const scope=organizationData.people.filter(item=>!organizationCompany||item.company_id===organizationCompany)
 const statusMatch=person=>directoryStatus==='active'?person.active:directoryStatus==='blocked'?!person.active:directoryStatus==='unassigned'?!person.company_id:true
 const rows=scope.filter(person=>statusMatch(person)&&[person.name,person.email,person.position,organizationName(organizationData.companies,person.company_id)].join(' ').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))
 return heading('Pessoas',btn('Criar usuário','user','','primary'))+'<p class="directory-intro">Gerencie os acessos e a estrutura profissional. Empresa, unidade e liderança conectam cada pessoa à sua jornada.</p>'+
  '<div class="stats">'+[['Pessoas no contexto',scope.length,''],['Acessos ativos',scope.filter(p=>p.active).length,'active'],['Sem empresa',scope.filter(p=>!p.company_id).length,'unassigned']].map(([label,value,status])=>'<button class="stat" data-act="directoryStatus" data-id="'+status+'"><span>'+label+'</span><b>'+value+'</b></button>').join('')+'</div>'+
  '<section class="card directory-panel"><div class="filters"><input id="query" type="search" aria-label="Pesquisar pessoas" placeholder="Buscar nome, e-mail, cargo ou empresa" value="'+esc(search)+'"><label>Situação<select id="directoryStatus">'+opt([['','Todas'],['active','Ativos'],['blocked','Bloqueados'],['unassigned','Sem empresa']],directoryStatus)+'</select></label></div>'+
  '<div class="table-scroll"><table class="organization-table"><caption>'+rows.length+' pessoa(s) encontradas</caption><thead><tr><th scope="col">Pessoa</th><th scope="col">Empresa e unidade</th><th scope="col">Perfil e acesso</th><th scope="col">Liderança</th><th scope="col">Ações</th></tr></thead><tbody>'+rows.map(person=>'<tr><td><div class="directory-person"><span class="person-monogram" aria-hidden="true">'+esc(person.name.split(' ').map(word=>word[0]).slice(0,2).join(''))+'</span><div><b>'+esc(person.name)+'</b><br><small>'+esc(person.email)+'</small><br><small>'+esc(person.position||'Cargo não informado')+'</small></div></div></td><td>'+esc(organizationName(organizationData.companies,person.company_id))+'<br><small>'+esc(organizationName(organizationData.units,person.unit_id))+'</small></td><td>'+tag(person.role)+'<br><small>'+(person.active?'Ativo':'Bloqueado')+'</small></td><td>'+esc(organizationData.people.find(item=>item.id===person.manager)?.name||'Sem liderança')+'</td><td><div class="actions">'+btn('Ver perfil','professionalProfile',person.id,'smallBtn')+btn('Editar','user',person.id,'smallBtn')+'</div></td></tr>').join('')+'</tbody></table></div>'+(!rows.length?empty('Nenhuma pessoa encontrada para este filtro.'):'')+'</section>'
}
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-act="directoryStatus"]')
 if(!button||!admin())return
 directoryStatus=button.dataset.id;body()
})
