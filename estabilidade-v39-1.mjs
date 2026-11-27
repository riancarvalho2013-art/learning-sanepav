/** V39.1: bounded auth, atomic certificates and fail-closed organization scope. */
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v);
const fail=(msg,status=409)=>{throw Object.assign(new Error(msg),{status})};
function swap(s,a,b){const n=s.split(a).length-1;if(n!==1)throw Error('V39.1: âncora inesperada ('+n+'): '+a.slice(0,120));return s.replace(a,()=>b)}
export const verificationRecord=c=>({courseTitle:c.courseTitle,issuedAt:c.issuedAt,brandTitle:c.brandTitle});
export function commitCertificatePair(db,cert,guard,revision){
 if(!uuid(cert.enrollmentId)||!uuid(cert.code)||typeof guard?.requireStateEtag!=='string')fail('Certificado inválido.',400);
 const issued='evolution/v1/issued/'+cert.enrollmentId,verification='evolution/v1/verification/'+cert.code;
 const get=db.prepare('SELECT etag,body FROM objects WHERE key=?'),insert=db.prepare('INSERT INTO objects(key,etag,body) VALUES(?,?,?)');
 db.exec('BEGIN IMMEDIATE');try{
  if(get.get('system/state-v1')?.etag!==guard.requireStateEtag||guard.requireOrganizationRevision!==undefined&&revision()!==guard.requireOrganizationRevision)fail('A matrícula ou autorização mudou. Atualize e tente novamente.');
  const old=get.get(issued),index=get.get(verification),publicData=verificationRecord(cert);
  if(old&&!isDeepStrictEqual(JSON.parse(Buffer.from(old.body).toString()),cert))fail('Certificado atualizado por outra operação. Tente novamente.');
  if(index&&!isDeepStrictEqual(JSON.parse(Buffer.from(index.body).toString()),publicData))fail('Verificação de certificado inconsistente. Contate a administração.');
  if(index&&!old)fail('Código de certificado já utilizado. Tente novamente.');
  if(!old)insert.run(issued,randomUUID(),Buffer.from(JSON.stringify(cert)));
  if(!index)insert.run(verification,randomUUID(),Buffer.from(JSON.stringify(publicData)));
  db.exec('COMMIT');return cert;
 }catch(e){db.exec('ROLLBACK');throw e}
}
// Global per-route window supplements existing per-account and concurrent-operation gates.
// Do not key on arbitrary forwarded IP headers or leak account existence.
export function createAuthRateV391({clock=Date.now,windowMs=60000,limits={'/api/login':240,'/api/request-password-reset':30,'/api/reset-password':60,'/ativar':20}}={}){
 const windows=new Map();return (path,method)=>{
  if(method!=='POST'||!Object.hasOwn(limits,path))return true;
  const now=clock(),old=windows.get(path)||[];const live=old.filter(t=>t>now-windowMs);
  if(live.length>=limits[path]){windows.set(path,live);return false}live.push(now);windows.set(path,live);return true;
 };
}
export function pruneLoginFailuresV391(fails,now,key,max=4096){
 for(const [k,v] of Object.entries(fails))if(!v||!Number.isFinite(v.since)||v.since<now-900000)delete fails[k];
 if(!Object.hasOwn(fails,key)&&Object.keys(fails).length>=max)fail('Muitas tentativas. Aguarde 15 minutos.',429);
}
// Warn on aggregate growth without rejecting writes or logging personal data.
export function aggregateMonitorV391(log=console.info){
 const last=new Map(),keys=new Set(['system/state-v1','lxp/v2/state']);
 return (key,bytes)=>{if(!keys.has(key)||!Number.isSafeInteger(bytes)||bytes<0)return;const level=bytes>=32*1024*1024?'critical':bytes>=8*1024*1024?'warning':'normal';if(last.get(key)===level)return;last.set(key,level);if(level!=='normal')try{log(JSON.stringify({event:'aggregate_size_v391',aggregate:key,bytes,level}))}catch{} };
}
// Missing company IDs are never treated as a shared tenant. Explicit self/admin/grants stay in callers.
export function sameActiveTenantV391(own,target,companies){return Boolean(own&&target&&own===target&&companies.some(c=>c.id===own&&c.active!==false&&c.active!==0));}
export function patchPlatform(s){
 s="import {pruneLoginFailuresV391,sameActiveTenantV391} from './estabilidade-v39-1.mjs'\n"+s;
 s=swap(s,'if(own===target)return !own||organization.companies.some(company=>company.id===own)','if(own===target)return sameActiveTenantV391(own,target,organization.companies)');
 s=swap(s,"if(u.role==='Líder')for(let i=0;i<s.users.length;i++){","if(u.role==='Líder'&&own?.company_id&&activeCompanies.has(own.company_id))for(let i=0;i<s.users.length;i++){");
 s=swap(s,'const f=s.fails[key];requireOk(', 'pruneLoginFailuresV391(s.fails,Date.now(),key);const f=s.fails[key];requireOk(');return s;
}
export function patchDomain(s){
 s=swap(s,"if ((target?.company_id || null) !== (own?.company_id || null)) return false","if (!own?.company_id || !target?.company_id || target.company_id !== own.company_id || !organization.companies.some(c=>c.id===own.company_id)) return false");
 return swap(s,"while (person?.manager && !visited.has(person.id)) {","while (person?.manager && !visited.has(person.id) && organization.assignments.get(person.id)?.company_id===own.company_id) {");
}
export function patchLxp(s){
 s=swap(s,"const seen=new Set();let next=own(state,personId)\n  while(next&&!seen.has(next.id)){if(next.manager===user.id)return company(state,next.id)===company(state,user.id);", "const tenant=company(state,user.id);if(!tenant||personCompany!==tenant||!allowed(state,domain,user).includes(tenant))return false;\n  const seen=new Set();let next=own(state,personId)\n  while(next&&!seen.has(next.id)&&company(state,next.id)===tenant){if(next.manager===user.id)return true;");
 s=swap(s,'const applicable=db.cycles.filter(x=>scope.has(x.companyId))','const applicable=db.cycles.filter(x=>scope.has(x.companyId))\n  const applicableIds=new Set(applicable.map(c=>c.id))');
 const old='applicable.some(c=>c.id===t.cycleId)';if(s.split(old).length!==3)throw Error('V39.1: contagem de ciclos inesperada');return s.replaceAll(old,'applicableIds.has(t.cycleId)');
}
export function patchStorage(s){
 s="import {commitCertificatePair,aggregateMonitorV391} from './estabilidade-v39-1.mjs'\nimport {auditSnapshotV391} from './auditoria-operacional-v39-1.mjs'\n"+s;
 s=swap(s,'createMediaAdapter,verifyRemote}', 'createMediaAdapter,verifyRemote,unseal}');
 s=swap(s,'const legacy = {','const monitorAggregateV391=aggregateMonitorV391();\nfor(const row of db.prepare("SELECT key,length(body) AS bytes FROM objects WHERE key IN (?,?)").all("system/state-v1","lxp/v2/state"))monitorAggregateV391(row.key,row.bytes);\nconst legacy = {\n async commitCertificatePairV391(cert,guards){return commitCertificatePair(db,cert,guards,organizationRevision)},');
 s=swap(s,"   db.exec('COMMIT')\n   return result.changes ? {etag} : null","   db.exec('COMMIT')\n   if(result.changes)monitorAggregateV391(key,body.length);\n   return result.changes ? {etag} : null");
 return swap(s,'startBackupScheduler(databasePath,scheduledBackup)',"startBackupScheduler(databasePath,(primary,dir)=>scheduledBackup(primary,dir,{auditSnapshot:path=>auditSnapshotV391(path,{config:configuration,remote,unseal,verifyRemote:process.env.LEARNING_BACKUP_VERIFY_REMOTE==='true'})}))");
}
export function patchRecovery(s){
 return swap(s,'const result=await rehearseRestore(path);return {ok:true,createdAt:manifest.createdAt,bytes:manifest.bytes,independent:manifest.storageDeviceIndependent,...result}',"const result=await rehearseRestore(path);if(typeof options.auditSnapshot==='function')try{await options.auditSnapshot(path)}catch{console.warn(JSON.stringify({event:'backup_v391_audit',status:'failed'}))}return {ok:true,createdAt:manifest.createdAt,bytes:manifest.bytes,independent:manifest.storageDeviceIndependent,...result}");
}
export function patchEvolution(s){
 s=swap(s,"      try{await putObject(BUCKET,'issued/'+enroll.id,cert,{create:true})}catch(err){if(err.status!==409)throw err;cert=await readObject(BUCKET,'issued/'+enroll.id)}\n    }\n    if(!await readObject(BUCKET,'verification/'+cert.code)){\n      try{await putObject(BUCKET,'verification/'+cert.code,{courseTitle:cert.courseTitle,issuedAt:cert.issuedAt,brandTitle:cert.brandTitle},{create:true})}catch(err){if(err.status!==409)throw err}\n    }", "    }\n    invalid(cert.company===company&&cert.personId===person.id&&cert.courseId===course.id,'Certificado histórico vinculado a outra matrícula ou empresa. Contate a administração.',409)\n    invalid(typeof BUCKET.commitCertificatePairV391==='function','Armazenamento transacional indisponível.',503)\n    cert=await BUCKET.commitCertificatePairV391(cert,{requireStateEtag:original.etag,requireOrganizationRevision:state.organization?.revision})");
 return s;
}
export function patchServe(s){
 s="import {createAuthRateV391} from './estabilidade-v39-1.mjs'\n"+s;
 s=swap(s,'const authGate=createAuthGate()','const authGate=createAuthGate()\nconst authRateV391=createAuthRateV391()');
 return swap(s,'gate=authGate.enter(url.pathname,req.method)','gate=authRateV391(url.pathname,req.method)?authGate.enter(url.pathname,req.method):null');
}
export function patchScormWeb(s){
 s=swap(s,'changing:false}','changing:false,expiredV391:false}');
 s=swap(s,"if(!response.ok)throw Error(data.error||'Não foi possível carregar o curso.')","if(!response.ok)throw Object.assign(Error(data.error||'Não foi possível carregar o curso.'),{status:response.status})");
 s=swap(s,'state.launch=data;showSco(data.multiSco)','state.launch=data;state.expiredV391=false;showSco(data.multiSco)');
 s=swap(s,"try{await asApi('keepalive?token='+encodeURIComponent(state.launch.url.split('/')[3]))}catch(error){updateState('Sessão expirada. Recarregue a aula para continuar.',true)}", "const launch=state.launch,version=state.version;try{await asApi('keepalive?token='+encodeURIComponent(launch.url.split('/')[3]))}catch(error){if(!state.opened||version!==state.version||launch!==state.launch)return;if([403,404].includes(error.status)){state.expiredV391=true;updateState('Sessão encerrada. Recarregue a aula para retomar o último progresso confirmado.',true)}else updateState('Não foi possível verificar a conexão. Tente novamente.',true)}");
 s=swap(s,'  if(!launch)return state.queue','  if(!launch){if(!state.pending)state.pending=values;return state.queue}');
 s=swap(s,"if(!state.pending)state.pending=values;updateState('Não foi possível salvar o progresso:","if(!state.pending)state.pending=values;if(/Sessão SCORM inválida ou expirada|Acesso à sessão SCORM revogado/.test(error.message))state.expiredV391=true;updateState('Não foi possível salvar o progresso:");
 s=swap(s,'state.enrollment=enrol;state.course=course;state.launch=null;state.pending=null;', 'state.enrollment=enrol;state.course=course;state.launch=null;state.expiredV391=false;state.pending=null;');
 s=swap(s,'async function changeSco(index){','async function changeSco(index,recovery=false){');
 s=swap(s,"if(state.pending){updateState('Salve o progresso antes de trocar de etapa.',true);return}","if(state.pending){if(!recovery||!state.expiredV391||!window.confirm('A sessão anterior terminou. O progresso não confirmado pode ser perdido. Retomar o último progresso salvo no servidor?')){updateState('Salve o progresso antes de trocar de etapa.',true);return}state.pending=null;index=null;}if(recovery&&state.expiredV391)index=null;");
 return swap(s,"if(scormAction==='reload')void changeSco(state.multiSco?.index??null)","if(scormAction==='reload')void changeSco(state.multiSco?.index??null,true)");
}
function patchSocialTest(s){
 s=swap(s,"const {BUCKET}=await import('./storage.mjs')","const {BUCKET,DOMAIN}=await import('./storage.mjs')");
 s=swap(s,'worker.fetch(req,{BUCKET})','worker.fetch(req,{BUCKET,DOMAIN})');
 s=swap(s,'const cookies={admin};',`const companyV391=(await good('v2/company',admin,{name:'Empresa QA V391'})).data.id;
for(const p of people.people)await good('v2/assignment',admin,{person_id:p.id,company_id:companyV391,revision:0});
const cookies={admin};`);
 return s+`\n// V39.1: no shared null tenant; administrator moderation remains explicit.\nawait good('user',admin,{name:'Sem vínculo A',email:'unlinked-a@example.test',role:'Colaborador',password,active:true});\nawait good('user',admin,{name:'Sem vínculo B',email:'unlinked-b@example.test',role:'Colaborador',password,active:true});\nconst noA=(await good('login','',{email:'unlinked-a@example.test',password})).cookie,noB=(await good('login','',{email:'unlinked-b@example.test',password})).cookie;\nconst noData=await (await raw('/api/data',admin)).json(),noBId=noData.people.find(p=>p.email==='unlinked-b@example.test').id;\nassert.equal((await call('record',noA,{kind:'Elogio',person:noBId,title:'Não compartilhar',status:'Concluído'})).status,400);\nawait good('socialPost',noA,{text:'Publicação isolada V391'});\nconst ownPostV391=(await (await raw('/api/socialFeed',noA)).json()).items.find(p=>p.text==='Publicação isolada V391');assert.ok(ownPostV391);\nassert.equal((await (await raw('/api/socialFeed?post='+ownPostV391.id,noB)).json()).items.length,0);\nassert.equal((await call('socialReaction',noB,{id:ownPostV391.id,reaction:'Curtir'})).status,404);\nconsole.log('V39.1: contas sem vínculo não compartilham conteúdo.');\n`;
}
function patchPrivacyTest(s){
 s=swap(s,"const {BUCKET}=await import('./storage.mjs')","const {BUCKET,DOMAIN}=await import('./storage.mjs')");
 s=swap(s,'worker.fetch(req,{BUCKET})','worker.fetch(req,{BUCKET,DOMAIN})');
 s=swap(s,"const l=(await good('login'",`const companyV391=(await good('v2/company',a,{name:'Empresa QA V391'})).data.id;
for(const p of all.people)await good('v2/assignment',a,{person_id:p.id,company_id:companyV391,revision:0});
const l=(await good('login'`);
 s=swap(s,"const recipients=Array.from({length:7},(_,i)=>'aggregate-test-'+i)","const recipients=Array.from({length:7},()=>crypto.randomUUID())");
 s=swap(s,"assert.equal((await good('data',l)).data.pulses.find(p=>p.id==='aggregate-survey').averageRating,undefined)","for(const id of recipients)await good('v2/assignment',a,{person_id:id,company_id:companyV391,revision:0});\nassert.equal((await good('data',l)).data.pulses.find(p=>p.id==='aggregate-survey').averageRating,undefined)");return s;
}
// Existing handler unit tests use in-memory fixture adapters; production always uses atomic SQLite method.
function patchCertificateFixture(s,anchor){return swap(s,anchor,`BUCKET.commitCertificatePairV391=async(cert,guard)=>{const state=await BUCKET.get('system/state-v1');assert.equal(state.etag,guard.requireStateEtag);const ik='evolution/v1/issued/'+cert.enrollmentId,vk='evolution/v1/verification/'+cert.code;if(!await BUCKET.get(ik))await BUCKET.put(ik,JSON.stringify(cert),{onlyIf:{etagDoesNotMatch:'*'}});if(!await BUCKET.get(vk))await BUCKET.put(vk,JSON.stringify({courseTitle:cert.courseTitle,issuedAt:cert.issuedAt,brandTitle:cert.brandTitle}),{onlyIf:{etagDoesNotMatch:'*'}});return cert};\n${anchor}`)}
function patchScormRestartTest(s){
 const anchor="same(completionClassification(row(es)),'scorm');same(row(es).cmi['cmi.suspend_data'].length,60000)";
 return swap(s,anchor,anchor+`\n // V39.1: simulated process restart uses a new runtime and the last persisted CMI.\n const restartedV391=createScormRuntime();\n const restartedReqV391=(path,body)=>new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{'oai-authenticated-user-id':identity,origin,'content-type':'application/json',cookie:'learning='+tokens.get(learner.id)},...(body===undefined?{}:{body:JSON.stringify(body)})});\n const staleV391=await restartedV391(restartedReqV391('/api/scorm/v3/commit',{...ticket,cmi:{'cmi.core.lesson_status':'passed'}}),ctx);same(staleV391.status,403);\n const resumedV391=await restartedV391(restartedReqV391('/api/scorm/v3/launch?enrollment='+es.id),ctx);same(resumedV391.status,200);const newTicketV391=await resumedV391.json();same(newTicketV391.url===launch.url,false);\n same(row(es).cmi['cmi.suspend_data'].length,60000);\n const resumedContentV391=await restartedV391(restartedReqV391(newTicketV391.url),ctx);same(resumedContentV391.status,200);const resumedHtmlV391=await resumedContentV391.text();assert.match(resumedHtmlV391,/resume/);assert.ok(resumedHtmlV391.includes('S'.repeat(60000)));\n`);
}
export function install(root='.'){
 const edits=[['platform.mjs',patchPlatform],['domain.mjs',patchDomain],['lxp-v2.mjs',patchLxp],['storage.mjs',patchStorage],['recovery-v13.mjs',patchRecovery],['learning-evolution.mjs',patchEvolution],['serve.mjs',patchServe],['web-scorm-v3.js',patchScormWeb],['verify-social-v24.mjs',patchSocialTest],['verify-privacy.mjs',patchPrivacyTest],['verify-evolution.mjs',s=>patchCertificateFixture(s,'const call=async(path,')],['verify-completion-v11.mjs',s=>patchScormRestartTest(patchCertificateFixture(s,'const DOMAIN={'))]];
 const out=edits.map(([f,fn])=>[resolve(root,f),fn(readFileSync(resolve(root,f),'utf8'))]);for(const [f,s] of out)writeFileSync(f,s);return out.length;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--install'))console.log('V39.1: '+install()+' arquivos revisados.');
