import {readFileSync,writeFileSync,existsSync,copyFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const source=dirname(fileURLToPath(import.meta.url)),root=resolve(process.argv[2]||'.')
const target=p=>resolve(root,p),read=p=>readFileSync(target(p),'utf8')
const changes=new Map()
function edit(file,pairs){let s=read(file);for(const [old,next] of pairs){if(s.includes(next))continue;if(s.split(old).length!==2)throw Error('Base incompatível em '+file+': '+old.slice(0,100));s=s.replace(old,next)}changes.set(file,s)}
edit('platform.mjs',[
 ["import {ASSETS} from './assets.mjs'","import {ASSETS} from './assets.mjs'\nimport {socialVideoUpload,consumeVideoSession,videoResponse} from './social-video-v24.mjs'"],
 ["else member(s,u,b.person);requireOk(!['Administrador','Diretoria'].includes(u.role)||b.person===u.id,'Este perfil permite apenas registros pessoais.',403);","else {member(s,u,b.person);requireOk(!['Administrador','Diretoria'].includes(u.role)||b.person===u.id,'Este perfil permite apenas registros pessoais.',403);}"],
 ["return {id:item.id,type:item.type}\n}\nfunction socialUpdate","return consumeVideoSession(state,item)\n}\nfunction socialUpdate"],
 ["  const stored=await env.BUCKET.get('social/'+item.id)","  if(item.storage==='parts-v24')return videoResponse(req,env.BUCKET,item,{'content-type':item.type,'cache-control':'private,max-age=60','x-content-type-options':'nosniff'})\n  const stored=await env.BUCKET.get('social/'+item.id)"],
 [" if(req.method==='POST'&&path==='/api/socialUpload')return socialUpload(req,env,state,u,digest,identity,url)"," if(req.method==='POST'&&path==='/api/socialUpload'){\n   if(url.searchParams.has('action'))return socialVideoUpload(req,{bucket:env.BUCKET,userId:u.id,readState:async()=>{const current=await (await env.BUCKET.get(stateKey)).json();actor(current,digest,identity);return current},mutate:fn=>change(env,s=>fn(s,actor(s,digest,identity)))})\n   return socialUpload(req,env,state,u,digest,identity,url)\n }"]
])
edit('storage.mjs',[["export const BUCKET = {","export const BUCKET = {\n // Delete only unpublished video parts whose server-issued ID was authorized by the upload session.\n async deleteSocialVideoParts(id){\n  if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id))throw new TypeError('Identificador inválido.')\n  db.prepare('DELETE FROM objects WHERE key GLOB ?').run('social-video/'+id+'/*')\n },"]])
edit('serve.mjs',[["import {Readable} from 'node:stream'","import {Readable} from 'node:stream'\nimport {pipeline} from 'node:stream/promises'"],["if (result.body) Readable.fromWeb(result.body).pipe(res)","if (result.body) await pipeline(Readable.fromWeb(result.body),res)"]])
const oldClient=`  const limit=video?64:8
  if(file.size>limit*1024*1024)throw Error('Arquivo acima de '+limit+' MB.')`
const newClient=`  const limit=video?1024:8
  if(!file.size||file.size>limit*1024*1024)throw Error(video?'Selecione um vídeo de até 1 GB.':'Selecione uma foto de até 8 MB.')
  if(video)return sendSocialVideoV24(file,extension)`
edit('web-app.js',[["Foto até 8 MB ou vídeo até 64 MB.","Foto até 8 MB ou vídeo MP4/WebM até 1 GB."],[oldClient,newClient],["const socialTime=stamp=>",`async function sendSocialVideoV24(file,extension){
 const editor=document.getElementById('editor'),progress=document.createElement('progress'),label=document.createElement('p')
 progress.max=file.size;progress.value=0;progress.setAttribute('aria-label','Progresso do envio de vídeo');progress.style.width='100%'
 label.setAttribute('role','status');label.textContent='Preparando envio do vídeo…'
 const anchor=editor?.querySelector('.attachment-preview');if(anchor)anchor.after(label,progress)
 let uploadId='',completed=false
 const controller=new AbortController(),cancel=()=>controller.abort();modal.addEventListener('close',cancel,{once:true})
 async function request(params,body,signal=controller.signal){
  const res=await fetch('/api/socialUpload?'+new URLSearchParams(params),{method:'POST',body,signal})
  const result=await res.json().catch(()=>null);if(!res.ok){const error=Error(result?.error||'Não foi possível enviar o vídeo.');error.status=res.status;throw error}return result
 }
 try{
  const opened=await request({action:'start',extension,size:String(file.size)});uploadId=opened.id
  const chunkSize=opened.chunkSize;if(!Number.isInteger(chunkSize)||chunkSize<1||chunkSize>8*1024*1024)throw Error('Configuração de envio inválida.')
  for(let offset=0,index=0;offset<file.size;offset+=chunkSize,index++){
   const part=file.slice(offset,offset+chunkSize);let lastError
   for(let attempt=0;attempt<3;attempt++){
    try{await request({action:'part',id:uploadId,index:String(index)},part);lastError=null;break}
    catch(error){lastError=error;if(controller.signal.aborted||error.status&&error.status<500&&error.status!==409)throw error;await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)))}
   }
   if(lastError)throw lastError
   progress.value=Math.min(file.size,offset+part.size);label.textContent='Enviando vídeo: '+Math.floor(progress.value/file.size*100)+'%'
  }
  label.textContent='Finalizando vídeo…';const result=await request({action:'finish',id:uploadId});completed=true;label.textContent='Vídeo enviado. Publicando…';return result.id
 }finally{
  modal.removeEventListener('close',cancel)
  if(uploadId&&!completed)try{await request({action:'abort',id:uploadId},undefined,AbortSignal.timeout(5000))}catch{}
  progress.remove();label.remove()
 }
}
const socialTime=stamp=>`]])
// Validate all anchors before writing any files. Never replace whole files from an old revision.
const module=resolve(source,'social-video-v24.mjs'),dest=target('social-video-v24.mjs')
if(!existsSync(module))throw Error('Módulo ausente no pacote.')
if(module!==dest)copyFileSync(module,dest)
for(const test of ['test-social-video-v24.mjs','verify-social-v24.mjs']){const a=resolve(source,test),b=target(test);if(a!==b&&existsSync(a))copyFileSync(a,b)}
for(const [file,content] of changes)writeFileSync(target(file),content)
console.log('V24 aplicada: '+[...changes.keys(),'social-video-v24.mjs'].join(', '))
