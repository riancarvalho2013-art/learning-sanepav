import {hashPassword,verifyPassword} from './credentials.mjs'
import {recoveryConfigured} from './recovery.mjs'
import {ASSETS} from './assets.mjs'
import {courseStatus,courseRevision,requirePublished,checkCourseRevision,stampCourse,changeCourseState,missingPrerequisites,requireLearningAccess} from './learning.mjs'
const pulseContexts=["Orgulho do time", "Metas claras", "Semana muito produtiva", "Apoio de alguém", "Carga de trabalho alta", "Falta de clareza", "Metas pouco claras", "Problemas pessoais", "Precisando de apoio"];
const stateKey='system/state-v1'
const roles=['Administrador','Líder','Colaborador','RH/DHO','Diretoria']
const kinds=['OKR','PDI','1:1','Feedback','Elogio','Pulse','Desempenho']
const types=['Leitura','Vídeo','Áudio','PDF','Imagem','Apresentação','Documento','Link','SCORM','Questionário']
const id=()=>crypto.randomUUID()
const iso=()=>new Date().toISOString()
const requireOk=(ok,message,status=400)=>{if(!ok)throw Object.assign(new Error(message),{status})}
const str=(v,max=300)=>String(v??'').trim().slice(0,max)
const number=(v,min,max)=>{const n=Number(v);requireOk(v!==''&&v!=null&&Number.isFinite(n)&&n>=min&&n<=max,'Valor fora da faixa.');return n}
const hex=a=>Array.from(new Uint8Array(a),x=>x.toString(16).padStart(2,'0')).join('')
const hash=async v=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))
const password=hashPassword
function initial(){return {users:[],sessions:[],logs:[],courses:[],enroll:[],records:[],uploads:[],fails:{},theme:{color:'#062b4f',accent:'#94c928',title:'Learning Sanepav',layout:'Confortável'}}}
async function change(env,fn){
 for(let i=0;i<8;i++){const obj=await env.BUCKET.get(stateKey),s=obj?await obj.json():initial();const result=await fn(s)
 const saved=await env.BUCKET.put(stateKey,JSON.stringify(s),{onlyIf:obj?{etagMatches:obj.etag}:{etagDoesNotMatch:'*'},organizationAssignment:s.pendingOrganizationAssignment})
 if(saved)return result}
 requireOk(false,'Os dados mudaram. Tente novamente.',409)
}
function audit(s,u,event){s.logs.unshift({at:iso(),who:u?.name||'Acesso',event});if(s.logs.length>5000)s.logs.pop()}
function organizationGroup(s,u){
 if(!s.organization)return s.users.filter(person=>person.id===u.id)
 const {assignments,grants,companies}=s.organization
 const activeCompanies=new Set(companies.map(company=>company.id))
 if(u.role==='Administrador')return s.users
 const own=assignments.get(u.id)
 const allowed=new Set(own&&activeCompanies.has(own.company_id)?[own.company_id]:[])
 if(['RH/DHO','Diretoria'].includes(u.role)){
  for(const grant of grants)if(grant.person_id===u.id&&activeCompanies.has(grant.company_id))allowed.add(grant.company_id)
  return s.users.filter(person=>person.id===u.id||allowed.has(assignments.get(person.id)?.company_id))
 }
 const ids=new Set([u.id])
 if(u.role==='Líder')for(let i=0;i<s.users.length;i++){
  const previous=ids.size
  for(const person of s.users){
   const company=assignments.get(person.id)?.company_id||null
   if(ids.has(person.manager)&&company===(own?.company_id||null)&&(!company||activeCompanies.has(company)))ids.add(person.id)
  }
  if(ids.size===previous)break
 }
 return s.users.filter(person=>ids.has(person.id))
}
function group(state,user){
 const people=organizationGroup(state,user)
 if(!state.requestCompany)return people
 return people.filter(person=>state.organization?.assignments.get(person.id)?.company_id===state.requestCompany)
}
const clean=({salt,digest,iterations,...p})=>p
function sameOrganization(state,user,personId){
 if(user.id===personId)return true
 const organization=state.organization
 if(!organization)return false
 const own=organization.assignments.get(user.id)?.company_id||null
 const target=organization.assignments.get(personId)?.company_id||null
 if(own===target)return !own||organization.companies.some(company=>company.id===own)
 return ['RH/DHO','Diretoria'].includes(user.role)&&organization.companies.some(company=>company.id===target)&&organization.grants.some(grant=>grant.person_id===user.id&&grant.company_id===target)
}
function assertLearning(user){requireOk(['Administrador','RH/DHO'].includes(user.role),'Acesso restrito à gestão de aprendizagem.',403)}
function canReadPrivateRecord(record,user){
 if(record.kind==='Pulse')return record.person===user.id
 if(['Feedback','1:1'].includes(record.kind))return record.person===user.id||record.author===user.id
 return true
}
function view(s,u){
 const people=group(s,u),ids=new Set(people.map(p=>p.id)),admin=u.role===roles[0],enroll=s.enroll.filter(e=>ids.has(e.person))
 const pulses=(s.pulses||[]).filter(p=>admin||p.people.some(id=>ids.has(id))).map(p=>{
   const people=p.people.filter(id=>ids.has(id))
   const allowed=new Set(people)
   const responses=s.records.filter(r=>r.kind==='Pulse'&&r.pulse===p.id&&allowed.has(r.person))
   const mean=['Líder','RH/DHO','Diretoria'].includes(u.role)&&responses.length>=7
     ? Math.round(responses.reduce((sum,item)=>sum+item.rating,0)/responses.length*10)/10 : undefined
   return {...p,people,responseCount:responses.length,averageRating:mean}
 })
 const mine = new Set(enroll.filter(e=>e.person===u.id).map(e=>e.course))
 const missionEnrollments=(s.missionEnrollments||[]).filter(item=>ids.has(item.person))
 const missions = (s.missions||[]).filter(m=>['Administrador','RH/DHO'].includes(u.role)||missionEnrollments.some(item=>item.person===u.id&&item.mission===m.id)||(m.sequential===undefined||m.legacyVisibility===true)&&m.courses.every(course=>mine.has(course)))
 const recent = Date.now()-30*86400000
 const platform = admin ? {
   auditEvents:s.logs.length,
   privateFeedbackCount:s.records.filter(record=>record.kind==='Feedback').length,
   publicPraiseCount:s.records.filter(record=>record.kind==='Elogio').length,
   emailConfigured:Boolean(emailSettings()),
   logins30:s.logs.filter(row=>row.event==='Entrada na plataforma'&&Date.parse(row.at)>=recent).length,
   refused30:s.logs.filter(row=>row.event==='Tentativa de acesso recusada'&&Date.parse(row.at)>=recent).length,
   activeSessions:s.sessions.filter(session=>session.until>Date.now()).length,
   socialPosts:(s.socialPosts||[]).length,
   socialComments:(s.socialPosts||[]).reduce((count,post)=>count+post.comments.length,0),
   socialReactions:(s.socialPosts||[]).reduce((count,post)=>count+Object.keys(post.reactions).length,0)
 } : undefined
 const names=new Map(s.users.map(person=>[person.id,person.name]))
 const praise=s.records.filter(record=>record.kind==='Elogio'&&sameOrganization(s,u,record.person)&&sameOrganization(s,u,record.author)).map(record=>({
   id:record.id,title:record.title,note:record.note,updated:record.updated,
   recipient:names.get(record.person)||'Colaborador',sender:names.get(record.author)||'Colaborador',
   editable:record.author===u.id,recipientId:record.author===u.id?record.person:undefined
 }))
 const praiseRecipients=s.users.filter(person=>person.active&&sameOrganization(s,u,person.id)).map(person=>[person.id,person.name])
 const sentFeedback=s.records.filter(record=>record.kind==='Feedback'&&record.author===u.id&&record.person!==u.id&&sameOrganization(s,u,record.person))
   .map(record=>({...record,recipient:names.get(record.person)||'Colaborador'}))
 return {missions,missionEnrollments,platform,praise,praiseRecipients,sentFeedback,me:clean(u),theme:s.theme,people:people.map(clean),courses:s.courses.filter(c=>['Administrador','RH/DHO'].includes(u.role)||courseStatus(c)!=='draft'&&enroll.some(e=>e.course===c.id)).map(({answer,history,...c})=>{const blockedBy=missingPrerequisites(s,s.enroll.find(e=>e.course===c.id&&e.person===u.id));if(blockedBy.length&&!['Administrador','RH/DHO'].includes(u.role))for(const key of ['body','url','options','entry'])delete c[key];return {...c,status:courseStatus(c),revision:courseRevision(c),blockedBy,...(['Administrador','RH/DHO'].includes(u.role)?{history}: {})}}),enroll:enroll.map(({cmi,...e})=>e),records:s.records.filter(r=>(u.role==='Diretoria'||u.role==='Administrador')&&r.person!==u.id?false:['Feedback','Pulse'].includes(r.kind)?r.person===u.id:r.kind!=='Elogio'&&ids.has(r.person)&&canReadPrivateRecord(r,u)),pulses,logs:admin?s.logs.filter(row=>row.event!=='Registro de Pulse atualizado').slice(0,200):[]}
}
function starter(s,u){const c={id:id(),title:'Boas-vindas à Sanepav',type:'Leitura',track:'DNA do Desenvolvimento',body:'Sua integração começa com as pessoas. Conheça seu padrinho, converse com sua liderança e identifique os canais de apoio de Departamento Pessoal, DHO, SST e TI.\n\nNa primeira conversa com seu gestor, alinhe as prioridades da semana e registre uma ação no seu PDI.',minutes:5};s.courses.push(c);s.enroll.push({id:id(),person:u.id,course:c.id,progress:0})}
const response=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store',...headers}})
function assertAdmin(u){requireOk(u.role===roles[0],'Acesso restrito à administração.',403)}
function member(s,u,p){requireOk(group(s,u).some(x=>x.id===p),'Pessoa fora da sua hierarquia.',403)}
const filePath=v=>typeof v==='string'&&v.length<350&&!v.startsWith('/')&&!v.includes('\\')&&!v.includes(':')&&v.split('/').every(t=>t&&t!=='.'&&t!=='..'&&!/[\u0000-\u001f?#]/.test(t))
function logSession(s,u,digest,identity){s.sessions=s.sessions.filter(x=>x.until>Date.now());s.sessions.push({digest,person:u.id,identity,until:Date.now()+8*3600000});audit(s,u,'Entrada na plataforma')}
function actor(s,digest,identity){const t=s.sessions.find(x=>x.digest===digest&&x.identity===identity&&x.until>Date.now());const u=s.users.find(p=>p.id===t?.person&&p.active);requireOk(u,'Entre para continuar.',401);return u}
const coverPath = /^cover\.(png|jpe?g|webp|gif)$/i
function takeCover(s,u,cover){
 if(!cover)return undefined
 const pending=s.uploads.find(x=>x.id===cover.upload&&x.owner===u.id)
 requireOk(pending&&coverPath.test(cover.entry)&&pending.paths.includes(cover.entry),'Envie uma imagem de capa válida.')
 s.uploads=s.uploads.filter(x=>x!==pending)
 return {upload:pending.id,entry:cover.entry}
}
function notify(state,recipient,page,title,subject,{target,due}={}) {
  const inbox=state.notifications??={}
  const items=inbox[recipient]??=[]
  items.unshift({id:id(),page,title,subject:str(subject,150),target,due,at:iso(),read:false})
  if(items.length>100)items.length=100
}
function listNotifications(state,recipient) {
  const items=state.notifications?.[recipient]||[]
  const reminders=deadlineNotifications(state,recipient)
  return [...reminders,...[...items,...legacyNotifications(state,recipient,items)]
    .sort((a,b)=>b.at.localeCompare(a.at))].slice(0,100)
}
const deadlineKinds=['PDI','1:1','OKR','Desempenho']
const dateInSaoPaulo=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'})
const saoPauloDate=(now=new Date())=>dateInSaoPaulo.format(now)
function validDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false
  const parsed=new Date(value+'T00:00:00Z')
  return Number.isFinite(+parsed)&&parsed.toISOString().slice(0,10)===value
}
function shiftDate(date,days){
  const value=new Date(date+'T00:00:00Z')
  value.setUTCDate(value.getUTCDate()+days)
  return value.toISOString().slice(0,10)
}
function pulseWindow(today){
  const weekday=new Date(today+'T00:00:00Z').getUTCDay()
  const monday=shiftDate(today,-((weekday+6)%7))
  return {friday:shiftDate(monday,4),sunday:shiftDate(monday,6)}
}
function answeredWeeklyPulse(state,recipient,week){
  return state.records.some(record=>record.kind==='Pulse'&&record.person===recipient&&!record.pulse&&record.date>=week.friday&&record.date<=week.sunday)
}
function deadlineNotifications(state,recipient,now=new Date()){
  const today=saoPauloDate(now)
  const reads=state.reminderReads?.[recipient]||{}
  const reminders=[]
  const add=(id,page,title,subject,date,target)=>reminders.push({
    id,page,title,subject,target,at:date+'T12:00:00-03:00',read:Boolean(reads[id])
  })
  const week=pulseWindow(today)
  if(today>=week.friday&&!answeredWeeklyPulse(state,recipient,week)){
    add('week-'+week.friday,'Pulse','Seu Pulse semanal está aberto','Responda até domingo',week.friday)
  }
  for(const record of state.records){
    if(!deadlineKinds.includes(record.kind)||(record.person!==recipient&&record.author!==recipient)||
      record.status==='Concluído'||!validDate(record.date)||record.date>shiftDate(today,3))continue
    const overdue=record.date<today
    add('deadline-'+record.id+'-'+record.date+(overdue?'-late':''),record.kind,
      record.kind+(overdue?' · prazo vencido':' · prazo próximo'),record.title,record.date,record.id)
  }
  for(const survey of state.pulses||[]){
    if(survey.date<today||survey.date>shiftDate(today,3)||!survey.people.includes(recipient)||
      state.records.some(record=>record.pulse===survey.id&&record.person===recipient))continue
    add('survey-'+survey.id+'-'+survey.date,'Pulse','Pesquisa Pulse perto do prazo',survey.title,survey.date,survey.id)
  }
  for(const enrollment of state.enroll){
    if(enrollment.person!==recipient||enrollment.progress===100||!validDate(enrollment.due)||enrollment.due>shiftDate(today,3))continue
    const overdue=enrollment.due<today
    const course=state.courses.find(item=>item.id===enrollment.course)
    if(course)add('course-'+enrollment.id+'-'+enrollment.due+(overdue?'-late':''),'Catálogo LMS',
      overdue?'Curso com prazo vencido':'Curso perto do prazo',course.title,enrollment.due,course.id)
  }
  return reminders.sort((a,b)=>a.at.localeCompare(b.at)).slice(0,100)
}
function legacyNotifications(state,recipient,items) {
  const seen=state.legacyNotificationReads?.[recipient]||{}
  return state.records.filter(record=>record.person===recipient&&record.author!==recipient&&
    !record.notifyDelivered&&['Feedback','Elogio'].includes(record.kind)&&
    !items.some(item=>item.page===record.kind&&item.subject===record.title))
    .map(record=>({id:'history-'+record.id,page:record.kind,title:recordNotification(record.kind,false),
      subject:record.title,at:record.updated||'1970-01-01T00:00:00.000Z',read:Boolean(seen['history-'+record.id])}))
}
function recordNotification(kind,editing) {
  const labels={
    OKR:['Novo OKR','OKR atualizado'],
    PDI:['Nova ação de PDI','Ação de PDI atualizada'],
    '1:1':['Nova conversa 1:1','Conversa 1:1 atualizada'],
    Feedback:['Você recebeu um feedback','Feedback atualizado'],
    Elogio:['Você recebeu um elogio','Elogio atualizado'],
    Desempenho:['Nova avaliação de desempenho','Avaliação de desempenho atualizada']
  }
  return labels[kind][editing?1:0]
}

const courseExtensions={
 'Vídeo':['mp4','webm'], 'Áudio':['mp3','ogg','wav','m4a'], 'Imagem':['png','jpg','jpeg','webp','gif'],
 PDF:['pdf'], SCORM:['html','htm'], 'Apresentação':['pptx','ppt'], Documento:['docx','xlsx','csv','txt']
}
function takeCourseMaterial(state,user,course,body){
 const pending=state.uploads.find(item=>item.id===body.upload&&item.owner===user.id)
 const extension=String(body.entry||'').split('.').at(-1).toLowerCase()
 requireOk(pending&&filePath(body.entry)&&pending.paths.includes(body.entry)&&courseExtensions[course.type]?.includes(extension),
   'Envie um arquivo compatível com o formato do curso.')
 course.upload=pending.id
 course.entry=body.entry
 state.uploads=state.uploads.filter(item=>item!==pending)
}
function update(s,u,op,b){
 const admin=u.role===roles[0],manager=['Líder','RH/DHO'].includes(u.role)||admin
 if(op==='theme'){assertAdmin(u);requireOk(/^#[0-9a-f]{6}$/i.test(b.color)&&/^#[0-9a-f]{6}$/i.test(b.accent)&&str(b.title)&&['Compacto','Confortável'].includes(b.layout),'Confira a identidade visual.');s.theme={color:b.color,accent:b.accent,title:str(b.title,50),layout:b.layout}}
 else if(op==='user'){assertAdmin(u);let p=s.users.find(x=>x.id===b.id);requireOk(!b.id||p,'Usuário inexistente.');const email=str(b.email).toLowerCase();requireOk(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&str(b.name)&&roles.includes(b.role),'Confira nome, e-mail e perfil.');requireOk(!s.users.some(x=>x!==p&&x.email===email),'E-mail já cadastrado.',409)
 const mgr=s.users.find(x=>x.id===b.manager);requireOk(!b.manager||mgr&&mgr.active&&mgr.role!==roles[2],'Liderança inválida.');let parent=mgr;while(parent){requireOk(parent!==p,'A hierarquia não pode formar um ciclo.');parent=s.users.find(x=>x.id===parent.manager)}
 requireOk(!p||p.id!==u.id||(b.active&&b.role===roles[0]),'Preserve seu acesso administrativo.');requireOk(!p||!s.users.some(x=>x.manager===p.id)||(b.active&&b.role!==roles[2]),'Reatribua os subordinados antes desta alteração.')
 if(!p){requireOk(b.secret,'Informe a senha inicial.');p={id:id()};s.users.push(p)}Object.assign(p,{name:str(b.name,90),role:b.role,email,active:!!b.active,manager:b.manager||'',area:str(b.area,80)},b.secret||{})
 if(b.secret||!p.active)s.sessions=s.sessions.filter(x=>x.person!==p.id)
 if(Object.hasOwn(b,'organization')){
  requireOk(b.organization&&typeof b.organization==='object'&&!Array.isArray(b.organization),'Confira o vínculo profissional.')
  Object.defineProperty(s,'pendingOrganizationAssignment',{value:{actorId:u.id,body:{...b.organization,person_id:p.id}}})
 }
 }
 else if(op==='course'){assertLearning(u);requireOk(types.includes(b.type)&&str(b.title),'Informe título e formato.');let c={id:id(),title:str(b.title,150),type:b.type,track:str(b.track,100)||'Catálogo geral',minutes:number(b.minutes,1,10000),body:str(b.body,24000)}
 if(Object.hasOwn(courseExtensions,c.type))takeCourseMaterial(s,u,c,b)
 if(c.type==='Link'){requireOk(/^https:\/\//i.test(b.url),'Informe um endereço HTTPS.');c.url=str(b.url,2000)}
 if(c.type==='Leitura')requireOk(c.body,'Escreva o conteúdo.')
 if(c.type==='Questionário'){requireOk(c.body&&Array.isArray(b.options)&&b.options.length>=2&&b.options.length<=8,'Informe pergunta e alternativas.');c.options=b.options.map(x=>str(x));requireOk(c.options.every(Boolean),'Alternativa vazia.');c.answer=number(b.answer,0,c.options.length-1)}
 c.description=str(b.description,500)
 c.cover=takeCover(s,u,b.cover)
 c.status='draft';stampCourse(c,u,'created')
 s.courses.push(c)}
 else if(op==='courseEdit'){
   assertLearning(u)
   const course=s.courses.find(c=>c.id===b.id)
   requireOk(course&&str(b.title),'Selecione um curso e informe um título.')
   checkCourseRevision(course,b.revision)
   if(b.upload)takeCourseMaterial(s,u,course,b)
   Object.assign(course,{title:str(b.title,150),track:str(b.track,100)||'Catálogo geral',description:str(b.description,500),minutes:number(b.minutes,1,10000),cover:takeCover(s,u,b.cover)||course.cover})
   if(course.type==='Leitura'&&Object.hasOwn(b,'body')){requireOk(str(b.body,24000),'Escreva o conteúdo.');course.body=str(b.body,24000)}
   if(course.type==='Link'&&Object.hasOwn(b,'url')){requireOk(/^https:\/\//i.test(b.url),'Informe um endereço HTTPS.');course.url=str(b.url,2000)}
   stampCourse(course,u,'edited')
 }
 else if(op==='courseState'){assertLearning(u);changeCourseState(s.courses.find(c=>c.id===b.id),u,b)}
 else if(op==='mission'){
   assertLearning(u)
   const missions=s.missions??=[]
   const mission=b.id?missions.find(m=>m.id===b.id):{id:id()}
   if(b.id){requireOk(mission,'Missão inexistente.',404);requireOk(Number.isSafeInteger(b.revision)&&b.revision===(mission.revision||0),'A trilha mudou. Atualize a página.',409)}
   requireOk(mission&&str(b.title)&&Array.isArray(b.courses)&&b.courses.length>0&&b.courses.length<=30,'Informe um título e selecione de 1 a 30 cursos.')
   requireOk(new Set(b.courses).size===b.courses.length&&b.courses.every(cid=>s.courses.some(c=>c.id===cid)),'Selecione cursos válidos, sem repetir etapas.')
   requireOk(b.sequential===undefined||typeof b.sequential==='boolean','Informe uma ordem de estudo válida.')
   const sequential=b.sequential===true
   if(b.id&&mission.sequential===undefined)mission.legacyVisibility=true
   if((s.missionEnrollments||[]).some(item=>item.mission===mission.id))requireOk(JSON.stringify(b.courses)===JSON.stringify(mission.courses)&&sequential===Boolean(mission.sequential),'Uma trilha atribuída preserva sua sequência. Crie outra trilha para uma nova estrutura.',409)
   Object.assign(mission,{title:str(b.title,150),description:str(b.description,800),courses:b.courses,sequential,revision:(mission.revision||0)+1,updated:iso(),cover:takeCover(s,u,b.cover)||mission.cover})
   if(!b.id)missions.push(mission)
 }
 else if(op==='missionAssign'){
   assertLearning(u)
   const mission=(s.missions||[]).find(m=>m.id===b.id)
   const recipients=Array.isArray(b.people)?b.people:[b.person]
   const allowed=new Set(group(s,u).filter(person=>person.active).map(person=>person.id))
   requireOk(mission&&recipients.length>0&&recipients.length<=200&&new Set(recipients).size===recipients.length&&recipients.every(person=>allowed.has(person)),'Selecione uma trilha e pessoas ativas no seu escopo.')
   for(const course of mission.courses)requirePublished(s.courses.find(c=>c.id===course))
   const due=b.date||''
   requireOk(!due||validDate(due),'Informe um prazo válido para a trilha.')
   for(const person of recipients){
    const assignments=s.missionEnrollments??=[]
    if(assignments.some(item=>item.mission===mission.id&&item.person===person))continue
    mission.courses.forEach((course,index)=>{
     if(!s.enroll.some(e=>e.course===course&&e.person===person))s.enroll.push({id:id(),person,course,progress:0,due,
      originMission:mission.id,prerequisites:mission.sequential?mission.courses.slice(0,index):[]})
    })
    assignments.push({id:id(),mission:mission.id,person,due,assigned:iso(),author:u.id})
    if(person!==u.id)notify(s,person,'Missões','Nova trilha atribuída',mission.title,{target:mission.id,due})
   }
 }
 else if(op==='assign'){requireOk(manager,'Permissão insuficiente.',403);member(s,u,b.person);requireOk(s.courses.some(c=>c.id===b.course)&&(admin||u.role==='RH/DHO'||s.enroll.some(e=>e.course===b.course&&group(s,u).some(p=>p.id===e.person))),'Curso indisponível.');requirePublished(s.courses.find(c=>c.id===b.course));requireOk(!s.enroll.some(e=>e.course===b.course&&e.person===b.person),'Matrícula já existe.',409);const due=b.date||''
 requireOk(!due||validDate(due),'Informe um prazo válido para o curso.')
 s.enroll.push({id:id(),person:b.person,course:b.course,progress:0,due});if(b.person!==u.id)notify(s,b.person,'Catálogo LMS','Novo curso atribuído',s.courses.find(c=>c.id===b.course).title,{target:b.course,due})}
 else if(op==='progress'){const e=s.enroll.find(e=>e.id===b.id&&e.person===u.id);requireOk(e,'Matrícula indisponível.',403);requireLearningAccess(s,e);const c=s.courses.find(c=>c.id===e.course);requireOk(c&&courseStatus(c)!=='draft','Curso indisponível.',403);let progress=number(b.progress,0,100)
 if(c.type==='Questionário'){const correct=b.answer!=null&&Number(b.answer)===c.answer;e.score=correct?100:0;progress=correct?100:1}
 if(c.type==='SCORM'){requireOk(b.cmi&&JSON.stringify(b.cmi).length<90000,'Estado SCORM inválido.');e.cmi=Object.fromEntries(Object.entries(b.cmi).filter(([k,v])=>k.startsWith('cmi.')&&typeof v==='string'));const raw=e.cmi['cmi.score.raw']??e.cmi['cmi.core.score.raw'];if(raw!=null&&Number.isFinite(Number(raw)))e.score=Number(raw);progress=['completed','passed'].includes(e.cmi['cmi.core.lesson_status'])||e.cmi['cmi.completion_status']==='completed'?100:Math.min(99,Math.max(1,Math.round(Number(e.cmi['cmi.progress_measure']||0)*100)||1))}
 e.progress=Math.max(e.progress,progress);e.updated=iso();if(e.progress===100&&!e.completed)e.completed=e.updated
 }
 else if(op==='pulse'){requireOk(['Líder','RH/DHO'].includes(u.role),'Permissão insuficiente.',403);requireOk(str(b.title)&&validDate(b.date)&&b.date>=saoPauloDate(),'Informe pergunta e prazo válido.');const people=group(s,u).filter(p=>p.active&&(!b.person||p.id===b.person)).map(p=>p.id);requireOk(people.length,'Público vazio.');const pulse={id:id(),title:str(b.title,150),date:b.date,people,author:u.id};(s.pulses??=[]).push(pulse);for(const recipient of people)notify(s,recipient,'Pulse','Nova pesquisa de Pulse',pulse.title,{target:pulse.id,due:pulse.date});audit(s,u,'Pesquisa pulse publicada');return}
 else if(op==='record'){
 if(b.kind==='Elogio')requireOk(s.users.some(person=>person.id===b.person&&person.active&&sameOrganization(s,u,person.id))&&b.person!==u.id,'Escolha um colega ativo para reconhecer.')
 else member(s,u,b.person);requireOk(!['Administrador','Diretoria'].includes(u.role)||b.person===u.id,'Este perfil permite apenas registros pessoais.',403);requireOk(kinds.includes(b.kind)&&str(b.title),'Informe o tipo e o título.');let r=s.records.find(r=>r.id===b.id);requireOk(!b.id||r&&r.person===b.person&&r.kind===b.kind,'Registro incompatível.');requireOk(!r||r.author===u.id,'Somente quem enviou pode editar este registro.',403)
 if(b.pulse||r?.pulse){const p=(s.pulses||[]).find(p=>p.id===(r?.pulse||b.pulse));requireOk(b.kind==='Pulse'&&p?.people.includes(u.id)&&p.date>=new Date(Date.now()-10800000).toISOString().slice(0,10),'Pesquisa encerrada ou indisponível.');requireOk(!s.records.some(x=>x.pulse===p.id&&x.person===u.id&&x!==r),'Resposta já registrada.',409);b.title=p.title;b.pulse=p.id}
 if(b.kind==='Desempenho')requireOk(manager,'Avaliação reservada à liderança.',403)
 if(b.kind==='Pulse')requireOk(b.person===u.id,'Cada pessoa responde a sua pesquisa.',403)
 if(b.course)requireOk(s.enroll.some(e=>e.person===b.person&&e.course===b.course),'Selecione um curso atribuído à pessoa.')
 if(b.link)requireOk(s.records.some(x=>x.person===b.person&&x.id===b.link&&x.id!==b.id&&canReadPrivateRecord(x,u)),'Vínculo inválido.')
 const due=deadlineKinds.includes(b.kind)
 if(due){
   requireOk(validDate(b.date)||Boolean(r&&!r.date&&!b.date),'Informe uma data de prazo válida.')
 }
 if(b.kind==='Pulse'&&!r&&!b.pulse){
   const today=saoPauloDate()
   const window=pulseWindow(today)
   requireOk(today>=window.friday,'O Pulse semanal abre na sexta-feira e fecha no domingo.')
   requireOk(!answeredWeeklyPulse(s,u.id,window),'Você já respondeu ao Pulse desta semana.',409)
   b.date=today
 }
 if(b.kind==='Pulse'&&r&&!r.pulse)b.date=r.date
 const fields={title:str(b.title,150),note:str(b.note,4000),date:str(b.date,10),course:str(b.course),link:str(b.link),status:str(b.status||'Em andamento',40)}
 if(b.kind==='OKR'){fields.target=number(b.target,1,10000000);fields.actual=number(b.actual,0,10000000)}
 if(b.kind==='Pulse'){
   fields.rating=number(b.rating,1,5);fields.pulse=str(b.pulse)
   requireOk(Number.isInteger(fields.rating),'Selecione um dos cinco sentimentos.')
   const contexts=b.pulseContexts??r?.pulseContexts??[]
   requireOk(Array.isArray(contexts)&&contexts.length<=3&&new Set(contexts).size===contexts.length&&contexts.every(value=>pulseContexts.includes(value)),'Escolha até três motivos da lista.')
   if(!fields.pulse)fields.pulseContexts=contexts
 }
 if(b.kind==='Desempenho'){fields.performance=number(b.performance,1,3);fields.potential=number(b.potential,1,3)}
 if(!r){r={id:id(),person:b.person,kind:b.kind,author:u.id};s.records.push(r)}Object.assign(r,fields,{updated:iso()})
 if(r.kind==='Pulse')return
 if(r.person!==u.id){
   const subject=r.kind==='1:1'?r.title+' · com '+u.name:r.title
   notify(s,r.person,r.kind,recordNotification(r.kind,Boolean(b.id)),subject,{target:r.id,due:deadlineKinds.includes(r.kind)?r.date:undefined})
   r.notifyDelivered=true
 }
 }
 else requireOk(false,'Operação desconhecida.',404)
 audit(s,u,({theme:'Identidade visual atualizada',user:'Cadastro atualizado · '+str(b.email),course:'Rascunho de curso criado · '+str(b.title),courseState:'Status do curso atualizado · '+str(b.id)+' · '+str(b.status),assign:'Matrícula registrada',courseEdit:'Informações do curso atualizadas',mission:'Missão atualizada',missionAssign:'Missão atribuída',progress:'Progresso registrado',record:'Registro de '+str(b.kind)+' atualizado'})[op])
}


const media={html:'text/html',htm:'text/html',css:'text/css',js:'text/javascript',json:'application/json',xml:'application/xml',png:'image/png',svg:'image/svg+xml',gif:'image/gif',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',mp4:'video/mp4',webm:'video/webm',mp3:'audio/mpeg',m4a:'audio/mp4',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',csv:'text/csv;charset=utf-8',txt:'text/plain;charset=utf-8',wav:'audio/wav',ogg:'audio/ogg',pdf:'application/pdf',woff:'font/woff',woff2:'font/woff2',vtt:'text/vtt'}
function bridge(data){
 let values=data.cmi,live=false,err='0'
 const send=()=>{parent.postMessage({key:data.key,values},location.origin);return 'true'}
 const init=()=>{live=true;return 'true'},finish=()=>{send();live=false;return 'true'}
 const get=k=>values[k]??'',set=(k,v)=>{if(!live||!k.startsWith('cmi.')){err='301';return 'false'}values[k]=String(v);err='0';return 'true'}
 window.API={LMSInitialize:init,LMSFinish:finish,LMSGetValue:get,LMSSetValue:set,LMSCommit:send,LMSGetLastError:()=>err,LMSGetErrorString:()=>err==='0'?'No error':'Not initialized',LMSGetDiagnostic:()=>err}
 window.API_1484_11={Initialize:init,Terminate:finish,GetValue:get,SetValue:set,Commit:send,GetLastError:()=>err,GetErrorString:window.API.LMSGetErrorString,GetDiagnostic:()=>err}
 addEventListener('pagehide',()=>{if(live)send()})
}
function fileResponse(req,bytes,headers,mime){
 if(/^(video|audio)\//.test(mime)){
   const size=bytes.byteLength
   headers['accept-ranges']='bytes'
   const range=req.headers.get('range')
   if(range){
     const match=/^bytes=(\d*)-(\d*)$/.exec(range)
     const start=match?.[1]?Number(match[1]):Math.max(0,size-Number(match?.[2]))
     const end=match?.[1]&&match[2]?Math.min(size-1,Number(match[2])):size-1
     if(!match||(!match[1]&&!match[2])||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size){
       return new Response(null,{status:416,headers:{...headers,'content-range':'bytes */'+size}})
     }
     return new Response(req.method==='HEAD'?null:bytes.subarray(start,end+1),{status:206,headers:{...headers,'content-range':'bytes '+start+'-'+end+'/'+size,'content-length':String(end-start+1)}})
   }
 }
 headers['content-length']=String(bytes.byteLength)
 return new Response(req.method==='HEAD'?null:bytes,{headers})
}
const socialReactions=['Curtir','Amei','Celebro','Apoio','Útil']
const socialImages=['png','jpg','jpeg','webp','gif']
const socialMediaTypes={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',mp4:'video/mp4',webm:'video/webm'}
const socialId=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/

function socialProfile(person){
  return {id:person.id,name:person.name,avatar:person.avatar?.id||''}
}
function socialFeed(state,user,cursor,postId){
  const posts=(state.socialPosts||[]).filter(post=>sameOrganization(state,user,post.author))
  const start=cursor?posts.findIndex(post=>post.id===cursor)+1:0
  const batch=postId?posts.filter(post=>post.id===postId):posts.slice(start,start+20)
  const people=new Map(state.users.map(person=>[person.id,socialProfile(person)]))
  const profile=id=>people.get(id)||{id,name:'Colaborador',avatar:''}
  const items=batch.map(post=>{
    const counts={}
    for(const reaction of Object.values(post.reactions))counts[reaction]=(counts[reaction]||0)+1
    return {id:post.id,owner:profile(post.author),text:post.text,at:post.at,edited:post.edited,
      media:post.media?{id:post.media.id,type:post.media.type}:null,
      comments:post.comments.map(comment=>({id:comment.id,owner:profile(comment.author),text:comment.text,at:comment.at})),
      reaction:post.reactions[user.id]||'',reactions:counts,canEdit:post.author===user.id}
  })
  return {items,next:!postId&&start+batch.length<posts.length?batch.at(-1)?.id:null}
}
function takeSocialMedia(state,user,upload,photoOnly=false){
  const now=Date.now()
  const pending=state.socialUploads??=[]
  const index=pending.findIndex(item=>item.id===upload&&item.owner===user.id&&item.until>now)
  requireOk(index>=0,'Envie novamente o arquivo.',400)
  const item=pending[index]
  requireOk(!photoOnly||item.type.startsWith('image/'),'Escolha uma foto compatível.')
  pending.splice(index,1)
  return {id:item.id,type:item.type}
}
function socialUpdate(state,user,operation,body){
  if(operation==='avatar'){
    user.avatar=takeSocialMedia(state,user,body.upload,true)
    return
  }
  const posts=state.socialPosts??=[]
  if(operation==='socialPost'){
    const text=str(body.text,3000)
    if(body.id){
      const previous=posts.find(item=>item.id===body.id)
      requireOk(previous&&previous.author===user.id,'Só quem publicou pode editar.',403)
      requireOk(text||previous.media,'Escreva algo ou inclua uma mídia.')
      previous.text=text
      previous.edited=iso()
      return
    }
    requireOk(text||body.upload,'Escreva algo ou inclua uma mídia.')
    const attachment=body.upload?takeSocialMedia(state,user,body.upload):null
    posts.unshift({id:id(),author:user.id,text,media:attachment,at:iso(),comments:[],reactions:{}})
    return
  }
  const post=posts.find(item=>item.id===body.id)
  requireOk(post&&sameOrganization(state,user,post.author),'Publicação indisponível.',404)
  if(operation==='socialComment'){
    const text=str(body.text,800)
    requireOk(text,'Escreva um comentário.')
    requireOk(post.comments.length<200,'Esta publicação já atingiu o limite de comentários.',409)
    post.comments.push({id:id(),author:user.id,text,at:iso()})
    if(post.author!==user.id)notify(state,post.author,'Rede social','Novo comentário na sua publicação',user.name,{target:post.id})
    return
  }
  requireOk(socialReactions.includes(body.reaction),'Escolha uma reação.')
  const prior=post.reactions[user.id]
  if(prior===body.reaction)delete post.reactions[user.id]
  else post.reactions[user.id]=body.reaction
  if(!prior&&post.author!==user.id){
    const inbox=state.notifications?.[post.author]||[]
    const title='Nova reação à sua publicação'
    if(!inbox.some(item=>item.title===title&&item.subject===user.name&&Date.now()-Date.parse(item.at)<3600000)){
      notify(state,post.author,'Rede social',title,user.name,{target:post.id})
    }
  }
}
function matchesMedia(data,extension){
  const starts=hex=>data.subarray(0,hex.length/2).toString('hex')===hex
  if(extension==='png')return starts('89504e470d0a1a0a')
  if(extension==='jpg'||extension==='jpeg')return starts('ffd8ff')
  if(extension==='gif')return ['GIF87a','GIF89a'].includes(data.toString('ascii',0,6))
  if(extension==='webp')return data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP'
  if(extension==='mp4')return data.toString('ascii',4,8)==='ftyp'
  return starts('1a45dfa3')
}
async function socialUpload(req,env,state,user,digest,identity,url){
  const extension=url.searchParams.get('extension')
  const mime=Object.hasOwn(socialMediaTypes,extension)?socialMediaTypes[extension]:null
  requireOk(mime,'Use JPG, PNG, WebP, GIF, MP4 ou WebM.',415)
  const max=mime.startsWith('image/')?8*1024*1024:64*1024*1024
  const recent=state.socialUploads||[]
  requireOk((state.socialUploadRates?.[user.id]||[]).filter(stamp=>stamp>Date.now()-86400000).length<12,'Limite diário de envios atingido.',429)
  requireOk(recent.filter(item=>item.owner===user.id&&item.until>Date.now()).length<5,'Você já tem cinco envios em aberto. Aguarde ou termine a publicação.',429)
  requireOk(Number(req.headers.get('content-length')||0)<=max,'Arquivo acima do limite permitido.',413)
  const chunks=[]
  let size=0
  if(req.body)for await(const chunk of req.body){
    size+=chunk.byteLength
    requireOk(size<=max,'Arquivo acima do limite permitido.',413)
    chunks.push(chunk)
  }
  const bytes=Buffer.concat(chunks,size)
  requireOk(matchesMedia(bytes,extension),'O conteúdo do arquivo é incompatível com a extensão.',415)
  const key=id()
  const saved=await env.BUCKET.put('social/'+key,bytes,{onlyIf:{etagDoesNotMatch:'*'}})
  requireOk(saved,'Não foi possível guardar o arquivo.',409)
  await change(env,current=>{
    const author=actor(current,digest,identity)
    const now=Date.now()
    const until=now+60*60*1000
    const rates=current.socialUploadRates??={}
    const sent=(rates[author.id]||[]).filter(stamp=>stamp>now-86400000)
    requireOk(sent.length<12,'Limite diário de envios atingido.',429)
    rates[author.id]=[...sent,now]
    const pending=(current.socialUploads||[]).filter(item=>item.until>Date.now())
    requireOk(pending.filter(item=>item.owner===author.id).length<5,'Limite de envios em aberto.',429)
    pending.push({id:key,type:mime,owner:author.id,until})
    current.socialUploads=pending
  })
  return response({id:key,type:mime})
}
async function socialFile(req,env,state,path,user){
  const [, ,kind,itemId]=path.split('/')
  requireOk(socialId.test(itemId),'Mídia indisponível.',404)
  const item=kind==='avatar'?state.users.find(person=>person.id===itemId)?.avatar:
    (state.socialPosts||[]).find(post=>post.id===itemId)?.media
  const owner=kind==='avatar'?itemId:(state.socialPosts||[]).find(post=>post.id===itemId)?.author
  requireOk(item&&sameOrganization(state,user,owner),'Mídia indisponível.',404)
  const stored=await env.BUCKET.get('social/'+item.id)
  requireOk(stored,'Mídia indisponível.',404)
  return fileResponse(req,stored.body,{'content-type':item.type,'cache-control':'private,max-age=60','x-content-type-options':'nosniff'},item.type)
}

const emailStateKey='system/email-delivery-v1'
const emailPages=['OKR','PDI','1:1','Feedback','Elogio','Desempenho','Pulse','Catálogo LMS','Missões','Rede social']
const emailPrivatePages=new Set(['Feedback','Pulse'])
const emailDay=86400000
const escapeMail=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
function emailSettings(){
  const key=process.env.RESEND_API_KEY?.trim(),from=process.env.EMAIL_FROM?.trim()
  if(!key||!from||/[\r\n]/.test(from))return null
  const origin='https://learning-sanepav-production.up.railway.app'
  return {key,from,origin}
}
function emailCandidates(state,user,now,since){
  const today=saoPauloDate(now)
  const notices=(state.notifications?.[user.id]||[]).filter(item=>Date.parse(item.at)>=Math.max(since,now.getTime()-emailDay))
  const reminders=deadlineNotifications(state,user.id,now).flatMap(item=>{
    const day=saoPauloDate(new Date(item.at))
    if(day<shiftDate(today,-1))return []
    const slot=item.id.startsWith('week-')?day:(item.id.endsWith('-late')?shiftDate(day,1):shiftDate(day,-3))
    const start=Date.parse(slot+'T09:00:00-03:00')
    if(now.getTime()<start||item.id.startsWith('week-')&&start<since)return []
    if(item.target&&notices.some(notice=>notice.target===item.target&&Date.parse(notice.at)>now.getTime()-12*3600000))return []
    return [{...item,due:item.id.startsWith('week-')?undefined:day}]
  })
  return [...notices,...reminders].filter(item=>emailPages.includes(item.page))
}
function emailPayload(item,user,config){
  const link=new URL('/',config.origin)
  link.searchParams.set('view',item.page)
  if(item.target&&socialId.test(item.target))link.searchParams.set('item',item.target)
  const title=item.title.replace(/[\r\n]/g,' ')
  const name=user.name.trim().split(/\s+/)[0]||'colega'
  const detail=emailPrivatePages.has(item.page)?(item.id.startsWith('week-')?
    'Seu check-in semanal está aberto até domingo. Reserve um momento para registrar como foi a semana.':
    'Entre com sua conta para consultar a novidade com privacidade.'):item.subject
  const date=item.due&&validDate(item.due)?(item.page==='1:1'?'Data da conversa: ':'Prazo: ')+item.due.split('-').reverse().join('/'):''
  const action=item.id.startsWith('week-')?'Responder meu Pulse':'Abrir no Learning'
  return {from:config.from,to:[user.email],subject:'Learning Sanepav | '+title,
    text:['Olá, '+name+'!',title,detail,date,action+': '+link].filter(Boolean).join('\n\n'),
    html:'<!doctype html><html lang="pt-BR"><meta charset="utf-8"><body style="margin:0;padding:24px 10px;background:#edf5f4;color:#153345;font-family:Arial,sans-serif">'+
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden">'+
      '<tr><td style="padding:25px 28px;background:#0a3551;background-image:linear-gradient(115deg,#0a3551,#167363);color:#fff">'+
      '<strong style="font-size:17px">Learning Sanepav</strong><div style="margin-top:10px;color:#cdeee4;font-size:13px">'+escapeMail(item.page)+'</div></td></tr>'+
      '<tr><td style="padding:26px 28px"><p style="margin:0 0 12px">Olá, '+escapeMail(name)+'!</p>'+
      '<h1 style="font-size:24px;margin:0 0 12px;line-height:1.24">'+escapeMail(title)+'</h1>'+
      (detail?'<p style="line-height:1.55">'+escapeMail(detail)+'</p>':'')+
      (date?'<p style="font-weight:bold">'+escapeMail(date)+'</p>':'')+
      '<p style="margin:24px 0 8px"><a href="'+escapeMail(link)+'" style="display:inline-block;background:#106557;color:#fff;padding:13px 20px;border-radius:9px;text-decoration:none;font-weight:bold">'+
      escapeMail(action)+'</a></p></td></tr><tr><td style="background:#f0f7f6;padding:16px 28px;color:#496572;font-size:12px">'+
      'Aviso automático da sua conta no Learning Sanepav.</td></tr></table></body></html>'}
}
async function changeEmailLedger(bucket,now,mutate){
  for(let attempt=0;attempt<8;attempt++){
    const current=await bucket.get(emailStateKey)
    const state=current?await current.json():{since:now,entries:{}}
    const result=mutate(state)
    if(current&&result===undefined)return
    const saved=await bucket.put(emailStateKey,JSON.stringify(state),{onlyIf:current?{etagMatches:current.etag}:{etagDoesNotMatch:'*'}})
    if(saved)return result
  }
  throw Error('Fila de e-mail indisponível.')
}
export async function emailTick(bucket,config,now=new Date(),send=fetch){
  const time=now.getTime()
  await changeEmailLedger(bucket,time,()=>undefined)
  const current=await bucket.get(stateKey)
  if(!current)return
  const state=await current.json()
  const ledger=await (await bucket.get(emailStateKey)).json()
  const available=state.users.filter(user=>user.active&&/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(user.email))
  const candidates=available.flatMap(user=>emailCandidates(state,user,now,ledger.since).map(item=>({user,item})))
  const jobs=await changeEmailLedger(bucket,time,book=>{
    let changed=false
    for(const [key,entry] of Object.entries(book.entries)){
      if(entry.created<time-45*emailDay){delete book.entries[key];changed=true}
    }
    const batch=[]
    for(const {user,item} of candidates){
      const key=user.id+'-'+item.id
      const entry=book.entries[key]
      if(entry&&(entry.done||entry.next>time))continue
      if(entry&&(entry.attempts>=5||entry.created<time-22*3600000||entry.payload.to[0]!==user.email)){
        entry.done=true;delete entry.payload;changed=true;continue
      }
      const reserved=entry||{created:time,attempts:0,payload:emailPayload(item,user,config)}
      reserved.attempts++
      reserved.next=time+10*60000
      book.entries[key]=reserved
      batch.push({key,payload:reserved.payload,attempt:reserved.attempts})
      changed=true
      if(batch.length===12)break
    }
    return changed?batch:undefined
  })
  for(const job of jobs||[]){
    let status=0
    try{
      const result=await send('https://api.resend.com/emails',{method:'POST',headers:{
        authorization:'Bearer '+config.key,'content-type':'application/json','idempotency-key':job.key
      },body:JSON.stringify(job.payload),signal:AbortSignal.timeout(12000)})
      status=result.status
    }catch{}
    await changeEmailLedger(bucket,time,book=>{
      const entry=book.entries[job.key]
      if(!entry||entry.done||entry.attempts!==job.attempt)return undefined
      if(status>=200&&status<300||status===400||status===422){
        entry.done=true;entry.status=status;delete entry.payload
      }else entry.next=time+(status===401||status===403?3600000:Math.min(60,2**job.attempt)*60000)
      return true
    })
  }
}
export function startEmailDelivery(bucket){
  const config=emailSettings()
  if(!config)return
  let running=false
  const cycle=async()=>{
    if(running)return
    running=true
    try{await emailTick(bucket,config)}catch{console.warn('A fila de e-mails será verificada novamente.')}
    finally{running=false}
  }
  void cycle()
  setInterval(cycle,60000).unref()
}

async function handle(req,env){
 const url=new URL(req.url),path=url.pathname,origin=url.origin
 if(req.method==='GET'&&Object.hasOwn(ASSETS,path)){const [mime,data]=ASSETS[path];return new Response(Uint8Array.from(atob(data),c=>c.charCodeAt(0)),{headers:{'content-type':mime,'x-content-type-options':'nosniff','cache-control':'no-cache','referrer-policy':'no-referrer',...(path==='/'?{'x-frame-options':'DENY','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; frame-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"}:{})}})}
 const identity=req.headers.get('oai-authenticated-user-id')||''
 requireOk(identity,'Acesse pelo endereço privado da plataforma.',401)
 const digest=await hash((req.headers.get('cookie')||'').match(/(?:^|; )learning=([^;]+)/)?.[1]||''),raw=await env.BUCKET.get(stateKey),state=raw?await raw.json():initial()
 if(req.method==='GET'&&path==='/api/access'){let me=null;try{me=clean(actor(state,digest,identity))}catch{}return response({setup:!state.users.length,me,theme:state.theme,recoveryConfigured:recoveryConfigured()})}
 if(req.method==='POST')requireOk(req.headers.get('origin')===origin,'Origem inválida.',403)
 if(req.method==='POST'&&['/api/request-password-reset','/api/reset-password'].includes(path))return env.DOMAIN.recovery(req,identity)
 if(path==='/api/login'&&req.method==='POST'){
 const b=await req.json(),email=str(b.email).toLowerCase(),token=id()+id(),tokenHash=await hash(token),key=await hash(identity+'|'+(req.headers.get('cf-connecting-ip')||'')+'|'+email);const result=await change(env,async s=>{
 const f=s.fails[key];requireOk(!f||f.since<Date.now()-900000||f.n<8,'Muitas tentativas. Aguarde 15 minutos.',429)
 let u=s.users.find(p=>p.email===email);if(!s.users.length){requireOk(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&str(b.name),'Informe nome e e-mail.');u={id:id(),email,name:str(b.name,90),role:roles[0],area:'DHO',manager:'',active:true,...await password(b.password)};s.users.push(u);starter(s,u)}
 if(!u?.active||typeof b.password!=='string'||b.password.length<12||b.password.length>150||!await verifyPassword(b.password,u)){s.fails[key]=f&&f.since>Date.now()-900000?{...f,n:f.n+1}:{n:1,since:Date.now()};audit(s,null,'Tentativa de acesso recusada');return false}
 delete s.fails[key];logSession(s,u,tokenHash,identity);return true})
 requireOk(result,'E-mail ou senha inválidos.',401);return response({ok:true},200,{'set-cookie':'learning='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800'+(url.protocol==='https:'?'; Secure':'')})}
 const u=actor(state,digest,identity)
 if(req.method==='GET'&&path==='/api/socialFeed')return response(socialFeed(state,u,url.searchParams.get('after'),url.searchParams.get('post')))
 if(req.method==='POST'&&path==='/api/socialUpload')return socialUpload(req,env,state,u,digest,identity,url)
 if(['GET','HEAD'].includes(req.method)&&/^\/social\/(avatar|post)\/[^/]+$/.test(path))return socialFile(req,env,state,path,u)
 if(req.method==='POST'&&['/api/avatar','/api/socialPost','/api/socialComment','/api/socialReaction'].includes(path)){
   const body=await req.json()
   requireOk(body&&typeof body==='object'&&!Array.isArray(body),'Dados inválidos.')
   await change(env,s=>socialUpdate(s,actor(s,digest,identity),path.slice(5),body))
   return response({ok:true})
 }
 if(req.method==='GET'&&path==='/api/notifications')return response(listNotifications(state,u.id))
 if(req.method==='POST'&&path==='/api/notifications'){
   const body=await req.json()
   await change(env,s=>{
     const person=actor(s,digest,identity)
     const items=s.notifications?.[person.id]||[]
     for(const item of items)if(body.all===true||item.id===body.id)item.read=true
     const seen=(s.legacyNotificationReads??={})[person.id]??={}
     for(const item of legacyNotifications(s,person.id,items))if(body.all===true||item.id===body.id)seen[item.id]=true
     const reminders=(s.reminderReads??={})[person.id]??={}
     const current=deadlineNotifications(s,person.id)
     const eligible=new Set(current.map(item=>item.id))
     for(const previous of Object.keys(reminders))if(!eligible.has(previous))delete reminders[previous]
     for(const item of current)if(body.all===true||item.id===body.id)reminders[item.id]=true
   })
   return response({ok:true})
 }
 if(path.startsWith('/api/v2/'))return env.DOMAIN.handle(req,{digest,identity})
 if(req.method==='GET'&&path==='/api/data'){
  const company=url.searchParams.get('company')
  if(company){requireOk(env.DOMAIN?.allowedCompanies(state,u).includes(company),'Empresa fora do seu escopo.',403);Object.defineProperty(state,'requestCompany',{value:company})}
  return response({...view(state,u),permissions:env.DOMAIN?.permissions(u)})
 }
 if(req.method==='POST'&&path==='/api/logout'){await change(env,s=>{s.sessions=s.sessions.filter(x=>x.digest!==digest);audit(s,u,'Saída da plataforma')});return response({ok:true},200,{'set-cookie':'learning=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'})}
 if(req.method==='POST'&&path==='/api/upload'){assertLearning(u);const key=url.searchParams.get('id')||id(),name=url.searchParams.get('path')
 requireOk(/^[\da-f-]{36}$/.test(key)&&filePath(name),'Arquivo inválido.')
 const published=s=>s.courses.some(c=>c.upload===key||c.cover?.upload===key)||(s.missions||[]).some(m=>m.cover?.upload===key)
 requireOk(!published(state),'Material já publicado.')
 requireOk(!state.uploads.some(up=>up.id===key&&up.owner!==u.id),'Acesso negado.',403)
 const limit=coverPath.test(name)?8*1024*1024:64*1024*1024
 requireOk(Number(req.headers.get('content-length')||0)<=limit,'Arquivo acima do limite permitido.',413)
 const chunks=[]
 let size=0
 if(req.body)for await(const chunk of req.body){size+=chunk.byteLength;requireOk(size<=limit,'Arquivo acima do limite permitido.',413);chunks.push(chunk)}
 requireOk(size>0,'O arquivo está vazio.')
 const blob=Buffer.concat(chunks,size)
 const storageKey='files/'+key+'/'+name
 const saved=await env.BUCKET.put(storageKey,blob,{onlyIf:{etagDoesNotMatch:'*'}});requireOk(saved,'Arquivo já enviado.',409)
 await change(env,s=>{assertLearning(actor(s,digest,identity));requireOk(!published(s),'Material já publicado.');let up=s.uploads.find(x=>x.id===key);if(!up){up={id:key,owner:u.id,paths:[]};s.uploads.push(up)}requireOk(up.owner===u.id,'Acesso negado.',403);up.paths.push(name)});return response({id:key})}
 if(req.method==='GET'&&/^\/cover\/(course|mission)\/[a-f0-9-]{36}$/.test(path)){
   const [,,kind,cid]=path.split('/')
   const item=kind==='course'?state.courses.find(c=>c.id===cid):(state.missions||[]).find(m=>m.id===cid)
   const enrolled=course=>state.enroll.some(e=>e.course===course&&e.person===u.id)
   const admin=['Administrador','RH/DHO'].includes(u.role)
   requireOk(item?.cover&&(admin||courseStatus(item)!=='draft'&&(kind==='course'?enrolled(cid):item.courses.every(enrolled))),'Capa indisponível.',404)
   const obj=await env.BUCKET.get('files/'+item.cover.upload+'/'+item.cover.entry)
   requireOk(obj,'Capa indisponível.',404)
   return new Response(obj.body,{headers:{'content-type':media[item.cover.entry.split('.').pop()],'cache-control':'private, max-age=60','x-content-type-options':'nosniff'}})
 }
 if(['GET','HEAD'].includes(req.method)&&path.startsWith('/content/')){
 const [, ,cid,...parts]=path.split('/');const name=parts.map(decodeURIComponent).join('/'),c=state.courses.find(x=>x.id===cid),e=state.enroll.find(e=>e.course===cid&&e.person===u.id);requireOk(c&&c.upload&&filePath(name)&&(e&&courseStatus(c)!=='draft'||['Administrador','RH/DHO'].includes(u.role)),'Conteúdo indisponível.',403)
 if(e)requireLearningAccess(state,e)
 const obj=await env.BUCKET.get('files/'+c.upload+'/'+name);requireOk(obj,'Arquivo inexistente.',404)
 const mime=media[name.split('.').pop().toLowerCase()]||'application/octet-stream'
 const headers={'content-type':mime,'cache-control':'private,no-store','x-content-type-options':'nosniff','content-security-policy':"sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'none'; frame-src 'self'; form-action 'none'; base-uri 'none'"}
 if(mime==='text/html'&&c.type==='SCORM'&&name===c.entry){const key=url.searchParams.get('key')||'';const cm={'cmi.core.student_id':u.id,'cmi.core.student_name':u.name,'cmi.learner_id':u.id,'cmi.learner_name':u.name,'cmi.core.lesson_status':'not attempted','cmi.completion_status':'unknown','cmi.core.entry':e?.cmi?'resume':'ab-initio','cmi.entry':e?.cmi?'resume':'ab-initio',...e?.cmi};const injection='<script>('+bridge.toString()+')('+JSON.stringify({key,cmi:cm}).replaceAll('<','\\u003c')+')</script>';let html=await obj.text();html=html.replace(/^(\s*<!doctype[^>]*>)?/i,m=>(m||'')+injection);return new Response(html,{headers})}
 if(c.type==='PDF'&&mime==='application/pdf'){
   delete headers['content-security-policy']
   headers['content-disposition']='inline'
 }
 if(['Apresentação','Documento'].includes(c.type))headers['content-disposition']='attachment'
 return fileResponse(req,obj.body,headers,mime)}
 if(req.method==='POST'&&path.startsWith('/api/')){const op=path.slice(5),b=await req.json();delete b.secret;if(op==='user'&&b.password){assertAdmin(u);b.secret=await password(b.password)}delete b.password
 await change(env,s=>update(s,actor(s,digest,identity),op,b));return response({ok:true})}
 requireOk(false,'Página inexistente.',404)
}
export default {async fetch(req,env){try{return await handle(req,env)}catch(e){if(e instanceof SyntaxError||e instanceof URIError)return response({error:'Solicitação inválida.'},400);return response({error:e.status?e.message:'Falha ao processar a solicitação.'},e.status||500)}}}


if(emailSettings()) import('./storage.mjs').then(({BUCKET})=>startEmailDelivery(BUCKET)).catch(()=>console.warn('Não foi possível iniciar a fila de e-mails.'))
