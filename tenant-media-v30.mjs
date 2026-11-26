/** V30.2B2: bounded, private single-file staging pilot; never enable on production data.
 * Ledger is written BEFORE the object; failed writes are quarantined, never garbage-collected here.
 * Signature checks are not malware scanning or full format validation. Drafts cannot be published yet.
 */
import {createHash,randomUUID} from 'node:crypto'
import {tenantContext} from './tenant-policy-v30.mjs'
const KEY='system/state-v1', PREFIX='/api/tenant-media/v30/', MAX=4*1024*1024, TTL=15*60*1000, LIMIT=500
const types={'application/pdf':{entry:'material.pdf',type:'PDF',valid:b=>b.subarray(0,5).toString()==='%PDF-'&&b.subarray(-1024).includes(Buffer.from('%%EOF'))},'image/png':{entry:'material.png',type:'Imagem',valid:b=>b.length>=24&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&b.subarray(12,16).toString()==='IHDR'},'image/jpeg':{entry:'material.jpg',type:'Imagem',valid:b=>b.length>=4&&b[0]===255&&b[1]===216&&b[2]===255&&b.at(-2)===255&&b.at(-1)===217},'image/webp':{entry:'material.webp',type:'Imagem',valid:b=>b.length>=16&&b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP'&&b.readUInt32LE(4)+8===b.length}}
const sha=b=>createHash('sha256').update(b).digest('hex'), rows=x=>Array.isArray(x)?x:[], unique=(a,id)=>{const x=rows(a).filter(i=>i?.id===id);return x.length===1?x[0]:null}
const deny=(status=403)=>{throw Object.assign(new Error('Media denied'),{status})}, check=(x,status=403)=>{if(!x)deny(status)}
const json=(status,data)=>Response.json(data,{status,headers:{'cache-control':'private,no-store','x-content-type-options':'nosniff'}})
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(x)
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)
const strict=(b,keys)=>check(b&&typeof b==='object'&&!Array.isArray(b)&&Object.keys(b).every(x=>keys.includes(x)),400)
const cleanText=(v,max)=>{check(typeof v==='string'&&v.trim()&&v.length<=max,400);return v.trim()}
export function mediaRoute(req){const path=new URL(req.url).pathname;return req.method==='POST'&&path.startsWith(PREFIX)?path.slice(PREFIX.length):null}
async function body(req,limit){const length=req.headers.get('content-length');if(length!==null)check(/^\d+$/.test(length)&&Number(length)<=limit,413);const r=req.body?.getReader();check(r,400);let size=0;const chunks=[];try{while(true){const {done,value}=await r.read();if(done)break;size+=value.byteLength;if(size>limit){await r.cancel();deny(413)}chunks.push(Buffer.from(value))}}finally{r.releaseLock()}return Buffer.concat(chunks,size)}
async function input(req){check(req.headers.get('content-type')?.split(';')[0].trim()==='application/json',415);let v;try{v=JSON.parse((await body(req,8192)).toString('utf8'))}catch(e){if(e.status)throw e;deny(400)}return v}
function identity(req,s){const identity=req.headers.get('oai-authenticated-user-id'),cookies=(req.headers.get('cookie')||'').match(/(?:^|;\s*)learning=([^;]+)/g)||[];check(identity&&cookies.length===1,401);const token=cookies[0].split('learning=')[1];check(token&&token.length<=256,401);const hash=sha(token), sessions=rows(s.sessions).filter(x=>x.digest===hash&&x.identity===identity&&x.until>Date.now());check(sessions.length===1,401);const u=unique(s.users,sessions[0].person);check(u&&(u.active===true||u.active===1),401);return {u,hash}}
async function snapshot(req,ctx){const raw=await ctx.BUCKET.get(KEY);check(raw,401);const state=await raw.json(),{u,hash}=identity(req,state),url=new URL(req.url);const co=url.searchParams.getAll('company');check(co.length<=1&&[...url.searchParams.keys()].every(k=>k==='company'),400);const tc=tenantContext(state,u.id,co.length?co[0]:undefined);check(tc&&['RH/DHO','Administrador corporativo'].includes(tc.role));check(typeof raw.etag==='string'&&raw.etag&&typeof state.organization?.revision==='string'&&state.organization.revision&&Array.isArray(state.courses)&&Array.isArray(state.logs),503);const candidate=structuredClone(state);delete candidate.organization;if(candidate.tenantMediaV30===undefined)candidate.tenantMediaV30=[];check(Array.isArray(candidate.tenantMediaV30),503);return {raw,state,candidate,u,hash,company:tc.company}}
function ledger(s,id){return unique(s.tenantMediaV30,id)}
function references(s,id){return [...rows(s.courses),...rows(s.missions)].some(x=>x.upload===id||x.cover?.upload===id)||rows(s.uploads).some(x=>x.id===id)}
function owns(x,id,allowed){check(uuid(id),400);const l=ledger(x.candidate,id);check(l&&l.tenantCompanyId===x.company&&l.owner===x.u.id&&l.sessionDigest===x.hash);check(allowed.includes(l.status)&&Number.isFinite(l.expiresAt)&&l.expiresAt>Date.now(),409);check(Object.hasOwn(types,l.mime)&&l.entry===types[l.mime].entry&&digest(l.sha256)&&Number.isInteger(l.bytes)&&l.bytes>0&&l.bytes<=MAX,503);check(!references(x.state,id),409);return l}
function audit(x,event){x.candidate.logs.unshift({at:new Date().toISOString(),actorId:x.u.id,who:x.u.name||x.u.id,event:'Media piloto V30: '+event,tenantCompanyId:x.company})}
async function commit(req,ctx,x){identity(req,x.state);const saved=await ctx.BUCKET.put(KEY,JSON.stringify(x.candidate),{onlyIf:{etagMatches:x.raw.etag},requireStateEtag:x.raw.etag,requireOrganizationRevision:x.state.organization.revision});check(saved,409)}
const objectKey=l=>'files/'+l.id+'/'+l.entry
export function mediaInventory(state,company,now=Date.now()){const out={reserved:0,uploading:0,uploaded:0,attached:0,expiredUnattached:0,invalid:0};for(const l of rows(state.tenantMediaV30)){if(l.tenantCompanyId!==company)continue;if(!['reserved','uploading','uploaded','attached'].includes(l.status)){out.invalid++;continue}out[l.status]++;if(l.status!=='attached'&&l.expiresAt<=now)out.expiredUnattached++}return out}
export async function pilotMedia(req,ctx){try{
 const op=mediaRoute(req),url=new URL(req.url);check(op&&req.headers.get('origin')===url.origin);let x=await snapshot(req,ctx)
 if(op==='reserve'){
  const b=await input(req);strict(b,['mime','bytes','sha256']);check(Object.hasOwn(types,b.mime)&&Number.isInteger(b.bytes)&&b.bytes>0&&b.bytes<=MAX&&digest(b.sha256),400);
  const all=x.candidate.tenantMediaV30,own=all.filter(l=>l.tenantCompanyId===x.company);check(all.length<5000&&own.length<LIMIT&&own.filter(l=>l.owner===x.u.id&&l.status!=='attached'&&l.expiresAt>Date.now()).length<5,409);const id=randomUUID();check(!ledger(x.candidate,id)&&!references(x.state,id),409);const l={id,tenantCompanyId:x.company,owner:x.u.id,sessionDigest:x.hash,mime:b.mime,bytes:b.bytes,sha256:b.sha256,entry:types[b.mime].entry,status:'reserved',expiresAt:Date.now()+TTL};all.push(l);audit(x,'reserve');await commit(req,ctx,x);return json(201,{id,expiresAt:l.expiresAt,maxBytes:MAX})
 }
 const match=op.match(/^([a-f0-9-]{36})\/(upload|attach)$/)
 if(match&&match[2]==='upload'){
  let l=owns(x,match[1],['reserved']);check(req.headers.get('content-type')===l.mime,415);const bytes=await body(req,MAX);check(bytes.length===l.bytes&&sha(bytes)===l.sha256&&types[l.mime].valid(bytes),400)
  // Fresh authorization after receiving bytes, exclusive claim before blob insertion.
  x=await snapshot(req,ctx);l=owns(x,match[1],['reserved']);check(bytes.length===l.bytes&&sha(bytes)===l.sha256&&req.headers.get('content-type')===l.mime&&types[l.mime].valid(bytes),400);l.status='uploading';audit(x,'claim');await commit(req,ctx,x)
  // Revalidate before storage; a later race can leave a quarantined blob, never an authorized attachment.
  x=await snapshot(req,ctx);l=owns(x,match[1],['uploading']);const key=objectKey(l);check(!await ctx.BUCKET.get(key),409);const result=await ctx.BUCKET.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'}});check(result,409)
  x=await snapshot(req,ctx);l=owns(x,match[1],['uploading']);l.status='uploaded';audit(x,'upload');await commit(req,ctx,x);return json(200,{ok:true})
 }
 if(match&&match[2]==='attach'){
  const b=await input(req);strict(b,['title','minutes']);const title=cleanText(b.title,150);check(Number.isInteger(b.minutes)&&b.minutes>=1&&b.minutes<=10000,400);let l=owns(x,match[1],['uploaded']);const stored=await ctx.BUCKET.get(objectKey(l));check(stored&&Buffer.isBuffer(stored.body)&&stored.body.length===l.bytes&&sha(stored.body)===l.sha256&&types[l.mime].valid(stored.body),409);
  // Re-read authorization and require unchanged reservation/metadata before atomic attachment.
  const old=JSON.stringify(l);x=await snapshot(req,ctx);l=owns(x,match[1],['uploaded']);check(JSON.stringify(l)===old,409);const c={id:randomUUID(),tenantCompanyId:x.company,title,minutes:b.minutes,track:'Catálogo geral',description:'',type:types[l.mime].type,status:'draft',revision:1,upload:l.id,entry:l.entry,tenantMediaV30:true,updated:new Date().toISOString(),history:[{at:new Date().toISOString(),person:x.u.id,event:'created',revision:1}]};x.candidate.courses.push(c);l.status='attached';l.courseId=c.id;delete l.sessionDigest;audit(x,'attach');await commit(req,ctx,x);return json(201,{id:c.id,status:'draft'})
 }
 if(op==='inventory'){const b=await input(req);strict(b,[]);return json(200,mediaInventory(x.state,x.company))}
 deny(403)
 }catch(e){return json([400,401,403,409,413,415,503].includes(e?.status)?e.status:503,{error:'Operação de mídia indisponível ou não autorizada no piloto.'})}}
