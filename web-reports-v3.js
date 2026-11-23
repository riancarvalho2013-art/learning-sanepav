/* Learning Sanepav 3.0 — Reports center. Existing application extension. */
(() => {
'use strict'
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const n=x=>x==null||!Number.isFinite(Number(x))?'Não disponível':Number(x).toLocaleString('pt-BR',{maximumFractionDigits:2})
const tabs=[['Geral','Visão Geral'],['LMS','Aprendizagem'],['DHO','DHO e LXP'],['Pessoas','Pessoas e áreas'],['Matrículas','Detalhamento'],['Dicionário','Dicionário']]
const groups={Geral:['people.active','learning.enrollments','learning.completed','learning.completion_rate','learning.courses','learning.certificates','dho.reviews_submitted','dho.pdi_actions','dho.pulse_mean'],LMS:['learning.enrollments','learning.completed','learning.completion_rate','learning.courses','learning.avg_progress','learning.score_avg','learning.expired','learning.certificates','learning.tracks'],DHO:['dho.pdi_actions','dho.pdi_completion','dho.cycles','dho.reviews_assigned','dho.reviews_submitted','dho.review_adherence','dho.meetings','dho.feedback_requests','dho.pulse_surveys','dho.pulse_mean','dho.pulse_response_rate']}
let savedViews=null,reportContextInitialized=false,lastHeaderCompany=''
let section='Geral', reportState={company:'',department:'',person:'',course:'',from:'',to:''},catalog=null,last=null,offset=0,token=0
const $r=()=>document.getElementById('inside')
const query=()=>new URLSearchParams(Object.entries(reportState).filter(([k,v])=>v)).toString()
const filters=()=>query()?'?'+query():''
const org=()=>typeof organizationData==='object'&&organizationData?organizationData:{companies:[],departments:[],people:[]}
const firstCompany=()=>typeof organizationCompany==='string'?organizationCompany:''
const departmentChoices=()=>org().departments.filter(x=>!reportState.company||x.company_id===reportState.company)
const metricCard=m=>'<article class="r3-card"><div class="r3-card-label">'+esc(m.label)+'</div><strong class="r3-number">'+(m.available?n(m.value):'—')+(m.unit==='%'&&m.available?'<small>%</small>':'')+'</strong><p>'+esc(m.available?'Fonte: '+m.source:m.note||m.reason||'Sem dados suficientes para o cálculo')+'</p></article>'
const opt=(v,label,selected)=>'<option value="'+esc(v)+'"'+(selected===v?' selected':'')+'>'+esc(label)+'</option>'
const form=()=>'<form id="r3-filters" class="r3-filters"><label>Empresa<select name="company">'+opt('','Todas autorizadas',reportState.company)+org().companies.map(x=>opt(x.id,x.name,reportState.company)).join('')+'</select></label>'+ 
 '<label>Departamento<select name="department">'+opt('','Todos',reportState.department)+departmentChoices().map(x=>opt(x.id,x.name,reportState.department)).join('')+'</select></label>'+ 
 '<label>De<input type="date" name="from" value="'+esc(reportState.from)+'"></label><label>Até<input type="date" name="to" value="'+esc(reportState.to)+'"></label>'+ 
 '<div class="r3-filter-actions"><button type="submit" class="r3-btn r3-primary">Aplicar filtros</button><button type="button" data-r3="reset" class="r3-btn">Limpar</button></div></form>'
const savedToolbar=()=>'<div class="r3-saved"><label>Minhas visões salvas<select id="r3-view-picker">'+opt('','Escolher filtros salvos','')+(savedViews||[]).map(v=>opt(v.id,v.name,'')).join('')+'</select></label><button type="button" data-r3="apply-view" class="r3-btn">Aplicar visão</button><button type="button" data-r3="save-view" class="r3-btn">Salvar visão</button><button type="button" data-r3="delete-view" class="r3-btn">Excluir visão</button></div><dialog id="r3-save-dialog" class="r3-dialog"><form id="r3-saveform"><h2>Salvar visão personalizada</h2><p>Guarde sua seleção de empresa, período e departamento.</p><label>Nome da visão<input name="viewname" required minlength="2" maxlength="80" placeholder="Ex.: Resultado trimestral de T&D"></label><div><button type="button" class="r3-btn" data-r3="close-dialog">Cancelar</button><button class="r3-btn r3-primary" type="submit">Salvar</button></div></form></dialog>'
const top=(subtitle='Indicadores gerados com dados reais da plataforma.')=>'<section class="r3-hero"><div><span class="r3-overline">DNA DO DESENVOLVIMENTO / PEOPLE INTELLIGENCE</span><h1>Central de relatórios</h1><p>'+esc(subtitle)+'</p></div><div class="r3-hero-mark" aria-hidden="true">◈</div></section>'+ 
 '<nav class="r3-tabs" aria-label="Módulos analíticos">'+tabs.map(([id,label])=>'<button type="button" class="r3-tab'+(section===id?' is-active':'')+'" data-r3="tab" data-id="'+esc(id)+'">'+esc(label)+'</button>').join('')+'</nav>'+savedToolbar()+form()
const info=message=>'<div class="r3-empty" role="status">'+esc(message)+'</div>'
function value(code){return last?.metrics?.find(m=>m.code===code)}
function chart(){const d=(last?.byCourse||[]).slice(0,8)
 if(!d.length)return info('Ainda não existem matrículas no recorte selecionado.')
 return '<div class="r3-chart">'+d.map(x=>'<div class="r3-chart-row"><div class="r3-chart-label"><span>'+esc(x.title)+'</span><b>'+n(x.completionRate)+'%</b></div><div class="r3-track"><div style="width:'+Math.max(0,Math.min(100,x.completionRate||0))+'%"></div></div><small>'+n(x.completed)+' de '+n(x.enrollments)+' matrículas concluídas</small></div>').join('')+'</div>'}
function card(title,html,caption=''){return '<section class="r3-panel"><header><h2>'+esc(title)+'</h2>'+(caption?'<small>'+esc(caption)+'</small>':'')+'</header>'+html+'</section>'}
function metrics(codes){return '<div class="r3-metrics">'+codes.map(code=>value(code)).filter(Boolean).map(metricCard).join('')+'</div>'}
function table(headers,rows){return '<div class="r3-table-scroll"><table><thead><tr>'+headers.map(t=>'<th scope="col">'+esc(t)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>'}
function courseTable(){const a=last?.byCourse||[];return a.length?table(['Curso','Trilha','Tipo','Matrículas','Concluídas','Conclusão'],a.map(x=>'<tr><td><b>'+esc(x.title)+'</b></td><td>'+esc(x.track)+'</td><td>'+esc(x.type)+'</td><td>'+n(x.enrollments)+'</td><td>'+n(x.completed)+'</td><td>'+n(x.completionRate)+'%</td></tr>')):info('Nenhum curso com matrícula no escopo.')}
function deptTable(){const depts=last?.departments||[],names=new Map(org().departments.map(x=>[x.id,x.name]));return depts.length?table(['Departamento','Pessoas','Matrículas','Conclusões','Taxa de conclusão'],depts.map(x=>'<tr><td><b>'+esc(names.get(x.id)||x.label)+'</b></td>'+(x.suppressed?'<td colspan="4">Dados suprimidos: menos de cinco pessoas</td>':'<td>'+n(x.people)+'</td><td>'+n(x.enrollments)+'</td><td>'+n(x.completed)+'</td><td>'+n(x.completionRate)+'%</td>')+'</tr>')):info('Nenhuma pessoa encontrada no escopo autorizado.')}
const actions=()=>'<div class="r3-actions"><a class="r3-btn r3-primary" href="/api/reports/v3/export.csv'+esc(filters())+'" download>Exportar matrículas CSV</a><button type="button" class="r3-btn" data-r3="xlsx">Exportar Excel XLSX</button><button type="button" class="r3-btn" data-r3="print">Imprimir / salvar PDF</button></div>'
const annotations=()=>'<aside class="r3-disclaimer"><b>Como interpretar:</b> '+esc((last?.caveats||[]).join(' '))+'</aside>'
function content(){
 if(section==='Dicionário')return card('Definições oficiais',catalog?table(['Indicador','Código','Cálculo / critério','Unidade'],catalog.definitions.map(x=>'<tr><td><b>'+esc(x.label)+'</b></td><td><code>'+esc(x.code)+'</code></td><td>'+esc(x.definition)+'</td><td>'+esc(x.unit)+'</td></tr>')):info('Carregando dicionário.'))+card('Ainda sem fonte confiável',(catalog?.notTracked||[]).map(x=>'<p><b>'+esc(x.code)+':</b> '+esc(x.reason)+'</p>').join(''))
 if(section==='Pessoas')return metrics(['people.active','learning.enrollments','learning.completed','learning.completion_rate'])+card('Comparativo por departamento',deptTable(),'Resultados abaixo de cinco pessoas são suprimidos')+annotations()
 if(section==='LMS')return metrics(groups.LMS)+card('Conclusão por curso',chart())+card('Detalhamento dos cursos',courseTable())+actions()+annotations()
 if(section==='DHO')return metrics(groups.DHO)+card('Privacidade de pesquisas',info('Resultados de Pulse com menos de 7 respostas não aparecem em médias. O sistema não expõe respostas individuais nem notas privadas de 1:1.'))+annotations()
 if(section==='Matrículas')return card('Matrículas autorizadas','<div id="r3-enrollmentRows">'+info('Carregando registros…')+'</div>')+actions()+annotations()
 return metrics(groups.Geral)+card('Aprendizagem por curso',chart(),'Taxa de conclusão')+card('Resumo por departamento',deptTable(),'Mínimo de cinco pessoas')+actions()+annotations()
}
function skeleton(){return '<section class="r3-wrapper">'+top()+'<div class="r3-loading" role="status">Atualizando os indicadores…</div></section>'}
async function render(){const el=$r();if(!el)return
 const currentHeader=firstCompany();if(!reportContextInitialized||currentHeader!==lastHeaderCompany){reportState.company=currentHeader;reportState.department='';lastHeaderCompany=currentHeader;reportContextInitialized=true}
 const job=++token;el.innerHTML=skeleton()
 try{
  const out=await Promise.all([api('reports/v3/summary'+filters()),catalog?Promise.resolve(catalog):api('reports/v3/catalog'),savedViews?Promise.resolve({items:savedViews}):api('reports/v3/views')]);if(job!==token||page!=='Relatórios')return
  last=out[0];catalog=out[1];savedViews=out[2].items||[]
  el.innerHTML='<section class="r3-wrapper">'+top('Indicadores rastreáveis, permissões por empresa e recortes consistentes.')+content()+'</section>'
  if(section==='Matrículas')void loadRows()
 }catch(ex){if(job===token&&page==='Relatórios')el.innerHTML='<section class="r3-wrapper">'+top()+'<div class="r3-error" role="alert">'+esc(ex.message||'Não foi possível carregar a central de relatórios.')+'</div></section>'}
}
async function loadRows(){const anchor=document.getElementById('r3-enrollmentRows');if(!anchor)return
 try{const q=new URLSearchParams(query());q.set('limit','25');q.set('offset',String(offset))
  const result=await api('reports/v3/enrollments?'+q.toString())
  if(section!=='Matrículas'||page!=='Relatórios')return
  const current=document.getElementById('r3-enrollmentRows');if(!current)return
  const entries=result.rows||[]
  current.innerHTML=(entries.length?table(['Pessoa','Curso','Progresso','Status','Conclusão'],entries.map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+esc(x.course)+'</td><td>'+n(x.progress)+'%</td><td>'+esc(x.status)+'</td><td>'+esc(x.completed?new Date(x.completed).toLocaleDateString('pt-BR'):'—')+'</td></tr>')):info('Não há matrículas para este filtro.'))+
  '<div class="r3-pager"><span>Exibindo '+(result.total?offset+1:0)+'–'+Math.min(offset+entries.length,result.total)+' de '+result.total+'</span><button type="button" data-r3="back" '+(offset===0?'disabled':'')+'>Anterior</button><button type="button" data-r3="next" '+(offset+25>=result.total?'disabled':'')+'>Próxima</button></div>'
 }catch(ex){const box=document.getElementById('r3-enrollmentRows');if(box)box.innerHTML='<div class="r3-error">'+esc(ex.message)+'</div>'}
}
// Real Excel file via JSZip (the library already bundled for SCORM in the existing LMS).
function xmlEscape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))}
function columnLabel(i){let label='';for(let n=i+1;n;n=Math.floor((n-1)/26))label=String.fromCharCode(65+(n-1)%26)+label;return label}
function xmlSheet(rows){return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetData>'+rows.map((row,index)=>'<row r="'+(index+1)+'">'+row.map((value,col)=>{const addr=columnLabel(col)+(index+1),head=index===0?' s="1"':'';return typeof value==='number'&&Number.isFinite(value)?'<c r="'+addr+'"'+head+'><v>'+value+'</v></c>':'<c r="'+addr+'" t="inlineStr"'+head+'><is><t xml:space="preserve">'+xmlEscape(value)+'</t></is></c>'}).join('')+'</row>').join('')+'</sheetData></worksheet>'}
async function exportExcel(){
 if(typeof JSZip==='undefined')throw Error('A biblioteca de compactação não está disponível. Use CSV.')
 if(!last)throw Error('Aguarde o carregamento dos indicadores.')
 const meta=await api('reports/v3/enrollments?'+new URLSearchParams({...reportState,limit:'1',offset:'0'}).toString())
 if(meta.total>2000)throw Error('Para mais de 2.000 matrículas, utilize o CSV ou restrinja os filtros.')
 const rows=[]
 for(let offset=0;offset<meta.total;offset+=100){const args=new URLSearchParams({...reportState,limit:'100',offset:String(offset)})
  const pageData=await api('reports/v3/enrollments?'+args.toString());rows.push(...pageData.rows)
 }
 const sheetNames=['Resumo','Indicadores','Dados detalhados','Metadados','Dicionário']
 const overview=[['Learning Sanepav','DNA do Desenvolvimento'],['Relatório','Central de indicadores'],['Gerado em',new Date().toLocaleString('pt-BR')],['Fonte','Learning Sanepav (API autorizada)'],['Matrículas exportadas',rows.length]]
 const indicators=[['Código','Indicador','Valor','Unidade','Fonte','Definição'],...(last.metrics||[]).map(x=>[x.code,x.label,x.value??'Não disponível',x.unit,x.source,x.definition])]
 const detailed=[['Matrícula','Colaborador (ID)','Nome','Empresa (ID)','Departamento (ID)','Curso (ID)','Curso','Trilha','Formato','Situação','Progresso (%)','Nota','Prazo','Atualizado','Concluído'],...rows.map(x=>[x.id,x.personId,x.name,x.companyId,x.departmentId,x.courseId,x.course,x.track,x.type,x.status,x.progress,x.score??'',x.due,x.updated,x.completed])]
 const filtersRows=[['Filtro','Valor'],...Object.entries(reportState).map(([k,v])=>[k,v||'Todos']),['Fonte de vínculos','Estrutura organizacional atual'],['Privacidade Pulse','Somente agregados >=7 respostas; sem resposta individual'],['Processamento','Exportação local de dados já autorizados pela API']]
 const dictionary=[['Código','Nome','Definição','Unidade','Periodicidade'],...(catalog?.definitions||[]).map(x=>[x.code,x.label,x.definition,x.unit,x.period])]
 const data=[overview,indicators,detailed,filtersRows,dictionary],zip=new JSZip()
 zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheetNames.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>')
 zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
 zip.file('xl/workbook.xml','<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheetNames.map((name,i)=>'<sheet name="'+xmlEscape(name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>')
 zip.file('xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheetNames.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>')
 zip.file('xl/styles.xml','<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1868BA"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>')
 data.forEach((rows,i)=>zip.file('xl/worksheets/sheet'+(i+1)+'.xml',xmlSheet(rows)))
 const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'})
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='learning-sanepav-relatorio.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000)
}

// Preserve legacy navigation and all functional LXP modules.
const previousBody=body
body=function(...args){if(page==='Relatórios'){void render();return}return previousBody(...args)}
const previousDraw=draw
draw=function(...args){const out=previousDraw(...args);if(d?.me?.role==='Diretoria'){const nav=document.querySelector('aside nav');if(nav&&!nav.querySelector('[data-id="Relatórios"]')){const button=document.createElement('button');button.dataset.act='nav';button.dataset.id='Relatórios';button.innerHTML='<span class="ico">◫</span>Relatórios';nav.append(button)}}return out}
window.addEventListener('click',ev=>{const b=ev.target.closest('[data-r3]');if(!b)return
 ev.preventDefault();if(page!=='Relatórios')return
 const act=b.dataset.r3
 if(act==='tab'){section=b.dataset.id;offset=0;void render()}
 if(act==='reset'){reportState={company:firstCompany(),department:'',person:'',course:'',from:'',to:''};offset=0;void render()}
 if(act==='back'){offset=Math.max(0,offset-25);void loadRows()}
 if(act==='next'){offset+=25;void loadRows()}
 if(act==='apply-view'){const id=document.getElementById('r3-view-picker')?.value;const selected=savedViews?.find(v=>v.id===id);if(!selected)return toast('Selecione uma visão salva.');reportState={company:'',department:'',person:'',course:'',from:'',to:'',...selected.filters};offset=0;void render()}
 if(act==='save-view'){document.getElementById('r3-save-dialog')?.showModal()}
 if(act==='close-dialog'){document.getElementById('r3-save-dialog')?.close()}
 if(act==='delete-view'){const id=document.getElementById('r3-view-picker')?.value;const selected=savedViews?.find(v=>v.id===id);if(!selected)return toast('Selecione a visão para excluir.');if(!confirm('Excluir a visão '+selected.name+'?'))return;void api('reports/v3/views/delete',{id:selected.id,revision:selected.revision}).then(()=>{savedViews=null;void render()}).catch(ex=>toast(ex.message))}
 if(act==='print')window.print()
 if(act==='xlsx')void exportExcel().catch(ex=>{if(typeof toast==='function')toast(ex.message);else alert(ex.message)})
})
window.addEventListener('submit',ev=>{if(ev.target.id==='r3-saveform'){ev.preventDefault();const name=String(new FormData(ev.target).get('viewname')||'');void api('reports/v3/views',{name,filters:reportState}).then(()=>{document.getElementById('r3-save-dialog')?.close();savedViews=null;toast('Visão salva no seu perfil.');void render()}).catch(ex=>toast(ex.message));return}
 if(ev.target.id!=='r3-filters')return;ev.preventDefault()
 const data=new FormData(ev.target);reportState={...reportState,company:String(data.get('company')||''),department:String(data.get('department')||''),from:String(data.get('from')||''),to:String(data.get('to')||'')};offset=0;void render()
})
window.addEventListener('change',ev=>{if(ev.target.name==='company'&&ev.target.closest('#r3-filters')){
 const target=ev.target.value;const dept=ev.target.form?.elements.department;reportState.company=target;reportState.department=''
 if(dept)dept.innerHTML=opt('','Todos','')+org().departments.filter(x=>!target||x.company_id===target).map(x=>opt(x.id,x.name,'')).join('')
}})
})()
