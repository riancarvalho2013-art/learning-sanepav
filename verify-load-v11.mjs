/** Synthetic local performance baseline; NOT Railway capacity or an SLA. */
import assert from 'node:assert/strict'
import http from 'node:http'
import {once} from 'node:events'
import {DatabaseSync} from 'node:sqlite'
import {randomUUID,createHash} from 'node:crypto'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {performance,monitorEventLoopDelay} from 'node:perf_hooks'
import {handleReportsV3} from './reports-v3.mjs'
import {handleCompletionV11} from './completion-v11.mjs'
const dir=await mkdtemp(join(tmpdir(),'learning-load-')),db=new DatabaseSync(join(dir,'load.sqlite'))
const company=randomUUID(),department=randomUUID(),users=Array.from({length:1000},(_,i)=>({id:randomUUID(),name:'QA '+i,role:i===0?'Administrador':'Colaborador',active:true})),tokens=users.map(()=>randomUUID()),courses=Array.from({length:500},(_,i)=>({id:randomUUID(),title:'Curso QA '+i,type:'Leitura',status:'published',minutes:10,revision:1})),enroll=users.flatMap((u,i)=>Array.from({length:10},(_,j)=>({id:randomUUID(),person:u.id,course:courses[(i+j)%500].id,progress:j%3===0?100:j%3===1?50:0})))
const state={users,sessions:users.map((u,i)=>({person:u.id,digest:createHash('sha256').update(tokens[i]).digest('hex'),identity:'load-qa',until:Date.now()+3600000})),courses,enroll,records:[],missions:[],missionEnrollments:[]},org={companies:[{id:company,name:'Empresa sintética',active:1}],assignments:new Map(users.map(u=>[u.id,{company_id:company,department_id:department}])),grants:[]}
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE objects(key TEXT PRIMARY KEY,etag TEXT NOT NULL,body BLOB NOT NULL);');db.prepare('INSERT INTO objects VALUES(?,?,?)').run('system/state-v1',randomUUID(),Buffer.from(JSON.stringify(state)))
const get=db.prepare('SELECT etag,body FROM objects WHERE key=?'),ctx={BUCKET:{async get(key){const row=get.get(key);if(!row)return null;return {...row,json:async()=>Object.assign(JSON.parse(Buffer.from(row.body).toString()),{organization:org})}}},DOMAIN:{allowedCompanies:()=>[company],canSeePerson:(_,actor,p)=>actor.role==='Administrador'||actor.id===p}}
const server=http.createServer(async(req,res)=>{try{const r=new Request('http://'+req.headers.host+req.url,{headers:{...req.headers,'oai-authenticated-user-id':'load-qa'}});const result=await handleCompletionV11(r,ctx)||await handleReportsV3(r,ctx);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text())}catch(e){res.writeHead(500);res.end('error')}}).listen(0,'127.0.0.1');await once(server,'listening')
const base='http://127.0.0.1:'+server.address().port,lag=monitorEventLoopDelay({resolution:20});lag.enable();let peak=process.memoryUsage().rss
async function run(name,path,concurrency,count,tokenFor){const ms=[],cpu=process.cpuUsage(),start=performance.now();let next=0,fail=0
 await Promise.all(Array.from({length:concurrency},async()=>{while(next<count){const i=next++,t=performance.now();try{const r=await fetch(base+path,{headers:{cookie:'learning='+tokenFor(i)}});await r.arrayBuffer();if(r.status!==200)fail++}catch{fail++}ms.push(performance.now()-t);peak=Math.max(peak,process.memoryUsage().rss)}}))
 const wall=performance.now()-start,usage=process.cpuUsage(cpu),sorted=ms.sort((a,b)=>a-b),p=q=>Math.round(sorted[Math.max(0,Math.ceil(sorted.length*q)-1)]*100)/100
 return {scenario:name,concurrency,requests:count,errors:fail,p50_ms:p(.5),p95_ms:p(.95),p99_ms:p(.99),wall_ms:Math.round(wall),rps:Math.round(count/(wall/1000)*10)/10,cpu_ms:Math.round((usage.user+usage.system)/1000),peak_rss_mib:Math.round(peak/1048576*10)/10}}
try{
 await fetch(base+'/api/completion/v11/mine',{headers:{cookie:'learning='+tokens[1]}})
 const rows=[await run('Conclusões pessoais','/api/completion/v11/mine',20,100,i=>tokens[1+i%999]),await run('Resumo gerencial','/api/reports/v3/summary?company='+company,20,60,()=>tokens[0]),await run('Detalhamento paginado','/api/reports/v3/enrollments?company='+company+'&limit=25',20,60,()=>tokens[0])]
 console.log(JSON.stringify({node:process.version,dataset:{users:1000,courses:500,enrollments:10000,events:0},adapter:'SQLite local com estado sintético, domínio simulado; servidor HTTP do benchmark, sem núcleo completo; somente leitura',eventLoopP95_ms:Math.round(lag.percentile(95)/1e6),results:rows},null,2));assert.equal(rows.reduce((n,r)=>n+r.errors,0),0)
}finally{lag.disable();server.closeAllConnections();await new Promise(r=>server.close(r));db.close();await rm(dir,{recursive:true,force:true})}
