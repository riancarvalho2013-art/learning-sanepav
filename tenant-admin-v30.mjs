/** Advanced pilot: only existing accounts, no credentials, organization writes,
 * or implicit technical access to customer content. State changes use SQLite CAS.
 */
import {createHash} from 'node:crypto'
import {resolve,basename,dirname} from 'node:path'
import {tmpdir} from 'node:os'
import {tenantContext} from './tenant-policy-v30.mjs'
import {prepareAdminMigration} from './tenant-governance-v30.mjs'
const STATE='system/state-v1',ROOT='/api/tenant/v30/admin/',TECH='Superadministrador técnico',CORP='Administrador corporativo'
const rows=x=>Array.isArray(x)?x:[],active=x=>x===true||x===1
const fail=(status=403)=>{throw Object.assign(new Error('Operação administrativa indisponível.'),{status})}
const check=(v,status=403)=>{if(!v)fail(status)}
const one=(xs,id)=>{const r=rows(xs).filter(x=>x?.id===id);return r.length===1?r[0]:null}
const home=(s,id)=>s.organization?.assignments?.get(id)?.company_id
const companyActive=(s,id)=>active(one(s.organization?.companies,id)?.active)
const json=(x,status=200)=>Response.json(x,{status,headers:{'cache-control':'private,no-store','x-content-type-options':'nosniff'}})
const roles=new Set(['RH/DHO','Diretoria','Líder','Colaborador'])
const hash=x=>createHash('sha256').update(x).digest('hex')
function auth(req,s){const id=req.headers.get('oai-authenticated-user-id');const cs=(req.headers.get('cookie')||'').match(/(?:^|;\s*)learning=([^;]+)/g)||[];check(id&&cs.length===1,401);const token=cs[0].split('learning=')[1];check(token&&token.length<=256,401);const matches=rows(s.sessions).filter(x=>x.identity===id&&x.digest===hash(token)&&x.until>Date.now());check(matches.length===1,401);const u=one(s.users,matches[0].person);check(u&&active(u.active),401);return u}
function snapshot(raw,s){check(typeof raw?.etag==='string'&&raw.etag&&typeof s.organization?.revision==='string'&&s.organization.revision&&s.organization.assignments instanceof Map,503)}
function isTechnical(s,u){return u.role===TECH&&!s.organization.assignments.has(u.id)&&!rows(s.organization.grants).some(g=>g.person_id===u.id)}
export function isAdminWriteRoute(req){return req.method==='POST'&&['role','session/revoke','account/status'].includes(new URL(req.url).pathname.slice(ROOT.length))&&new URL(req.url).pathname.startsWith(ROOT)}
export async function pilotAdminWrite(req,ctx){try{
 const url=new URL(req.url),route=url.pathname.slice(ROOT.length);check(isAdminWriteRoute(req),404);check(req.headers.get('origin')===url.origin&&req.headers.get('content-type')?.split(';')[0].trim().toLowerCase()==='application/json'&&!url.searchParams.size,400)
 const text=await req.text();check(Buffer.byteLength(text)<=4096,413);let b;try{b=JSON.parse(text)}catch{fail(400)}check(b&&typeof b==='object'&&!Array.isArray(b)&&typeof b.userId==='string'&&typeof b.companyId==='string'&&typeof b.expectedRole==='string'&&typeof b.expectedActive==='boolean',400)
 const allowed=['userId','companyId','expectedRole','expectedActive',...(route==='role'?['role']:route==='account/status'?['active']:[])];check(Object.keys(b).every(k=>allowed.includes(k)),400)
 const raw=await ctx.BUCKET.get(STATE);check(raw,401);const s=await raw.json();snapshot(raw,s);const u=auth(req,s),target=one(s.users,b.userId);check(target&&target.id!==u.id&&companyActive(s,b.companyId)&&home(s,target.id)===b.companyId&&target.role!==TECH&&target.role!=='Administrador')
 const technical=isTechnical(s,u);if(technical){check(target.role===CORP||route==='role'&&roles.has(target.role));check(route!=='role'||b.role===CORP||b.role==='Colaborador')}
 else {const tc=tenantContext(s,u.id,b.companyId);check(tc?.role===CORP&&roles.has(target.role));check(route!=='role'||roles.has(b.role))}
 check(target.role===b.expectedRole&&active(target.active)===b.expectedActive,409)
 const next=JSON.parse(JSON.stringify(s)),t=one(next.users,target.id);check(t&&Array.isArray(next.logs)&&Array.isArray(next.sessions),503)
 if(route==='role'){check(typeof b.role==='string'&&b.role!==target.role&&(roles.has(b.role)||b.role===CORP),409);if(target.role==='Líder'&&b.role!=='Líder')check(!rows(s.users).some(x=>x.manager===target.id&&active(x.active)),409);t.role=b.role}
 if(route==='account/status'){check(typeof b.active==='boolean'&&b.active!==active(target.active),409);if(!b.active)check(!rows(s.users).some(x=>x.manager===target.id&&active(x.active)),409);t.active=b.active}
 check(rows(next.users).some(x=>x.role===CORP&&active(x.active)&&home(s,x.id)===b.companyId),409)
 const prior=next.sessions.length;next.sessions=next.sessions.filter(x=>x.person!==t.id);next.logs.unshift({at:new Date().toISOString(),who:u.name||u.id,actorId:u.id,tenantCompanyId:b.companyId,event:'V30 admin '+route,targetId:t.id});auth(req,s)
 const saved=await ctx.BUCKET.put(STATE,JSON.stringify(next),{onlyIf:{etagMatches:raw.etag},requireStateEtag:raw.etag,requireOrganizationRevision:s.organization.revision});check(saved,409);return json({ok:true,revoked:prior-next.sessions.length})
 }catch(e){return json({error:'Operação administrativa indisponível.'},[400,401,403,404,409,413,503].includes(e?.status)?e.status:503)}}
/** No HTTP route: caller must be an authorized offline operator on synthetic/copy DB.
 * Refuse default DB and production. Migration is atomic, all accounts explicitly mapped.
 */
export async function applyAdminMigrationPilot(ctx,plan,{syntheticOnly=false}={}){
 const file=process.env.LEARNING_DB;check(syntheticOnly===true&&process.env.NODE_ENV==='test'&&process.env.LEARNING_TENANT_ADMIN_MIGRATION==='synthetic-only'&&typeof file==='string'&&basename(file)==='fixture.sqlite'&&dirname(dirname(resolve(file)))===resolve(tmpdir())&&basename(dirname(file)).startsWith('v30-'),403)
 const raw=await ctx.BUCKET.get(STATE);check(raw,409);const s=await raw.json();snapshot(raw,s);const next=prepareAdminMigration(raw,s,plan);check(Array.isArray(next.state.logs),503);next.state.logs.unshift({at:new Date().toISOString(),event:'V30 synthetic admin migration',count:next.summary.changed});const saved=await ctx.BUCKET.put(STATE,JSON.stringify(next.state),{onlyIf:{etagMatches:raw.etag},requireStateEtag:raw.etag,requireOrganizationRevision:s.organization.revision});check(saved,409);return {...next.summary,applied:true,syntheticOnly:true}
}
