/** V30.1B offline migration planner. No runtime authorization or production writes. */
import {createHash} from 'node:crypto'
const hash=x=>createHash('sha256').update(x).digest('hex')
const validId=x=>typeof x==='string'&&x.length>0&&x.length<=128&&x.trim()===x
const fail=code=>{throw Object.assign(new Error(code),{code})}
const check=(ok,code)=>{if(!ok)fail(code)}
const list=(s,k,optional=false)=>{const v=s[k];if(optional&&v===undefined)return [];check(Array.isArray(v),'INVALID_LIST_'+k);return v}
function index(rows){const m=new Map();for(const row of rows){check(row&&validId(row.id)&&!m.has(row.id),'INVALID_OR_DUPLICATE_ID');m.set(row.id,row)}return m}
const active=x=>x===1||x===true
const groups=['courses','missions','uploads']
export function fingerprint(raw,etag,companies,assignments){return hash(JSON.stringify([hash(raw),etag,companies,assignments]))}
function inspect(state,org){
 const all={users:index(list(state,'users')),courses:index(list(state,'courses')),missions:index(list(state,'missions',true)),uploads:index(list(state,'uploads',true)),enroll:index(list(state,'enroll')),missionEnrollments:index(list(state,'missionEnrollments',true))}
 const companies=index(org.companies),people=new Map();for(const a of org.assignments){check(validId(a.person_id)&&!people.has(a.person_id)&&companies.has(a.company_id),'INVALID_ORGANIZATION_ASSIGNMENT');people.set(a.person_id,a.company_id)}
 return {all,companies,people}
}
export function makeInventory(state,org,snapshot){
 const {all,companies,people}=inspect(state,org)
 const output={version:1,snapshot,approved:false,ownership:{},companies:[...companies.values()].map(x=>({id:x.id,name:x.name,active:active(x.active)})),review:[]}
 for(const k of groups){output.ownership[k]=[];for(const row of all[k].values()){
  output.ownership[k].push({id:row.id,companyId:row.tenantCompanyId??null})
  let evidence=[];if(k==='courses')evidence=[...all.enroll.values()].filter(e=>e.course===row.id).map(e=>people.get(e.person)??null)
  if(k==='missions')evidence=[...all.missionEnrollments.values()].filter(e=>e.mission===row.id).map(e=>people.get(e.person)??null)
  if(k==='uploads')evidence=[people.get(row.owner)??null]
  output.review.push({kind:k,id:row.id,...(k!=='uploads'?{title:row.title??''}:{}),currentOwner:row.tenantCompanyId??null,companyEvidence:[...new Set(evidence)]})
 }}
 return output
}
export function prepareMigration(state,org,snapshot,plan){
 check(plan?.version===1&&plan.snapshot===snapshot,'STALE_OR_INVALID_PLAN');check(plan.approved===true,'EXPLICIT_APPROVAL_REQUIRED')
 const {all,companies,people}=inspect(state,org), next=structuredClone(state), target=inspect(next,org).all
 const owner=id=>validId(id)&&active(companies.get(id)?.active)
 const media=new Map();const bindMedia=(id,owner,ref)=>{if(id===undefined||id===null)return;check(validId(id),'INVALID_MEDIA_ID');check(!media.has(id),'SHARED_MEDIA_REFERENCE_REVIEW_REQUIRED');media.set(id,{owner,ref})}
 const stats={courses:0,missions:0,uploads:0,enroll:0,missionEnrollments:0,mediaReferences:0}
 for(const k of groups){const entries=plan.ownership?.[k];check(Array.isArray(entries),'MISSING_OWNERSHIP_LIST');const mapped=index(entries);check(mapped.size===all[k].size,'INCOMPLETE_OR_EXTRA_PLAN_ITEMS')
  for(const [id,row] of all[k]){const c=mapped.get(id)?.companyId;check(owner(c),'EXPLICIT_ACTIVE_COMPANY_REQUIRED');check(row.tenantCompanyId==null||row.tenantCompanyId===c,'EXISTING_OWNER_CHANGE_FORBIDDEN');if(row.tenantCompanyId!==c)stats[k]++;target[k].get(id).tenantCompanyId=c}
 }
 for(const c of target.courses.values()){bindMedia(c.upload,c.tenantCompanyId,'course');bindMedia(c.cover?.upload,c.tenantCompanyId,'cover')}
 for(const m of target.missions.values()){check(Array.isArray(m.courses)&&m.courses.length>0&&new Set(m.courses).size===m.courses.length,'INVALID_MISSION_COURSES');for(const cid of m.courses)check(target.courses.get(cid)?.tenantCompanyId===m.tenantCompanyId,'CROSS_COMPANY_OR_MISSING_MISSION_COURSE');bindMedia(m.cover?.upload,m.tenantCompanyId,'mission-cover')}
 for(const u of target.uploads.values()){check(all.users.has(u.owner)&&people.get(u.owner)===u.tenantCompanyId,'PENDING_UPLOAD_OWNER_MISMATCH');bindMedia(u.id,u.tenantCompanyId,'pending')}
 const enrollmentPairs=new Set();for(const [k,ref,kind] of [['enroll','course','courses'],['missionEnrollments','mission','missions']])for(const e of target[k].values()){
  const item=target[kind].get(e[ref]),c=item?.tenantCompanyId;check(item&&all.users.has(e.person)&&owner(c),'ORPHAN_ENROLLMENT');check(people.get(e.person)===c,'CROSS_COMPANY_OR_UNASSIGNED_ENROLLMENT');check(e.tenantCompanyId==null||e.tenantCompanyId===c,'EXISTING_ENROLLMENT_OWNER_CHANGE_FORBIDDEN');const pair=JSON.stringify([k,e.person,e[ref]]);check(!enrollmentPairs.has(pair),'DUPLICATE_ENROLLMENT');enrollmentPairs.add(pair)
  if(k==='enroll'){if(e.prerequisites!==undefined){check(Array.isArray(e.prerequisites),'INVALID_PREREQUISITES');for(const cid of e.prerequisites)check(target.courses.get(cid)?.tenantCompanyId===c,'CROSS_COMPANY_OR_MISSING_PREREQUISITE')}if(e.originMission!==undefined&&e.originMission!==null&&e.originMission!==''){const m=target.missions.get(e.originMission);check(m?.tenantCompanyId===c&&m.courses.includes(e.course),'INVALID_OR_CROSS_COMPANY_ORIGIN_MISSION')}}
  if(e.tenantCompanyId!==c)stats[k]++;e.tenantCompanyId=c
 }
 stats.mediaReferences=media.size
 return {state:next,summary:{changes:stats,legacyAdministrators:state.users.filter(u=>u.role==='Administrador'&&active(u.active)).length,unassignedActiveUsers:state.users.filter(u=>active(u.active)&&!owner(people.get(u.id))).length,physicalMediaVerified:false,runtimeIsolationEnabled:false}}
}
