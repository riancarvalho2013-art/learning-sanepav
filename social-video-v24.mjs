// Private, resumable-by-part social video upload. SQLite stores bounded blobs.
import {randomUUID} from 'node:crypto'
export const VIDEO_LIMIT=1024**3, PART_SIZE=4*1024**2
const TTL=2*3600000, READY_TTL=3600000, DAY=86400000
const validId=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/
const mimeTypes={mp4:'video/mp4',webm:'video/webm'}
const key=(id,index)=>`social-video/${id}/${index}`
const fail=(ok,message,status=400)=>{if(!ok)throw Object.assign(new Error(message),{status})}
const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store'}})
const sessions=s=>s.socialVideoSessions??={}
const find=(s,id,owner)=>{const item=sessions(s)[id];fail(item&&item.owner===owner&&item.until>Date.now(),'Envio expirado ou indisponível.',404);return item}
const partLength=(session,i)=>Math.min(PART_SIZE,session.size-i*PART_SIZE)
const locks=new Map()
async function locked(id,fn){
 fail(!locks.has(id),'Já existe uma operação para este envio. Tente novamente.',409)
 locks.set(id,true);try{return await fn()}finally{locks.delete(id)}
}
async function readPart(req,expected){
 const length=req.headers.get('content-length');fail(length===null||Number(length)===expected,'Tamanho da parte inválido.',413)
 const buffer=Buffer.allocUnsafe(expected);let n=0
 if(req.body)for await(const chunk of req.body){fail(n+chunk.byteLength<=expected,'Parte acima do limite.',413);buffer.set(chunk,n);n+=chunk.byteLength}
 fail(n===expected,'Parte incompleta. Envie novamente.',400);return buffer
}
function validSignature(bytes,ext){return ext==='mp4'?bytes.length>=12&&bytes.toString('ascii',4,8)==='ftyp':bytes.length>=4&&bytes.subarray(0,4).toString('hex')==='1a45dfa3'}
// State transitions are authorized again by the caller's optimistic transaction.
export async function socialVideoUpload(req,{bucket,mutate,readState,userId}){
 const url=new URL(req.url),action=url.searchParams.get('action'),id=url.searchParams.get('id')||''
 if(action==='start'){
  const ext=url.searchParams.get('extension'),size=Number(url.searchParams.get('size'))
  fail(Object.hasOwn(mimeTypes,ext),'Use vídeo MP4 ou WebM.',415)
  fail(Number.isSafeInteger(size)&&size>0&&size<=VIDEO_LIMIT,'Vídeo deve ter até 1 GB.',413)
  const now=Date.now(),newId=randomUUID()
  // Sweep expired, unpublished sessions before opening a new upload. Keep published media intact.
  const expired=await mutate((s,u)=>{const stale=Object.values(sessions(s)).filter(x=>x.until<=now&&!locks.has(x.id));for(const x of stale){delete sessions(s)[x.id];s.socialUploads=(s.socialUploads||[]).filter(p=>p.id!==x.id)}return stale.map(x=>x.id)})
  for(const old of expired)await bucket.deleteSocialVideoParts(old)
  await mutate((s,u)=>{
   const active=Object.values(sessions(s)).filter(x=>x.until>now)
   fail(active.filter(x=>x.owner===u.id&&x.phase==='upload').length<1,'Finalize ou cancele o vídeo em andamento.',429)
   fail(active.filter(x=>x.phase==='upload').length<8,'Muitos vídeos sendo enviados. Tente novamente.',429)
   fail((s.socialUploads||[]).filter(x=>x.owner===u.id&&x.until>now).length+active.filter(x=>x.owner===u.id&&x.phase==='upload').length<5,'Limite de envios em aberto.',429)
   const rates=s.socialUploadRates??={},sent=(rates[u.id]||[]).filter(t=>t>now-DAY)
   fail(sent.length<12,'Limite diário de envios atingido.',429);rates[u.id]=[...sent,now]
   sessions(s)[newId]={id:newId,owner:u.id,extension:ext,type:mimeTypes[ext],size,next:0,total:Math.ceil(size/PART_SIZE),phase:'upload',until:now+TTL}
  })
  return json({id:newId,chunkSize:PART_SIZE})
 }
 fail(validId.test(id),'Envio indisponível.',404)
 return locked(id,async()=>{
  const current=await readState(),session=find(current,id,userId)
  if(action==='abort'){
   await mutate((s,u)=>{find(s,id,u.id);delete sessions(s)[id];s.socialUploads=(s.socialUploads||[]).filter(x=>x.id!==id)})
   await bucket.deleteSocialVideoParts(id);return json({ok:true})
  }
  if(action==='part'){
   fail(session.phase==='upload','Envio já finalizado.',409)
   const index=Number(url.searchParams.get('index'))
   fail(url.searchParams.has('index')&&Number.isInteger(index)&&index>=0&&index<session.total&&index<=session.next,'Parte fora de ordem.',409)
   const bytes=await readPart(req,partLength(session,index))
   fail(index!==0||validSignature(bytes,session.extension),'Arquivo incompatível com a extensão.',415)
   const objectKey=key(id,index)
   const stored=await bucket.put(objectKey,bytes,{onlyIf:{etagDoesNotMatch:'*'}})
   if(!stored){const existing=await bucket.get(objectKey);fail(existing&&Buffer.from(existing.body).equals(bytes),'Parte conflitante. Cancele e tente novamente.',409)}
   const next=await mutate((s,u)=>{const x=find(s,id,u.id);fail(x.phase==='upload'&&index<=x.next,'Envio alterado.',409);if(index===x.next)x.next++;x.until=Date.now()+TTL;return x.next})
   return json({next})
  }
  if(action==='finish'){
   fail(session.next===session.total,'Ainda faltam partes do vídeo.',409)
   await mutate((s,u)=>{
    const x=find(s,id,u.id);fail(x.next===x.total,'Ainda faltam partes do vídeo.',409)
    if(x.phase==='ready')return
    const now=Date.now(),pending=(s.socialUploads||[]).filter(p=>p.until>now)
    fail(pending.filter(p=>p.owner===u.id).length<5,'Limite de envios em aberto.',429)
    x.phase='ready';x.until=now+READY_TTL
    pending.push({id,type:x.type,owner:u.id,until:x.until,storage:'parts-v24',size:x.size});s.socialUploads=pending
   })
   return json({id,type:session.type})
  }
  fail(false,'Operação de envio inválida.',400)
 })
}
export function consumeVideoSession(state,item){
 if(item.storage!=='parts-v24')return {id:item.id,type:item.type}
 const session=sessions(state)[item.id]
 fail(session&&session.phase==='ready'&&session.owner===item.owner&&session.size===item.size,'Envio indisponível.',409)
 delete sessions(state)[item.id]
 return {id:item.id,type:item.type,storage:item.storage,size:item.size}
}
export function videoResponse(req,bucket,item,headers){
 const size=item.size;fail(validId.test(item.id)&&Number.isSafeInteger(size)&&size>0&&size<=VIDEO_LIMIT,'Mídia indisponível.',404)
 headers={...headers,'accept-ranges':'bytes'}
 const range=req.headers.get('range');let start=0,end=size-1,status=200
 if(range){
  const m=/^bytes=(\d*)-(\d*)$/.exec(range)
  if(m&&(m[1]||m[2])){start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2]));end=m[1]&&m[2]?Math.min(size-1,Number(m[2])):size-1}else start=NaN
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=size)return new Response(null,{status:416,headers:{...headers,'content-range':`bytes */${size}`}})
  status=206;headers['content-range']=`bytes ${start}-${end}/${size}`
 }
 headers['content-length']=String(end-start+1)
 if(req.method==='HEAD')return new Response(null,{status,headers})
 let offset=start
 const stream=new ReadableStream({async pull(controller){
  if(offset>end){controller.close();return}
  const i=Math.floor(offset/PART_SIZE),object=await bucket.get(key(item.id,i)),expected=Math.min(PART_SIZE,size-i*PART_SIZE)
  if(!object||object.body.byteLength!==expected){controller.error(new Error('Parte de vídeo indisponível.'));return}
  const from=offset-i*PART_SIZE,to=Math.min(expected,end-i*PART_SIZE+1),bytes=object.body.subarray(from,to)
  controller.enqueue(bytes);offset+=bytes.byteLength;if(offset>end)controller.close()
 }})
 return new Response(stream,{status,headers})
}
