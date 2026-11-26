/** V30.1: pure policy and migration preflight. Not connected to HTTP yet.
 * Inputs must be obtained from authenticated server state; never from a request body.
 * A historical creator or enrolment is evidence for review, not proof of ownership.
 */
const rows = x => Array.isArray(x) ? x : []
const id = x => typeof x === 'string' && x.trim() === x && x.length > 0 && x.length <= 128
const active = x => x === true || x === 1
const corporate = new Set(['Administrador corporativo','RH/DHO','Diretoria','Líder','Colaborador'])
const managers = new Set(['Administrador corporativo','RH/DHO'])
const validCompany = (org,c) => id(c) && rows(org?.companies).filter(x=>x.id===c && active(x.active)).length===1
const personCompany = (org,p) => org?.assignments instanceof Map ? org.assignments.get(p)?.company_id : undefined
function unique(items,key){const found=rows(items).filter(x=>x?.id===key);return found.length===1?found[0]:null}
export function tenantContext(state,authenticatedUserId,requestedCompany){
 const user=unique(state?.users,authenticatedUserId),org=state?.organization
 if(!user||!active(user.active)||!corporate.has(user.role))return null
 const home=personCompany(org,user.id)
 if(!validCompany(org,home))return null
 // Existing company_access grants predate SaaS tenant boundaries. Do not trust
 // them across companies until an explicit group/customer model has been approved.
 const permitted=new Set([home])
 // Omitted company is the authenticated user's own; invalid explicit scope is denied.
 const company=requestedCompany===undefined?home:requestedCompany
 if(!permitted.has(company))return null
 return Object.freeze({userId:user.id,role:user.role,company,home})
}
export function canManageLearning(state,userId,company,item){
 const ctx=tenantContext(state,userId,company)
 return Boolean(ctx&&managers.has(ctx.role)&&item&&item.tenantCompanyId===ctx.company&&validCompany(state.organization,item.tenantCompanyId))
}
export function canReadCourseMetadata(state,userId,company,course){
 const ctx=tenantContext(state,userId,company)
 if(!ctx||!course||unique(state.courses,course.id)!==course||course.tenantCompanyId!==ctx.company)return false
 return canManageLearning(state,userId,company,course)||(course.status||'published')==='published'
}
export function canReadCourseMaterial(state,userId,company,course,enrollmentId){
 const ctx=tenantContext(state,userId,company)
 if(!ctx||!course||unique(state.courses,course.id)!==course||course.tenantCompanyId!==ctx.company)return false
 if(enrollmentId===undefined&&canManageLearning(state,userId,company,course))return true
 const e=unique(state.enroll,enrollmentId)
 if(!e||rows(state.enroll).filter(x=>x.person===ctx.userId&&x.course===course.id).length!==1||e.person!==ctx.userId||e.course!==course.id||e.tenantCompanyId!==ctx.company||ctx.home!==ctx.company||!['published','archived'].includes(course.status||'published')||(e.prerequisites!==undefined&&!Array.isArray(e.prerequisites)))return false
 return rows(e.prerequisites).every(cid=>{
  const prior=unique(state.courses,cid)
  const found=rows(state.enroll).filter(x=>x.person===ctx.userId&&x.course===cid);return prior?.tenantCompanyId===ctx.company&&found.length===1&&unique(state.enroll,found[0].id)===found[0]&&found[0].tenantCompanyId===ctx.company&&found[0].progress===100
 })
}
export function canAssignCourse(state,userId,company,course,recipientId){
 const ctx=tenantContext(state,userId,company),person=unique(state.users,recipientId)
 // Leaders retain their legacy team-specific authority only after a separate hierarchy check is integrated.
 return Boolean(ctx&&course&&unique(state.courses,course.id)===course&&canManageLearning(state,userId,company,course)&&(course.status||'published')==='published'&&person&&active(person.active)&&personCompany(state.organization,person.id)===ctx.company)
}
export function canManageMission(state,userId,company,mission){
 return Boolean(canManageLearning(state,userId,company,mission)&&rows(mission.courses).length>0&&new Set(mission.courses).size===mission.courses.length&&mission.courses.every(cid=>canManageLearning(state,userId,company,unique(state.courses,cid))))
}
/** No writes. The report never exposes personal identifiers, course titles, content, tokens or file paths. */
export function inspectLegacyOwnership(state){
 const org=state?.organization
 if(!(org?.assignments instanceof Map)||!Array.isArray(org.companies)||!Array.isArray(state?.courses)||!Array.isArray(state?.users)||!Array.isArray(state?.enroll))throw new Error('Snapshot organizacional incompleto.')
 const items={course:rows(state.courses),mission:rows(state.missions)}
 const count={courses:items.course.length,missions:items.mission.length,enrollments:state.enroll.length,missionEnrollments:rows(state.missionEnrollments).length,uploads:rows(state.uploads).length,legacyAdmins:state.users.filter(u=>u.role==='Administrador'&&active(u.active)).length,unassignedPeople:state.users.filter(u=>active(u.active)&&!validCompany(org,personCompany(org,u.id))&&!(u.role==='Superadministrador técnico'&&!org.assignments.has(u.id)&&!rows(org.grants).some(g=>g.person_id===u.id))).length}
 const findings={missingOwner:0,invalidOwner:0,multipleCompanyEvidence:0,unknownEvidence:0,singleCompanyEvidence:0,noEvidence:0,duplicateOrInvalidIds:0,orphanEnrollment:0,crossCompanyEnrollment:0,unboundEnrollment:0,orphanMissionEnrollment:0,crossCompanyMissionEnrollment:0,unboundMissionEnrollment:0,invalidMissionCourses:0,mixedMissionOwners:0,unboundMissionCourses:0,sharedMediaReferences:0,pendingUnboundUploads:0,invalidPendingUpload:0}
 const fileRefs=new Map()
 const checkIdList=list=>{const seen=new Set();for(const x of list){if(!id(x?.id)||seen.has(x.id))findings.duplicateOrInvalidIds++;seen.add(x?.id)}}
 for(const list of [...Object.values(items),state.users,state.enroll,rows(state.missionEnrollments),rows(state.uploads)])checkIdList(list)
 function evidence(people){const known=new Set();let unknown=false;for(const personId of people){const c=personCompany(org,personId);if(unique(state.users,personId)&&validCompany(org,c))known.add(c);else unknown=true}if(unknown)findings.unknownEvidence++;if(known.size>1)findings.multipleCompanyEvidence++;else if(known.size===1)findings.singleCompanyEvidence++;else findings.noEvidence++}
 function media(kind,item){for(const [slot,key] of [['material',item.upload],['cover',item.cover?.upload]]){if(!id(key))continue;const existing=fileRefs.get(key)||new Set();existing.add(kind+':'+item.id+':'+slot);fileRefs.set(key,existing)}}
 for(const [kind,list] of Object.entries(items))for(const item of list){
  if(!id(item.tenantCompanyId))findings.missingOwner++;else if(!validCompany(org,item.tenantCompanyId))findings.invalidOwner++
  const people=kind==='course'?state.enroll.filter(e=>e.course===item.id).map(e=>e.person):rows(state.missionEnrollments).filter(e=>e.mission===item.id).map(e=>e.person)
  evidence(people);media(kind,item)
  if(kind==='mission'){
   const children=rows(item.courses).map(cid=>unique(state.courses,cid))
   if(!children.length||children.includes(null)||new Set(item.courses).size!==children.length)findings.invalidMissionCourses++
   if(children.some(c=>!validCompany(org,c?.tenantCompanyId)))findings.unboundMissionCourses++
   if(children.some(c=>validCompany(org,c?.tenantCompanyId)&&validCompany(org,item.tenantCompanyId)&&c.tenantCompanyId!==item.tenantCompanyId))findings.mixedMissionOwners++
  }
 }
 for(const e of state.enroll){const c=unique(items.course,e.course),p=unique(state.users,e.person);if(!c||!p){findings.orphanEnrollment++;continue}if(!validCompany(org,e.tenantCompanyId)||!validCompany(org,c.tenantCompanyId))findings.unboundEnrollment++;else if(e.tenantCompanyId!==c.tenantCompanyId||personCompany(org,p.id)!==e.tenantCompanyId)findings.crossCompanyEnrollment++}
 for(const e of rows(state.missionEnrollments)){const m=unique(items.mission,e.mission),p=unique(state.users,e.person);if(!m||!p){findings.orphanMissionEnrollment++;continue}if(!validCompany(org,e.tenantCompanyId)||!validCompany(org,m.tenantCompanyId))findings.unboundMissionEnrollment++;else if(e.tenantCompanyId!==m.tenantCompanyId||personCompany(org,p.id)!==e.tenantCompanyId)findings.crossCompanyMissionEnrollment++}
 for(const u of rows(state.uploads)){if(!unique(state.users,u.owner)||fileRefs.has(u.id))findings.invalidPendingUpload++;if(!validCompany(org,u.tenantCompanyId)||personCompany(org,u.owner)!==u.tenantCompanyId)findings.pendingUnboundUploads++}
 findings.sharedMediaReferences=[...fileRefs.values()].filter(x=>x.size>1).length
 const evidenceOnly=new Set(['singleCompanyEvidence','noEvidence','multipleCompanyEvidence','unknownEvidence'])
 return {counts:count,findings,structuralChecksPass:count.legacyAdmins===0&&count.unassignedPeople===0&&Object.entries(findings).every(([k,v])=>evidenceOnly.has(k)||v===0),runtimeIsolationEnabled:false}
}
