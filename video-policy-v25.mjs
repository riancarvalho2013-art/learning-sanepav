/* Server-side policy for sequential video consumption. No client-supplied duration is trusted. */
import {courseRevision,courseStatus} from './learning.mjs'
const check=(ok,msg,status=400)=>{if(!ok)throw Object.assign(new Error(msg),{status})}
export const restrictedVideo=c=>c?.type==='Vídeo'&&c.allowVideoSkip===false
const validDuration=n=>Number.isFinite(n)&&n>0&&n<=86400
function mp4Duration(b){
 function boxes(start,end){const out=[];for(let p=start;p+8<=end;){let size=b.readUInt32BE(p),head=8;const type=b.toString('ascii',p+4,p+8);if(size===1){if(p+16>end)break;size=Number(b.readBigUInt64BE(p+8));head=16}else if(size===0)size=end-p;if(!Number.isSafeInteger(size)||size<head||p+size>end)break;out.push({type,start:p+head,end:p+size});p+=size}return out}
 const moov=boxes(0,b.length).find(x=>x.type==='moov');if(!moov)return NaN
 const m=boxes(moov.start,moov.end).find(x=>x.type==='mvhd');if(!m)return NaN
 const p=m.start,v=b[p];if(v!==0&&v!==1)return NaN
 const off=v===1?20:12;if(p+off+(v===1?12:8)>m.end)return NaN
 const scale=b.readUInt32BE(p+off),ticks=v===1?Number(b.readBigUInt64BE(p+off+4)):b.readUInt32BE(p+off+4)
 if(!scale||ticks===0xffffffff&&v===0||!Number.isSafeInteger(ticks))return NaN
 return ticks/scale
}
function webmDuration(b){
 function vint(p,end,id=false){if(p>=end)return null;let mask=128,n=1;while(n<=8&&!(b[p]&mask)){mask>>=1;n++}if(n>8||p+n>end||id&&n>4)return null;let value=BigInt(id?b[p]:b[p]& (mask-1));for(let i=1;i<n;i++)value=(value<<8n)|BigInt(b[p+i]);return {n,value,unknown:!id&&value===(1n<<BigInt(7*n))-1n}}
 function elements(start,end){const out=[];for(let p=start;p<end;){const a=vint(p,end,true);if(!a)break;const s=vint(p+a.n,end);if(!s)break;const x=p+a.n+s.n,y=s.unknown?end:x+Number(s.value);if(!Number.isSafeInteger(y)||y<x||y>end)break;out.push({id:Number(a.value),start:x,end:y});p=y;if(s.unknown)break}return out}
 const segment=elements(0,b.length).find(x=>x.id===0x18538067);if(!segment)return NaN
 const info=elements(segment.start,segment.end).find(x=>x.id===0x1549a966);if(!info)return NaN
 const parts=elements(info.start,info.end),scaleNode=parts.find(x=>x.id===0x2ad7b1),dur=parts.find(x=>x.id===0x4489);if(!dur)return NaN
 let scale=1e6;if(scaleNode){const n=scaleNode.end-scaleNode.start;if(n<1||n>6)return NaN;scale=b.readUIntBE(scaleNode.start,n)}
 const n=dur.end-dur.start,d=n===4?b.readFloatBE(dur.start):n===8?b.readDoubleBE(dur.start):NaN;return d*scale/1e9
}
export function readVideoDuration(value,entry){const b=Buffer.from(value),ext=String(entry).split('.').at(-1).toLowerCase();const n=ext==='mp4'?mp4Duration(b):ext==='webm'?webmDuration(b):NaN;check(validDuration(n),'Não foi possível verificar a duração do vídeo. Use MP4 ou WebM com metadados completos ou permita avanço livre.',422);return n}
/* Called within the existing CAS mutation after session resolution. */
export async function prepareVideoPolicy(bucket,state,user,op,body){
 if(!['course','courseEdit'].includes(op))return body
 check(['Administrador','RH/DHO'].includes(user.role),'Acesso restrito à gestão de aprendizagem.',403)
 const prior=op==='courseEdit'?state.courses.find(c=>c.id===body.id):null
 if(op==='courseEdit')check(prior,'Curso inexistente.',404)
 const type=prior?.type||body.type
 const out={...body};delete out.videoDurationSeconds
 if(type!=='Vídeo'){delete out.allowVideoSkip;return out}
 const raw=body.allowVideoSkip
 check(raw===undefined||[true,false,'true','false'].includes(raw),'Política de vídeo inválida.')
 const allow=raw===undefined?prior?.allowVideoSkip!==false:raw===true||raw==='true'
 out.allowVideoSkip=allow
 if(allow)return out
 const upload=body.upload||prior?.upload,entry=body.upload?body.entry:prior?.entry
 if(body.upload)check(state.uploads.some(x=>x.id===upload&&x.owner===user.id&&x.paths.includes(entry)),'Envie um vídeo compatível.',403)
 check(upload&&typeof entry==='string'&&/\.(mp4|webm)$/i.test(entry),'Vídeo indisponível.',422)
 const stored=await bucket.get('files/'+upload+'/'+entry);check(stored?.body,'Vídeo indisponível.',422)
 out.videoDurationSeconds=readVideoDuration(stored.body,entry)
 return out
}
export function saveVideoPolicy(c,b){if(c.type!=='Vídeo')return;c.allowVideoSkip=b.allowVideoSkip!==false;if(c.allowVideoSkip)delete c.videoDurationSeconds;else {check(validDuration(b.videoDurationSeconds),'Duração de vídeo não verificada.',422);c.videoDurationSeconds=b.videoDurationSeconds}}
export function videoState(e,c){const v=e.videoV25;return v?.revision===courseRevision(c)&&v.duration===c.videoDurationSeconds?v:null}
export function videoSatisfied(e,c){const v=videoState(e,c);return !!v?.ended&&validDuration(c.videoDurationSeconds)&&v.watched>=c.videoDurationSeconds-Math.min(0.35,c.videoDurationSeconds*0.02)}
export function videoTick(e,c,input,now=Date.now()){
 check(restrictedVideo(c)&&courseStatus(c)!=='draft','Vídeo sem política sequencial.',409)
 const duration=c.videoDurationSeconds;check(validDuration(duration),'Duração não verificada. Contate a gestão do curso.',409)
 const token=input.session;check(typeof token==='string'&&/^[a-f0-9-]{36}$/i.test(token),'Sessão de vídeo inválida.')
 let v=videoState(e,c);if(!v)v=e.videoV25={revision:courseRevision(c),duration,watched:0,ended:false}
 if(input.action==='start'){v.session=token;v.last=now;v.position=v.watched;v.budget=v.budget||0;v.advanced=v.advanced||0;return {watched:v.watched,duration,ended:v.ended}}
 check(v.session===token,'Reabra o vídeo para continuar.',409)
 const position=input.position;check(typeof position==='number'&&Number.isFinite(position)&&position>=0&&position<=duration+0.75,'Posição inválida.')
 const pos=Math.min(duration,position)
 if(input.action==='reset'){check(pos<=v.watched+0.25,'Avanço não permitido.',409);v.last=now;v.position=Math.min(pos,v.watched)}
 else {
  check(['tick','end'].includes(input.action),'Ação inválida.')
  const elapsed=Math.max(0,(now-v.last)/1000),delta=pos-v.position
  const budget=(v.budget||0)+Math.min(elapsed,20)*1.06,advanced=(v.advanced||0)+Math.max(0,delta)
  check(advanced<=budget+0.25,'Avanço não permitido. Retome do trecho registrado.',409)
  check(elapsed<=20&&delta>=-0.25&&delta<=elapsed*1.06+0.15,'Avanço não permitido. Retome do trecho registrado.',409)
  v.budget=budget;v.advanced=advanced;v.watched=Math.max(v.watched,pos);v.position=pos;v.last=now
  if(input.action==='end')check(v.watched>=duration-Math.min(0.35,duration*0.02),'Assista ao vídeo até o final.',409),v.ended=true
 }
 e.progress=Math.min(99,Math.floor(v.watched/duration*100));return {watched:v.watched,duration,ended:v.ended}
}
