import assert from 'node:assert/strict'
import {VIDEO_LIMIT,PART_SIZE,socialVideoUpload,consumeVideoSession,videoResponse} from './social-video-v24.mjs'
const objects=new Map();let state={};const actor={id:'alice'},bob={id:'bob'}
const bucket={async put(k,v){if(objects.has(k))return null;objects.set(k,Buffer.from(v));return {etag:'1'}},async get(k){return objects.has(k)?{body:objects.get(k)}:null},async deleteSocialVideoParts(id){for(const k of objects.keys())if(k.startsWith('social-video/'+id+'/'))objects.delete(k)}}
async function call(params,body,user=actor){const req=new Request('http://local/api/socialUpload?'+new URLSearchParams(params),{method:'POST',body});try{const response=await socialVideoUpload(req,{bucket,userId:user.id,readState:async()=>structuredClone(state),mutate:async fn=>{const next=structuredClone(state),result=await fn(next,user);state=next;return result}});return {status:response.status,...await response.json()}}catch(e){return {status:e.status||500,error:e.message}}}
let x=await call({action:'start',extension:'mp4',size:VIDEO_LIMIT+1});assert.equal(x.status,413)
x=await call({action:'start',extension:'exe',size:123});assert.equal(x.status,415)
x=await call({action:'start',extension:'mp4',size:VIDEO_LIMIT});assert.equal(x.status,200);assert.equal(state.socialVideoSessions[x.id].total,256);assert.equal((await call({action:'abort',id:x.id})).status,200)
const size=PART_SIZE+100,first=Buffer.alloc(PART_SIZE,0x42),second=Buffer.alloc(100,0x55);first.write('ftyp',4,'ascii')
const {id}=await call({action:'start',extension:'mp4',size});assert.ok(id)
assert.equal((await call({action:'start',extension:'mp4',size})).status,429)
assert.equal((await call({action:'part',id,index:0},first,bob)).status,404)
assert.equal((await call({action:'part',id,index:1},second)).status,409)
assert.equal((await call({action:'finish',id})).status,409)
assert.equal((await call({action:'part',id,index:0},Buffer.alloc(PART_SIZE))).status,415)
assert.equal((await call({action:'part',id,index:0},first.subarray(0,3))).status,400)
assert.equal((await call({action:'part',id,index:0},first)).next,1)
assert.equal((await call({action:'part',id,index:0},first)).next,1)
const conflict=Buffer.from(first);conflict[20]=1;assert.equal((await call({action:'part',id,index:0},conflict)).status,409)
assert.equal((await call({action:'part',id,index:1},second)).next,2)
assert.equal((await call({action:'finish',id})).status,200)
assert.equal((await call({action:'finish',id})).status,200)
assert.equal(state.socialUploads.length,1)
const item=consumeVideoSession(state,state.socialUploads.shift());assert.equal(item.size,size);assert.equal(item.storage,'parts-v24');assert.equal(state.socialVideoSessions[id],undefined)
const read=(range,method='GET')=>videoResponse(new Request('http://local/video',{method,headers:range?{range}:{}}),bucket,item,{'content-type':'video/mp4'})
let response=read(`bytes=${PART_SIZE-2}-${PART_SIZE+2}`);assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),`bytes ${PART_SIZE-2}-${PART_SIZE+2}/${size}`);assert.deepEqual(Buffer.from(await response.arrayBuffer()),Buffer.from([0x42,0x42,0x55,0x55,0x55]))
response=read('bytes=-3');assert.deepEqual(Buffer.from(await response.arrayBuffer()),Buffer.alloc(3,0x55));assert.equal(read('bytes=999999999-').status,416);assert.equal(read('bytes=0-1,4-5').status,416);assert.equal(read(null,'HEAD').headers.get('content-length'),String(size));response=read(null);assert.equal((await response.arrayBuffer()).byteLength,size)
assert.equal((await call({action:'abort',id})).status,404);assert.equal(objects.size,2)
assert.deepEqual(consumeVideoSession(state,{id:'legacy',type:'video/mp4'}),{id:'legacy',type:'video/mp4'})
const stale=await call({action:'start',extension:'mp4',size});await call({action:'part',id:stale.id,index:0},first);state.socialVideoSessions[stale.id].until=0;const fresh=await call({action:'start',extension:'mp4',size});assert.equal(fresh.status,200);assert.ok(![...objects.keys()].some(k=>k.includes(stale.id)));await call({action:'abort',id:fresh.id})
console.log('OK: 1 GiB limite declarado, formato, ordem, autorização, partes repetidas, finalização, cancelamento, expiração, range entre partes, HEAD e compatibilidade legado.')
// Cross the previous 64 MiB ceiling without allocating a 1 GiB blob.
const bigSize=65*1024**2,big=await call({action:'start',extension:'mp4',size:bigSize});assert.equal(big.status,200)
for(let i=0;i<Math.ceil(bigSize/PART_SIZE);i++){const bytes=Buffer.alloc(Math.min(PART_SIZE,bigSize-i*PART_SIZE),i);if(i===0)bytes.write('ftyp',4,'ascii');assert.equal((await call({action:'part',id:big.id,index:i},bytes)).status,200)}
assert.equal((await call({action:'finish',id:big.id})).status,200);const large=consumeVideoSession(state,state.socialUploads.shift());let readBytes=0;for await(const chunk of videoResponse(new Request('http://local/video'),bucket,large,{}).body)readBytes+=chunk.byteLength;assert.equal(readBytes,bigSize);console.log('OK: upload e leitura de 65 MiB em partes, acima do limite anterior (armazenamento simulado).')
