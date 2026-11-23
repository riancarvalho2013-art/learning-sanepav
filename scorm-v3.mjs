/**
 * Learning Sanepav | SCORM Runtime V3
 * Secure, isolated package-resource delivery and interoperable SCORM 1.2/2004
 * CMI bridge. Original implementation; no external dependencies.
 *
 * Important: this is not a formal ADL conformance certification. One SCO per
 * package is the current LMS authoring limit. LTI/xAPI/cmi5 are not supported.
 */
import {createHash, randomBytes, randomUUID, timingSafeEqual} from 'node:crypto'
import {missingPrerequisites, courseStatus} from './learning.mjs'

const SCOPE = '/scorm/v3/'
const URL_TTL = 30 * 60_000
const MAX_SESSION = 8 * 60 * 60_000
const MAX_SESSIONS = 600
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const TOKEN = /^[A-Za-z0-9_-]{40,64}$/
const contentType = {
 html:'text/html;charset=utf-8', htm:'text/html;charset=utf-8', css:'text/css;charset=utf-8',
 js:'text/javascript;charset=utf-8',mjs:'text/javascript;charset=utf-8',json:'application/json;charset=utf-8',
 xml:'application/xml;charset=utf-8',txt:'text/plain;charset=utf-8',pdf:'application/pdf',
 png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',svg:'image/svg+xml',
 mp4:'video/mp4',m4v:'video/mp4',webm:'video/webm',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',
 mp4a:'audio/mp4',m4a:'audio/mp4',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',otf:'font/otf',
 vtt:'text/vtt',srt:'text/plain;charset=utf-8',wasm:'application/wasm',map:'application/json;charset=utf-8',
 swf:'application/x-shockwave-flash'
}
const noStore = {'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}
const json = (data, status=200) => new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json;charset=utf-8',...noStore}})
const failure = (status,error) => json({error},status)
const hex = str => createHash('sha256').update(str).digest('hex')
const verifiedEqual=(a,b)=>{
 const left=Buffer.from(a||''),right=Buffer.from(b||'')
 return left.length===right.length && timingSafeEqual(left,right)
}
const unescapeAttribute=s=>s.replaceAll('&amp;','&')

function safePath(raw){
 if(typeof raw!=='string'||!raw||raw.length>700||raw.startsWith('/')||raw.includes('\\')||/[\0-\x1f]/.test(raw))return null
 const segments=raw.split('/')
 if(segments.some(seg=>!seg||seg==='.'||seg==='..'||seg.includes(':')))return null
 return raw
}
function decodeRoute(route){
 try{
  const split=route.split('/')
  if(split.some(p=>!p||/%2f|%5c/i.test(p)))return null
  return safePath(split.map(decodeURIComponent).join('/'))
 }catch{return null}
}
function assetURL(token,path){return SCOPE+encodeURIComponent(token)+'/'+path.split('/').map(encodeURIComponent).join('/')}
function rewriteRootPaths(text,base,css=false){
 if(css)return text.replace(/url\(\s*(['"]?)\/(?!\/)([^)'"\s]+)\1\s*\)/gi,(_,q,path)=>'url('+q+base+path+q+')')
 return text.replace(/\b(href|src|poster|data|action)\s*=\s*(['"])\/(?!\/)([^'"]*)\2/gi,(_,attr,q,path)=>attr+'='+q+base+path+q)
}
function scormBridge(setup){
 'use strict'
 const values={...setup.cmi}
 const key=setup.key
 let initialized=false, last12='0',last2004='0',sequence=0
 const result=(ok,code='0')=>{last12=code;last2004=code;return ok?'true':'false'}
 const message=op=>{
  try{window.top.postMessage({type:'DNA_SCORM_COMMIT_V3',key,op,sequence:++sequence,values:{...values}},setup.parentOrigin)}catch{}
 }
 function get(name){
  if(!initialized){last12='301';last2004='132';return ''}
  if(name==='cmi.interactions._count')return String(Object.keys(values).filter(x=>/^cmi\.interactions\.\d+\.id$/.test(x)).length)
  if(name==='cmi.objectives._count')return String(Object.keys(values).filter(x=>/^cmi\.objectives\.\d+\.id$/.test(x)).length)
  if(name==='cmi._version')return '1.0'
  last12='0';last2004='0'
  return values[name]??''
 }
 function set(name,value){
  if(!initialized)return result(false,'301')
  if(typeof name!=='string'||!name.startsWith('cmi.')||name.length>160||typeof value==='undefined')return result(false,'201')
  if(['cmi.core.student_id','cmi.core.student_name','cmi.learner_id','cmi.learner_name','cmi.core.credit','cmi.credit','cmi.mode','cmi.core.lesson_mode'].includes(name))return result(false,'403')
  const asString=String(value)
  if(asString.length>(name==='cmi.suspend_data'?64000:4000))return result(false,'405')
  values[name]=asString
  return result(true)
 }
 function initialize(){if(initialized)return result(false,'101');initialized=true;message('start');return result(true)}
 function terminate(){if(!initialized)return result(false,'301');message('commit');initialized=false;return result(true)}
 function commit(){if(!initialized)return result(false,'301');message('commit');return result(true)}
 const api12={LMSInitialize:initialize,LMSFinish:terminate,LMSGetValue:get,LMSSetValue:set,LMSCommit:commit,
  LMSGetLastError:()=>last12,LMSGetErrorString:v=>v==='0'?'No error':'SCORM error '+v,LMSGetDiagnostic:v=>'SCORM error '+(v||last12)}
 const api2004={Initialize:initialize,Terminate:terminate,GetValue:get,SetValue:set,Commit:commit,
  GetLastError:()=>last2004,GetErrorString:v=>v==='0'?'No error':'SCORM error '+v,GetDiagnostic:v=>'SCORM error '+(v||last2004)}
 try{Object.defineProperty(window,'API',{value:api12,configurable:true})}catch{window.API=api12}
 try{Object.defineProperty(window,'API_1484_11',{value:api2004,configurable:true})}catch{window.API_1484_11=api2004}
 window.addEventListener('pagehide',()=>{if(initialized)message('commit')})
 window.addEventListener('beforeunload',()=>{if(initialized)message('commit')})
 try{window.top.postMessage({type:'DNA_SCORM_READY_V3',key},setup.parentOrigin)}catch{}
}
function injectedHTML(html,session,origin){
 const data={key:session.key,parentOrigin:origin,cmi:session.cmi}
 const call='('+scormBridge.toString()+')('+JSON.stringify(data).replace(/</g,'\\u003c')+');'
 const script='<script data-dna-scorm-runtime="3">'+call.replace(/<\/script/gi,'<\\/script')+'</script>'
 const scope=SCOPE+encodeURIComponent(session.token)+'/'
 let transformed=rewriteRootPaths(html,scope)
 if(/<head\b[^>]*>/i.test(transformed))transformed=transformed.replace(/<head\b[^>]*>/i,m=>m+script)
 else if(/<!doctype\b[^>]*>/i.test(transformed))transformed=transformed.replace(/<!doctype\b[^>]*>/i,m=>m+'\n'+script)
 else transformed=script+transformed
 return transformed
}
function mimeOf(path){return contentType[path.split('.').at(-1).toLowerCase()]||'application/octet-stream'}
const readState=async BUCKET=>{
 const blob=await BUCKET.get('system/state-v1')
 return blob?await blob.json():null
}
function authenticated(state,request){
 if(!state)return null
 const token=(request.headers.get('cookie')||'').match(/(?:^|;\s*)learning=([^;]+)/)?.[1]
 if(!token)return null
 const digest=hex(token),identity=request.headers.get('oai-authenticated-user-id')||''
 const session=state.sessions?.find(s=>verifiedEqual(s.digest,digest)&&s.identity===identity&&s.until>Date.now())
 return state.users?.find(person=>person.id===session?.person&&person.active)||null
}
function permitted(state,user,courseId,enrollId='',uploadId=''){
 const course=state.courses?.find(c=>c.id===courseId&&c.type==='SCORM'&&c.upload&&c.entry)
 if(!course||uploadId&&course.upload!==uploadId)return null
 const isManager=['Administrador','RH/DHO'].includes(user.role)
 let enrollment=enrollId?state.enroll?.find(e=>e.id===enrollId&&e.course===courseId&&e.person===user.id):null
 if(enrollId&&!enrollment)return null
 if(!enrollment&&!isManager)return null
 if(!enrollment&&!['published','archived','draft'].includes(courseStatus(course)))return null
 if(enrollment&&(courseStatus(course)==='draft'||missingPrerequisites(state,enrollment).length))return null
 return {course,enrollment}
}
function securityHeaders(origin,html){
 const allowed=origin.replace(/\/$/,'')
 return {...noStore,'Access-Control-Allow-Origin':'null','Cross-Origin-Resource-Policy':'cross-origin',
  ...(html?{'Content-Security-Policy':[
   'sandbox allow-scripts allow-forms',
   `default-src ${allowed} data: blob:`,
   `script-src ${allowed} 'unsafe-inline' 'unsafe-eval' blob:`,
   `style-src ${allowed} 'unsafe-inline'`,
   `img-src ${allowed} data: blob:`,
   `font-src ${allowed} data:`,
   `media-src ${allowed} data: blob:`,
   `connect-src ${allowed}`,
   `frame-src ${allowed} blob:`,
   `worker-src ${allowed} blob:`,
   "object-src 'none'",`base-uri ${allowed}`,`form-action ${allowed}`
  ].join('; ')}: {})}
}
function fileResponse(req,buffer,headers){
 const size=buffer.length,range=req.headers.get('range')
 if(range){
  const match=/^bytes=(\d*)-(\d*)$/.exec(range)
  let first=match?.[1]?Number(match[1]):Math.max(0,size-Number(match?.[2])),last=match?.[2]&&match?.[1]?Number(match[2]):size-1
  if(!match||(!match[1]&&!match[2])||!Number.isSafeInteger(first)||!Number.isSafeInteger(last)||first>last||first>=size||last<0){return new Response(null,{status:416,headers:{...headers,'Content-Range':'bytes */'+size}})}
  last=Math.min(last,size-1)
  return new Response(req.method==='HEAD'?null:buffer.subarray(first,last+1),{status:206,headers:{...headers,'Content-Range':`bytes ${first}-${last}/${size}`,'Content-Length':String(last-first+1),'Accept-Ranges':'bytes'}})
 }
 return new Response(req.method==='HEAD'?null:buffer,{status:200,headers:{...headers,'Content-Length':String(size),'Accept-Ranges':'bytes'}})
}

/** Create an isolated runtime instance for production or hermetic tests. */
export function createScormRuntime({clock=()=>Date.now()}={}){
 const sessions=new Map()
 const prune=()=>{for(const [token,s] of sessions)if(s.expires<clock()||s.expiresAbsolute<clock())sessions.delete(token)}
 return async function handleScormV3(request,environment){
  const url=new URL(request.url),path=url.pathname,method=request.method
  if(!path.startsWith(SCOPE)&&!path.startsWith('/api/scorm/v3/'))return null
  const {BUCKET}=environment
  if(!BUCKET)return failure(503,'Armazenamento indisponível.')
  if(method==='OPTIONS'&&path.startsWith(SCOPE))return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'null','Access-Control-Allow-Headers':'content-type,range','Access-Control-Allow-Methods':'GET,HEAD,OPTIONS','Access-Control-Max-Age':'600'}})
  if(!['GET','HEAD'].includes(method))return failure(405,'Método não permitido.')
  prune()
  if(path.startsWith('/api/scorm/v3/')){
   const state=await readState(BUCKET),user=authenticated(state,request)
   if(!user)return failure(401,'Entre no Learning para acessar esse conteúdo.')
   if(path==='/api/scorm/v3/launch'){
    const enrollmentId=url.searchParams.get('enrollment')||'',courseId=url.searchParams.get('course')||''
    if(!UUID.test(enrollmentId)&&!UUID.test(courseId))return failure(400,'Selecione uma matrícula ou curso.')
    const enrollment=enrollmentId?state.enroll?.find(e=>e.id===enrollmentId&&e.person===user.id):null
    const chosen=enrollment?.course||courseId
    const access=permitted(state,user,chosen,enrollmentId)
    if(!access)return failure(403,'Conteúdo indisponível ou etapa anterior pendente.')
    const {course}=access
    if(!safePath(course.entry)||!/[.]html?$/i.test(course.entry))return failure(422,'A página inicial do SCORM está inválida.')
    if(!await BUCKET.get('files/'+course.upload+'/'+course.entry))return failure(422,'O arquivo inicial SCORM não está no armazenamento. Reenvie o pacote completo.')
    if(sessions.size>=MAX_SESSIONS){const oldest=sessions.keys().next().value;if(oldest)sessions.delete(oldest)}
    const token=randomBytes(36).toString('base64url'),key=randomUUID()
    const session={token,key,courseId:course.id,courseUpload:course.upload,enrollmentId:enrollment?.id||'',personId:user.id,
     preview:!access.enrollment,created:clock(),expires:clock()+URL_TTL,expiresAbsolute:clock()+MAX_SESSION,
     cmi:{'cmi.core.student_id':user.id,'cmi.core.student_name':user.name,
      'cmi.learner_id':user.id,'cmi.learner_name':user.name,'cmi.core.credit':'credit','cmi.credit':'credit',
      'cmi.core.lesson_mode':'normal','cmi.mode':'normal','cmi.core.lesson_status':'not attempted','cmi.completion_status':'unknown',
      'cmi.core.entry':enrollment?.cmi?'resume':'ab-initio','cmi.entry':enrollment?.cmi?'resume':'ab-initio',...(enrollment?.cmi||{})}}
    sessions.set(token,session)
    return json({url:assetURL(token,course.entry),key,course:course.id,enrollment:enrollment?.id||null,
     preview:session.preview,title:course.title,minutes:course.minutes,expiresInSeconds:URL_TTL/1000})
   }
   if(path==='/api/scorm/v3/keepalive'){
    const token=url.searchParams.get('token')||'',session=sessions.get(token)
    if(!session||session.personId!==user.id)return failure(404,'Sessão SCORM não encontrada.')
    const access=permitted(state,user,session.courseId,session.enrollmentId,session.courseUpload)
    if(!access)return failure(403,'Acesso revogado.')
    session.expires=Math.min(clock()+URL_TTL,session.expiresAbsolute)
    return json({active:true,expiresInSeconds:Math.max(0,Math.floor((session.expires-clock())/1000))})
   }
   if(path==='/api/scorm/v3/diagnostics'){
    if(!['Administrador','RH/DHO'].includes(user.role))return failure(403,'Acesso restrito à gestão de aprendizagem.')
    const courseId=url.searchParams.get('course')||''
    const access=permitted(state,user,courseId)
    if(!access)return failure(404,'Curso SCORM não encontrado.')
    const course=access.course
    const root=course.entry.slice(0,course.entry.lastIndexOf('/')+1)
    const exists=Boolean(await BUCKET.get('files/'+course.upload+'/'+course.entry))
    const manifest=await BUCKET.get('files/'+course.upload+'/'+root+'imsmanifest.xml')||await BUCKET.get('files/'+course.upload+'/imsmanifest.xml')
    const manifestContent=manifest?await manifest.text():''
    const version=/2004/i.test(manifestContent)?'SCORM 2004':/1[.]2/i.test(manifestContent)?'SCORM 1.2':'Não identificada'
    const launch=exists?await BUCKET.get('files/'+course.upload+'/'+course.entry):null
    const html=launch?await launch.text():''
    const refs=[...html.matchAll(/\b(?:href|src|poster)\s*=\s*["']([^"']+)["']/gi)].map(x=>unescapeAttribute(x[1])).filter(x=>!/^data:|^blob:|^https?:|^\/\//i.test(x)).slice(0,60)
    const missing=[]
    for(const ref of refs){
     try{const resolved=new URL(ref,'https://package.example/'+root);const filename=decodeURIComponent(resolved.pathname.slice(1))
      if(!safePath(filename)||!await BUCKET.get('files/'+course.upload+'/'+filename))missing.push(ref)
     }catch{missing.push(ref)}
    }
    return json({course:course.id,title:course.title,entry:course.entry,entryExists:exists,manifestExists:Boolean(manifest),version,missingResources:[...new Set(missing)],
      advisory:'Inspeciona vínculos diretos no HTML inicial; recursos carregados dinamicamente devem ser testados no player.'})
   }
   return failure(404,'Recurso SCORM inexistente.')
  }
  const parts=path.slice(SCOPE.length).split('/'),token=parts.shift()
  if(!TOKEN.test(token||''))return failure(404,'Conteúdo indisponível.')
  const session=sessions.get(token)
  if(!session)return failure(403,'A sessão da aula expirou. Reabra o curso para continuar.')
  const filename=decodeRoute(parts.join('/'))
  if(!filename)return failure(400,'Caminho inválido.')
  const state=await readState(BUCKET)
  const owner=state?.users?.find(x=>x.id===session.personId&&x.active)
  if(!owner||!permitted(state,owner,session.courseId,session.enrollmentId,session.courseUpload))return failure(403,'Acesso à aula revogado.')
  const object=await BUCKET.get('files/'+session.courseUpload+'/'+filename)
  if(!object)return failure(404,'Recurso não encontrado dentro do pacote SCORM: '+filename)
  const mime=mimeOf(filename),html=/^text\/html/.test(mime),css=/^text\/css/.test(mime)
  const headers={'Content-Type':mime,...securityHeaders(url.origin,html)}
  if(html){
   const content=injectedHTML(await object.text(),session,url.origin)
   return new Response(method==='HEAD'?null:content,{status:200,headers})
  }
  if(css){
   const scope=SCOPE+encodeURIComponent(token)+'/'
   return new Response(method==='HEAD'?null:rewriteRootPaths(await object.text(),scope,true),{status:200,headers})
  }
  const bytes=Buffer.from(object.body)
  return fileResponse(request,bytes,headers)
 }
}
export const handleScormV3=createScormRuntime()
