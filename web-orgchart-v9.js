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
  let fitCompact=false;let mode='hierarchy',query='',companyFilter='',deptFilter='',unitFilter='',scale=100,selected=null,tags=true,stage=null,surface=null,edges=null,nodes=new Map(),links=[],collapsed=new Set(),offsets=new Map(),boardWidth=0,boardHeight=0,paintFrame=0,autoFit=true
  if(people.length>150)for(const p of people)if(p.managerId&&direct.has(p.id))collapsed.add(p.id)
  const section=make('section','oc9'),hero=make('div','oc-hero'),heroText=make('div');heroText.append(make('h1','','Organograma corporativo'),make('p','oc-subtitle','Diretório de pessoas e relações de liderança.'))
  const refresh=button('↻ Atualizar mapa',()=>void show(root));hero.append(heroText,refresh);section.append(hero)
  const stats=make('div','oc-stats');for(const [value,label] of [[data.counts.companies,'Empresas'],[data.counts.departments,'Departamentos'],[data.counts.people,'Pessoas com conta ativa'],[data.counts.managers,'Gestores com equipe']]){const box=make('div','oc-stat');box.append(make('strong','',String(value)),make('span','',label));stats.append(box)}section.append(stats)
  const tools=make('div','oc-tools'),tabs=make('div','oc-tabs');tabs.setAttribute('aria-label','Visualização do mapa')
  const depTab=button('Departamentos',()=>setMode('departments')),treeTab=button('Hierarquia de gestores',()=>setMode('hierarchy'));tabs.append(depTab,treeTab);tools.append(tabs)
  const filterRow=make('div','oc-filters'),searchLabel=make('label','oc-field');searchLabel.append(make('span','','Buscar pessoa, cargo ou setor'));const searchInput=make('input');searchInput.type='search';searchInput.placeholder='Ex.: Financeiro, gerente…';searchInput.addEventListener('input',()=>{query=searchInput.value;paint()});searchLabel.append(searchInput);filterRow.append(searchLabel)
  const companySelect=selectField('Empresa',[['','Todas autorizadas'],...companies.map(c=>[c.id,c.name]),...(people.some(p=>!p.companyId)?[['~unassigned','Sem vínculo empresarial']]:[])],v=>{companyFilter=v;deptFilter='';unitFilter='';fillFilters();paint()});filterRow.append(companySelect.field)
  const depSelect=selectField('Departamento',[],v=>{deptFilter=v;paint()}),unitSelect=selectField('Unidade',[],v=>{unitFilter=v;paint()});filterRow.append(depSelect.field,unitSelect.field);tools.append(filterRow)
  function fillFilters(){for(const [control,rows,missing] of [[depSelect,departments,'Sem departamento'],[unitSelect,units,'Sem unidade']]){control.select.replaceChildren();for(const [id,label] of [['','Todos'],...rows.filter(x=>!companyFilter||x.companyId===companyFilter).map(x=>[x.id,x.name]),['~none',missing]]){const opt=make('option','',label);opt.value=id;control.select.append(opt)}control.select.value=''}}fillFilters()
  const controls=make('div','oc-controls'),count=make('span','oc-count');count.setAttribute('role','status');const scaleLabel=make('span','oc-scale','100%')
  const zoom=delta=>{autoFit=false;setZoom(scale+delta)}
  const expand=button('Expandir tudo',()=>{collapsed.clear();if(mode==='hierarchy')paint();else canvas.querySelectorAll('details').forEach(x=>x.open=true)}),collapse=button('Recolher tudo',()=>{if(mode==='hierarchy'){for(const id of direct.keys())collapsed.add(id);paint()}else canvas.querySelectorAll('details').forEach(x=>x.open=false)})
  const minus=button('−',()=>zoom(-10)),plus=button('+',()=>zoom(10));minus.setAttribute('aria-label','Reduzir mapa');plus.setAttribute('aria-label','Ampliar mapa');
  const tagToggle=button('Ocultar etiquetas',()=>{tags=!tags;tagToggle.textContent=tags?'Ocultar etiquetas':'Mostrar etiquetas';tagToggle.setAttribute('aria-pressed',String(tags));section.classList.toggle('oc-hide-tags',!tags)});tagToggle.setAttribute('aria-pressed','true');
  const fit=button('Ajustar à tela',()=>{autoFit=true;fitCompact=true;fitBoard()}),reset=button('Restaurar posições',()=>{offsets.clear();autoFit=true;fitCompact=false;paint()}),full=button('Tela cheia',async()=>{try{if(document.fullscreenElement===section)await document.exitFullscreen();else if(section.requestFullscreen)await section.requestFullscreen();else toast('Tela cheia não disponível neste navegador.')}catch{toast('Não foi possível abrir tela cheia.')}});
  controls.append(count,expand,collapse,tagToggle,minus,scaleLabel,plus,fit,reset,full);tools.append(controls);section.append(tools)
  const note=make('p','oc-note',data.scope==='administration'?'Escopo administrativo · o mapa inclui contas ativas sem vínculo, quando houver.':'Escopo da sua empresa · somente dados profissionais básicos. O acesso a registros de RH continua restrito.');
  const detail=make('section','oc-detail');detail.hidden=true;detail.setAttribute('aria-label','Dados profissionais selecionados');section.append(detail)
  const viewport=make('div','oc-viewport');viewport.tabIndex=0;viewport.setAttribute('aria-label','Mapa organizacional, arraste a lousa para navegar');const canvas=make('div','oc-canvas');viewport.append(canvas);section.append(viewport)
  const help=make('p','oc-note','Arraste os cartões para organizar a visualização; arraste o fundo para navegar. Clique no cartão para abrir o perfil. As setas do teclado movem o cartão em foco. Nenhuma posição altera os vínculos oficiais.');section.append(help,note)
  let pan=null;viewport.addEventListener('pointerdown',ev=>{if(mode!=='hierarchy'||ev.button!==0||ev.target.closest('button,input,select,.oc-map-card'))return;pan={id:ev.pointerId,x:ev.clientX,y:ev.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(ev.pointerId);viewport.classList.add('oc-panning')});viewport.addEventListener('pointermove',ev=>{if(!pan||pan.id!==ev.pointerId)return;viewport.scrollLeft=pan.left+pan.x-ev.clientX;viewport.scrollTop=pan.top+pan.y-ev.clientY});const stopPan=ev=>{if(pan?.id===ev.pointerId){pan=null;viewport.classList.remove('oc-panning')}};for(const evt of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(evt,stopPan)
  viewport.addEventListener('wheel',ev=>{if(mode!=='hierarchy'||!ev.ctrlKey)return;ev.preventDefault();autoFit=false;setZoom(scale+(ev.deltaY<0?10:-10),ev.clientX,ev.clientY)},{passive:false});
  const resize=new ResizeObserver(()=>{if(current()&&mode==='hierarchy'&&stage&&autoFit)fitBoard()});resize.observe(viewport);const lifetime=new MutationObserver(()=>{if(!current()){resize.disconnect();lifetime.disconnect();if(paintFrame)cancelAnimationFrame(paintFrame)}});lifetime.observe(document.body,{childList:true,subtree:true})
  const footer=make('p','oc-note','Fonte: cadastro de pessoas, empresas, unidades e departamentos do Learning. Não representa headcount de folha de pagamento.');section.append(footer);root.append(section)
  const matchesCompany=p=>!companyFilter||(companyFilter==='~unassigned'?!p.companyId:p.companyId===companyFilter)
  const matchesDept=p=>!deptFilter||(deptFilter==='~none'?!p.departmentId:p.departmentId===deptFilter)
  const matchesUnit=p=>!unitFilter||(unitFilter==='~none'?!p.unitId:p.unitId===unitFilter)
  function personMatches(p){const text=[p.name,p.position,deptById.get(p.departmentId)?.name,unitById.get(p.unitId)?.name,personById.get(p.managerId)?.name].join(' ');return matchesCompany(p)&&matchesDept(p)&&matchesUnit(p)&&clean(text).includes(clean(query.trim()))}
  function showPerson(p){if(!current())return;selected=p.id;detail.hidden=false;detail.replaceChildren();const top=make('div','oc-detail-header');top.append(make('h2','',p.name),button('Fechar',()=>{selected=null;detail.hidden=true}));detail.append(top);const fields=make('dl','oc-dl');for(const [key,value] of [['Cargo',p.position],['Empresa',companyById.get(p.companyId)?.name||'Sem vínculo'],['Departamento',deptById.get(p.departmentId)?.name||'Não informado'],['Unidade',unitById.get(p.unitId)?.name||'Não informada'],['Gestor',personById.get(p.managerId)?.name||statuses[p.managerStatus]||'Não informado'],['Liderados diretos',String(p.directReports)]]){const cell=make('div');cell.append(make('dt','',key),make('dd','',value));fields.append(cell)}detail.append(fields);const seen=new Set();let node=p,within=false;while(node&&!seen.has(node.id)&&node.companyId===p.companyId){if(node.id===d?.me?.id){within=true;break}seen.add(node.id);node=personById.get(node.managerId)}if(d?.me?.role==='Administrador'||within){const profile=make('button','oc-btn','Perfil integrado');profile.type='button';profile.dataset.profileV16=p.id;detail.append(profile)}if(d?.me?.role==='Administrador'){
  const historyPanel=make('div','oc-history');const historyButton=button('Histórico de vínculos',async()=>{
   historyButton.disabled=true;historyPanel.replaceChildren(make('p','','Consultando histórico…'))
   try{const result=await api('organization/v11/history?person='+encodeURIComponent(p.id)+'&limit=50');if(!current()||selected!==p.id||!historyPanel.isConnected)return
    historyPanel.replaceChildren(make('h3','','Vínculos observados'),make('p','',result.method||''))
    for(const r of result.assignments||[]){const line=make('p','');line.textContent=(companyById.get(r.company_id)?.name||'Empresa histórica')+' · '+(r.position||'Cargo não informado')+' · '+new Date(r.valid_from).toLocaleDateString('pt-BR')+' → '+(r.valid_to?new Date(r.valid_to).toLocaleDateString('pt-BR'):'Atual');historyPanel.append(line)}
    if(!result.assignments?.length)historyPanel.append(make('p','','Nenhum vínculo observado.'))
    historyPanel.append(make('h3','','Gestores observados'))
    for(const r of result.managers||[])historyPanel.append(make('p','',(personById.get(r.manager_id)?.name||(r.manager_id?'Gestor histórico':'Sem gestor'))+' · '+new Date(r.valid_from).toLocaleDateString('pt-BR')+' → '+(r.valid_to?new Date(r.valid_to).toLocaleDateString('pt-BR'):'Atual')))
    if(result.total>result.limit)historyPanel.append(make('p','','Exibindo os '+result.limit+' vínculos mais recentes.'))
   }catch(error){if(current()&&selected===p.id)historyPanel.replaceChildren(make('p','',error.message))}finally{historyButton.disabled=false}
  });detail.append(historyButton,historyPanel)
 }detail.scrollIntoView({block:'nearest'});top.querySelector('button').focus({preventScroll:true})}
  function personCard(p,context=false){const b=make('button','oc-person'+(context?' oc-context':''));b.type='button';const icon=make('span','oc-avatar',initials(p.name));icon.setAttribute('aria-hidden','true');const info=make('span','oc-person-info');info.append(make('strong','',p.name),make('small','',p.position));if(mode==='hierarchy')info.append(make('small','',deptById.get(p.departmentId)?.name||'Sem departamento'));else info.append(make('small','',personById.get(p.managerId)?.name?'Gestor: '+personById.get(p.managerId).name:statuses[p.managerStatus]||''));b.append(icon,info);if(p.directReports)b.append(make('span','oc-pill',String(p.directReports)));if(context)b.append(make('span','oc-context-label','Contexto'));b.addEventListener('click',()=>showPerson(p));return b}
  function companyGroup(id,name,filtered){const box=make('section','oc-company');const title=make('div','oc-company-title');title.append(make('span','oc-eyebrow','EMPRESA'),make('h2','',name),make('span','oc-pill',plural(filtered.length,'pessoa','pessoas')));box.append(title);return box}
  function renderDepartments(id,box,filtered){
   const branch=make('div','oc-dept-branches');const ds=departments.filter(x=>x.companyId===id&&(!deptFilter||deptFilter===x.id));const groupByDept=new Map();for(const p of filtered){const key=p.departmentId||'~none';if(!groupByDept.has(key))groupByDept.set(key,[]);groupByDept.get(key).push(p)}
   const items=[...ds.map(x=>[x.id,x.name]),...(groupByDept.has('~none')?[['~none','Sem departamento definido']]:[])]
   for(const [key,name] of items){const list=groupByDept.get(key)||[];if((query.trim()||unitFilter)&&!list.length&&!clean(name).includes(clean(query.trim())))continue;const card=make('details','oc-dept');card.open=true;const sum=make('summary','oc-dept-head');sum.append(make('strong','',name),make('span','oc-pill',plural(list.length,'pessoa','pessoas')));card.append(sum);const members=make('div','oc-members');if(!list.length)members.append(make('p','oc-empty','Nenhum integrante no recorte.'));for(const p of list)members.append(personCard(p));card.append(members);branch.append(card)}
   if(!branch.children.length)branch.append(make('p','oc-empty','Nenhum departamento ou integrante neste recorte.'));box.append(branch)
  }
  // Layout is derived from the authorized projection. No mutation of managerId or server data.
  const W=220,H=116,GAP=32,LEVEL=64,PAD=36,COMPANY_GAP=84
  function setZoom(value,clientX,clientY){
   const old=scale/100;scale=Math.max(35,Math.min(180,Math.round(value)));scaleLabel.textContent=scale+'%'
   if(mode!=='hierarchy'){canvas.style.zoom=String(scale/100);return}if(!stage)return
   const rect=viewport.getBoundingClientRect(),cx=clientX===undefined?viewport.clientWidth/2:clientX-rect.left,cy=clientY===undefined?viewport.clientHeight/2:clientY-rect.top
   const worldX=(viewport.scrollLeft+cx)/old,worldY=(viewport.scrollTop+cy)/old;sizeStage();viewport.scrollLeft=worldX*scale/100-cx;viewport.scrollTop=worldY*scale/100-cy
  }
  function fitBoard(){if(mode!=='hierarchy'){setZoom(100);return}if(!stage)return;setZoom(Math.max(fitCompact?35:70,Math.min(100,Math.floor((viewport.clientWidth-12)/boardWidth*100))));viewport.scrollLeft=Math.max(0,(boardWidth*scale/100-viewport.clientWidth)/2);viewport.scrollTop=0}
  function sizeStage(){if(!stage)return;surface.style.width=Math.max(viewport.clientWidth,Math.ceil(boardWidth*scale/100))+'px';surface.style.height=Math.max(480,Math.ceil(boardHeight*scale/100))+'px';stage.style.width=boardWidth+'px';stage.style.height=boardHeight+'px';stage.style.transform='scale('+scale/100+')';stage.style.left=Math.max(0,(viewport.clientWidth-boardWidth*scale/100)/2)+'px';edges.setAttribute('width',boardWidth);edges.setAttribute('height',boardHeight)}
  function drawEdges(){if(!stage||!stage.isConnected)return;for(const edge of links){const a=nodes.get(edge.from),b=nodes.get(edge.to);if(!a||!b)continue;let x=a.x+W/2,y=a.y+H,tx=b.x+W/2,ty=b.y;const mid=y+(ty-y)/2;let path;if(edge.stack){const rail=Math.min(a.x+W/2,b.x-16);path=`M ${x} ${y} V ${y+16} H ${rail} V ${b.y+H/2} H ${b.x}`}else path=`M ${x} ${y} V ${mid} H ${tx} V ${ty}`;edge.path.setAttribute('d',path)}}
  function redrawEdges(){if(paintFrame)return;paintFrame=requestAnimationFrame(()=>{paintFrame=0;drawEdges()})}
  function moveNode(n,x,y){n.x=Math.max(8,Math.min(1000000,x));n.y=Math.max(40,Math.min(1000000,y));n.el.style.left=n.x+'px';n.el.style.top=n.y+'px';offsets.set(n.id,{x:n.x-n.baseX,y:n.y-n.baseY});const width=Math.max(boardWidth,n.x+W+PAD),height=Math.max(boardHeight,n.y+H+PAD);if(width!==boardWidth||height!==boardHeight){boardWidth=width;boardHeight=height;sizeStage()}redrawEdges()}
  function createMapCard(p,x,y,context,children){
   const el=make('article','oc-map-card'+(context?' oc-context':''));el.dataset.personId=p.id;el.style.left=x+'px';el.style.top=y+'px';el.setAttribute('aria-label',p.name)
   const b=make('button','oc-map-main');b.type='button';b.setAttribute('aria-label','Abrir perfil de '+p.name);const av=make('span','oc-map-avatar',initials(p.name));av.setAttribute('aria-hidden','true');const info=make('span','oc-map-info');info.append(make('strong','',p.name),make('small','',p.position));b.append(av,info);el.append(b)
   const badges=make('div','oc-map-tags');badges.append(make('span','',deptById.get(p.departmentId)?.name||'Sem departamento'));if(p.directReports)badges.append(make('span','','Liderança'));if(context)badges.append(make('span','','Contexto'));el.append(badges)
   const bottom=make('div','oc-map-footer');if(children.length){const toggle=button(plural(children.length,'liderado','liderados')+(collapsed.has(p.id)&&!query.trim()&&!deptFilter&&!unitFilter?' ▸':' ▾'),()=>{if(collapsed.has(p.id))collapsed.delete(p.id);else collapsed.add(p.id);paint()});toggle.className='oc-map-toggle';const filtering=Boolean(query.trim()||deptFilter||unitFilter),open=filtering||!collapsed.has(p.id);toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',(open?'Recolher ':'Expandir ')+'liderados de '+p.name);toggle.disabled=filtering;bottom.append(toggle)}else bottom.append(make('span','',p.managerStatus==='cycle'?'Revisar vínculo':p.managerStatus==='unavailable'?'Gestor indisponível':'Perfil profissional'));el.append(bottom)
   const n={id:p.id,el,baseX:x,baseY:y,x,y};nodes.set(p.id,n);stage.append(el);const off=offsets.get(p.id);if(off){n.x=Math.max(8,x+off.x);n.y=Math.max(40,y+off.y);el.style.left=n.x+'px';el.style.top=n.y+'px'}
   let drag=null,suppress=false;b.addEventListener('click',ev=>{if(suppress&&ev.detail!==0){ev.preventDefault();suppress=false;return}suppress=false;showPerson(p)});
   el.addEventListener('pointerdown',ev=>{if(ev.button!==0||ev.target.closest('.oc-map-toggle'))return;suppress=false;drag={id:ev.pointerId,x:ev.clientX,y:ev.clientY,left:n.x,top:n.y,moved:false};(ev.target.closest('button')||el).setPointerCapture(ev.pointerId)});
   el.addEventListener('pointermove',ev=>{if(!drag||drag.id!==ev.pointerId)return;const dx=ev.clientX-drag.x,dy=ev.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<5)return;drag.moved=true;suppress=true;autoFit=false;el.classList.add('oc-dragging');moveNode(n,drag.left+dx/(scale/100),drag.top+dy/(scale/100))});
   const stop=ev=>{if(drag?.id!==ev.pointerId)return;const moved=drag.moved;drag=null;el.classList.remove('oc-dragging');if(moved)suppress=true};for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,stop);
   b.addEventListener('keydown',ev=>{const delta={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]}[ev.key];if(!delta)return;ev.preventDefault();autoFit=false;moveNode(n,n.x+delta[0],n.y+delta[1])});
   return n
  }
  function treeData(id,filtered){
   const include=new Set(filtered.map(x=>x.id)),matched=new Set(include);for(const p of filtered){let m=personById.get(p.managerId);while(m&&m.companyId===id&&!include.has(m.id)){include.add(m.id);m=personById.get(m.managerId)}}
   const roots=people.filter(p=>include.has(p.id)&&p.companyId===id&&(!p.managerId||!include.has(p.managerId)));const children=p=>(direct.get(p.id)||[]).filter(x=>include.has(x.id));const records=new Map(),stack=roots.map(p=>({p,depth:0,exit:false})).reverse(),seen=new Set()
   while(stack.length){const {p,depth,exit}=stack.pop();if(exit){const n=records.get(p.id);const cs=n.visible.map(x=>records.get(x.id));n.stacked=depth>0&&cs.length>1&&cs.every(x=>x.visible.length===0);n.width=n.stacked?W+24:Math.max(W,cs.reduce((sum,c)=>sum+c.width,0)+Math.max(0,cs.length-1)*GAP);continue}if(seen.has(p.id))continue;seen.add(p.id);const all=children(p),visible=collapsed.has(p.id)&&!query.trim()&&!deptFilter&&!unitFilter?[]:all;records.set(p.id,{p,all,visible,width:W});stack.push({p,depth,exit:true});for(let i=visible.length-1;i>=0;i--)stack.push({p:visible[i],depth:depth+1,exit:false})}
   return {roots,records,matched,width:roots.reduce((sum,p)=>sum+records.get(p.id).width,0)+Math.max(0,roots.length-1)*GAP}
  }
  function renderTree(groups){
   canvas.classList.add('oc-tree-canvas');canvas.style.zoom='';surface=make('div','oc-map-surface');stage=make('div','oc-map-stage');edges=document.createElementNS('http://www.w3.org/2000/svg','svg');edges.classList.add('oc-map-edges');edges.setAttribute('aria-hidden','true');stage.append(edges);surface.append(stage);canvas.append(surface);nodes=new Map();links=[];boardWidth=0;boardHeight=0
   const nonempty=groups.filter(g=>g.filtered.length);const emptyGroups=groups.filter(g=>!g.filtered.length);const prepared=nonempty.map(g=>({...g,tree:treeData(g.id,g.filtered)}));const contentWidth=prepared.reduce((n,g)=>n+Math.max(W,g.tree.width),0)+Math.max(0,prepared.length-1)*COMPANY_GAP;let left=Math.max(PAD,(560-contentWidth)/2),maxY=0
   for(const g of prepared){const tree=g.tree,width=Math.max(W,tree.width),header=make('div','oc-map-company');header.textContent=g.name+' · '+plural(g.filtered.length,'pessoa','pessoas');header.style.left=left+'px';header.style.width=width+'px';stage.append(header);let start=left;const stack=[];for(const p of tree.roots){const n=tree.records.get(p.id);stack.push({n,left:start,y:78,stacked:false,parent:null});start+=n.width+GAP}
    while(stack.length){const {n,left:lx,y,stacked,parent}=stack.pop(),x=lx+(n.width-W)/2;createMapCard(n.p,x,y,!tree.matched.has(n.p.id),n.all);maxY=Math.max(maxY,y+H);if(parent){const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.dataset.from=parent;path.dataset.to=n.p.id;edges.append(path);links.push({from:parent,to:n.p.id,path,stack:stacked})}const childY=y+H+LEVEL;if(n.stacked){for(let i=n.visible.length-1;i>=0;i--)stack.push({n:tree.records.get(n.visible[i].id),left:lx+24,y:childY+i*(H+22),stacked:true,parent:n.p.id})}else{const width=n.visible.reduce((sum,p)=>sum+tree.records.get(p.id).width,0)+Math.max(0,n.visible.length-1)*GAP;let l=lx+(n.width-width)/2;for(const p of n.visible){const ch=tree.records.get(p.id);stack.push({n:ch,left:l,y:childY,stacked:false,parent:n.p.id});l+=ch.width+GAP}}}
    left+=width+COMPANY_GAP
   }
   if(!nonempty.length){const text=make('p','oc-map-no-results','Nenhuma pessoa neste recorte. Ajuste os filtros ou cadastre os vínculos.');stage.append(text);left=560;maxY=160}
   if(emptyGroups.length){const label=make('p','oc-map-empty-companies','Empresas sem pessoas neste recorte: '+emptyGroups.map(g=>g.name).join(' · '));label.style.left=PAD+'px';label.style.top=(maxY+22)+'px';stage.append(label);maxY+=62}
   boardWidth=Math.max(560,left-COMPANY_GAP+PAD);boardHeight=Math.max(480,maxY+PAD);for(const n of nodes.values()){boardWidth=Math.max(boardWidth,n.x+W+PAD);boardHeight=Math.max(boardHeight,n.y+H+PAD)}sizeStage();drawEdges();if(autoFit)fitBoard();else setZoom(scale)
  }
  function paint(){if(!current())return;const filtered=people.filter(personMatches);count.textContent=plural(filtered.length,'pessoa no mapa','pessoas no mapa');if(selected&&!filtered.some(x=>x.id===selected)){selected=null;detail.hidden=true}
   const rows=[...companies.map(c=>[c.id,c.name]),...(people.some(p=>!p.companyId)?[[null,'Sem vínculo empresarial']]:[])].filter(([id])=>!companyFilter||(companyFilter==='~unassigned'?!id:companyFilter===id));const groups=rows.map(([id,name])=>({id,name,filtered:filtered.filter(p=>p.companyId===id)}));canvas.replaceChildren();stage=null;surface=null;edges=null;canvas.classList.toggle('oc-tree-canvas',mode==='hierarchy');viewport.classList.toggle('oc-tree-viewport',mode==='hierarchy');
   if(mode==='hierarchy'){renderTree(groups);return}
   for(const {id,name,filtered:matches} of groups){if(!matches.length&&(query.trim()||unitFilter||deptFilter)&&!(!unitFilter&&departments.some(dep=>dep.companyId===id&&(!deptFilter||dep.id===deptFilter)&&clean(dep.name).includes(clean(query.trim())))))continue;const box=companyGroup(id,name,matches);renderDepartments(id,box,matches);canvas.append(box)}
   if(!canvas.children.length)canvas.append(make('p','oc-empty','Nenhum resultado encontrado. Ajuste os filtros ou cadastre os vínculos na Estrutura organizacional.'));canvas.style.zoom=String(scale/100)
  }
  function setMode(value){mode=value;autoFit=true;fitCompact=false;scale=100;scaleLabel.textContent='100%';depTab.setAttribute('aria-pressed',String(mode==='departments'));treeTab.setAttribute('aria-pressed',String(mode==='hierarchy'));paint()}
  setMode(mode)
 }
 renderFoundation=function(root,...args){return page===PAGE?show(root):oldRender(root,...args)}
})()
