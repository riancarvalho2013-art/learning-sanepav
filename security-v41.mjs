/** V41: ingress defense in depth; does not replace authorization or a WAF. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const MiB=1024*1024;
export function uploadPolicyV41(url,method){
 if(method!=='POST')return null;
 const p=url.pathname;
 if(p==='/api/upload')return {limit:/^cover\.(png|jpe?g|webp|gif)$/i.test(url.searchParams.get('path')||'')?8*MiB:64*MiB};
 if(p==='/api/socialUpload'){
  if(url.searchParams.has('action'))return {limit:url.searchParams.get('action')==='part'?4*MiB:256*1024};
  return {limit:['png','jpg','jpeg','webp','gif'].includes(url.searchParams.get('extension'))?8*MiB:64*MiB};
 }
 if(p==='/api/evo/brand/logo')return {limit:4*MiB};
 if(p==='/api/evo/certificate/background')return {limit:8*MiB};
 return null;
}
export function checkUploadLengthV41(policy,length){
 if(!policy||length===undefined||length===null)return 0;
 if(typeof length!=='string'||!/^\d{1,16}$/.test(length)||!Number.isSafeInteger(Number(length)))return 400;
 return Number(length)>policy.limit?413:0;
}
// No untrusted IP headers, unbounded maps, or queue of file buffers. Scope is one process.
export function createUploadGateV41({max=4,maxLarge=2}={}){
 let active=0,large=0;
 return policy=>{
  if(!policy)return {release(){}};
  const heavy=policy.limit>8*MiB;
  if(active>=max||(heavy&&large>=maxLarge))return null;
  active++;if(heavy)large++;let released=false;
  return {release(){if(released)return;released=true;active--;if(heavy)large--;}};
 };
}
// Aggregate only fixed classes, never URLs, names, IPs, cookies, or bodies.
export function createSecurityMonitorV41({clock=Date.now,windowMs=60000,emit=event=>console.warn(JSON.stringify(event)),thresholds={auth_denied:10,access_denied:20,limit_exceeded:15,invalid_request:30,server_error:10}}={}){
 let started=clock(),counts=Object.create(null),sent=new Set();
 return (path,status)=>{
  const now=clock();if(now-started>=windowMs||now<started){started=now;counts=Object.create(null);sent=new Set();}
  let category;
  if(status===401&&path==='/api/login')category='auth_denied';
  else if(status===401||status===403||status===421)category='access_denied';
  else if(status===413||status===429)category='limit_exceeded';
  else if(status===400||status===405||status===415)category='invalid_request';
  else if(status>=500)category='server_error';
  if(!category)return;
  const count=counts[category]=(counts[category]||0)+1;
  if(count>=thresholds[category]&&!sent.has(category)){sent.add(category);try{emit({type:'security_threshold_v41',category,count,windowSeconds:windowMs/1000,at:new Date(now).toISOString()});}catch{/* log failure must not change HTTP outcome */}}
 };
}
// Basic binary format checks only. Does not establish that a document is safe.
export function validUploadV41(name,bytes){
 if(typeof name!=='string'||!(bytes instanceof Uint8Array)||!bytes.length)return false;
 const ext=name.split('.').pop().toLowerCase(),b=Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const prefix=hex=>b.subarray(0,hex.length/2).toString('hex')===hex;
 const ascii=(start,end)=>b.toString('ascii',start,end);
 if(['exe','dll','msi','msp','scr','com','bat','cmd','ps1','vbs','vbe','hta','jar','apk','sh','dmg','iso'].includes(ext))return false;
 if(ext==='pdf')return /^%PDF-\d\.\d/.test(ascii(0,8));
 if(ext==='png')return prefix('89504e470d0a1a0a');
 if(ext==='jpg'||ext==='jpeg')return prefix('ffd8ff');
 if(ext==='gif')return ['GIF87a','GIF89a'].includes(ascii(0,6));
 if(ext==='webp')return ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP';
 if(ext==='mp4'||ext==='m4a')return ascii(4,8)==='ftyp';
 if(ext==='webm')return prefix('1a45dfa3');
 if(['docx','xlsx','pptx'].includes(ext))return prefix('504b0304');
 if(ext==='ppt')return prefix('d0cf11e0a1b11ae1');
 // SCORM requires HTML/JS/XML and other browser assets. Existing sandbox remains essential.
 return true;
}
export function securityIdentityChangedV41(person,body,email){
 return Boolean(person?.id&&(person.email!==email||person.role!==body.role||Boolean(person.active)!==Boolean(body.active)||(person.manager||'')!==(body.manager||'')));
}
const marker='/* V41 ingress hardening */';
function swap(s,a,b){if(s.split(a).length!==2)throw Error('V41: estrutura incompatível: '+a);return s.replace(a,()=>b);}
export function patchServe(s){
 if(s.includes(marker))return s;
 if(!s.includes('const authRateV391=createAuthRateV391()'))throw Error('V41 requer V39.1');
 s=marker+"\nimport {uploadPolicyV41,checkUploadLengthV41,createUploadGateV41,createSecurityMonitorV41} from './security-v41.mjs'\n"+s;
 s=swap(s,'const authRateV391=createAuthRateV391()','const authRateV391=createAuthRateV391()\nconst uploadGateV41=createUploadGateV41(),monitorV41=createSecurityMonitorV41()');
 s=swap(s,'  let gate\n','  let gate,uploadPermitV41\n');
 s=swap(s,"  res.on('finish',()=>{\n", "  res.on('finish',()=>{\n    // Only fixed categories are emitted; no raw request content.\n    const monitoredPathV41=String(req.url||'').split('?')[0];monitorV41(monitoredPathV41,res.statusCode)\n");
 const anchor="    if (url.pathname === '/ativar') {";
 s=swap(s,anchor,`    const uploadPolicy=uploadPolicyV41(url,req.method)
    if(uploadPolicy){
      const invalidLength=checkUploadLengthV41(uploadPolicy,req.headers['content-length'])
      if(invalidLength){res.writeHead(invalidLength,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'});return res.end(JSON.stringify({error:'Tamanho do arquivo inválido ou acima do limite.',requestId}))}
      uploadPermitV41=uploadGateV41(uploadPolicy)
      if(!uploadPermitV41){res.writeHead(429,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','Retry-After':'10'});return res.end(JSON.stringify({error:'Muitos envios simultâneos. Tente novamente.',requestId}))}
    }
`+anchor);
 return swap(s,'  } finally {gate?.release()}','  } finally {uploadPermitV41?.release();gate?.release()}');
}
export function patchPlatform(s){
 if(s.includes('/* V41 upload and session hardening */'))return s;
 s="/* V41 upload and session hardening */\nimport {validUploadV41,securityIdentityChangedV41} from './security-v41.mjs'\n"+s;
 s=swap(s,' const blob=Buffer.concat(chunks,size)\n const storageKey='," const blob=Buffer.concat(chunks,size)\n requireOk(validUploadV41(name,blob),'Formato de arquivo incompatível ou não permitido.',415)\n const storageKey=");
 s=swap(s," if(!p){requireOk(b.secret,'Informe a senha inicial.');p={id:id()};s.users.push(p)}Object.assign(p,", " const revokeIdentityV41=securityIdentityChangedV41(p,b,email)\n if(!p){requireOk(b.secret,'Informe a senha inicial.');p={id:id()};s.users.push(p)}Object.assign(p,");
 s=swap(s,' if(b.secret||!p.active)s.sessions=s.sessions.filter(x=>x.person!==p.id)',' if(b.secret||!p.active||revokeIdentityV41)s.sessions=s.sessions.filter(x=>x.person!==p.id)');
 return s;
}
export function patchTestV28(s){
 if(s.includes('// V41: real ingress module'))return s;
 const a=" for(const m of source.matchAll";
 s=swap(s,a," // V41: real ingress module, never an asynchronous mock.\n writeFileSync(join(tmp,'security-v41.mjs'),readFileSync(new URL('./security-v41.mjs',import.meta.url)))\n"+a);
 s=swap(s,"if(m[2]==='storage.mjs'||m[2]==='estabilidade-v39-1.mjs')continue","if(m[2]==='storage.mjs'||m[2]==='estabilidade-v39-1.mjs'||m[2]==='security-v41.mjs')continue");
 const b=" r=await fetch(origin+'/healthz');eq(r.status,200);eq((await r.json()).ok,true)";
 return swap(s,b,` // Reject oversized uploads before handler allocation. Stub business handlers do not consume bodies.
 r=await fetch(origin+'/api/evo/brand/logo?ext=png',{method:'POST',headers:{origin},body:Buffer.alloc(4*1024*1024+1)});eq(r.status,413);await r.text()
 for(let i=0;i<22;i++){r=await fetch(origin+'/api/private-v41?secret=NEVER_LOG_V41',{method:'POST',body:'{}'});eq(r.status,403);await r.text()}
 await new Promise(resolve=>setTimeout(resolve,50));eq(logs.includes('security_threshold_v41'),true);eq(logs.includes('NEVER_LOG_V41'),false)
`+b);
}
export function patchUserTest(s){
 if(s.includes('// V41 session revocation regression'))return s;
 return s+`\n// V41 session revocation regression: role changes must not upgrade a stolen session.\nconst oldV41=(await good('login','',{email:person.email,password})).cookie;\nconst promotedV41={...input('person',second,{role:'Líder',id:person.id})};delete promotedV41.password;delete promotedV41.organization;\nawait good('user',admin,promotedV41);\nassert.equal((await call('data',oldV41)).status,401);\nassert.equal((await call('data',user)).status,401);\nconst newV41=(await good('login','',{email:person.email,password})).cookie;\nassert.equal((await good('data',newV41)).data.me.role,'Líder');\nconsole.log('OK V41: revogação de sessões após alteração de perfil.');\n`;
}
export function patchPrivacyTest(s){
 if(s.includes('// V41 binary upload regression'))return s;
 const anchor="const key=crypto.randomUUID();assert.equal((await fetch(origin+'/api/upload?id='+key+'&path=index.html',{method:'POST',headers:{origin,cookie:a},body:'<!doctype html><title>SCO</title>'})).status,200)";
 return swap(s,anchor,anchor+`\n// V41 binary upload regression: declared extension is not sufficient.\nfor(const [file,content,status] of [['cover.png','not a PNG',415],['lecture.pdf','not a PDF',415],['file.exe','MZ',415],['valid.pdf','%PDF-1.7\\n',200]]){\n const uploadV41=await fetch(origin+'/api/upload?id='+crypto.randomUUID()+'&path='+file,{method:'POST',headers:{origin,cookie:a},body:content});assert.equal(uploadV41.status,status,file);\n}\n`);
}
export function install(root='.'){
 const p=f=>resolve(root,f),read=f=>readFileSync(p(f),'utf8');
 const edits=[['serve.mjs',patchServe(read('serve.mjs'))],['platform.mjs',patchPlatform(read('platform.mjs'))],['verify-security-v28.mjs',patchTestV28(read('verify-security-v28.mjs'))],['verify-user-company.mjs',patchUserTest(read('verify-user-company.mjs'))],['verify-privacy.mjs',patchPrivacyTest(read('verify-privacy.mjs'))]];
 for(const [f,s] of edits)writeFileSync(p(f),s);return edits.length;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--install'))console.log('V41: proteção de ingresso integrada ('+install()+' arquivos).');
