/** V40 — configurable authorized analytics, no historical backfill. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const DAY=86400000, hist=['history.completions','history.unresolved','history.coverage'];
const fail=(ok,msg,status=400)=>{if(!ok)throw Object.assign(new Error(msg),{status})};
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const date=t=>new Date(t).toISOString().slice(0,10), stamp=s=>Date.parse(s+'T00:00:00Z');
const localDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
export const basisMode=b=>b==='ocorrencia_historica'?'historical':['estoque_atual','carteira_atual'].includes(b)?'current':['periodo_com_escopo_atual','pesquisa_vigente'].includes(b)?'period':null;
export function normalizeDashboardV40(value,definitions){
 if(value==null)return null;
 fail(value&&typeof value==='object'&&!Array.isArray(value),'Configuração do painel inválida.');
 fail(Object.keys(value).every(k=>['mode','granularity','compare','preset','widgets'].includes(k)),'Configuração desconhecida.');
 const {mode,granularity='month',compare=false,preset='custom',widgets}=value;
 fail(['current','period','historical'].includes(mode)&&['week','month','quarter','year'].includes(granularity)&&typeof compare==='boolean'&&['custom','7','30','90','month','quarter','year'].includes(preset),'Modo, período ou agrupamento inválido.');
 fail(Array.isArray(widgets)&&widgets.length>=1&&widgets.length<=12,'Escolha de 1 a 12 indicadores.');
 const defs=new Map(definitions.map(d=>[d.code,d]));const used=new Set();
 const normalized=widgets.map(w=>{fail(w&&typeof w==='object'&&!Array.isArray(w)&&Object.keys(w).every(k=>['code','display'].includes(k)),'Indicador inválido.');const d=defs.get(w.code);fail(d&&basisMode(d.temporalBasis)===mode&&!used.has(w.code),'Indicador fora da base temporal ou duplicado.');used.add(w.code);fail((mode==='historical'?['card','table','bar','line']:['card','table','bar']).includes(w.display),'Formato não suportado.');return {code:w.code,display:w.display}});
 return {mode,granularity,compare:mode==='historical'&&compare,preset,widgets:normalized};
}
export function rangesV40(from,to,granularity){
 fail(validDate(from)&&validDate(to)&&from<=to&&stamp(to)-stamp(from)<=1826*DAY,'Selecione um período histórico de até cinco anos.');
 fail(['week','month','quarter','year'].includes(granularity),'Agrupamento inválido.');
 const end=stamp(to),out=[];let cursor=stamp(from);
 while(cursor<=end){const d=new Date(cursor);let next;
 if(granularity==='week')next=cursor+(7-((d.getUTCDay()+6)%7))*DAY;
 else if(granularity==='month')next=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1);
 else if(granularity==='quarter')next=Date.UTC(d.getUTCFullYear(),Math.floor(d.getUTCMonth()/3)*3+3,1);
 else next=Date.UTC(d.getUTCFullYear()+1,0,1);
 const stop=Math.min(end,next-DAY);out.push({from:date(cursor),to:date(stop)});cursor=stop+DAY;fail(out.length<=120,'Selecione agrupamento mensal, trimestral ou anual para períodos longos.');}
 return out;
}
export function previousRangeV40(from,to){const start=stamp(from),length=stamp(to)-start+DAY;return {from:date(start-length),to:date(start-DAY)};}
/** Only already-authorized rows from historicalProjection enter this aggregation. */
export function historySeriesV40(result,from,to,granularity){
 const ranges=rangesV40(from,to,granularity);let observed=null;try{if(result.observedFrom&&Number.isFinite(Date.parse(result.observedFrom)))observed=localDay.format(new Date(result.observedFrom))}catch{}
 const globalCoverage=result.metrics?.find(m=>m.code==='history.unresolved')?.available===true;
 const bins=ranges.map(r=>({...r,resolved:0,unresolved:0}));
 for(const row of result.rows||[]){if(!row.completedAt||!Number.isFinite(Date.parse(row.completedAt)))continue;const d=localDay.format(new Date(row.completedAt));let lo=0,hi=bins.length;while(lo<hi){const mid=(lo+hi)>>1;if(bins[mid].to<d)lo=mid+1;else hi=mid}const b=bins[lo];if(!b||d<b.from)continue;if(row.reconciliation==='nao_reconciliado'){if(globalCoverage)b.unresolved++}else if(['snapshot_conclusao','historico_vigente'].includes(row.reconciliation))b.resolved++;}
 const project=b=>{const n=b.resolved+b.unresolved,known=Boolean(observed&&b.from>observed);return {from:b.from,to:b.to,coverage:known?'observado':'parcial',values:{'history.completions':known||b.resolved?b.resolved:null,'history.unresolved':globalCoverage&&(known||b.unresolved)?b.unresolved:null,'history.coverage':globalCoverage&&n?Math.round(b.resolved*10000/n)/100:null}}};
 const points=bins.map(project),total=project({from,to,resolved:bins.reduce((n,b)=>n+b.resolved,0),unresolved:bins.reduce((n,b)=>n+b.unresolved,0)});
 return {observedFrom:result.observedFrom||null,points,total,metrics:(result.metrics||[]).filter(m=>hist.includes(m.code)).map(({code,label,unit,definition,source})=>({code,label,unit,definition,source})),caveats:result.caveats||[]};
}
function swap(s,old,next){const n=s.split(old).length-1;if(n!==1)throw Error('V40: âncora esperada uma vez; encontrada '+n+': '+old.slice(0,110));return s.replace(old,()=>next)}
export function patchReportsV40(s){
 s="import {normalizeDashboardV40} from './people-analytics-v40.mjs'\n"+s;
 s=swap(s,"const id=body.id\n  return await updateViews", "const dashboard=normalizeDashboardV40(body.dashboard,semanticDefinitions())\n  const id=body.id\n  return await updateViews");
 s=swap(s,'Object.assign(view,{name,filters,revision:view.revision+1','Object.assign(view,{name,filters,dashboard,revision:view.revision+1');
 s=swap(s,'ownerId:user.id,name,filters,revision:1','ownerId:user.id,name,filters,dashboard,revision:1');
 s=swap(s,"if(route==='history'||route==='history.csv'||route==='history.xlsx')", "if(route==='history'||route==='history.csv'||route==='history.xlsx'||route==='history-series')");
 return s;
}
export function patchHistoryV40(s){
 s="import {rangesV40,historySeriesV40,previousRangeV40} from './people-analytics-v40.mjs'\n"+s;
 s=swap(s," const result=historicalProjection(state,user,ctx.DOMAIN,params,index)",` if(route==='history-series'){
  const from=params.get('from'),to=params.get('to'),granularity=params.get('granularity')||'month';rangesV40(from,to,granularity);fail(to<=day(new Date()),'O histórico não inclui datas futuras.');
  const result=historicalProjection(state,user,ctx.DOMAIN,params,index),series=historySeriesV40(result,from,to,granularity);
  let previous=null;if(params.get('compare')==='1'){const range=previousRangeV40(from,to),prior=new URLSearchParams(params);prior.set('from',range.from);prior.set('to',range.to);const previousResult=historicalProjection(state,user,ctx.DOMAIN,prior,index);previous=historySeriesV40(previousResult,range.from,range.to,'year').total}
  return json({...series,previous,filters:result.filters,granularity});
 }
 const result=historicalProjection(state,user,ctx.DOMAIN,params,index)`);
 return s;
}
export function patchWebV40(s,fragment){
 s=swap(s,"const tabs=[['Geral'","const tabs=[['Painel40','People Analytics'],['Geral'");
 s=swap(s,"let section='Geral', reportState=","let section='Painel40', reportState=");
 s=swap(s,"function content(){","function content(){\n if(section==='Painel40')return panelV40()");
 // The People Analytics calendar has its own form. Preserve its dates when applying organization filters.
 const dateFields=`'<label>De<input type="date" name="from" value="'+esc(reportState.from)+'"></label><label>Até<input type="date" name="to" value="'+esc(reportState.to)+'"></label>'+`;
 const scopedFields=`(section==='Painel40'?'<input type="hidden" name="from" value="'+esc(reportState.from)+'"><input type="hidden" name="to" value="'+esc(reportState.to)+'">':'<label>De<input type="date" name="from" value="'+esc(reportState.from)+'"></label><label>Até<input type="date" name="to" value="'+esc(reportState.to)+'"></label>')+`;
 s=swap(s,dateFields,scopedFields);
 s=swap(s,"const previousBody=body",fragment+'\nconst previousBody=body');
 s=swap(s," const job=++token;el.innerHTML=skeleton()",` if(reportOwnerV40!==d?.me?.id){reportOwnerV40=d?.me?.id;savedViews=null;catalog=null;last=null;historyResult=null;semanticResult=null;integrated=null;reportState={company:currentHeader,department:'',person:'',course:'',from:'',to:''};dashboardV40=defaultV40('current');panelResultV40=null;section='Painel40'}
 const job=++token;el.innerHTML=skeleton()`);
 s=swap(s,"  const historical=section==='Histórico';",`  if(section==='Painel40'){await loadPanelV40(el,job);return}
  const historical=section==='Histórico';`);
 s=swap(s,"if(job!==token||page!=='Relatórios')return\n  if(historical)","if(job!==token||page!=='Relatórios'||reportOwnerV40!==d?.me?.id)return\n  if(historical)");
 s=swap(s,"...selected.filters};offset=0;void render()}","...selected.filters};if(selected.dashboard){dashboardV40=selected.dashboard;section='Painel40'}offset=0;void render()}");
 s=swap(s,"{name,filters:reportState}).then", "{name,filters:reportState,...(section==='Painel40'?{dashboard:dashboardV40}:{})}).then");
 s=swap(s,"Guarde sua seleção de empresa, período e departamento.","Guarde filtros e, no People Analytics, os indicadores e formatos selecionados.");
 s=swap(s,"+top()+'<div class=\"r3-error\" role=\"alert\">'", "+top()+(section==='Painel40'?modesV40():'')+'<div class=\"r3-error\" role=\"alert\">'");
 s=swap(s,"if(act==='reset'){reportState=", "if(act==='reset'){if(section==='Painel40'){dashboardV40=defaultV40('current');panelResultV40=null}reportState=");
 s=swap(s,"to:String(data.get('to')||'')};offset=0;void render()", "to:String(data.get('to')||'')};if(section==='Painel40')dashboardV40.preset='custom';offset=0;void render()");
 return s;
}
export function patchReportTestsV40(s){
 return swap(s,"const saved=await call('hr','views',{name:'Minha visão de LMS',filters:{company:companyA,from:'2026-11-01'}})",`const dashboardV40={mode:'current',granularity:'month',compare:false,preset:'custom',widgets:[{code:'people.active',display:'card'},{code:'learning.completion_rate',display:'bar'}]};
 const savedV40=await call('hr','views',{name:'Painel V40',filters:{company:companyA},dashboard:dashboardV40});assert.equal(savedV40.status,200);assert.deepEqual((await call('hr','views')).data.items.find(v=>v.id===savedV40.data.id).dashboard,dashboardV40);assert.equal((await call('leader','views')).data.items.some(v=>v.id===savedV40.data.id),false);
 assert.equal((await call('hr','views',{name:'Inválido V40',filters:{company:companyA},dashboard:{...dashboardV40,widgets:[{code:'history.completions',display:'line'}]}})).status,400);
 assert.equal((await call('hr','views',{name:'Fora do escopo V40',filters:{company:companyB},dashboard:dashboardV40})).status,403);
 assert.equal((await call('hr','views/delete',{id:savedV40.data.id,revision:savedV40.data.revision})).status,200);
 const saved=await call('hr','views',{name:'Minha visão de LMS',filters:{company:companyA,from:'2026-11-01'}})`);
}
export function patchHistoryTestsV40(s){
 return swap(s," const catalog=await fetchData(admin,'catalog');eq(catalog.historicalDefinitions.length,3)",` const catalog=await fetchData(admin,'catalog');eq(catalog.historicalDefinitions.length,3)
 const seriesV40=await fetchData(admin,'history-series?from=2026-10-01&to=2026-10-31&granularity=week&compare=1');eq(seriesV40.total.values['history.completions'],4);eq(seriesV40.total.values['history.unresolved'],1);eq(seriesV40.total.values['history.coverage'],80);ok(seriesV40.previous);ok(!Object.hasOwn(seriesV40,'rows'));
 const seriesScopedV40=await fetchData(hrA,'history-series?company='+A+'&from=2026-10-01&to=2026-10-31&granularity=month');eq(seriesScopedV40.total.values['history.completions'],3);eq(seriesScopedV40.total.values['history.unresolved'],null);eq(seriesScopedV40.total.values['history.coverage'],null);
 eq((await call(hrB,'history-series?company='+A+'&from=2026-10-01&to=2026-10-31')).status,403);eq((await call(p,'history-series?from=2026-10-01&to=2026-10-31')).status,403);eq((await call(admin,'history-series?from=2026-10-31&to=2026-10-01')).status,400);
 console.log('PASS V40: configuração privada e série histórica serão verificadas pelos testes de relatórios.');`);
}
export function installV40(root='.'){
 const read=f=>readFileSync(resolve(root,f),'utf8'),fragment=read('web-people-analytics-v40.js'),style=read('web-people-analytics-v40.css');
 const changes=[['reports-v3.mjs',patchReportsV40(read('reports-v3.mjs'))],['historical-analytics-v12.mjs',patchHistoryV40(read('historical-analytics-v12.mjs'))],['web-reports-v3.js',patchWebV40(read('web-reports-v3.js'),fragment)],['web-reports-v3.css',read('web-reports-v3.css')+'\n'+style],['verify-reports-v3.mjs',patchReportTestsV40(read('verify-reports-v3.mjs'))],['verify-historical-v12.mjs',patchHistoryTestsV40(read('verify-historical-v12.mjs'))]];
 for(const [f,s] of changes)writeFileSync(resolve(root,f),s);return changes.length;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--install'))console.log('V40: '+installV40()+' arquivos integrados.');
