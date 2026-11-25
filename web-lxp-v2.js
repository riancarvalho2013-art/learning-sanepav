/* DNA do Desenvolvimento — LXP V2 interface, layered on existing app, no frameworks. */
(() => {
'use strict'
const routeLabels={'Pulse':'Pulse de sentimentos e pesquisas identificadas','Desempenho':'Avaliações de desempenho','PDI':'Plano de desenvolvimento','1:1':'Conversas 1:1','Feedback':'Feedback e conexões','Minha jornada':'Minha jornada','Meu acesso':'Meu acesso'}
const svgPath={pulse:'<path d="M2 12h4l3-6 5 12 3-6h5"/>',performance:'<path d="m4 16 5-5 4 3 7-9M15 5h5v5M4 21h16"/>',growth:'<path d="M12 22v-8M12 14C4 15 3 7 3 4c4 0 8 1 9 7 1-6 5-7 9-7 0 5-2 10-9 10Z"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',feedback:'<path d="M21 11a8 8 0 0 1-8 8h-5l-4 3v-6A8 8 0 1 1 21 11Z"/><path d="M8 10h8M8 14h5"/>',learning:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',check:'<path d="m4 12 5 5 11-11"/>',person:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',edit:'<path d="m4 20 4-.7L20 7a2 2 0 0 0-3-3L5 16Z"/>'}
const ic=k=>'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(svgPath[k]||svgPath.learning)+'</svg>'
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const shortDate=v=>v?new Date(v+'T12:00:00Z').toLocaleDateString('pt-BR'):'—'
const iso=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const canManage=()=>['Administrador','RH/DHO'].includes(d?.me?.role)
const canCreatePulse=()=>canManage()||d?.me?.role==='Líder'
const companies=()=>organizationData?.companies||[]
const companyPick=()=>organizationCompany||organizationData?.people?.find(p=>p.id===d?.me?.id)?.company_id||companies()[0]?.id||''
const companyList=(selected='')=>companies().map(c=>'<option value="'+e(c.id)+'"'+(c.id===selected?' selected':'')+'>'+e(c.name)+'</option>').join('')
const field=(label,name,value='',type='text',extra='')=>'<label class="lxp-field"><span>'+e(label)+'</span><input type="'+e(type)+'" name="'+e(name)+'" value="'+e(value)+'" '+extra+'></label>'
const textarea=(label,name,value='',extra='')=>'<label class="lxp-field"><span>'+e(label)+'</span><textarea name="'+e(name)+'" '+extra+'>'+e(value)+'</textarea></label>'
const select=(label,name,options,selected='')=>'<label class="lxp-field"><span>'+e(label)+'</span><select name="'+e(name)+'">'+options.map(([v,l])=>'<option value="'+e(v)+'"'+(String(v)===String(selected)?' selected':'')+'>'+e(l)+'</option>').join('')+'</select></label>'
const button=(label,action,id='',cls='')=>'<button type="button" class="lxp-btn '+e(cls)+'" data-lxp="'+e(action)+'" data-id="'+e(id)+'">'+e(label)+'</button>'
const screen=(eyebrow,title,description,content,actions='')=>'<div class="lxp-page"><header class="lxp-heading"><div class="lxp-heading-body"><span class="lxp-overline">'+e(eyebrow)+'</span><h1>'+e(title)+'</h1><p>'+e(description)+'</p></div><div class="lxp-heading-actions">'+actions+'</div></header>'+content+'</div>'
const panel=(title,content,note='')=>'<section class="lxp-panel"><div class="lxp-panel-top"><h2>'+e(title)+'</h2>'+(note?'<span>'+e(note)+'</span>':'')+'</div>'+content+'</section>'
const boxInfo=(title,body)=>'<div class="lxp-note"><strong>'+e(title)+'</strong><p>'+e(body)+'</p></div>'
const empty=(title,desc)=>'<div class="lxp-blank">'+ic('learning')+'<h3>'+e(title)+'</h3><p>'+e(desc)+'</p></div>'
const metric=(label,value,desc)=>'<article class="lxp-metric"><span>'+e(label)+'</span><strong>'+e(value)+'</strong><small>'+e(desc)+'</small></article>'
const status=(s)=>'<span class="lxp-pill lxp-status-'+e(s)+'">'+e(({open:'Em andamento',closed:'Encerrado',scheduled:'Agendado',published:'Publicado',calibration:'Em calibração',draft:'Rascunho',submitted:'Respondida',pending:'Pendente',answered:'Respondido',requested:'Solicitado',todo:'Planejado',doing:'Em execução',done:'Concluído'})[s]||s)+'</span>'
const load=()=>'<div class="lxp-progress" role="status" aria-live="polite"><span class="lxp-spinner"></span> Carregando seu desenvolvimento…</div>'
const error=msg=>'<div class="lxp-error" role="alert">'+e(msg)+'</div>'
const root=()=>$('inside')
const apiLxp=(name,data)=>api('lxp/v2/'+name,data)
const notify=msg=>typeof toast==='function'?toast(msg):console.info(msg)
const linkLegacy=kind=>{const rows=(d?.records||[]).filter(x=>x.kind===kind);return rows.length?panel('Registros anteriores','<div class="lxp-stack">'+rows.slice(0,40).map(x=>'<div class="lxp-line"><div><strong>'+e(x.title)+'</strong><small>'+e(x.status||'Em andamento')+'</small></div>'+button('Consultar / editar','legacy',x.id)+'</div>').join('')+'</div>',''+rows.length+' registros do Learning original'):''}
const validCompanyIds=()=>companies().map(x=>x.id)
const deptOptions=companyId=>(organizationData?.departments||[]).filter(x=>x.company_id===companyId)
const personOptions=()=>[...(organizationData?.people||d.people||[])].filter(p=>p.active!==false&&p.id!==d?.me?.id)
const safe=async(fn)=>{try{return await fn()}catch(ex){notify(ex.message||'Falha na solicitação.');throw ex}}
let renderToken=0,subpage='',perfCycleId='',taskId='',lxpPerfDraft=null,lxpCurrentPulse=''
function enterScreen(html){const el=root();if(el){el.innerHTML=html;el.scrollIntoView({block:'start',behavior:'instant'});window.scrollTo({top:0,behavior:'instant'})}}
async function asyncScreen(loadHtml,fn){const token=++renderToken,route=page,anchor=root();enterScreen(loadHtml);const current=()=>token===renderToken&&page===route&&root()===anchor&&Boolean(d?.me);try{return await fn(current)}catch(ex){if(current()){anchor.querySelector('.lxp-progress')?.remove();anchor.insertAdjacentHTML('beforeend',error(ex.message))};return null}}
function names(id){return (organizationData?.people||d?.people||[]).find(x=>x.id===id)?.name||'Colaborador'}
function enhanceMenu(){
 const nav=document.querySelector('aside nav');if(!nav)return
 let cluster=nav.querySelector('#lxpNavigation')
 if(!cluster){cluster=document.createElement('div');cluster.id='lxpNavigation';nav.append(cluster)}
 const entries=[['Minha jornada','growth'],['Meu acesso','person']]
 cluster.innerHTML='<small>Experiência e autonomia</small>'+entries.map(([name,type])=>'<button type="button" data-act="nav" data-id="'+e(name)+'" class="'+(page===name?'sel':'')+'"><span class="ico">'+ic(type)+'</span>'+e(name)+'</button>').join('')
 for(const [name,icon] of [['Pulse','pulse'],['Desempenho','performance'],['PDI','growth'],['1:1','calendar'],['Feedback','feedback']]){
  const item=[...nav.querySelectorAll('button[data-id]')].find(b=>b.dataset.id===name)
  if(item){const ico=item.querySelector('.ico');if(ico)ico.innerHTML=ic(icon);item.title=routeLabels[name];if(name==='Pulse'){const label=[...item.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).at(-1);if(label)label.textContent='Pulse de sentimentos'}}
 }
}
const priorDraw=draw
draw=function(...args){const result=priorDraw(...args);enhanceMenu();return result}
const priorBody=body
body=function(...args){
 ++renderToken
 if(page==='Pulse'){void renderPulse();return}
 if(page==='Desempenho'){void renderPerformance();return}
 if(page==='PDI'){void renderGrowth();return}
 if(page==='OKR'){void renderOKR13();return}
 if(page==='1:1'){void renderMeetings();return}
 if(page==='Feedback'){void renderFeedback();return}
 if(page==='Minha jornada'){void renderJourney();return}
 if(page==='Meu acesso'){void renderAccess();return}
 priorBody(...args)
 if(page==='Pessoas'&&d?.me?.role==='Administrador'){importButton();inviteButtons17()}
}

// First-access invitations: one click sends only to the persisted corporate address.
const inviteInFlight17=new Set()
function inviteEligible17(id){const p=organizationData?.people?.find(x=>x.id===id);return d?.me?.role==='Administrador'&&p&&p.active&&p.role!=='Administrador'&&p.id!==d.me.id&&p.email?p:null}
function inviteWidget17(p){return '<span class="invite17"><button type="button" class="lxp-btn" data-invite17="'+e(p.id)+'" title="Enviar convite para '+e(p.email)+'"'+(inviteInFlight17.has(p.id)?' disabled':'')+'>Enviar convite para primeiro acesso</button><small role="status" aria-live="polite" data-invite-status17></small></span>'}
function inviteButtons17(){for(const edit of root()?.querySelectorAll('button[data-act="user"][data-id]')||[]){const p=inviteEligible17(edit.dataset.id),row=edit.closest('td .actions')||edit.parentElement;if(p&&row&&!row.querySelector('[data-invite17]'))row.insertAdjacentHTML('beforeend',inviteWidget17(p))}}
if(typeof userForm==='function'){const oldUserForm17=userForm;userForm=function(id,...args){const result=oldUserForm17(id,...args),p=inviteEligible17(id),host=$('modalBody');if(p&&host&&!host.querySelector('[data-invite17]'))host.insertAdjacentHTML('beforeend','<section class="invite17-panel"><strong>Convite de primeiro acesso</strong><p>O convite será enviado para o e-mail salvo: '+e(p.email)+'. Salve alterações no cadastro antes de enviar.</p>'+inviteWidget17(p)+'</section>');return result}}
document.addEventListener('click',async ev=>{const b=ev.target.closest('[data-invite17]');if(!b)return;ev.preventDefault();const p=inviteEligible17(b.dataset.invite17);if(!p||inviteInFlight17.has(p.id))return;const status=b.parentElement.querySelector('[data-invite-status17]');inviteInFlight17.add(p.id);b.disabled=true;b.textContent='Enviando…';if(status)status.textContent='';try{const result=await api('first-access/invite',{personId:p.id,requestId:crypto.randomUUID()});if(b.isConnected){b.textContent='Convite enviado';if(status)status.textContent=result.message;setTimeout(()=>{if(b.isConnected){b.disabled=false;b.textContent='Reenviar convite'}},60000)}notify(result.message)}catch(ex){if(b.isConnected){b.disabled=false;b.textContent='Enviar convite para primeiro acesso';if(status)status.textContent=ex.message}notify(ex.message)}finally{inviteInFlight17.delete(p.id)}})

// Excel import is confined to the administration page and uses the existing modal.
const importHeaders=['nome','email','perfil','empresa','departamento','unidade','cargo','gestor_email','admissao','senha_inicial']
let importRows=null,importPreview=null,importRun=0
function clearImport(){importRun++;importRows=null;importPreview=null}
function importButton(){const h=root()?.querySelector('.heading .page-actions')||root()?.querySelector('.heading')||root();if(!h||h.querySelector('[data-import-open]'))return;h.insertAdjacentHTML('beforeend','<button type="button" class="lxp-btn" data-import-open>Importar usuários (Excel)</button>')}
function importModal(){if(d?.me?.role!=='Administrador'||page!=='Pessoas')return;clearImport();$('modalBody').innerHTML='<section class="lxp-page bulk-import"><h2>Importar usuários por Excel</h2><p>Cadastre até 100 pessoas por vez. A importação é somente de novos usuários; todos os registros precisam estar válidos para confirmar.</p><a class="lxp-btn" href="/api/users/v14/import/template" download>Baixar modelo Excel</a><p class="lxp-note">Preencha a aba Usuarios. Use o nome ou ID da empresa, departamento e unidade; gestor pelo e-mail. A senha inicial deve ser individual. Proteja a planilha, que contém credenciais.</p><label class="lxp-field"><span>Selecionar planilha .xlsx</span><input id="bulkExcel" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label><p id="bulkStatus" role="status"></p><div id="bulkPreview"></div><div class="lxp-heading-actions"><button class="lxp-btn primary" type="button" data-import-confirm disabled>Confirmar importação</button><button class="lxp-btn" type="button" data-import-cancel>Cancelar</button></div></section>';if(!$('modal').open)$('modal').showModal()}
function xlsxGuard(buffer){const v=new DataView(buffer);let end=-1;for(let i=buffer.byteLength-22;i>=Math.max(0,buffer.byteLength-65557);i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===buffer.byteLength){end=i;break}if(end<0)throw Error('Arquivo Excel inválido.');const n=v.getUint16(end+10,true),size=v.getUint32(end+12,true),start=v.getUint32(end+16,true);if(v.getUint16(end+4,true)||v.getUint16(end+6,true)||n>250||start+size!==end)throw Error('Formato de arquivo não suportado.');let pos=start,total=0;for(let i=0;i<n;i++){if(pos+46>end||v.getUint32(pos,true)!==0x02014b50)throw Error('Estrutura Excel inválida.');const compressed=v.getUint32(pos+20,true),expanded=v.getUint32(pos+24,true),flags=v.getUint16(pos+8,true);total+=expanded;if(flags&1||expanded>8*1024*1024||total>16*1024*1024||compressed>buffer.byteLength)throw Error('Arquivo muito grande ou protegido.');pos+=46+v.getUint16(pos+28,true)+v.getUint16(pos+30,true)+v.getUint16(pos+32,true)}if(pos!==end)throw Error('Estrutura Excel inválida.')}
async function readImportExcel(file){
 if(!file||!file.name.toLowerCase().endsWith('.xlsx')||file.size>2*1024*1024)throw Error('Selecione um arquivo .xlsx de até 2 MB.');if(typeof JSZip==='undefined')throw Error('Leitor Excel indisponível. Atualize a página.');const buffer=await file.arrayBuffer();xlsxGuard(buffer);const zip=await JSZip.loadAsync(buffer)
 const xml=async path=>{const entry=zip.file(path);if(!entry)throw Error('Arquivo Excel sem estrutura válida.');const text=await entry.async('string');if(text.length>8*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('XML não permitido.');const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('XML inválido.');return doc}
 const nodes=(node,name)=>[...node.getElementsByTagNameNS('*',name)],book=await xml('xl/workbook.xml'),sheet=nodes(book,'sheet').find(x=>x.getAttribute('name')==='Usuarios');if(!sheet)throw Error('Use a aba Usuarios do modelo.');const relId=sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||sheet.getAttribute('r:id'),rels=await xml('xl/_rels/workbook.xml.rels'),rel=nodes(rels,'Relationship').find(x=>x.getAttribute('Id')===relId);let path=rel?.getAttribute('Target')||'';path=path.startsWith('/')?path.slice(1):'xl/'+path;if(!/^xl\/worksheets\/[A-Za-z0-9_.-]+\.xml$/.test(path)||rel.getAttribute('TargetMode')==='External')throw Error('Aba de usuários inválida.');const doc=await xml(path),shared=zip.file('xl/sharedStrings.xml')?nodes(await xml('xl/sharedStrings.xml'),'si').map(x=>nodes(x,'t').map(t=>t.textContent).join('')):[],rows=[],header=[];const date1904=['1','true'].includes(nodes(book,'workbookPr')[0]?.getAttribute('date1904'))
 for(const r of nodes(doc,'row')){const number=Number(r.getAttribute('r'));if(!Number.isInteger(number)||number<1||number>101)throw Error('Limite de 100 linhas de dados. Remova linhas excedentes.');const values=Array(importHeaders.length).fill('');for(const c of nodes(r,'c')){if(nodes(c,'f').length)throw Error('Fórmulas não são permitidas na aba Usuarios.');const ref=c.getAttribute('r')||'',m=ref.match(/^([A-Z]+)(\d+)$/);if(!m||Number(m[2])!==number)throw Error('Célula Excel inválida.');let col=0;for(const ch of m[1])col=col*26+ch.charCodeAt(0)-64;col--;const type=c.getAttribute('t'),val=nodes(c,'v')[0]?.textContent||'';let value=type==='s'?shared[Number(val)]:type==='inlineStr'?nodes(c,'t').map(t=>t.textContent).join(''):val;if(value===undefined)throw Error('Texto Excel inválido.');if(col>=importHeaders.length){if(value)throw Error('Colunas adicionais não são permitidas.');continue}if(number>1&&col===8&&value&&(!type||type==='n')){const serial=Number(value);if(Number.isInteger(serial)&&serial>=1&&serial<100000){value=new Date(Date.UTC(1899,11,30)+(serial+(date1904?1462:0))*86400000).toISOString().slice(0,10)}}if(type==='e'||type==='b')throw Error('Célula inválida na linha '+number+'.');values[col]=String(value)}if(number===1){header.push(...values);continue}if(values.some(v=>v.trim()))rows.push({number,values})}
 if(header.length!==importHeaders.length||header.some((v,i)=>v.trim().toLowerCase()!==importHeaders[i]))throw Error('Cabeçalhos incompatíveis. Baixe o modelo atualizado.');if(!rows.length)throw Error('A planilha não possui usuários.');if(rows.some((r,i)=>r.number!==i+2))throw Error('Não deixe linhas vazias entre os usuários.');return rows.map(r=>Object.fromEntries(importHeaders.map((key,i)=>[key,r.values[i]])))
}
function importView(result){const el=$('bulkPreview');if(!el)return;el.innerHTML='<p><strong>'+e(result.total)+' registro(s)</strong> · '+(result.valid?'Todos válidos':'Corrija '+e(result.errors.length)+' problema(s)')+'</p>'+(result.errors.length?'<ul class="bulk-errors">'+result.errors.map(x=>'<li>Linha '+e(x.line)+' · '+e(x.field)+': '+e(x.message)+'</li>').join('')+'</ul>':'')+'<div class="table-scroll bulk-table"><table class="organization-table"><thead><tr><th>Linha</th><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Empresa / Departamento</th><th>Gestor</th></tr></thead><tbody>'+result.rows.map(r=>'<tr><td>'+e(r.line)+'</td><td>'+e(r.name)+'</td><td>'+e(r.email)+'</td><td>'+e(r.role)+'</td><td>'+e(r.companyName)+' / '+e(r.departmentName)+'</td><td>'+e(r.managerEmail||'—')+'</td></tr>').join('')+'</tbody></table></div>';const btn=document.querySelector('[data-import-confirm]');if(btn)btn.disabled=!result.valid}
document.addEventListener('change',async ev=>{if(ev.target.id!=='bulkExcel'||d?.me?.role!=='Administrador')return;clearImport();const run=importRun,el=$('bulkStatus'),btn=document.querySelector('[data-import-confirm]');btn.disabled=true;$('bulkPreview').textContent='';el.textContent='Validando planilha…';try{const rows=await readImportExcel(ev.target.files[0]);if(run!==importRun)return;const result=await api('users/v14/import/preview',{rows});if(run!==importRun||!el.isConnected)return;importRows=rows;importPreview=result;el.textContent='Prévia concluída. Nenhum usuário foi criado.';importView(result)}catch(ex){if(run===importRun&&el.isConnected)el.textContent=ex.message}})
document.addEventListener('click',async ev=>{const b=ev.target.closest('[data-import-open],[data-import-cancel],[data-import-confirm]');if(!b)return;ev.preventDefault();if(b.hasAttribute('data-import-open')){importModal();return}if(b.hasAttribute('data-import-cancel')){$('modal').close();clearImport();return}if(b.disabled||!importPreview?.valid||!importRows||d?.me?.role!=='Administrador')return;const run=importRun,el=$('bulkStatus'),file=$('bulkExcel');b.disabled=true;file.disabled=true;el.textContent='Criando usuários e vínculos…';try{const result=await api('users/v14/import/commit',{rows:importRows,revision:importPreview.revision,organizationRevision:importPreview.organizationRevision});if(run!==importRun)return;clearImport();$('modal').close();notify(result.created+' usuários importados com sucesso.');await refresh()}catch(ex){if(run===importRun&&el.isConnected){el.textContent=ex.message+' Selecione o arquivo novamente para validar.';file.disabled=false;file.value='';clearImport()}}})
$('modal')?.addEventListener('close',clearImport)

// OKR uses the existing LXP page lifecycle and server-projected permissions.
let okrDraft=null,okrFilter='all',okrCompanyFilter=''
const okrLabels={company:'Empresa',department:'Departamento',individual:'Colaborador(a)'}
const okrAction=(action,id,revision,kr='')=>'<button type="button" class="lxp-btn" data-okr13="'+e(action)+'" data-id="'+e(id)+'" data-revision="'+e(revision)+'" data-kr="'+e(kr)+'">'+e({publish:'Publicar',close:'Encerrar',checkin:'Registrar check-in',retarget:'Alterar atribuição'}[action])+'</button>'
function okrCards(){
 const result=okrDraft,items=(result.items||[]).filter(o=>(okrFilter==='all'||o.scope===okrFilter)&&(!okrCompanyFilter||o.companyId===okrCompanyFilter))
 const cards=items.map(o=>panel(o.title,'<p class="okr-scope"><span class="lxp-pill">'+e(okrLabels[o.scope]||'Colaborador(a)')+'</span> '+e([o.companyName,o.departmentName,o.ownerName].filter(Boolean).join(' · '))+'</p><p>'+e(shortDate(o.startsOn))+' a '+e(shortDate(o.endsOn))+' · '+e(({draft:'Rascunho',active:'Ativo',closed:'Encerrado'})[o.status])+'</p><strong>'+e(o.progress)+'% do objetivo</strong><progress class="okr-progress" max="100" value="'+e(o.progress)+'" aria-label="Progresso do objetivo"></progress>'+o.results.map(k=>'<div class="lxp-line"><div><strong>'+e(k.title)+'</strong><small>'+e(k.baseline)+' → '+e(k.target)+' '+e(k.unit)+' · Peso '+e(k.weight)+'</small><p>Atual: '+e(k.current??k.baseline)+' · '+e(k.progress)+'%</p><progress max="100" value="'+e(k.progress)+'" aria-label="Progresso"></progress>'+(k.canSeeHistory?'<details><summary>Histórico ('+e(k.checkinCount)+')</summary>'+k.checkins.map(c=>'<p>'+e(shortDate(c.businessDate))+' · '+e(c.value)+' '+e(k.unit)+' — '+e(c.note)+(c.actorName?' · '+e(c.actorName):'')+'</p>').join('')+'</details>':'<small>Atualizações: '+e(k.checkinCount)+' · evidências restritas ao responsável e à gestão autorizada.</small>')+'</div>'+(o.canCheckin?okrAction('checkin',o.id,o.revision,k.id):'')+'</div>').join('')+'<div class="lxp-heading-actions">'+(o.canRetarget?okrAction('retarget',o.id,o.revision):'')+(o.canManage&&o.status==='draft'?okrAction('publish',o.id,o.revision):'')+(o.canManage&&o.status==='active'?okrAction('close',o.id,o.revision):'')+'</div>'+(o.audit?'<details class="okr-audit"><summary>Auditoria administrativa</summary><p>Criado por: '+e(o.audit.createdBy||'Não informado')+' · '+e(o.audit.createdAt||'')+'</p>'+(o.audit.closedAt?'<p>Encerrado por: '+e(o.audit.closedBy||'Não informado')+' · '+e(o.audit.closingNote||'')+'</p>':'')+'<p>Alterações de atribuição: '+e(o.audit.scopeHistory?.length||0)+'</p>'+(o.audit.scopeHistory||[]).map(h=>'<p>'+e(h.at)+' · '+e(okrLabels[h.scope]||h.scope)+' · '+e(h.actorName||'')+'</p>').join('')+'</details>':'')))
 const legacy=okrFilter==='all'&&!okrCompanyFilter&&(result.legacy||[]).length?panel('Registros anteriores — somente leitura',(result.legacy||[]).map(r=>'<div class="lxp-line"><div><strong>'+e(r.title)+'</strong><small>'+e(r.ownerName)+' · '+e(r.status||'')+'</small><p>'+e(r.actual??'—')+' / '+e(r.target??'—')+'</p><p>'+e(r.note||'')+'</p></div></div>').join('')):''
 return cards.join('')+(cards.length?'':empty('Nenhum OKR neste recorte','Os objetivos aparecem de acordo com sua empresa, departamento e hierarquia.'))+legacy
}
async function renderOKR13(){
 await asyncScreen(screen('Gestão de metas','Objetivos e resultados-chave','Acompanhe resultados mensuráveis, com histórico e responsabilidade.',load()),async current=>{
  const result=await apiLxp('okr');if(!current())return;okrDraft=result
  const selectableCompanies=[...new Map([...(result.companies||[]),...(result.items||[]).map(o=>({id:o.companyId,name:o.companyName}))].map(c=>[c.id,c])).values()]
  if(!selectableCompanies.some(c=>c.id===okrCompanyFilter))okrCompanyFilter=''
  const filters='<div class="lxp-panel okr-filters">'+select('Nível do OKR','okrFilter',[['all','Todos os níveis'],...Object.entries(okrLabels)],okrFilter)+select('Empresa','okrCompanyFilter',[['','Todas as autorizadas'],...selectableCompanies.map(c=>[c.id,c.name])],okrCompanyFilter)+'</div>'
  const create=result.canCreate?'<button type="button" class="lxp-btn primary" data-okr13="new">Novo objetivo</button>':''
  enterScreen(screen('Gestão de metas','Objetivos e resultados-chave','Objetivos corporativos, departamentais e individuais. Atribuições e resultados respeitam seu escopo.',filters+'<div id="okrCards">'+okrCards()+'</div>',create))
 })
}
function okrKR(){return '<fieldset class="lxp-panel" data-okr-kr><legend>Resultado-chave</legend>'+field('Resultado mensurável','krTitle','','text','required maxlength="160"')+field('Unidade','unit','','text','required maxlength="40"')+field('Valor inicial','baseline','0','number','required step="any"')+field('Meta','target','100','number','required step="any"')+field('Peso','weight','1','number','required step="any" min="0.01" max="100"')+'<button type="button" class="lxp-btn" data-okr13="remove-kr">Remover resultado</button></fieldset>'}
function okrTargetFields(o={}){return '<div class="lxp-form-grid okr-target">'+select('Nível do objetivo','scope',(okrDraft.levels||[]).map(x=>[x,okrLabels[x]]),o.scope||'')+select('Empresa','companyId',(okrDraft.companies||[]).map(c=>[c.id,c.name]),o.companyId||companyPick())+'<div data-okr-department></div><div data-okr-owner></div></div><p class="lxp-note" id="okrTargetHint"></p>'}
function bindOKRTarget(form,previous={}){
 const scope=form.elements.scope?.value,companyId=form.elements.companyId?.value;if(!scope)return
 const oldDept=form.elements.departmentId?.value||previous.departmentId||'',oldOwner=form.elements.ownerId?.value||previous.ownerId||''
 const depts=(okrDraft.departments||[]).filter(x=>x.companyId===companyId&&(scope!=='department'||x.canManage)),people=(okrDraft.people||[]).filter(p=>p.companyId===companyId)
 const deptBox=form.querySelector('[data-okr-department]'),ownerBox=form.querySelector('[data-okr-owner]')
 const chosen=depts.some(x=>x.id===oldDept)?oldDept:scope==='department'?depts[0]?.id||'':''
 deptBox.hidden=scope==='company';deptBox.innerHTML=scope==='company'?'':select('Departamento','departmentId',scope==='individual'?[['','Todos os departamentos'],...depts.map(x=>[x.id,x.name])]:[['','Selecione o departamento'],...depts.map(x=>[x.id,x.name])],chosen)
 const eligible=people.filter(p=>scope==='company'||(scope==='individual'&&!chosen)||p.departmentId===chosen)
 ownerBox.innerHTML=select(scope==='individual'?'Colaborador(a)':'Responsável (opcional)','ownerId',[[ '',scope==='individual'?'Selecione a pessoa':'Sem responsável individual'],...eligible.map(p=>[p.id,p.name])],eligible.some(p=>p.id===oldOwner)?oldOwner:'')
 if(scope==='individual')form.elements.ownerId.required=true
 if(scope==='department')form.elements.departmentId.required=true
 const hint=form.querySelector('#okrTargetHint');hint.textContent=scope==='company'?'Objetivo corporativo. Apenas a administração configura; pessoas da empresa consultam após publicação.':scope==='department'?'Objetivo de departamento. Se desejar, delegue os check-ins a uma pessoa do departamento.':'Objetivo individual. Selecione uma pessoa autorizada; seu departamento será validado no servidor.'
}
function okrForm(action,params={}){const box=$('modalBody'),modal=$('modal');if(!box||!modal)return
 const current=(okrDraft?.items||[]).find(o=>o.id===params.id)||{}
 const fields=action==='new'?field('Objetivo','title','','text','required maxlength="160"')+okrTargetFields()+field('Início','startsOn',iso(),'date','required')+field('Fim','endsOn',iso(),'date','required')+'<div id="okrKRs">'+okrKR()+'</div><button type="button" class="lxp-btn" data-okr13="add-kr">Adicionar resultado-chave</button>':action==='retarget'?'<p>Altere o público antes de registrar check-ins. O histórico anterior de atribuição é preservado.</p>'+okrTargetFields(current):action==='checkin'?field('Valor atual','value','','number','required step="any"')+textarea('Evidência ou comentário','note','','required maxlength="500"'):action==='close'?textarea('Justificativa de encerramento','note','','required maxlength="500"'):'<p>Publicar este objetivo e iniciar o acompanhamento?</p>'
 box.innerHTML='<section class="lxp-page"><h2>'+e(({new:'Novo OKR',retarget:'Alterar atribuição',checkin:'Check-in',close:'Encerrar objetivo',publish:'Publicar objetivo'})[action])+'</h2><form id="okr13Form" data-action="'+e(action)+'" data-id="'+e(params.id||'')+'" data-revision="'+e(params.revision||'')+'" data-kr="'+e(params.kr||'')+'" data-request="'+crypto.randomUUID()+'">'+fields+'<div class="lxp-heading-actions"><button type="submit" class="lxp-btn primary">Confirmar</button><button type="button" class="lxp-btn" data-okr13="cancel">Cancelar</button></div><p role="alert" id="okr13Error"></p></form></section>'
 if(action==='new'||action==='retarget')bindOKRTarget($('okr13Form'),current);if(!modal.open)modal.showModal()
}
document.addEventListener('change',ev=>{if(page!=='OKR')return;const input=ev.target;if(input.name==='okrFilter'||input.name==='okrCompanyFilter'){if(input.name==='okrFilter')okrFilter=input.value;else okrCompanyFilter=input.value;const el=$('okrCards');if(el)el.innerHTML=okrCards();return}const form=input.closest('#okr13Form');if(form&&['scope','companyId','departmentId'].includes(input.name)){if(input.name==='companyId'){if(form.elements.departmentId)form.elements.departmentId.value='';if(form.elements.ownerId)form.elements.ownerId.value=''}bindOKRTarget(form)}})
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-okr13]');if(!b||page!=='OKR')return;ev.preventDefault();const a=b.dataset.okr13;if(a==='cancel'){$('modal').close();return}if(a==='add-kr'){const list=$('okrKRs');if(list&&list.children.length<10)list.insertAdjacentHTML('beforeend',okrKR());return}if(a==='remove-kr'){const list=$('okrKRs');if(list?.children.length>1)b.closest('[data-okr-kr]')?.remove();return}okrForm(a,b.dataset)})
document.addEventListener('submit',async ev=>{const f=ev.target;if(f.id!=='okr13Form')return;ev.preventDefault();if(page!=='OKR')return;const btn=f.querySelector('[type=submit]');if(btn.disabled)return;btn.disabled=true;const values=new FormData(f),a=f.dataset.action;let payload={id:f.dataset.id,revision:Number(f.dataset.revision),requestId:f.dataset.request,note:values.get('note')};if(a==='new'||a==='retarget'){Object.assign(payload,{scope:values.get('scope'),companyId:values.get('companyId'),departmentId:values.get('departmentId')||null,ownerId:values.get('ownerId')||null});if(a==='new')Object.assign(payload,{title:values.get('title'),startsOn:values.get('startsOn'),endsOn:values.get('endsOn'),results:[...f.querySelectorAll('[data-okr-kr]')].map(k=>({title:k.querySelector('[name=krTitle]').value,unit:k.querySelector('[name=unit]').value,baseline:Number(k.querySelector('[name=baseline]').value),target:Number(k.querySelector('[name=target]').value),weight:Number(k.querySelector('[name=weight]').value)}))})}else if(a==='checkin'){payload.resultId=f.dataset.kr;payload.value=Number(values.get('value'))}try{await apiLxp('okr/'+(a==='new'?'create':a),payload);if(page==='OKR'&&f.isConnected){$('modal').close();await renderOKR13()}}catch(ex){if(f.isConnected)$('okr13Error').textContent=ex.message}finally{btn.disabled=false}})

// ───── Pulse: create, answer, view privacy-preserving aggregates ─────
async function renderPulse(){
 const selectedPage=page
 const weekly=typeof weeklyPulseCard==='function'?weeklyPulseCard():''
 await asyncScreen(screen('Clima e escuta','Pulse de sentimentos','Check-in semanal identificado e pesquisas da equipe.',weekly+load(),canCreatePulse()?button('Criar pesquisa','pulse-new','','primary'):'') ,async current=>{
  const result=await apiLxp('pulse');if(!current())return
  if(page!==selectedPage)return
  const items=result.items||[]
  const open=items.filter(x=>x.status==='open').length
  const pending=items.filter(x=>x.isParticipant&&!x.answered&&x.status==='open').length
  let content='<div class="lxp-metrics">'+metric('Pesquisas acessíveis',items.length,'visíveis no seu escopo')+metric('Pesquisas abertas',open,'em período de resposta')+metric('Suas respostas pendentes',pending,'para responder hoje')+'</div>'
  if(items.length)content+='<div class="lxp-grid">'+items.map(x=>'<article class="lxp-card"><div class="lxp-card-icon">'+ic('pulse')+'</div><div class="lxp-card-meta">'+status(x.status)+(x.answered?'<span class="lxp-pill">Você respondeu</span>':'')+'</div><h2>'+e(x.title)+'</h2><p>'+e(x.description||'Como está o nosso ambiente de trabalho?')+'</p><small>'+shortDate(x.startDate)+' a '+shortDate(x.endDate)+'</small>'+(x.summary?'<div class="lxp-card-summary"><b>'+e(x.summary.responses)+' de '+e(x.summary.invited)+'</b> respostas'+(x.summary.canShowAggregate?' · Média '+e(x.summary.mean):' · Resultado protegido até 7 respostas')+'</div>':'')+'<div class="lxp-card-actions">'+(x.isParticipant&&!x.answered&&x.status==='open'?button('Responder pesquisa','pulse-answer',x.id,'primary'):'')+(x.isOrganizer?button('Ver resultados','pulse-details',x.id):'')+'</div></article>').join('')+'</div>'
  else content+=empty('Nenhuma pesquisa disponível','Crie uma pesquisa ou aguarde uma atribuição do RH.')
  enterScreen(screen('Clima e escuta','Pulse de sentimentos','Check-in semanal e pesquisas identificadas. Para respostas agregadas, use Pulse Seguro.',weekly+content+linkLegacy('Pulse'),canCreatePulse()?button('Criar pesquisa','pulse-new','','primary'):''))
 })
}
function populationForm(companyId){return '<div class="lxp-form-grid">'+select('Empresa','companyId',companies().map(c=>[c.id,c.name]),companyId)+'<div class="lxp-select-depts"><span>Departamentos participantes</span><p>Sem seleção: todos os departamentos da empresa.</p><div id="lxpDepartmentItems"></div></div></div><details class="lxp-select-people"><summary>Selecionar pessoas específicas (opcional)</summary><p>A seleção individual prevalecerá sobre os departamentos se houver pessoas marcadas.</p><div id="lxpPersonItems"></div></details><label class="lxp-check"><input type="checkbox" name="includeCreator" checked> Incluir meu próprio perfil, quando permitido</label>'}
function bindDepartments(form,selected=[]){
 const source=form.querySelector('[name="companyId"]'),target=form.querySelector('#lxpDepartmentItems'),people=form.querySelector('#lxpPersonItems')
 if(!source||!target)return
 const update=()=>{
  const depts=deptOptions(source.value)
  target.innerHTML=depts.length?depts.map(dep=>'<label class="lxp-option"><input type="checkbox" name="departmentIds" value="'+e(dep.id)+'"'+(selected.includes(dep.id)?' checked':'')+'><span>'+e(dep.name)+'</span></label>').join(''):'<p class="lxp-muted">Nenhum departamento cadastrado; a pesquisa poderá abranger a empresa.</p>'
  if(people){const eligible=(organizationData?.people||[]).filter(p=>p.company_id===source.value&&p.active!==false);people.innerHTML=eligible.length?eligible.map(p=>'<label class="lxp-option"><input type="checkbox" name="personIds" value="'+e(p.id)+'"><span>'+e(p.name)+'</span></label>').join(''):'<p class="lxp-muted">Cadastre os vínculos para escolher pessoas específicas.</p>'}
 }
 source.onchange=update;update()
}
function showPulseNew(){
 if(!canCreatePulse()){notify('Criação restrita à administração, RH/DHO ou liderança.');return}
 const contents=panel('Configurar uma nova pesquisa','<form id="lxpPulseForm">'+field('Título da pesquisa','title','','text','required maxlength="160" placeholder="Ex.: Como foi sua semana?"')+textarea('Mensagem de abertura','description','','maxlength="600"')+populationForm(companyPick())+'<div class="lxp-form-grid">'+field('Abertura','startDate',iso(),'date','required')+field('Encerramento','endDate',iso(),'date','required')+'</div><div class="lxp-form-actions">'+button('Cancelar','pulse-back')+'<button class="lxp-btn primary" type="submit">Publicar pesquisa</button></div><p class="lxp-muted">Respostas individuais não serão exibidas em relatórios. O resultado agrupado só aparece com 7 respostas ou mais.</p></form>')
 enterScreen(screen('Nova pesquisa','Escute o seu time','Configure empresa, departamentos e período de respostas.',contents))
 const f=$('lxpPulseForm');bindDepartments(f)
 f.onsubmit=async ev=>{ev.preventDefault();const b=f.querySelector('button[type=submit]');b.disabled=true;try{
  const data=Object.fromEntries(new FormData(f));data.departmentIds=new FormData(f).getAll('departmentIds');data.personIds=new FormData(f).getAll('personIds');data.includeCreator=f.elements.includeCreator.checked
  const result=await apiLxp('pulse',data);notify('Pesquisa publicada para '+result.participants+' participante(s).');void renderPulse()
 }catch(ex){notify(ex.message)}finally{b.disabled=false}}
}
function showPulseAnswer(id){
 lxpCurrentPulse=id
 enterScreen(screen('Sua voz importa','Como você se sentiu?','Seu relato pode contribuir para um ambiente melhor.','<form id="lxpPulseAnswer" class="lxp-panel"><div class="lxp-emotion-grid">'+[['😣','Muito ruim'],['😕','Ruim'],['😐','Regular'],['🙂','Bem'],['🤩','Muito bem']].map(([emoji,label],i)=>'<label class="lxp-emotion"><input type="radio" name="rating" value="'+(i+1)+'" required><span><b>'+emoji+'</b><small>'+label+'</small></span></label>').join('')+'</div>'+textarea('Quer contar o que motivou sua resposta? (opcional)','comment','','maxlength="1300"')+'<div class="lxp-form-actions">'+button('Voltar','pulse-back')+'<button type="submit" class="lxp-btn primary">Enviar resposta</button></div></form>'))
 $('lxpPulseAnswer').onsubmit=async ev=>{ev.preventDefault();const form=ev.currentTarget,submit=form.querySelector('button[type=submit]');submit.disabled=true;try{await apiLxp('pulse/answer',{id,rating:Number(form.elements.rating.value),comment:form.elements.comment.value});notify('Sua resposta foi recebida. Obrigado pela contribuição!');void renderPulse()}catch(ex){notify(ex.message)}finally{submit.disabled=false}}
}
async function showPulseDetails(id){
 await asyncScreen(screen('Pesquisa de pulso','Resultado da escuta','Indicadores preservam a privacidade individual.',load(),button('Voltar','pulse-back')),async current=>{
  const r=await apiLxp('pulse'),item=r.items.find(x=>x.id===id);if(!current())return;if(!item||!item.summary){enterScreen(error('Pesquisa indisponível.'));return}
  let content='<div class="lxp-metrics">'+metric('Respostas recebidas',item.summary.responses,'de '+item.summary.invited+' convidados')+metric('Participação',item.summary.invited?Math.round(100*item.summary.responses/item.summary.invited)+'%':'—','sobre convidados')+metric('Média de sentimento',item.summary.mean??'Protegida','resultado com 7+ respostas')+'</div>'
  if(item.summary.canShowAggregate){content+=panel('Distribuição das respostas','<div class="lxp-bars">'+item.summary.distribution.map((n,i)=>'<div class="lxp-bar-row"><span>'+['Muito ruim','Ruim','Regular','Bem','Muito bem'][i]+'</span><div><i style="width:'+Math.round(100*n/item.summary.responses)+'%"></i></div><strong>'+n+'</strong></div>').join('')+'</div>')}
  else content+=boxInfo('Aguardando volume mínimo de respostas','Para evitar identificação de pessoas, as médias e distribuições só ficam disponíveis a partir de sete participantes respondentes.')
  if(item.status!=='closed')content+=button('Encerrar pesquisa','pulse-close',item.id)
  enterScreen(screen('Relatório de clima',item.title,item.description||'Período: '+shortDate(item.startDate)+' a '+shortDate(item.endDate),content,button('Voltar','pulse-back')))
 })
}

// ───── Performance cycles: authoring, publication, reviewer tasks ─────
async function renderPerformance(){
 await asyncScreen(screen('Desenvolvimento por competências','Avaliação de desempenho','Crie ciclos, defina perguntas e acompanhe o desenvolvimento com critérios transparentes.',load(),canManage()?button('Criar ciclo','perf-new','','primary'):''),async current=>{
  const data=await apiLxp('performance'),cycles=data.items||[];if(!current())return
  const active=cycles.filter(c=>c.status==='published').length,pending=cycles.reduce((n,c)=>n+(c.mine||[]).filter(t=>t.status!=='submitted').length,0)
  const metrics='<div class="lxp-metrics">'+metric('Ciclos',cycles.length,'no escopo autorizado')+metric('Em andamento',active,'ciclos publicados')+metric('Suas avaliações pendentes',pending,'autorrelato ou liderança')+'</div>'
  const list=cycles.length?'<div class="lxp-grid">'+cycles.map(c=>'<article class="lxp-card"><div class="lxp-card-icon">'+ic('performance')+'</div><div>'+status(c.status)+' <span class="lxp-pill">'+[c.includeSelf&&'Autoavaliação',c.includeLeader&&'Liderança',c.includePeer&&'Pares',c.includeReports&&'Liderados'].filter(Boolean).join(' · ')+'</span></div><h2>'+e(c.title)+'</h2><p>'+e(c.description||'Ciclo de desenvolvimento e desempenho.')+'</p><small>'+shortDate(c.startDate)+' a '+shortDate(c.endDate)+'</small>'+(c.isManager?'<div class="lxp-card-summary">'+e(c.submitted||0)+' de '+e(c.assigned||0)+' avaliações concluídas</div>':'')+'<div class="lxp-card-actions">'+button('Abrir ciclo','perf-open',c.id,'primary')+(c.canTake?button('Responder','perf-open',c.id):'')+'</div></article>').join('')+'</div>':empty('Nenhum ciclo disponível','Crie um ciclo de desempenho para sua organização.')
  enterScreen(screen('Competências e resultados','Avaliação de desempenho','Processos de avaliação claros para líderes e colaboradores.',metrics+list+linkLegacy('Desempenho'),canManage()?button('Criar ciclo','perf-new','','primary'):''))
 })
}
const perspectiveLabels={self:'Autoavaliação',leader:'Liderança',peer:'Pares',report:'Liderados'}
const perspectiveKeys=Object.keys(perspectiveLabels)
let questionCollections={self:[],leader:[],peer:[],report:[]}
const defaultQuestions={self:[{type:'rating',title:'Como você avalia suas entregas neste período?',weight:1,required:true,competency:'Resultados'}],leader:[{type:'rating',title:'Como avalia as entregas desta pessoa?',weight:1,required:true,competency:'Resultados'}]}
function resetQuestions(c){questionCollections=Object.fromEntries(perspectiveKeys.map(k=>[k,(c?.[k+'Questions']||defaultQuestions[k]||defaultQuestions.leader).map(q=>({...q}))]))}
function questionCard(q,group,i){return '<article class="lxp-question" data-index="'+i+'" data-group="'+group+'"><div class="lxp-question-head"><strong>Questão '+(i+1)+'</strong>'+button('Remover','perf-remove-question',group+':'+i)+'</div>'+field('Enunciado','title',q.title||'','text','required maxlength="250"')+textarea('Descrição e orientação','description',q.description||'','maxlength="500"')+'<div class="lxp-form-grid">'+select('Formato','type',[['rating','Escala de 1 a 5'],['text','Resposta aberta'],['single','Escolha única'],['yesno','Sim / não']],q.type||'rating')+field('Peso para notas','weight',q.weight??1,'number','min="0" max="10" step="0.5"')+'</div>'+field('Competência avaliada','competency',q.competency||'','text','maxlength="100"')+field('Proficiência esperada (opcional, somente escala 1–5)','expected',q.expected??'','number','min="1" max="5" step="0.1"')+textarea('Alternativas (uma por linha, se escolha única)','choices',(q.choices||[]).join('\n'),'placeholder="Ex.: Superou | Atendeu | Precisa evoluir"')+'<label class="lxp-check"><input type="checkbox" name="required" '+(q.required!==false?'checked':'')+'> Resposta obrigatória</label></article>'}
function syncQuestions(form){for(const group of perspectiveKeys){
 const host=form.querySelector('#lxpQuestions-'+group);if(!host)continue
 questionCollections[group]=[...host.querySelectorAll('.lxp-question')].map((node,i)=>{const el=node.querySelectorAll('input,select,textarea');const v={id:questionCollections[group][i]?.id,type:node.querySelector('[name=type]').value,title:node.querySelector('[name=title]').value,description:node.querySelector('[name=description]').value,weight:Number(node.querySelector('[name=weight]').value),competency:node.querySelector('[name=competency]').value,expected:node.querySelector('[name=expected]').value||null,required:node.querySelector('[name=required]').checked};const choices=node.querySelector('[name=choices]').value.trim();v.choices=choices.includes('|')?choices.split('|').map(s=>s.trim()).filter(Boolean):choices.split(/\n/).map(s=>s.trim()).filter(Boolean);return v})
 }}
function drawQuestions(){for(const group of perspectiveKeys){const el=$('lxpQuestions-'+group);if(el)el.innerHTML=questionCollections[group].map((q,i)=>questionCard(q,group,i)).join('')||'<p class="lxp-muted">Adicione ao menos uma questão se esta perspectiva estiver habilitada.</p>'}}
async function editPerformance(id=''){
 let c=null
 if(id){const value=await apiLxp('performance/cycle?id='+encodeURIComponent(id));if(!value.isManager||value.status!=='draft'){notify('Só é possível alterar o rascunho do ciclo.');return}c=value}
 lxpPerfDraft=c;resetQuestions(c)
 const companyId=c?.companyId||companyPick(),startDate=c?.startDate||iso(),endDate=c?.endDate||iso()
 const content=panel('1. Identificação do ciclo','<form id="lxpPerformanceBuilder">'+field('Nome do ciclo','title',c?.title||'Avaliação de desempenho semestral','text','required maxlength="160"')+textarea('Objetivo do ciclo','description',c?.description||'','','maxlength="1200"')+populationForm(companyId)+'<div class="lxp-form-grid">'+field('Início das respostas','startDate',startDate,'date','required')+field('Fim das respostas','endDate',endDate,'date','required')+'</div><div class="lxp-form-grid">'+
 '<label class="lxp-check"><input type="checkbox" name="includeSelf" '+(c?.includeSelf===false?'':'checked')+'> Colaborador responde a autoavaliação</label><label class="lxp-check"><input type="checkbox" name="includeLeader" '+(c?.includeLeader===false?'':'checked')+'> Liderança avalia o liderado</label><label class="lxp-check"><input type="checkbox" name="includePeer" '+(c?.includePeer?'checked':'')+'> Pares com o mesmo gestor</label><label class="lxp-check"><input type="checkbox" name="includeReports" '+(c?.includeReports?'checked':'')+'> Liderados avaliam seu gestor</label><label class="lxp-check"><input type="checkbox" name="requireCalibration" '+(c?.requireCalibration?'checked':'')+'> Exigir etapa de calibração</label></div><p class="lxp-muted">As tarefas são criadas na publicação. Pares e liderados só têm resultados agregados liberados com ao menos três notas válidas; os registros de origem são identificados.</p>'+ '</form>')+
 panel('2. Formulário de autoavaliação','<div id="lxpQuestions-self" class="lxp-question-list"></div>'+button('Adicionar pergunta de autoavaliação','perf-add-question','self'))+
 panel('3. Formulário da liderança','<div id="lxpQuestions-leader" class="lxp-question-list"></div>'+button('Adicionar pergunta da liderança','perf-add-question','leader'))+
 panel('4. Formulário de pares','<div id="lxpQuestions-peer" class="lxp-question-list"></div>'+button('Adicionar pergunta para pares','perf-add-question','peer'))+
 panel('5. Formulário de liderados','<div id="lxpQuestions-report" class="lxp-question-list"></div>'+button('Adicionar pergunta para liderados','perf-add-question','report'))+
 '<div class="lxp-form-actions">'+button('Cancelar','perf-back')+button('Salvar rascunho','perf-save','','primary')+'</div>'
 enterScreen(screen('Construtor de avaliações',c?'Editar ciclo':'Novo ciclo de desempenho','Personalize público, prazo, perspectivas, competências, escalas e perguntas.',content))
 bindDepartments($('lxpPerformanceBuilder'),c?.departmentIds||[]);drawQuestions()
}
async function savePerformance(){
 const form=$('lxpPerformanceBuilder');if(!form||!form.reportValidity())return
 syncQuestions(document)
 const formData=new FormData(form)
 const b=Object.fromEntries(formData);b.departmentIds=formData.getAll('departmentIds');b.personIds=formData.getAll('personIds');b.includeCreator=form.elements.includeCreator?.checked||false
 b.includeSelf=form.elements.includeSelf.checked;b.includeLeader=form.elements.includeLeader.checked
 b.includePeer=form.elements.includePeer.checked;b.includeReports=form.elements.includeReports.checked;b.requireCalibration=form.elements.requireCalibration.checked
 for(const k of perspectiveKeys)b[k+'Questions']=questionCollections[k]
 if(lxpPerfDraft){b.id=lxpPerfDraft.id;b.revision=lxpPerfDraft.revision}
 try{const r=await apiLxp('performance',b);notify('Ciclo salvo como rascunho. Revise e publique quando estiver pronto.');void openPerformance(r.id)}catch(ex){notify(ex.message)}
}
function recommendedPanel17(rows,self=true){if(!rows?.length)return '';return panel('Aprendizagem recomendada',rows.map(r=>'<div class="lxp-line"><div><strong>'+e(r.label)+'</strong><small>'+e(r.gap===null?'Sem meta comparável':r.gap>0?'Gap de '+r.gap+' pontos':'Meta alcançada')+'</small>'+r.items.map(item=>'<p>'+e(item.kind==='course'?'Curso':'Trilha')+' · '+e(item.title)+' · '+e(item.progress)+'%</p>').join('')+(r.unavailable?'<small>'+e(r.unavailable)+' recomendação(ões) sem acesso no momento. Solicite atribuição à gestão de aprendizagem.</small>':'')+'</div>'+(self?'<div class="lxp-heading-actions">'+(r.items.some(k=>k.kind==='course')?button('Abrir catálogo','goto','Catálogo LMS'):'')+(r.items.some(k=>k.kind==='mission')?button('Abrir trilhas','goto','Missões'):'')+'</div>':'')+'</div>').join(''))}
function recommendationEditor17(c){const x=c.recommendationConfig;if(!x?.topics.length)return '';return panel('Recomendações por competência','<p>Associe cursos e trilhas publicados ao tópico. Somente os conteúdos atribuídos serão identificados na devolutiva. Escolha até 10 por competência.</p><form id="lxpRecommendations17">'+select('Competência','topic',x.topics.map(t=>[t.key,t.label]))+'<label class="lxp-field"><span>Conteúdos recomendados (seleção múltipla)</span><select name="items" multiple size="6">'+x.catalog.map(k=>'<option value="'+e(k.kind+':'+k.id)+'">'+e((k.kind==='course'?'Curso · ':'Trilha · ')+k.title)+'</option>').join('')+'</select></label><p class="lxp-muted">No computador, use Ctrl ou Cmd para selecionar mais de um conteúdo. Desmarque todos para remover os vínculos do tópico.</p><button type="submit" class="lxp-btn primary">Salvar recomendações</button><p role="status" data-rec17-status></p></form>')}
function bindRecommendation17(c){const f=$('lxpRecommendations17');if(!f)return;const config=c.recommendationConfig,fill=()=>{const chosen=new Set((config.items.find(x=>x.key===f.elements.topic.value)?.items||[]).map(x=>x.kind+':'+x.id));for(const o of f.elements.items.options)o.selected=chosen.has(o.value)};f.elements.topic.addEventListener('change',fill);fill();f.onsubmit=async ev=>{ev.preventDefault();const b=f.querySelector('[type=submit]');if(b.disabled)return;b.disabled=true;try{await apiLxp('performance/recommendations',{id:c.id,revision:c.revision,key:f.elements.topic.value,items:[...f.elements.items.selectedOptions].map(o=>{const [kind,id]=o.value.split(':');return {kind,id}})});if(page==='Desempenho'&&f.isConnected){notify('Recomendações salvas.');await openPerformance(c.id)}}catch(ex){if(f.isConnected)f.querySelector('[data-rec17-status]').textContent=ex.message}finally{b.disabled=false}}}
async function openPerformance(id){perfCycleId=id
 await asyncScreen(screen('Ciclo de desempenho','Painel do ciclo','Acompanhe participantes e respostas com segurança.',load(),button('Voltar','perf-back')),async current=>{
 const c=await apiLxp('performance/cycle?id='+encodeURIComponent(id));if(!current())return;if(perfCycleId!==id)return
 const pending=c.mine.filter(t=>t.status!=='submitted');let content='<div class="lxp-metrics">'+metric('Avaliações atribuídas',c.assigned??c.mine.length,'no escopo de gestão')+metric('Concluídas',c.submitted??c.mine.filter(x=>x.status==='submitted').length,'respostas finalizadas')+metric('Suas pendências',pending.length,'solicitadas ao seu perfil')+'</div>'
 if(c.mine.length)content+=panel('Minhas avaliações','<div class="lxp-stack">'+c.mine.map(t=>'<div class="lxp-line"><div><strong>'+e(perspectiveLabels[t.perspective]||t.perspective)+'</strong><small>'+e(t.subjectName||names(t.subjectId))+' · '+e(t.status==='submitted'?'Concluída':'Aguardando resposta')+'</small></div>'+status(t.status)+(t.status!=='submitted'&&c.status==='published'?button('Responder','perf-task',t.id,'primary'):'')+'</div>').join('')+'</div>')
 if(c.isManager){
  content+=panel('Acompanhamento das tarefas','<div class="lxp-table-wrap"><table class="lxp-table"><thead><tr><th>Colaborador</th><th>Avaliador</th><th>Perspectiva</th><th>Situação</th></tr></thead><tbody>'+c.tasks.map(t=>'<tr><td>'+e(t.subject?.name||names(t.subjectId))+'</td><td>'+e(t.reviewer?.name||names(t.reviewerId))+'</td><td>'+e(perspectiveLabels[t.perspective]||t.perspective)+'</td><td>'+status(t.status)+'</td></tr>').join('')+'</tbody></table></div>')
  if(c.status==='draft')content+=boxInfo('Em rascunho','Revise as perguntas e clique em Publicar para gerar as tarefas aos participantes.')
  if(c.status==='closed'&&!c.releaseResults)content+=boxInfo('Resultados restritos','Os resultados individuais ainda não foram liberados aos participantes.')
  if(c.status==='calibration'){
   const rows=c.calibration||[],eligible=rows.filter(x=>x.original!==null)
   content+=panel('Calibração de notas','<p class="lxp-muted">A nota original é a média das perspectivas disponíveis (grupos pequenos excluídos). Uma proposta não altera as respostas de origem.</p><div class="lxp-stack">'+rows.map(x=>'<div class="lxp-line"><div><b>'+e(x.name)+'</b><small>Original: '+e(x.original??'Sem nota')+' · Proposta: '+e(x.proposal?.proposed??'—')+'</small></div>'+(x.proposal&&!x.proposal.approvedAt?button('Aprovar proposta','perf-calibrate-approve',x.proposal.id):'')+'</div>').join('')+'</div>'+(eligible.length?'<form id="lxpCalibrationForm">'+select('Pessoa','personId',eligible.map(x=>[x.personId,x.name]))+field('Nova nota de 1 a 5','proposed','','number','required min="1" max="5" step="0.01"')+textarea('Justificativa','justification','','required maxlength="1000"')+button('Registrar proposta','perf-calibrate',c.id,'primary')+'</form>':'')+button('Concluir calibração','perf-calibrate-finish',c.id))
  }
  if(c.competencyPeople?.length){content+=panel('Competências avaliadas e gaps','<p class="lxp-muted">Notas originais por competência. Metas são definidas nas questões; sem meta ou evidência suficiente, o gap não é inferido.</p><div class="lxp-stack">'+c.competencyPeople.flatMap(p=>p.items.map(x=>'<div class="lxp-line"><div><b>'+e(p.name)+' · '+e(x.label)+'</b><small>Observado: '+e(x.observed??'Sem evidência')+' · Esperado: '+e(x.expected??'Não definido')+(x.suppressed?' · Perspectiva protegida':'')+'</small></div><strong>Gap: '+e(x.gap??'—')+'</strong></div>')).join('')+'</div>')}
  if(c.status==='closed'&&c.releaseResults&&c.participants?.length){content+=panel('Ação de PDI vinculada ao ciclo','<form id="lxpCyclePdi">'+select('Pessoa','personId',c.participants.map(x=>[x.id,x.name]))+select('Competência vinculada (opcional)','competencyKey',[['','Sem vínculo'],...Array.from(new Map((c.competencyPeople||[]).flatMap(p=>p.items.filter(x=>x.observed!==null).map(x=>[x.key,x.label]))))])+field('Ação de desenvolvimento','title','','text','required maxlength="150"')+select('Metodologia','mix',[['70','Prática · 70'],['20','Aprendizagem social · 20'],['10','Formação · 10']])+field('Prazo','dueDate',iso(),'date','required')+textarea('Descrição','description','','maxlength="1500"')+button('Criar ação no PDI','perf-pdi',c.id,'primary')+'</form>')}

 }
 content+=recommendationEditor17(c)+recommendedPanel17(c.recommendations)
 if(c.competencies?.length)content+=panel('Minhas competências','<div class="lxp-stack">'+c.competencies.map(x=>'<div class="lxp-line"><div><b>'+e(x.label)+'</b><small>Observado: '+e(x.observed??'—')+' · Esperado: '+e(x.expected??'—')+(x.suppressed?' · Perspectiva protegida':'')+'</small></div><strong>Gap: '+e(x.gap??'—')+'</strong></div>').join('')+'</div>')
 if(c.results?.length)content+=panel('Meus resultados liberados','<p>Resultado final: <strong>'+e(c.finalScore??'Sem nota')+'</strong></p><div class="lxp-stack">'+c.results.map(x=>'<div class="lxp-line"><b>'+e(perspectiveLabels[x.perspective]||x.perspective)+'</b><strong>'+e(x.suppressed?'Resultado protegido':x.score??'Sem nota')+'</strong></div>').join('')+'</div>')
 const actions=button('Voltar','perf-back')+(c.isManager&&c.status==='draft'?button('Editar rascunho','perf-edit',c.id):'')+(c.isManager&&c.status==='draft'?button('Publicar ciclo','perf-publish',c.id,'primary'):'')+(c.isManager&&c.status==='published'?button('Encerrar ciclo','perf-close',c.id):'')+(c.isManager&&c.status==='closed'&&!c.releaseResults?button('Liberar resultados','perf-release',c.id,'primary'):'')
 enterScreen(screen('Ciclo de desempenho',c.title,c.description||'De '+shortDate(c.startDate)+' a '+shortDate(c.endDate),content,actions));bindRecommendation17(c)
 })}
async function openTask(id){taskId=id
 await asyncScreen(screen('Sua avaliação','Responder avaliação','Responda com atenção aos critérios apresentados.',load(),button('Voltar','perf-open',perfCycleId)),async current=>{
 const x=await apiLxp('performance/task?id='+encodeURIComponent(id));if(!current())return;if(taskId!==id)return
 const fields=x.form.map((q,i)=>'<fieldset class="lxp-answer" data-question="'+e(q.id)+'" data-type="'+e(q.type)+'"><legend><span>Questão '+(i+1)+'</span><strong>'+e(q.title)+'</strong></legend>'+(q.description?'<p>'+e(q.description)+'</p>':'')+(q.competency?'<small>Competência: '+e(q.competency)+'</small>':'')+
 (q.type==='rating'?'<div class="lxp-rate">'+[1,2,3,4,5].map(n=>'<label><input type="radio" name="'+e(q.id)+'" value="'+n+'" '+(x.answers?.[q.id]===n?'checked':'')+'><span>'+n+'</span></label>').join('')+'</div><small>1 = precisa desenvolver · 5 = destaque</small>':q.type==='text'?'<textarea name="'+e(q.id)+'" rows="5" maxlength="3500">'+e(x.answers?.[q.id]||'')+'</textarea>':q.type==='single'?'<div class="lxp-choice-stack">'+q.choices.map(choice=>'<label><input type="radio" name="'+e(q.id)+'" value="'+e(choice)+'" '+(x.answers?.[q.id]===choice?'checked':'')+'> '+e(choice)+'</label>').join('')+'</div>':'<div class="lxp-choice-stack"><label><input type="radio" name="'+e(q.id)+'" value="yes" '+(x.answers?.[q.id]===true?'checked':'')+'> Sim</label><label><input type="radio" name="'+e(q.id)+'" value="no" '+(x.answers?.[q.id]===false?'checked':'')+'> Não</label></div>')+'</fieldset>').join('')
 enterScreen(screen('Avaliação · '+(perspectiveLabels[x.task.perspective]||x.task.perspective),x.cycle.title,'Pessoa avaliada: '+x.subject.name, '<div class="lxp-workspace"><aside class="lxp-workspace-side"><span>Período</span><h3>'+shortDate(x.cycle.startDate)+' – '+shortDate(x.cycle.endDate)+'</h3><p>Suas respostas são usadas no ciclo e ficam protegidas pelas permissões do Learning.</p><div>'+status(x.task.status)+'</div></aside><form id="lxpTaskAnswers" class="lxp-workspace-main">'+fields+'<div class="lxp-form-actions">'+button('Salvar rascunho','perf-task-save')+button('Concluir avaliação','perf-task-submit','','primary')+'</div></form></div>',button('Voltar','perf-open',perfCycleId)))
 })
}
async function submitTask(submit){const form=$('lxpTaskAnswers');if(!form)return
 const answers={};for(const q of form.querySelectorAll('[data-question]')){const name=q.dataset.question,type=q.dataset.type;const input=type==='text'?q.querySelector('textarea'):q.querySelector('input:checked');if(!input)continue;answers[name]=type==='rating'?Number(input.value):type==='yesno'?input.value==='yes':input.value}
 try{await apiLxp('performance/task',{id:taskId,answers,submit});notify(submit?'Avaliação concluída e enviada.':'Rascunho salvo.');void openPerformance(perfCycleId)}catch(ex){notify(ex.message)}}

// ───── Growth 70-20-10 and daily development ─────
async function renderGrowth(){
 await asyncScreen(screen('PDI na prática','Meu desenvolvimento','Planos simples, com evidências e experiências para o cotidiano.',load(),button('Nova ação','growth-new','','primary')),async current=>{
  const r=await apiLxp('growth');if(!current())return;const items=r.items||[],ownActions=items.filter(x=>x.personId===d.me.id)
  const metrics='<div class="lxp-metrics">'+metric('Ações no escopo',items.length,'em todo o programa')+metric('Em andamento',items.filter(x=>x.status==='doing').length,'práticas de desenvolvimento')+metric('Suas conquistas',ownActions.filter(x=>x.status==='done').length,'ações concluídas')+'</div>'
  const buckets=[['70','Aprender fazendo','Projetos, desafios e experimentação'],['20','Aprender com pessoas','Mentorias, colaboração e feedback'],['10','Aprender estudando','Cursos, leituras e trilhas']]
  const content=metrics+'<div class="lxp-grid">'+buckets.map(([mix,title,desc])=>'<section class="lxp-panel"><div class="lxp-learning-ribbon">'+mix+'%</div><h2>'+title+'</h2><p>'+desc+'</p><div class="lxp-stack">'+items.filter(x=>x.mix===mix).map(x=>'<article class="lxp-line"><div><strong>'+e(x.title)+'</strong><small>'+e(x.person.name)+' · '+e(x.dueDate?shortDate(x.dueDate):'Sem prazo')+'</small></div>'+status(x.status)+(x.learning?'<div class="pic16-linked"><small>'+e(x.learning.title)+'</small><progress max="100" value="'+e(x.learning.progress??0)+'"></progress><small>'+e(x.learning.available?x.learning.progress+'% · sincronizado com LMS':'Vínculo indisponível')+'</small>'+(x.personId===d.me.id&&x.learning.available?button('Acessar treinamento','growth-launch',x.id):'')+'</div>':'')+button('Editar','growth-edit',x.id)+'</article>').join('')+'</div>'+(items.some(x=>x.mix===mix)?'':empty('Sem ações','Adicione práticas para evoluir.'))+'</section>').join('')+'</div>'
  enterScreen(screen('Plano de desenvolvimento','Meu desenvolvimento','70–20–10 é uma referência para diversificar experiências, não uma obrigação matemática.',content+linkLegacy('PDI'),button('Nova ação','growth-new','','primary')))
 })}
async function openGrowthEditor(id=''){
 const anchor=root(),token=++renderToken,viewer=d.me.id
 const data=await apiLxp('growth');if(page!=='PDI'||root()!==anchor||token!==renderToken||viewer!==d?.me?.id)return
 const found=data.items.find(x=>x.id===id)||null,choices=[['70','70 — Experiência prática'],['20','20 — Aprendizagem social'],['10','10 — Aprendizagem formal']]
 if(id&&!found){notify('Ação indisponível.');return}
 const canManagePeople=['Administrador','RH/DHO','Líder'].includes(d.me.role)
 const selectPeople=found?'<input type="hidden" name="personId" value="'+e(found.personId)+'"><p>'+e(found.person.name)+'</p>':canManagePeople?select('Pessoa','personId',[[d.me.id,d.me.name],...personOptions().map(x=>[x.id,x.name])],d.me.id):'<input type="hidden" name="personId" value="'+e(d.me.id)+'">'
 const html=panel('Plano de ação','<form id="lxpGrowthEditor">'+selectPeople+field('Qual habilidade ou objetivo deseja desenvolver?','title',found?.title||'','text','required maxlength="150"')+textarea('Descreva a ação','description',found?.description||'','maxlength="1500"')+select('Tipo de aprendizagem','mix',choices,found?.mix||'70')+'<div id="growthLearning16" hidden></div>'+select('Situação','status',[['todo','Planejado'],['doing','Em andamento'],['done','Concluído']],found?.status||'todo')+field('Prazo (opcional)','dueDate',found?.dueDate||'','date')+textarea('Evidências e entregas','evidence',found?.evidence||'','maxlength="1500"')+'<div class="lxp-form-actions">'+button('Voltar','growth-back')+'<button type="submit" class="lxp-btn primary">Salvar ação</button></div></form>')
 enterScreen(screen('Desenvolvimento na prática',found?'Editar ação':'Nova ação do PDI','Cada ação deve gerar aprendizado observável.',html))
 const form=$('lxpGrowthEditor'),linkBox=$('growthLearning16'),valid=()=>form.isConnected&&page==='PDI'&&root()===anchor&&token===renderToken&&viewer===d?.me?.id;let optionRun=0,selectedLink=null
 async function populate(){const run=++optionRun,personId=form.elements.personId.value,mix=form.elements.mix.value;selectedLink=null;form.elements.status.disabled=false;linkBox.hidden=mix!=='10';linkBox.replaceChildren();if(mix!=='10')return
  if(found?.learningLink){selectedLink=found.learningLink;form.elements.mix.disabled=true;form.elements.status.disabled=true;linkBox.innerHTML=boxInfo('Vínculo de aprendizagem',found.learning?.title+' · andamento calculado pelo LMS');return}
  linkBox.innerHTML='<p class="lxp-note">Buscando treinamentos já atribuídos…</p>'
  try{const r=await apiLxp('growth/learning-options?person='+encodeURIComponent(personId));if(!valid()||run!==optionRun)return;linkBox.innerHTML=select('Vincular treinamento (opcional)','learning16',[['','Sem vínculo automático'],...r.items.map(o=>[o.kind+':'+o.id,(o.kind==='mission'?'Trilha: ':'Curso: ')+o.title+' · '+o.progress+'%'])])+boxInfo('Sincronização automática','A conclusão da ação vinculada depende da conclusão oficial do curso ou de todas as etapas da trilha.')
   const available=r.items||[],normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');let generatedTitle=''
   linkBox.insertAdjacentHTML('afterbegin','<div class="pdi-learning-search">'+field('Buscar treinamento pelo título','learningQuery18','','search','maxlength="120" placeholder="Ex.: comunicação ou integração"')+select('Mostrar','learningKind18',[['','Cursos e trilhas'],['course','Somente cursos'],['mission','Somente trilhas']])+'</div><p class="lxp-note" id="learningResults18" role="status" aria-live="polite"></p>')
   linkBox.insertAdjacentHTML('beforeend','<p class="lxp-note" id="learningDetail18"></p>')
   const choose=()=>{const val=form.elements.learning16.value,item=available.find(o=>o.kind+':'+o.id===val);selectedLink=item?{kind:item.kind,id:item.id}:null;form.elements.status.disabled=!!selectedLink;if(selectedLink){form.elements.status.value='todo';if(!form.elements.title.value.trim()||form.elements.title.value===generatedTitle){form.elements.title.value=item.title;generatedTitle=item.title}}$('learningDetail18').textContent=item?(item.kind==='mission'?'Trilha de aprendizagem':'Curso')+' · '+item.minutes+' min · '+item.progress+'% concluído. O progresso será atualizado pelo LMS.':''}
   const filter=()=>{const previous=form.elements.learning16.value,q=normalize(form.elements.learningQuery18.value.trim()),kind=form.elements.learningKind18.value;const matches=available.filter(o=>(!kind||o.kind===kind)&&normalize(o.title).includes(q)),selected=available.find(o=>o.kind+':'+o.id===previous),visible=selected&&!matches.includes(selected)?[selected,...matches]:matches;form.elements.learning16.innerHTML=[['','Sem vínculo automático'],...visible.map(o=>[o.kind+':'+o.id,(o.kind==='mission'?'Trilha: ':'Curso: ')+o.title+' · '+o.minutes+' min · '+o.progress+'%'])].map(([value,label])=>'<option value="'+e(value)+'">'+e(label)+'</option>').join('');form.elements.learning16.value=previous;$('learningResults18').textContent=matches.length+' treinamento(s) encontrado(s) no escopo da pessoa.'+(r.truncated?' Refine a busca: o catálogo ultrapassa o limite de exibição.':'')}
   form.elements.learning16.onchange=choose;form.elements.learningQuery18.oninput=filter;form.elements.learningKind18.onchange=filter;filter()
  }catch(ex){if(valid()&&run===optionRun)linkBox.innerHTML=boxInfo('Vínculo indisponível',ex.message)}
 }
 form.elements.mix.addEventListener('change',populate);form.elements.personId.addEventListener('change',populate);void populate()
 form.onsubmit=async ev=>{ev.preventDefault();if(!valid())return;const btn=form.querySelector('[type=submit]');if(btn.disabled)return;btn.disabled=true;const b=Object.fromEntries(new FormData(form));delete b.learning16;if(found){b.id=found.id;b.revision=found.revision}if(selectedLink){b.learningLink=selectedLink;b.mix='10';b.status='todo'}try{await apiLxp('growth',b);if(valid()){notify('Ação registrada.');void renderGrowth()}}catch(ex){if(valid())notify(ex.message)}finally{btn.disabled=false}}
}
// ───── 1:1 private conversations ─────
async function renderMeetings(){
 await asyncScreen(screen('Presença e conexão','Conversas 1:1','Registre combinados e acompanhe as conversas com sua liderança.',load(),button('Agendar conversa','meeting-new','','primary')),async current=>{
  const response=await apiLxp('meetings'),items=response.items||[];if(!current())return
  const summary='<div class="lxp-metrics">'+metric('Conversas',items.length,'no seu histórico')+metric('Próximas',items.filter(m=>m.date>=iso()).length,'a partir de hoje')+'</div>'
  const list=items.length?'<div class="lxp-grid">'+items.map(m=>'<article class="lxp-card"><div class="lxp-card-icon">'+ic('calendar')+'</div><small>'+shortDate(m.date)+'</small><h2>'+e(m.agenda)+'</h2><p>'+e(m.action||'Sem combinados definidos.')+'</p><p><small>Participantes: '+m.participants.map(names).map(e).join(' e ')+'</small></p>'+button('Abrir conversa','meeting-edit',m.id)+'</article>').join('')+'</div>':empty('Nenhuma conversa registrada','Comece uma conversa de desenvolvimento com um colega ou sua liderança.')
  enterScreen(screen('Relações de confiança','Conversas 1:1','Apenas participantes têm acesso às suas conversas. Notas pessoais permanecem separadas.',summary+list+linkLegacy('1:1'),button('Agendar conversa','meeting-new','','primary')))
 })
}
async function openMeetingEditor(id=''){
 const data=await apiLxp('meetings'),m=data.items.find(x=>x.id===id),other=m?.participants.find(p=>p!==d.me.id)||''
 const people=personOptions().filter(p=>p.company_id===companyPick()||!p.company_id)
 const form=panel('Registro da conversa','<form id="lxpMeetingEditor">'+select('Com quem?','otherId',people.map(p=>[p.id,p.name]),other)+field('Data','date',m?.date||iso(),'date','required')+textarea('Pauta principal','agenda',m?.agenda||'','required maxlength="1500"')+textarea('Combinados e próximos passos','action',m?.action||'','maxlength="1500"')+textarea('Suas notas privadas','privateNote',m?.privateNote||'','maxlength="2000"')+'<p class="lxp-muted">Suas notas privadas não são compartilhadas nem com o outro participante.</p><div class="lxp-form-actions">'+button('Cancelar','meeting-back')+'<button type="submit" class="lxp-btn primary">Salvar conversa</button></div></form>')
 enterScreen(screen('Conexão e desenvolvimento',m?'Editar conversa':'Nova conversa 1:1','Priorize combinados claros e acompanhamento humano.',form))
 $('lxpMeetingEditor').onsubmit=async ev=>{ev.preventDefault();const b=Object.fromEntries(new FormData(ev.currentTarget));if(m)b.id=m.id;try{await apiLxp('meetings',b);notify('Conversa salva.');void renderMeetings()}catch(ex){notify(ex.message)}}
}
// ───── Feedback: request and reply without exposing messages to administrators ─────
async function renderFeedback(){
 await asyncScreen(screen('Cultura de feedback','Feedback e conexões','Converse sobre comportamentos, contribuições e oportunidades.',load(),button('Pedir feedback','feedback-new','','primary')),async current=>{
  const response=await apiLxp('feedback'),items=response.items||[];if(!current())return
  const incoming=items.filter(x=>x.toId===d.me.id&&x.status==='requested').length
  const summary='<div class="lxp-metrics">'+metric('Conversas de feedback',items.length,'solicitações relacionadas a você')+metric('Solicitações a responder',incoming,'seu retorno é importante')+'</div>'
  const list=items.length?'<div class="lxp-stack">'+items.map(item=>'<article class="lxp-line"><div><strong>'+e(item.topic)+'</strong><small>'+e(item.from.name)+' pediu a '+e(item.to.name)+'</small>'+(item.status==='answered'?'<p>'+e(item.answer)+'</p>':'')+'</div>'+status(item.status)+(item.toId===d.me.id&&item.status==='requested'?button('Responder','feedback-answer',item.id,'primary'):'')+'</article>').join('')+'</div>':empty('Nenhuma solicitação registrada','Um pedido de feedback pode iniciar uma conversa transformadora.')
  enterScreen(screen('Evolução compartilhada','Feedback e conexões','Solicite opiniões objetivas e construtivas com segurança.',summary+list+linkLegacy('Feedback'),button('Pedir feedback','feedback-new','','primary')))
 })
}
async function showFeedbackNew(){
 const people=personOptions().filter(p=>p.company_id===companyPick()||!p.company_id)
 const content=panel('Solicitar opinião','<form id="lxpFeedbackNew">'+select('De quem você quer receber um feedback?','toId',people.map(p=>[p.id,p.name]))+textarea('Sobre qual entrega, habilidade ou comportamento?','topic','','required maxlength="300"')+'<div class="lxp-form-actions">'+button('Voltar','feedback-back')+'<button type="submit" class="lxp-btn primary">Enviar solicitação</button></div></form>')
 enterScreen(screen('Novas perspectivas','Pedir feedback','Torne sua solicitação específica, para facilitar uma resposta útil.',content))
 $('lxpFeedbackNew').onsubmit=async event=>{event.preventDefault();try{await apiLxp('feedback',Object.fromEntries(new FormData(event.currentTarget)));notify('Solicitação enviada.');void renderFeedback()}catch(ex){notify(ex.message)}}
}
async function showFeedbackAnswer(id){
 const data=await apiLxp('feedback'),f=data.items.find(x=>x.id===id);if(!f)return
 const content=panel('Sua resposta','<form id="lxpFeedbackAnswer"><p><strong>'+e(f.from.name)+'</strong> deseja saber:</p><blockquote>'+e(f.topic)+'</blockquote>'+textarea('Compartilhe observações objetivas e sugestões práticas','answer','','required maxlength="3500"')+'<div class="lxp-form-actions">'+button('Cancelar','feedback-back')+'<button type="submit" class="lxp-btn primary">Enviar feedback</button></div></form>')
 enterScreen(screen('Compartilhar aprendizados','Responder feedback','Seu feedback será visível para a pessoa solicitante.',content))
 $('lxpFeedbackAnswer').onsubmit=async ev=>{ev.preventDefault();try{await apiLxp('feedback/answer',{id,answer:ev.currentTarget.elements.answer.value});notify('Feedback enviado.');void renderFeedback()}catch(ex){notify(ex.message)}}
}
// Integrated profile: read-only projection; no additional page/draw overrides.
const profileButton16=(p,label='Perfil integrado')=>'<button type="button" class="lxp-btn" data-profile-v16="'+e(p)+'">'+e(label)+'</button>'
let profileRun16=0
async function showProfile16(personId){
 const modal=$('modal'),host=$('modalBody'),run=++profileRun16,viewer=d?.me?.id,route=page
 if(!viewer||!modal||!host)return
 const current=()=>run===profileRun16&&modal.open&&d?.me?.id===viewer&&page===route&&host.isConnected&&host.querySelector('[data-profile16-root]')
 host.innerHTML='<section class="pic16" data-profile16-root><header><h2>Perfil integrado</h2><button type="button" class="lxp-btn" data-pic16-close>Fechar</button></header>'+load()+'</section>';if(!modal.open)modal.showModal()
 try{
  const x=await apiLxp('profile?person='+encodeURIComponent(personId));if(!current())return
  const p=x.person,c=x.counts,wrap=host.querySelector('[data-profile16-root]'),row=(title,subtitle,right='')=>'<article class="pic16-row"><div><strong>'+e(title)+'</strong><small>'+e(subtitle)+'</small></div>'+right+'</article>',progress=v=>v===null||v===undefined?'Indisponível':e(v)+'%',meter=v=>v==null?'—':'<span class="pic16-meter"><progress max="100" value="'+e(v)+'"></progress><b>'+progress(v)+'</b></span>',blank=()=>empty('Sem registros','Nenhum registro disponível neste recorte.'),rows=(items,fn)=>items.length?items.map(fn).join(''):blank()
  const data={
   'Visão geral':'<div class="pic16-metrics">'+metric('Cursos concluídos',c.completed+' / '+c.courses,'matrículas atuais')+metric('Trilhas concluídas',c.completedMissions+' / '+c.missions,'atribuições explícitas')+metric('Carga horária nominal',Math.round(c.nominalMinutes/60*10)/10+' h','conteúdos concluídos')+metric('Certificados',c.certificates??'—','efetivamente emitidos')+metric('PDI concluído',c.completedPdi+' / '+c.pdi,'ações atuais')+metric('OKRs individuais',c.okrs,'publicados ou encerrados')+'</div>'+boxInfo('Critérios dos indicadores',x.method)+(x.self?'<div class="pic16-metrics">'+metric('Conversas 1:1',c.meetings??'—','somente suas conversas')+metric('Feedbacks pendentes',c.pendingFeedback??'—','solicitações recebidas')+'</div>':''),
   'Treinamentos':panel('Cursos atribuídos',rows(x.courses,k=>row(k.title,k.minutes+' min · '+(k.completed?'Concluído':'Em aberto'),meter(k.progress))))+panel('Trilhas atribuídas',rows(x.missions,k=>row(k.title,k.minutes+' min',meter(k.progress))))+(x.self?button('Ir para catálogo','goto','Catálogo LMS','primary'):''),
   'PDI':panel('Plano de desenvolvimento',rows(x.pdi,k=>row(k.title,k.mix+'% · '+(k.dueDate?shortDate(k.dueDate):'Sem prazo')+(k.learning?' · '+k.learning.title:''),status(k.status)+(k.learning?meter(k.learning.progress):''))))+(x.self?button('Abrir meu PDI','goto','PDI','primary'):''),
   'Metas':panel('OKRs individuais',rows(x.okrs,k=>row(k.title,shortDate(k.startsOn)+' a '+shortDate(k.endsOn),meter(k.progress))))+(x.self?button('Abrir OKRs','goto','OKR','primary'):''),
   'Avaliações':panel('Resultados liberados',rows(x.cycles,k=>'<div class="pic16-review">'+row(k.title,shortDate(k.endDate),'<b>'+e(k.score??'—')+'</b>')+k.competencies.map(v=>row(v.label,v.suppressed?'Perspectivas pequenas protegidas':'Proficiência observada / esperada','<b>'+e(v.observed??'—')+' / '+e(v.expected??'—')+'</b>')).join('')+recommendedPanel17(k.recommendations,x.self)+'</div>'))
  }
  wrap.innerHTML='<header><div class="pic16-avatar">'+e(p.name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase())+'</div><div class="pic16-identity"><h2>'+e(p.name)+'</h2><p>'+e(p.position||'Cargo não informado')+'</p><small>'+e([p.companyName,p.departmentName,p.managerName?'Gestor: '+p.managerName:''].filter(Boolean).join(' · '))+'</small></div><button type="button" class="lxp-btn" data-pic16-close>Fechar</button></header><div class="pic16-tabs" role="group" aria-label="Seções do perfil">'+Object.keys(data).map((k,i)=>'<button type="button" class="lxp-btn" data-pic16-tab="'+e(k)+'" aria-pressed="'+(i===0)+'">'+e(k)+'</button>').join('')+'</div><div class="pic16-content"></div><small class="pic16-foot">Consulta · até '+x.limit+' registros por seção. Informações privadas e respostas de Pulse não são exibidas.</small>'
  const show=tab=>{wrap.querySelector('.pic16-content').innerHTML=data[tab];wrap.querySelectorAll('[data-pic16-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pic16Tab===tab)))};show('Visão geral')
  wrap.addEventListener('click',ev=>{const tab=ev.target.closest('[data-pic16-tab]');if(tab&&Object.hasOwn(data,tab.dataset.pic16Tab))show(tab.dataset.pic16Tab);if(ev.target.closest('[data-lxp="goto"]'))modal.close()})
 }catch(ex){if(current())host.querySelector('[data-profile16-root]').innerHTML='<header><h2>Perfil integrado</h2><button type="button" class="lxp-btn" data-pic16-close>Fechar</button></header>'+error(ex.message)}
}
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-profile-v16]');if(b){ev.preventDefault();void showProfile16(b.dataset.profileV16)}if(ev.target.closest('[data-pic16-close]')){$('modal').close();profileRun16++}})

// ───── LXP landing and self-service administration ─────
async function renderJourney(){
 await asyncScreen(screen('Você no centro','Minha jornada','Sua trilha de evolução é feita de experiências, pessoas e conquistas.',load()),async current=>{
  const data=await apiLxp('me');if(!current())return
  let next16='';try{const x=await apiLxp('profile');if(!current())return;const groups=[['Cursos pendentes',x.courses.filter(k=>!k.completed),'Catálogo LMS'],['Trilhas pendentes',x.missions.filter(k=>!k.completed),'Missões'],['Ações de PDI em aberto',x.pdi.filter(k=>k.status!=='done').sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999')),'PDI']];next16=panel('Próximas ações','<div class="lxp-grid">'+groups.map(([label,items,dest])=>'<div class="lxp-panel"><h3>'+e(label)+'</h3>'+items.slice(0,5).map(k=>'<div class="pic16-row"><div><strong>'+e(k.title)+'</strong><small>'+e(k.dueDate?shortDate(k.dueDate):k.progress!=null?k.progress+'%':'Em aberto')+'</small></div></div>').join('')+(items.length?'':'<p>Nenhuma pendência neste recorte.</p>')+button('Abrir módulo','goto',dest)+'</div>').join('')+'</div>','Até 5 itens por seção')}catch(ex){if(!current())return;next16=boxInfo('Próximas ações indisponíveis','Os demais módulos permanecem acessíveis.')}
  const links=[['Catálogo LMS','Catálogo de cursos','Explore conteúdos atribuídos a você','learning'],['Missões','Trilhas de aprendizagem','Missões que conectam etapas de desenvolvimento','growth'],['PDI','Meu PDI','Ações 70–20–10 e evidências','growth'],['1:1','Conversas 1:1','Alinhamentos e acompanhamento humano','calendar'],['Feedback','Feedback','Peça opiniões e amplie sua consciência','feedback'],['Pulse','Pulso do time','Participe de pesquisas e contribua com o clima','pulse'],['Desempenho','Avaliação de desempenho','Autoavaliações e avaliações de liderança','performance'],['Certificados','Minhas conquistas','Certificados das suas conclusões','check']]
  enterScreen(screen('Experiência de desenvolvimento','Minha jornada','Aprender é combinar conhecimento, prática e boas conversas.','<div class="lxp-hero-personal"><div><span>SEU DNA</span><h2>Bem-vindo de volta, '+e(data.user.name.split(' ')[0])+'.</h2><p>Seu desenvolvimento acontece em cada decisão, conversa e desafio.</p></div>'+ic('growth')+'</div><div class="lxp-metrics">'+metric('Cursos atribuídos',data.counts.assignedCourses,'na sua trajetória')+metric('Cursos concluídos',data.counts.completedCourses,'conquistas alcançadas')+metric('Avaliações para responder',data.counts.pendingReviews,'neste período')+metric('PDI em aberto',data.counts.activePDIs,'ações práticas')+'</div>'+next16+'<div class="lxp-grid">'+links.map(([to,title,desc,icon])=>'<button class="lxp-module-card" data-lxp="goto" data-id="'+e(to)+'"><span>'+ic(icon)+'</span><strong>'+e(title)+'</strong><small>'+e(desc)+'</small>'+ic('arrow')+'</button>').join('')+'</div>',profileButton16(d.me.id,'Meu perfil integrado')))
 })}
async function renderAccess(){
 await asyncScreen(screen('Seu papel no Learning','Meu acesso','Transparência de permissões, vínculo empresarial e caminhos de administração.',load()),async current=>{
  const data=await apiLxp('me'),mine=data.user;if(!current())return
  let content='<div class="lxp-metrics">'+metric('Meu perfil',mine.role,'permissão atual')+metric('Empresas disponíveis',data.allowedCompanies.length,'no meu escopo')+metric('Vínculo empresarial',mine.companyId?'Ativo':'Pendente','definido no cadastro')+'</div>'+panel('Configuração de acesso','<div class="lxp-stack"><div class="lxp-line"><div><strong>'+e(mine.name)+'</strong><small>ID: '+e(mine.id)+'</small></div>'+status(data.requiresCompanyLink?'pending':'done')+'</div><div class="lxp-line"><div><strong>Pesquisa de Pulse</strong><small>Permissão para criar e publicar pesquisas</small></div><strong>'+(data.canCreatePulse?'Permitido':'Não autorizado')+'</strong></div><div class="lxp-line"><div><strong>Ciclos de desempenho</strong><small>Configuração e publicação de formulários</small></div><strong>'+(data.canConfigurePerformance?'Permitido':'Não autorizado')+'</strong></div></div>'+(data.requiresCompanyLink?boxInfo('Vínculo da empresa pendente','Vincule seu próprio usuário a uma empresa em Pessoas → Editar cadastro e empresa. Isso é necessário para participar de alguns processos.'):'')+(data.user.role==='Administrador'?button('Editar meu cadastro','self-admin'):'') )
  if(data.canManage)content+=panel('Ferramentas de gestão','<div class="lxp-shortcuts">'+button('Gerenciar Pessoas','goto','Pessoas')+button('Estrutura organizacional','goto','Estrutura organizacional')+button('Nova pesquisa de Pulse','pulse-new')+button('Criar avaliação','perf-new')+'</div>')
  enterScreen(screen('Meu perfil e permissões','Meu acesso','Seu perfil administrativo pode configurar a plataforma conforme as regras corporativas.',content))
 })}

// ───── Immersive learning: preserve existing player, SCORM bridge and progress handlers ─────
const modalElement=$('modal')
let learningImmersive=null
function decorateLearningModal(){
 if(!modalElement?.open||!modalElement.classList.contains('lxp-immersive'))return
 const body=$('modalBody');if(!body)return
 const target=d?.enroll?.find(x=>x.id===learningImmersive?.id)
 const course=d?.courses?.find(x=>x.id===target?.course)
 if(!body.querySelector('.lxp-lesson-top')){
  const top=document.createElement('div');top.className='lxp-lesson-top'
  top.innerHTML='<span>DNA DO DESENVOLVIMENTO / SALA DE AULA</span><div><h2>'+e(course?.title||'Sua aula')+'</h2><p>'+e(course?.track||'Aprendizagem')+' · '+e(course?.minutes||'')+' min</p></div><div class="lxp-lesson-progress"><span>'+e(target?.progress||0)+'% concluído</span><div class="lxp-bar"><i style="width:'+Number(target?.progress||0)+'%"></i></div></div>'
  if(course&&course.type!=='SCORM'&&course.type!=='Questionário'){
   const note=document.createElement('p');note.className='privacy-note';note.textContent='Registrar conclusão confirma que você estudou este conteúdo (autodeclaração). Avaliações finais publicadas para o curso também podem ser necessárias.';top.append(note)
  }
  body.prepend(top)
 }
}
if(modalElement){
 const observer=new MutationObserver(()=>decorateLearningModal())
 observer.observe(modalElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']})
 modalElement.addEventListener('close',()=>{
  if(modalElement.classList.contains('lxp-immersive')){modalElement.classList.remove('lxp-immersive');document.body.classList.remove('lxp-reading');learningImmersive=null;if(location.hash.startsWith('#/aula/'))history.replaceState(null,'',location.pathname+location.search)}
  modalElement.classList.remove('lxp-editor-immersive')
 })
}
document.addEventListener('click',event=>{
 const btn=event.target.closest('[data-act]');if(!btn)return
 const act=btn.dataset.act
 if(['learn','openMission'].includes(act)){
  learningImmersive={id:btn.dataset.id,from:page};modalElement?.classList.add('lxp-immersive');document.body.classList.add('lxp-reading')
  if(act==='learn')history.replaceState(null,'','#/aula/'+encodeURIComponent(btn.dataset.id))
 }
 if(['newCourse','editCourse','newMission'].includes(act))modalElement?.classList.add('lxp-editor-immersive')
},true)
window.addEventListener('popstate',()=>{if(modalElement?.open&&modalElement.classList.contains('lxp-immersive'))modalElement.close()})

// Event handling: synchronous action dispatch, existing app nav remains in control.
document.addEventListener('click',event=>{
 const control=event.target.closest('[data-lxp]');if(!control)return
 event.preventDefault();const {lxp:action,id}=control.dataset
 const actions={
  'pulse-new':showPulseNew,'pulse-back':renderPulse,'pulse-answer':()=>showPulseAnswer(id),'pulse-details':()=>showPulseDetails(id),
  'pulse-close':async()=>{if(!confirm('Deseja encerrar a pesquisa?'))return;await apiLxp('pulse/close',{id});notify('Pesquisa encerrada.');renderPulse()},
  'perf-new':()=>editPerformance(),'perf-back':renderPerformance,'perf-open':()=>openPerformance(id),'perf-edit':()=>editPerformance(id),
  'perf-save':savePerformance,'perf-publish':async()=>{const x=await apiLxp('performance/cycle?id='+encodeURIComponent(id));if(!confirm('Publicar este ciclo e criar tarefas para os participantes?'))return;const r=await apiLxp('performance/publish',{id,revision:x.revision});notify('Ciclo publicado: '+r.tasks+' avaliações.'+(r.missingLeaders?' '+r.missingLeaders+' pessoa(s) sem liderança vinculada.':''));openPerformance(id)},
  'perf-close':async()=>{if(!confirm('Encerrar o ciclo? Não será possível enviar novas respostas.'))return;await apiLxp('performance/close',{id});openPerformance(id)},
  'perf-release':async()=>{if(!confirm('Liberar os resultados individuais aos colaboradores?'))return;await apiLxp('performance/release',{id});openPerformance(id)},
  'perf-calibrate':async()=>{const f=$('lxpCalibrationForm');if(!f?.reportValidity())return;const b=Object.fromEntries(new FormData(f)),c=await apiLxp('performance/cycle?id='+encodeURIComponent(id));await apiLxp('performance/calibrate',{id,revision:c.revision,personId:b.personId,proposed:Number(b.proposed),justification:b.justification});notify('Proposta registrada.');openPerformance(id)},
 'perf-calibrate-approve':async()=>{if(!confirm('Aprovar esta proposta de calibração?'))return;const c=await apiLxp('performance/cycle?id='+encodeURIComponent(perfCycleId));await apiLxp('performance/calibration/approve',{id:c.id,revision:c.revision,proposalId:id});openPerformance(c.id)},
 'perf-calibrate-finish':async()=>{if(!confirm('Encerrar a etapa de calibração?'))return;const c=await apiLxp('performance/cycle?id='+encodeURIComponent(id));await apiLxp('performance/calibration/finish',{id,revision:c.revision});openPerformance(id)},
 'perf-pdi':async()=>{const f=$('lxpCyclePdi');if(!f?.reportValidity())return;const b=Object.fromEntries(new FormData(f));f.dataset.requestId||=crypto.randomUUID();await apiLxp('performance/pdi',{...b,id,requestId:f.dataset.requestId});notify('Ação criada no PDI da pessoa.');openPerformance(id)},
 'perf-task':()=>openTask(id),'perf-task-save':()=>submitTask(false),'perf-task-submit':()=>submitTask(true),
  'perf-add-question':()=>{syncQuestions(document);questionCollections[id].push({type:'rating',title:'',weight:1,required:true});drawQuestions()},
  'perf-remove-question':()=>{syncQuestions(document);const [group,index]=id.split(':');questionCollections[group].splice(Number(index),1);drawQuestions()},
  'growth-new':()=>openGrowthEditor(),'growth-edit':()=>openGrowthEditor(id),'growth-back':renderGrowth,
  'growth-launch':async()=>{const response=await apiLxp('growth'),action=response.items.find(item=>item.id===id&&item.personId===d.me.id);if(!action?.learning?.available)throw Error('Treinamento indisponível para o seu acesso.');await refresh({social:false});if(action.learning.kind==='mission')openMission(action.learning.id);else learn(action.learning.id)},
  'meeting-new':()=>openMeetingEditor(),'meeting-edit':()=>openMeetingEditor(id),'meeting-back':renderMeetings,
  'feedback-new':showFeedbackNew,'feedback-answer':()=>showFeedbackAnswer(id),'feedback-back':renderFeedback,
  'goto':()=>{page=id;draw()},'self-admin':()=>{if(d?.me?.role==='Administrador'&&typeof userForm==='function')userForm(d.me.id)},
  'legacy':()=>{if(typeof record==='function')record(id)}
 }
 const fn=actions[action];if(!fn)return
 Promise.resolve().then(fn).catch(ex=>notify(ex.message||'Não foi possível concluir a operação.'))
})
window.addEventListener('load',enhanceMenu)
})()
