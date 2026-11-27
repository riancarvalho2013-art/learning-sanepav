import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import {readObjectV39,writeGuardV39,overviewScopeV39,socialTotalsV39,patchLxpV39,patchPlatformV39,patchEvolutionV39,patchWebV39,patchLxpRegressionV39} from './refinamento-v39.mjs';
const req=body=>new Request('https://test.invalid/api',{method:'POST',body});
test('JSON: accepts object; rejects null, primitive, list, malformed and empty with 400',async()=>{
 assert.deepEqual(await readObjectV39(req('{"ok":true}')),{ok:true});
 for(const body of ['null','[]','true','123','"string"','{',''])await assert.rejects(()=>readObjectV39(req(body)),e=>e.status===400);
});
test('commit guard snapshots the original state and organization',()=>{
 assert.deepEqual(writeGuardV39({etag:'original'},{organization:{revision:'org-1'}}),{requireStateEtag:'original',requireOrganizationRevision:'org-1'});
});
test('SQLite transactional simulation: stale session, stale organization and stale aggregate cannot commit',()=>{
 const db=new DatabaseSync(':memory:');try{db.exec("CREATE TABLE objects (key TEXT PRIMARY KEY, etag TEXT NOT NULL, body TEXT); INSERT INTO objects VALUES ('legacy','e1','original'),('lxp','l1','unchanged'); CREATE TABLE organization(revision TEXT); INSERT INTO organization VALUES ('o1')");
 const guard=writeGuardV39({etag:'e1'},{organization:{revision:'o1'}});function write(guard,aggregate){db.exec('BEGIN IMMEDIATE');try{if(db.prepare("SELECT etag FROM objects WHERE key='legacy'").get().etag!==guard.requireStateEtag||db.prepare('SELECT revision FROM organization').get().revision!==guard.requireOrganizationRevision){db.exec('ROLLBACK');return false;}const out=db.prepare("UPDATE objects SET body='saved',etag='l2' WHERE key='lxp' AND etag=?").run(aggregate);db.exec('COMMIT');return Boolean(out.changes)}catch(e){db.exec('ROLLBACK');throw e}}
 db.exec("UPDATE objects SET etag='e2' WHERE key='legacy'");assert.equal(write(guard,'l1'),false);db.exec("UPDATE objects SET etag='e1' WHERE key='legacy';UPDATE organization SET revision='o2'");assert.equal(write(guard,'l1'),false);db.exec("UPDATE organization SET revision='o1'");assert.equal(write(guard,'wrong'),false);assert.equal(db.prepare("SELECT body FROM objects WHERE key='lxp'").get().body,'unchanged');assert.equal(write(guard,'l1'),true);
 }finally{db.close()}
});
test('overview: only companies in the granted scope, including an empty scope',()=>{
 assert.deepEqual([...overviewScopeV39('',[])],[]);assert.deepEqual([...overviewScopeV39('', ['A','B'])],['A','B']);assert.deepEqual([...overviewScopeV39('B',['A','B'])],['B']);
 // Explicit company authorization is still enforced by ensureCompany at the route.
});
test('intranet: counts all loaded comments/reactions, including zero and legacy count',()=>{
 assert.deepEqual(socialTotalsV39([]),[0,0,0]);assert.deepEqual(socialTotalsV39([{comments:[],commentCount:9,reactions:{Curtir:2}},{commentCount:3,reactions:{Amei:['a','b']}}]),[2,3,4]);
});
const lxpFixture=`async function change(bucket,transform){
 const stored=await bucket.put(STORE,JSON.stringify(state),{onlyIf:etag?{etagMatches:etag}:{etagDoesNotMatch:'*'}})
}
async function endpoint(req,ctx){
 const state=await source(BUCKET),user=getUser(req,state)
 const request=async()=>{try{return await req.json()}catch{err(false,'Dados JSON inválidos.')}}
 ${Array.from({length:13},()=>`await change(BUCKET,s=>{});`).join('\n')}
 err(m&&m.participants.includes(user.id),'Conversa não encontrada.',404);
 const applicable=db.cycles.filter(x=>!companyId||x.companyId===companyId)
 const responses=db.pulseResponses.filter(x=>db.pulses.some(p=>p.id===x.surveyId&&(!companyId||p.companyId===companyId)))
 return {pulseSurveys:db.pulses.filter(p=>!companyId||p.companyId===companyId).length}
}`;
test('LXP installer: every legacy mutation guarded, explicit scopes and immutable meeting participants',()=>{
 const out=patchLxpV39(lxpFixture);assert.equal((out.match(/scopedChange\(s=>/g)||[]).length,13);assert.match(out,/writeGuardV39\(authorizedRaw,state\)/);assert.match(out,/\.\.\.authorization/);assert.match(out,/m\.participants\.includes\(other\.id\)/);assert.match(out,/scope\.has\(p\.companyId\)/);assert.throws(()=>patchLxpV39(lxpFixture.replace('await change(BUCKET,s=>{});','')),/quantidade/);
});
test('platform and evolution installers validate body shape at all existing JSON points',()=>{
 const src='async function a(req){'+Array.from({length:4},()=> 'await req.json();').join('')+'}';for(const fn of [patchPlatformV39,patchEvolutionV39]){assert.equal((fn(src).match(/await readObjectV39\(req\)/g)||[]).length,4);assert.throws(()=>fn(src+'\nawait req.json()'),/quantidade/);}
});
const webFixture=`function logout(){page='Painel';person='';d=null;notifications=[];}
async function refreshNotifications(){
  notificationPending=true
  try{
    const response=await fetch();
    const items=await response.json()
    if(JSON.stringify(items)!==JSON.stringify(notifications)){notifications=items;renderNotifications()}
  }finally{notificationPending=false}
}
function socialPage(){return ''}
function load(){if(target)target.innerHTML=feedContent()}
function update(){feedItems=feedItems.map(item=>item.id===id?updated:item)}
function direct(){feedItems=[...new Map([...result.items,...feedItems].map(item=>[item.id,item])).values()]}
async function save(){const outcome=await submit(Object.fromEntries(new FormData(f)),f);modal.close();await refresh();toast(outcome?.message||'Dados salvos.')}`;
test('actual injected browser helper updates 3 counters without replacing feed or focus',()=>{
 const out=patchWebV39(webFixture);const nodes=[{textContent:'0'},{textContent:'0'},{textContent:'0'}];const sandbox={document:{querySelectorAll:()=>nodes},isIntranet:()=>true,feedItems:[{comments:[{},{}],reactions:{Curtir:3}}]};vm.createContext(sandbox);vm.runInContext(out+'\nsyncIntranetMetricsV39()',sandbox);assert.deepEqual(nodes.map(n=>n.textContent),['1','2','3']);assert.equal((out.match(/syncIntranetMetricsV39\(\)/g)||[]).length,4);
});
test('save succeeded but refresh failed: clear success warning instead of failed save or retry',async()=>{
 const out=patchWebV39(webFixture);let messages=[],closed=0,saves=0;const sandbox={FormData:class{*[Symbol.iterator](){yield ['name','a']}},f:{},submit:async()=>{saves++;return {}},modal:{close(){closed++}},refresh:async()=>{throw Error('offline')},toast:t=>messages.push(t)};vm.createContext(sandbox);await vm.runInContext(out+'\nsave()',sandbox);assert.equal(saves,1);assert.equal(closed,1);assert.match(messages[0],/^Dados salvos/);
});
test('real LXP regression installer includes simulated revocation, successful update, company isolation and invalid JSON',()=>{
 const out=patchLxpRegressionV39('const BUCKET={async get(k){},async put(k,v,options){const existing=store.get(k);}}');assert.match(out,/requireStateEtag/);assert.match(out,/simulateStaleV39=true/);assert.match(out,/deny\(r,409\)/);assert.match(out,/r.management.pulseSurveys,2/);assert.match(out,/deny\(r,403\)/);assert.match(out,/deny\(r,400\)/);
});

test('notification response from prior session is discarded after logout',async()=>{
 const out=patchWebV39(webFixture);let resolveResponse,rendered=0;const sandbox={page:'',person:'',d:{me:{id:'old'}},notifications:[],refreshSequence:1,notificationPending:false,fetch:()=>new Promise(r=>{resolveResponse=r}),renderNotifications(){rendered++}};vm.createContext(sandbox);const pending=vm.runInContext(out+'\nrefreshNotifications()',sandbox);vm.runInContext('logout();d={me:{id:"new"}}',sandbox);resolveResponse({json:async()=>[{private:'old user'}]});await pending;assert.equal(sandbox.notifications.length,0);assert.equal(rendered,0);assert.equal(sandbox.refreshSequence,2);assert.equal(sandbox.notificationPending,false);
});
