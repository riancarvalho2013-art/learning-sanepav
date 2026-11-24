/* Single integration seam: the existing foundation page and navigation. No draw/body overrides. */
(()=>{
 'use strict'
 const PAGE='Organograma',isAllowed=()=>['Administrador','Líder'].includes(typeof d!=='undefined'?d?.me?.role:'')
 const oldNavigation=foundationNavigation,oldRender=renderFoundation
 foundationNavigation=function(...args){
  let links=oldNavigation(...args).replace(nav(PAGE,'♧'),'')
  if(isAllowed())links=links.replace(nav('Meu perfil','◉'),nav('Meu perfil','◉')+nav(PAGE,'⌘'))
  return links
 }
 const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el}
 const button=(text,action)=>{const b=make('button','oc-btn',text);b.type='button';b.addEventListener('click',action);return b}
 const clean=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR')
 const initials=name=>name.trim().split(/\s+/).slice(0,2).map(p=>p[0]||'').join('').toUpperCase()
 const plural=(n,one,many)=>`${n} ${n===1?one:many}`
 const statuses={not_assigned:'Sem gestor cadastrado',unavailable:'Gestor indisponível neste mapa',cycle:'Vínculo circular: revisar cadastro'}
 function selectField(label,options,change){const field=make('label','oc-field');field.append(make('span','',label));const select=make('select');select.setAttribute('aria-label',label);for(const [id,text] of options){const option=make('option','',text);option.value=id;select.append(option)}select.addEventListener('change',()=>change(select.value));field.append(select);return {field,select}}
 async function show(root){
  const request=++foundationRequest,userId=d?.me?.id,company=organizationCompany||''
  const current=()=>root.isConnected&&page===PAGE&&request===foundationRequest&&d?.me?.id===userId&&(organizationCompany||'')===company
  root.replaceChildren()
  if(!isAllowed()){root.append(make('p','oc-error','Acesso restrito à administração e liderança.'));return}
  const loading=make('p','oc-loading','Carregando estrutura organizacional…');loading.setAttribute('role','status');root.append(loading)
  try{
   const data=await api('orgchart/v9'+(company?'?company='+encodeURIComponent(company):''))
   if(!current())return
   root.replaceChildren();render(root,data,current)
  }catch(error){if(!current())return;root.replaceChildren();const p=make('p','oc-error',error.message||'Não foi possível carregar o organograma.');p.setAttribute('role','alert');root.append(p,button('Tentar novamente',()=>void show(root)))}
 }
 function render(root,data,current){
  const people=data.people,companies=data.companies,departments=data.departments,units=data.units
  const personById=new Map(people.map(p=>[p.id,p])),deptById=new Map(departments.map(p=>[p.id,p])),unitById=new Map(units.map(p=>[p.id,p])),companyById=new Map(companies.map(p=>[p.id,p]))
  const direct=new Map();for(const p of people)if(p.managerId){if(!direct.has(p.managerId))direct.set(p.managerId,[]);direct.get(p.managerId).push(p)}
  let mode='departments',query='',companyFilter='',deptFilter='',unitFilter='',scale=100,selected=null
  const section=make('section','oc9'),hero=make('div','oc-hero'),heroText=make('div');heroText.append(make('p','oc-eyebrow','DNA DO DESENVOLVIMENTO / PESSOAS'),make('h1','','Organograma corporativo'),make('p','oc-subtitle','Explore empresas, departamentos e relações de liderança cadastradas no Learning.'))
  const refresh=button('↻ Atualizar mapa',()=>void show(root));hero.append(heroText,refresh);section.append(hero)
  const stats=make('div','oc-stats');for(const [value,label] of [[data.counts.companies,'Empresas'],[data.counts.departments,'Departamentos'],[data.counts.people,'Pessoas com conta ativa'],[data.counts.managers,'Gestores com equipe']]){const box=make('div','oc-stat');box.append(make('strong','',String(value)),make('span','',label));stats.append(box)}section.append(stats)
  const tools=make('div','oc-tools'),tabs=make('div','oc-tabs');tabs.setAttribute('aria-label','Visualização do mapa')
  const depTab=button('Departamentos',()=>setMode('departments')),treeTab=button('Hierarquia de gestores',()=>setMode('hierarchy'));tabs.append(depTab,treeTab);tools.append(tabs)
  const filterRow=make('div','oc-filters'),searchLabel=make('label','oc-field');searchLabel.append(make('span','','Buscar pessoa, cargo ou setor'));const searchInput=make('input');searchInput.type='search';searchInput.placeholder='Ex.: Financeiro, gerente…';searchInput.addEventListener('input',()=>{query=searchInput.value;paint()});searchLabel.append(searchInput);filterRow.append(searchLabel)
  const companySelect=selectField('Empresa',[['','Todas autorizadas'],...companies.map(c=>[c.id,c.name]),...(people.some(p=>!p.companyId)?[['~unassigned','Sem vínculo empresarial']]:[])],v=>{companyFilter=v;deptFilter='';unitFilter='';fillFilters();paint()});filterRow.append(companySelect.field)
  const depSelect=selectField('Departamento',[],v=>{deptFilter=v;paint()}),unitSelect=selectField('Unidade',[],v=>{unitFilter=v;paint()});filterRow.append(depSelect.field,unitSelect.field);tools.append(filterRow)
  function fillFilters(){for(const [control,rows,missing] of [[depSelect,departments,'Sem departamento'],[unitSelect,units,'Sem unidade']]){control.select.replaceChildren();for(const [id,label] of [['','Todos'],...rows.filter(x=>!companyFilter||x.companyId===companyFilter).map(x=>[x.id,x.name]),['~none',missing]]){const opt=make('option','',label);opt.value=id;control.select.append(opt)}control.select.value=''}}fillFilters()
  const controls=make('div','oc-controls'),count=make('span','oc-count');count.setAttribute('role','status');const scaleLabel=make('span','oc-scale','100%')
  const zoom=delta=>{scale=Math.max(60,Math.min(140,scale+delta));canvas.style.zoom=String(scale/100);scaleLabel.textContent=scale+'%'}
  const expand=button('Expandir tudo',()=>canvas.querySelectorAll('details').forEach(x=>x.open=true)),collapse=button('Recolher tudo',()=>canvas.querySelectorAll('details').forEach(x=>x.open=false))
  const minus=button('−',()=>zoom(-10)),plus=button('+',()=>zoom(10));minus.setAttribute('aria-label','Reduzir mapa');plus.setAttribute('aria-label','Ampliar mapa');controls.append(count,expand,collapse,minus,scaleLabel,plus,button('Restaurar zoom',()=>{scale=100;zoom(0)}));tools.append(controls);section.append(tools)
  const note=make('p','oc-note',data.scope==='administration'?'Escopo administrativo · o mapa inclui contas ativas sem vínculo, quando houver.':'Escopo da sua empresa · somente dados profissionais básicos. O acesso a registros de RH continua restrito.');section.append(note)
  const detail=make('section','oc-detail');detail.hidden=true;detail.setAttribute('aria-label','Dados profissionais selecionados');section.append(detail)
  const viewport=make('div','oc-viewport');viewport.tabIndex=0;viewport.setAttribute('aria-label','Mapa organizacional, área com rolagem');const canvas=make('div','oc-canvas');viewport.append(canvas);section.append(viewport)
  const footer=make('p','oc-note','Fonte: cadastro de pessoas, empresas, unidades e departamentos do Learning. Não representa headcount de folha de pagamento.');section.append(footer);root.append(section)
  const matchesCompany=p=>!companyFilter||(companyFilter==='~unassigned'?!p.companyId:p.companyId===companyFilter)
  const matchesDept=p=>!deptFilter||(deptFilter==='~none'?!p.departmentId:p.departmentId===deptFilter)
  const matchesUnit=p=>!unitFilter||(unitFilter==='~none'?!p.unitId:p.unitId===unitFilter)
  function personMatches(p){const text=[p.name,p.position,deptById.get(p.departmentId)?.name,unitById.get(p.unitId)?.name,personById.get(p.managerId)?.name].join(' ');return matchesCompany(p)&&matchesDept(p)&&matchesUnit(p)&&clean(text).includes(clean(query.trim()))}
  function showPerson(p){if(!current())return;selected=p.id;detail.hidden=false;detail.replaceChildren();const top=make('div','oc-detail-header');top.append(make('h2','',p.name),button('Fechar',()=>{selected=null;detail.hidden=true}));detail.append(top);const fields=make('dl','oc-dl');for(const [key,value] of [['Cargo',p.position],['Empresa',companyById.get(p.companyId)?.name||'Sem vínculo'],['Departamento',deptById.get(p.departmentId)?.name||'Não informado'],['Unidade',unitById.get(p.unitId)?.name||'Não informada'],['Gestor',personById.get(p.managerId)?.name||statuses[p.managerStatus]||'Não informado'],['Liderados diretos',String(p.directReports)]]){const cell=make('div');cell.append(make('dt','',key),make('dd','',value));fields.append(cell)}detail.append(fields);detail.scrollIntoView({block:'nearest'});top.querySelector('button').focus({preventScroll:true})}
  function personCard(p,context=false){const b=make('button','oc-person'+(context?' oc-context':''));b.type='button';const icon=make('span','oc-avatar',initials(p.name));icon.setAttribute('aria-hidden','true');const info=make('span','oc-person-info');info.append(make('strong','',p.name),make('small','',p.position));if(mode==='hierarchy')info.append(make('small','',deptById.get(p.departmentId)?.name||'Sem departamento'));else info.append(make('small','',personById.get(p.managerId)?.name?'Gestor: '+personById.get(p.managerId).name:statuses[p.managerStatus]||''));b.append(icon,info);if(p.directReports)b.append(make('span','oc-pill',String(p.directReports)));if(context)b.append(make('span','oc-context-label','Contexto'));b.addEventListener('click',()=>showPerson(p));return b}
  function companyGroup(id,name,filtered){const box=make('section','oc-company');const title=make('div','oc-company-title');title.append(make('span','oc-eyebrow','EMPRESA'),make('h2','',name),make('span','oc-pill',plural(filtered.length,'pessoa','pessoas')));box.append(title);return box}
  function renderDepartments(id,box,filtered){
   const branch=make('div','oc-dept-branches');const ds=departments.filter(x=>x.companyId===id&&(!deptFilter||deptFilter===x.id));const groupByDept=new Map();for(const p of filtered){const key=p.departmentId||'~none';if(!groupByDept.has(key))groupByDept.set(key,[]);groupByDept.get(key).push(p)}
   const items=[...ds.map(x=>[x.id,x.name]),...(groupByDept.has('~none')?[['~none','Sem departamento definido']]:[])]
   for(const [key,name] of items){const list=groupByDept.get(key)||[];if((query.trim()||unitFilter)&&!list.length&&!clean(name).includes(clean(query.trim())))continue;const card=make('details','oc-dept');card.open=true;const sum=make('summary','oc-dept-head');sum.append(make('strong','',name),make('span','oc-pill',plural(list.length,'pessoa','pessoas')));card.append(sum);const members=make('div','oc-members');if(!list.length)members.append(make('p','oc-empty','Nenhum integrante no recorte.'));for(const p of list)members.append(personCard(p));card.append(members);branch.append(card)}
   if(!branch.children.length)branch.append(make('p','oc-empty','Nenhum departamento ou integrante neste recorte.'));box.append(branch)
  }
  function renderHierarchy(id,box,filtered){
   const include=new Set(filtered.map(x=>x.id));for(const p of filtered){let m=personById.get(p.managerId);while(m&&!include.has(m.id)){include.add(m.id);m=personById.get(m.managerId)}}
   const matched=new Set(filtered.map(x=>x.id)),roots=people.filter(p=>include.has(p.id)&&p.companyId===id&&(!p.managerId||!include.has(p.managerId)))
   const tree=make('ul','oc-tree');if(!roots.length){box.append(make('p','oc-empty','Nenhuma pessoa neste recorte.'));return}
   // Iterative construction: safe even for deep organizational structures.
   const stack=roots.map(p=>({p,parent:tree,depth:0})).reverse(),seen=new Set()
   while(stack.length){const {p,parent,depth}=stack.pop();if(seen.has(p.id))continue;seen.add(p.id);const li=make('li','oc-node'),children=(direct.get(p.id)||[]).filter(x=>include.has(x.id));parent.append(li)
    if(children.length){const det=make('details','oc-branch');det.open=people.length<=100||depth<2||Boolean(query.trim()||deptFilter||unitFilter);const sum=make('summary','oc-branch-head');sum.append(make('span','',plural(children.length,'liderado','liderados')+' no recorte'));det.append(sum);li.append(personCard(p,!matched.has(p.id)),det);const next=make('ul','oc-children');det.append(next);for(let i=children.length-1;i>=0;i--)stack.push({p:children[i],parent:next,depth:depth+1})}else li.append(personCard(p,!matched.has(p.id)))
   }box.append(tree)
  }
  function paint(){if(!current())return;canvas.replaceChildren();const filtered=people.filter(personMatches);count.textContent=plural(filtered.length,'pessoa no mapa','pessoas no mapa');if(selected&&!filtered.some(x=>x.id===selected)){selected=null;detail.hidden=true}
   const rows=[...companies.map(c=>[c.id,c.name]),...(people.some(p=>!p.companyId)?[[null,'Sem vínculo empresarial']]:[])].filter(([id])=>!companyFilter||(companyFilter==='~unassigned'?!id:companyFilter===id))
   for(const [id,name] of rows){const matches=filtered.filter(p=>p.companyId===id);if(!matches.length&&(query.trim()||unitFilter||deptFilter)&&!(mode==='departments'&&!unitFilter&&departments.some(dep=>dep.companyId===id&&(!deptFilter||dep.id===deptFilter)&&clean(dep.name).includes(clean(query.trim())))))continue;const box=companyGroup(id,name,matches);(mode==='departments'?renderDepartments:renderHierarchy)(id,box,matches);canvas.append(box)}
   if(!canvas.children.length)canvas.append(make('p','oc-empty','Nenhum resultado encontrado. Ajuste os filtros ou cadastre os vínculos na Estrutura organizacional.'));canvas.style.zoom=String(scale/100)
  }
  function setMode(value){mode=value;depTab.setAttribute('aria-pressed',String(mode==='departments'));treeTab.setAttribute('aria-pressed',String(mode==='hierarchy'));paint()}
  setMode(mode)
 }
 renderFoundation=function(root,...args){return page===PAGE?show(root):oldRender(root,...args)}
})()
