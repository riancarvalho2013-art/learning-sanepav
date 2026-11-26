// Run from repository root after installation and npm run build (requires Node >=24).
import assert from 'node:assert/strict'
process.env.LEARNING_DB=':memory:'
const {BUCKET}=await import('./storage.mjs'),{default:worker}=await import('./platform.mjs')
const origin='http://127.0.0.1:4187',password=crypto.randomUUID()
async function raw(path,cookie='',body,method=body===undefined?'GET':'POST',headers={}){const req=new Request(origin+path,{method,headers:{origin,cookie,'oai-authenticated-user-id':'test',...headers},body});return worker.fetch(req,{BUCKET})}
async function call(path,cookie,body){const res=await raw('/api/'+path,cookie,body===undefined?undefined:JSON.stringify(body),'POST',{'content-type':'application/json'});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]}}
async function good(path,cookie,body){const r=await call(path,cookie,body);assert.equal(r.status,200,JSON.stringify(r.data));return r}
const admin=(await good('login','',{email:'admin@example.test',name:'Admin',password})).cookie
for(const [name,role] of [['director','Diretoria'],['leader','Líder'],['rh','RH/DHO'],['employee','Colaborador'],['recipient','Colaborador']])await good('user',admin,{name,email:name+'@example.test',role,password,active:true})
const people=await (await raw('/api/data',admin)).json(),recipient=people.people.find(p=>p.name==='recipient');assert.ok(recipient)
const cookies={admin};for(const name of ['director','leader','rh','employee'])cookies[name]=(await good('login','',{email:name+'@example.test',password})).cookie
for(const [name,cookie] of Object.entries(cookies)){await good('record',cookie,{kind:'Elogio',person:recipient.id,title:'Teste '+name,note:'Reconhecimento',status:'Concluído'});const data=await (await raw('/api/data',cookie)).json();assert.ok(data.praise.some(p=>p.title==='Teste '+name));assert.equal((await call('record',cookie,{kind:'Elogio',person:data.me.id,title:'Autoelogio'})).status,400)}
for(const cookie of [admin,cookies.director])assert.equal((await call('record',cookie,{kind:'PDI',person:recipient.id,title:'Privado',date:'2099-01-01'})).status,403)
const size=4*1024**2+100,upload=async(q,body)=>{const res=await raw('/api/socialUpload?'+new URLSearchParams(q),admin,body,'POST');return {status:res.status,...await res.json()}}
const start=await upload({action:'start',extension:'mp4',size});assert.equal(start.status,200);const a=Buffer.alloc(4*1024**2),b=Buffer.alloc(100,9);a.write('ftyp',4,'ascii');assert.equal((await upload({action:'part',id:start.id,index:0},a)).status,200);assert.equal((await upload({action:'part',id:start.id,index:1},b)).status,200);assert.equal((await upload({action:'finish',id:start.id})).status,200);await good('socialPost',admin,{text:'Vídeo de teste',upload:start.id});const feed=await (await raw('/api/socialFeed',admin)).json();const post=feed.items.find(p=>p.text==='Vídeo de teste');assert.ok(post)
const response=await raw('/social/post/'+post.id,admin,undefined,'GET',{range:'bytes=4194302-4194305'});assert.equal(response.status,206);assert.deepEqual(Buffer.from(await response.arrayBuffer()),Buffer.from([0,0,9,9]));assert.equal((await raw('/social/post/'+post.id,'')).status,401)
console.log('OK: cinco perfis, autoelogio recusado, proteção de PDI, upload via API, publicação e leitura por intervalo.')
