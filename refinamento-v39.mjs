/** V39: functional consistency, scoped writes, and safe error handling. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const fail=(message)=>{throw Error('V39: '+message)};
function swap(source,from,to){const count=source.split(from).length-1;if(count!==1)fail('Esperava uma âncora, encontrei '+count+': '+from.slice(0,120));return source.replace(from,()=>to)}
export async function readObjectV39(request){
 let value;try{value=await request.json()}catch{throw Object.assign(new Error('JSON inválido.'),{status:400})}
 if(!value||typeof value!=='object'||Array.isArray(value))throw Object.assign(new Error('Envie um objeto JSON válido.'),{status:400});return value;
}
// The storage adapter validates both guards in the same SQLite transaction as the write.
export function writeGuardV39(raw,state){return {requireStateEtag:raw.etag,requireOrganizationRevision:state.organization?.revision};}
export function overviewScopeV39(companyId,allowedCompanies){return new Set(companyId?[companyId]:allowedCompanies);}
export function socialTotalsV39(items){return [items.length,items.reduce((n,x)=>n+(x.comments?.length??x.commentCount??0),0),items.reduce((n,x)=>n+Object.values(x.reactions||{}).reduce((sum,v)=>sum+(Array.isArray(v)?v.length:Number(v)||0),0),0)];}
const imp=(s,names)=>`import {${names}} from './refinamento-v39.mjs'\n`+s;
export function patchLxpV39(s){
 s=imp(s,'readObjectV39,writeGuardV39,overviewScopeV39');
 s=swap(s,'async function change(bucket,transform){','async function change(bucket,transform,authorization){');
 s=swap(s,"const stored=await bucket.put(STORE,JSON.stringify(state),{onlyIf:etag?{etagMatches:etag}:{etagDoesNotMatch:'*'}})","const stored=await bucket.put(STORE,JSON.stringify(state),{onlyIf:etag?{etagMatches:etag}:{etagDoesNotMatch:'*'},...authorization})");
 s=swap(s,'const state=await source(BUCKET),user=getUser(req,state)',`const authorizedRaw=await BUCKET.get(LEGACY);err(authorizedRaw,'Ambiente não inicializado.',503);
 const state=await authorizedRaw.json(),user=getUser(req,state);
 // The entire authorization snapshot is checked at commit; a changed session, role or organization rejects the stale write.
 const scopedChange=transform=>change(BUCKET,transform,writeGuardV39(authorizedRaw,state))`);
 const calls=s.split('change(BUCKET,s=>').length-1;if(calls!==13)fail('LXP: quantidade de mutações legadas inesperada: '+calls);s=s.replaceAll('change(BUCKET,s=>','scopedChange(s=>');
 s=swap(s,"const request=async()=>{try{return await req.json()}catch{err(false,'Dados JSON inválidos.')}}","const request=()=>readObjectV39(req)");
 s=swap(s,"err(m&&m.participants.includes(user.id),'Conversa não encontrada.',404);","err(m&&m.participants.includes(user.id),'Conversa não encontrada.',404);err(m.participants.length===2&&m.participants.includes(other.id),'O participante de uma conversa existente não pode ser alterado.',409);");
 s=swap(s,'const applicable=db.cycles.filter(x=>!companyId||x.companyId===companyId)',"const scope=overviewScopeV39(companyId,allowed(state,DOMAIN,user));\n  const applicable=db.cycles.filter(x=>scope.has(x.companyId))");
 s=swap(s,'const responses=db.pulseResponses.filter(x=>db.pulses.some(p=>p.id===x.surveyId&&(!companyId||p.companyId===companyId)))',"const surveyIds=new Set(db.pulses.filter(p=>scope.has(p.companyId)).map(p=>p.id));\n  const responses=db.pulseResponses.filter(x=>surveyIds.has(x.surveyId))");
 s=swap(s,'pulseSurveys:db.pulses.filter(p=>!companyId||p.companyId===companyId).length','pulseSurveys:surveyIds.size');return s;
}
export function patchPlatformV39(s){
 s=imp(s,'readObjectV39');const count=s.split('await req.json()').length-1;if(count!==4)fail('Platform: quantidade inesperada de leituras JSON: '+count);return s.replaceAll('await req.json()','await readObjectV39(req)');
}
export function patchEvolutionV39(s){s=imp(s,'readObjectV39');const count=s.split('await req.json()').length-1;if(count!==4)fail('Evolution: quantidade inesperada de leituras JSON: '+count);return s.replaceAll('await req.json()','await readObjectV39(req)');}
export function patchWebV39(s){
 s=swap(s,"page='Painel';person='';d=null;notifications=[];","refreshSequence++;page='Painel';person='';d=null;notifications=[];");
 s=swap(s,'  notificationPending=true\n  try{','  notificationPending=true\n  const viewerV39=d.me.id,sequenceV39=refreshSequence;\n  try{');
 s=swap(s,'    const items=await response.json()\n    if(JSON.stringify(items)!==JSON.stringify(notifications)){','    const items=await response.json()\n    if(!d?.me||d.me.id!==viewerV39||refreshSequence!==sequenceV39)return;\n    if(JSON.stringify(items)!==JSON.stringify(notifications)){');
 s=swap(s,'function socialPage(){',`function syncIntranetMetricsV39(){
 const nodes=document.querySelectorAll('.intranet-metrics strong');if(nodes.length!==3||!isIntranet())return;
 const values=[feedItems.length,feedItems.reduce((n,x)=>n+(x.comments?.length??x.commentCount??0),0),feedItems.reduce((n,x)=>n+Object.values(x.reactions||{}).reduce((sum,v)=>sum+(Array.isArray(v)?v.length:Number(v)||0),0),0)];
 nodes.forEach((node,i)=>{const value=String(values[i]);if(node.textContent!==value)node.textContent=value});
}
function socialPage(){`);
 s=swap(s,'if(target)target.innerHTML=feedContent()','if(target)target.innerHTML=feedContent()\n      syncIntranetMetricsV39()');
 s=swap(s,'feedItems=feedItems.map(item=>item.id===id?updated:item)','feedItems=feedItems.map(item=>item.id===id?updated:item)\n  syncIntranetMetricsV39()');
 s=swap(s,'feedItems=[...new Map([...result.items,...feedItems].map(item=>[item.id,item])).values()]','feedItems=[...new Map([...result.items,...feedItems].map(item=>[item.id,item])).values()]\n      syncIntranetMetricsV39()');
 s=swap(s,"const outcome=await submit(Object.fromEntries(new FormData(f)),f);modal.close();await refresh();toast(outcome?.message||'Dados salvos.')","const outcome=await submit(Object.fromEntries(new FormData(f)),f);modal.close();try{await refresh()}catch{toast('Dados salvos. Não foi possível atualizar a tela; recarregue antes de repetir a operação.');return}toast(outcome?.message||'Dados salvos.')");
 return s;
}
export function patchLxpRegressionV39(s){
 // Existing in-memory test adapter must honor the same guard as the actual SQLite adapter.
 s=swap(s,'const BUCKET={async get(k)','let simulateStaleV39=false;\nconst BUCKET={async get(k)');
 s=swap(s,'async put(k,v,options){const existing=store.get(k);',`async put(k,v,options){if(k==='lxp/v2/state'&&simulateStaleV39){simulateStaleV39=false;const old=store.get('system/state-v1');store.set('system/state-v1',{...old,etag:rid()})}if(options?.requireStateEtag!==undefined&&store.get('system/state-v1')?.etag!==options.requireStateEtag)return null;const existing=store.get(k);`);
 return s+`\n// V39: authorization snapshot, overview isolation, and immutable conversation participants.\nconst beforeV39=store.get('lxp/v2/state').body.toString();simulateStaleV39=true;\nr=await call('meetings',{as:workers[0],method:'POST',body:{otherId:workers[1],date,agenda:'Não persistir após mudança de autorização'}});deny(r,409);assert.equal(store.get('lxp/v2/state').body.toString(),beforeV39);\nr=await call('meetings',{as:workers[0],method:'POST',body:{id:meetingId,otherId:workers[2],date,agenda:'Não trocar participante'}});deny(r,409);\nr=await call('meetings',{as:workers[0],method:'POST',body:{id:meetingId,otherId:workers[1],date,agenda:'Atualização válida'}});assert.equal(r.httpStatus,200);\nr=await call('pulse',{as:admin,method:'POST',body:{title:'Pesquisa empresa B',companyId:B,startDate:date,endDate:date,departmentIds:[]}});assert.equal(r.httpStatus,201);\nconst hrAssignmentV39=assigned.get(hr);assigned.delete(hr);try{r=await call('overview',{as:hr});assert.equal(r.management.pulseSurveys,2);r=await call('overview?company='+B,{as:hr});deny(r,403)}finally{assigned.set(hr,hrAssignmentV39)}\nr=await call('meetings',{as:workers[0],method:'POST',body:[]});deny(r,400);\nconsole.log('V39: escopo, concorrência, participantes e JSON validados.');\n`;
}
export function installV39(root='.'){
 const edits=[['lxp-v2.mjs',patchLxpV39],['platform.mjs',patchPlatformV39],['learning-evolution.mjs',patchEvolutionV39],['web-app.js',patchWebV39],['verify-lxp-v2.mjs',patchLxpRegressionV39]];
 const outputs=edits.map(([f,patch])=>[resolve(root,f),patch(readFileSync(resolve(root,f),'utf8'))]);for(const [f,src] of outputs)writeFileSync(f,src);return outputs.length;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--install'))console.log('V39: '+installV39()+' arquivos refinados.');
