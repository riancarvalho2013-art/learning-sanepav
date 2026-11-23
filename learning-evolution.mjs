// Learning Sanepav · DNA Evolution | independent integration; no copied Open edX code.
import {createHash, randomUUID, timingSafeEqual} from 'node:crypto'

const VERSION = '2026.11.23-dna1'
const KEY = 'evolution/v1/'
const digest = value => createHash('sha256').update(value).digest('hex')
const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})
const invalid = (condition, message, status = 400) => {if(!condition)throw Object.assign(new Error(message),{status})}
const str = (value, max=100) => {invalid(typeof value==='string'&&value.trim()&&value.trim().length<=max,'Texto inválido ou acima do limite.');return value.trim()}
const uuid = value => typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const color = value => /^#[\da-fA-F]{6}$/.test(value||'')
const imageFormats = {png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'}
const matchImage=(bytes,extension)=>{
  if(extension==='png')return bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'
  if(['jpg','jpeg'].includes(extension))return bytes.subarray(0,3).toString('hex')==='ffd8ff'
  if(extension==='webp')return bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'
  return false
}
const safeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))
const optional = (value, max=140) => value==null||value===''?'':str(value,max)
const trackKey = title => digest(title.toLowerCase().trim()).slice(0,32)
const stateKey = 'system/state-v1'

async function readObject(bucket,key) {const result=await bucket.get(KEY+key);return result ? await result.json() : null}
async function putObject(bucket,key,body,{create=false}={}){
  const full=KEY+key, prior=create?null:await bucket.get(full)
  const result=await bucket.put(full,JSON.stringify(body),{onlyIf:prior?{etagMatches:prior.etag}:{etagDoesNotMatch:'*'}})
  invalid(result, 'Outro administrador atualizou esses dados. Atualize a página.',409)
  return body
}
async function readState(bucket){const original=await bucket.get(stateKey);invalid(original,'Ambiente não inicializado.',503);return {original,state:await original.json()}}
function loggedUser(req,state){
  const cookie=req.headers.get('cookie')||''
  const match=cookie.match(/(?:^|;\s*)learning=([^;]+)/)
  const hashed=digest(match?.[1]||'')
  const identity=req.headers.get('oai-authenticated-user-id')||''
  const session=state.sessions?.find(s=>s.digest===hashed&&s.identity===identity&&s.until>Date.now())
  const user=state.users?.find(u=>u.id===session?.person&&u.active)
  invalid(user,'Entre para continuar.',401)
  return user
}
function getCompany(state,domain,user,company){
  invalid(uuid(company),'Selecione uma empresa válida.')
  const allowed=domain.allowedCompanies(state,user)
  invalid(allowed.includes(company),'Empresa fora do seu escopo.',403)
  const record=state.organization?.companies.find(c=>c.id===company)
  invalid(record&&record.active===1,'Empresa indisponível.',404)
  return record
}
const admin=user=>invalid(user.role==='Administrador','Somente a administração pode alterar esta configuração.',403)
function originCheck(req){const url=new URL(req.url);invalid(req.headers.get('origin')===url.origin,'Origem da solicitação inválida.',403)}
async function binaryBody(req,limit){
 const size=Number(req.headers.get('content-length')||0)
 invalid(Number.isFinite(size)&&size<=limit,'Arquivo acima do limite.',413)
 let count=0;const chunks=[]
 if(req.body)for await(const c of req.body){const part=Buffer.from(c);count+=part.length;invalid(count<=limit,'Arquivo acima do limite.',413);chunks.push(part)}
 invalid(count>0,'O arquivo enviado está vazio.')
 return Buffer.concat(chunks,count)
}
async function writeBrand(bucket,company,updates){
 const key='brands/'+company,old=await readObject(bucket,key)||{}
 return putObject(bucket,key,{...old,...updates,company,updatedAt:new Date().toISOString()})
}
async function asset(bucket,storageKey,mime){
 const data=await bucket.get(storageKey)
 invalid(data,'Imagem indisponível.',404)
 const detected=Object.keys(imageFormats).find(extension=>matchImage(data.body,extension))
 return new Response(data.body,{headers:{'content-type':detected?imageFormats[detected]:mime,'cache-control':'private,max-age=60','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"}})
}
function scopeEnrollment(state,domain,user,enrollment){
 invalid(enrollment,'Matrícula inexistente.',404)
 invalid(user.id===enrollment.person||user.role==='Administrador','Matrícula indisponível.',403)
 const person=state.users.find(u=>u.id===enrollment.person)
 invalid(person,'Pessoa indisponível.',404)
 const company=state.organization?.assignments.get(person.id)?.company_id
 invalid(company,'A pessoa precisa estar vinculada a uma empresa para emitir um certificado.',409)
 getCompany(state,domain,user,company)
 return {person,company}
}
function printCertificate(record, template, url){
 const code=safeHtml(record.code), company=encodeURIComponent(record.company), track=encodeURIComponent(record.track)
 const logo='/api/evo/brand/logo?company='+company+(record.brandLogoVersion?'&version='+encodeURIComponent(record.brandLogoVersion):'')
 const bg='/api/evo/certificate/background?company='+company+'&track='+track+(template?.backgroundVersion?'&version='+encodeURIComponent(template.backgroundVersion):'')
 const primary=color(template?.color)?template.color:'#1866bb'
 const subtitle=safeHtml(template?.subtitle||'Certificado de conclusão')
 const signatory=safeHtml(template?.signatory||'Desenvolvimento Humano e Organizacional')
 const date=new Date(record.issuedAt).toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric',timeZone:'America/Sao_Paulo'})
 const verify=new URL('/api/evo/verify?code='+encodeURIComponent(record.code),url).href
 return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Certificado · ${safeHtml(record.courseTitle)}</title><style>
 :root{--accent:${primary}}*{box-sizing:border-box}body{margin:0;font-family:Arial,'Segoe UI',sans-serif;background:#eaf3fc;color:#11345b}.tools{padding:16px;text-align:center}.tools button{border:0;border-radius:9px;background:#1768bf;color:#fff;padding:13px 20px;cursor:pointer}.paper{width:min(1120px,96%);aspect-ratio:1.414/1;margin:16px auto;padding:5%;background:white;box-shadow:0 18px 50px #183b6638;position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;text-align:center;border:12px solid #e4f0fc}.paper::before{content:'';position:absolute;inset:0;background-image:url('${bg}');background-size:cover;background-position:center;opacity:.23;z-index:0}.paper>*{position:relative}.logo{max-width:160px;max-height:75px;object-fit:contain}.eyebrow{font-size:14px;letter-spacing:.25em;text-transform:uppercase;color:var(--accent);font-weight:700}.big{font-size:clamp(28px,4vw,56px);font-weight:800;letter-spacing:-.03em}.name{font-size:clamp(24px,3vw,42px);color:var(--accent);font-weight:700}.course{font-size:clamp(18px,2.4vw,29px);font-weight:bold}.body{line-height:1.6;font-size:clamp(13px,1.5vw,19px)}.foot{display:flex;justify-content:space-between;gap:18px;align-items:end;text-align:left;font-size:13px;border-top:1px solid #d5e5f7;padding-top:14px;overflow-wrap:anywhere}.sign{font-weight:700}.code{font-family:monospace;font-size:12px}.verify{color:var(--accent)}@page{size:A4 landscape;margin:0}@media print{body{background:white}.tools{display:none}.paper{width:100%;height:100vh;margin:0;box-shadow:none;border-width:10px;print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style><div class="tools"><button onclick="print()">Imprimir ou salvar como PDF</button></div><article class="paper"><header><img class="logo" src="${logo}" alt="Logo da empresa" onerror="this.style.display='none'"><div class="eyebrow">${safeHtml(record.brandTitle)}</div></header><section><div class="eyebrow">${subtitle}</div><h1 class="big">Certificado</h1><p>Certificamos que</p><div class="name">${safeHtml(record.personName)}</div><p class="body">concluiu com aproveitamento o conteúdo</p><div class="course">${safeHtml(record.courseTitle)}</div><p class="body">Trilha: ${safeHtml(record.track)} · Carga horária: ${safeHtml(record.minutes)} minutos</p></section><footer><div class="foot"><div><div class="sign">${signatory}</div><div>Emitido em ${safeHtml(date)}</div></div><div><div class="code">Código ${code}</div><div class="verify">Verificação: ${safeHtml(verify)}</div></div></div></footer></article></html>`
}
async function readConfig(bucket,key,fallback){return await readObject(bucket,key)||fallback}

export async function handleEvolution(req,{BUCKET,DOMAIN}){
 const url=new URL(req.url),path=url.pathname,method=req.method
 const relevant=path.startsWith('/api/evo/')
 if(!relevant)return null
 try{
  if(path==='/api/evo/version'&&method==='GET')return json({version:VERSION})
  if(path==='/api/evo/verify'&&method==='GET'){
    const code=url.searchParams.get('code')||''
    invalid(uuid(code),'Código inválido.',400)
    const entry=await readObject(BUCKET,'verification/'+code)
    return json(entry?{valid:true,courseTitle:entry.courseTitle,issuedAt:entry.issuedAt,company:entry.brandTitle}:{valid:false})
  }
  const {original,state}=await readState(BUCKET),user=loggedUser(req,state)
  if(method==='POST')originCheck(req)
  const company=url.searchParams.get('company')||''
  const companyRoutes=['/api/evo/brand','/api/evo/brand/logo','/api/evo/certificate/template','/api/evo/certificate/background']
  let companyRecord=null
  if(companyRoutes.includes(path)) companyRecord=getCompany(state,DOMAIN,user,company)
  if(path==='/api/evo/brand'&&method==='GET'){
    const value=await readConfig(BUCKET,'brands/'+company,{})
    return json({company,title:value.title||'Learning '+companyRecord.name,subtitle:value.subtitle||'DNA do Desenvolvimento',color:value.color||'#176bc1',accent:value.accent||'#61c5f8',logoVersion:value.logoVersion||'',logoMime:value.logoMime||'',updatedAt:value.updatedAt||null})
  }
  if(path==='/api/evo/brand'&&method==='POST'){
    admin(user);const body=await req.json()
    const title=str(body.title,60),subtitle=optional(body.subtitle,90)
    invalid(color(body.color)&&color(body.accent),'Selecione cores hexadecimais válidas.')
    return json(await writeBrand(BUCKET,company,{title,subtitle,color:body.color,accent:body.accent}))
  }
  if(path==='/api/evo/brand/logo'&&method==='GET'){
    const brand=await readObject(BUCKET,'brands/'+company)||{}
    invalid(brand.logoVersion&&brand.logoMime,'Logo não cadastrada.',404)
    const version=url.searchParams.get('version')||brand.logoVersion
    invalid(uuid(version),'Logo inexistente.',404)
    return asset(BUCKET,KEY+'logos/'+company+'/'+version,brand.logoMime)
  }
  if(path==='/api/evo/brand/logo'&&method==='POST'){
    admin(user);const ext=(url.searchParams.get('ext')||'').toLowerCase()
    invalid(imageFormats[ext],'Envie PNG, JPG ou WebP.')
    const bytes=await binaryBody(req,4*1024*1024)
    invalid(matchImage(bytes,ext),'O conteúdo não corresponde ao formato da imagem.')
    const version=randomUUID(),stored=await BUCKET.put(KEY+'logos/'+company+'/'+version,bytes,{onlyIf:{etagDoesNotMatch:'*'}})
    invalid(stored,'Não foi possível armazenar a logo.',500)
    return json(await writeBrand(BUCKET,company,{logoVersion:version,logoMime:imageFormats[ext]}))
  }
  if(path==='/api/evo/certificate/template'&&method==='GET'){
    const track=str(url.searchParams.get('track')||'',100)
    const value=await readConfig(BUCKET,'templates/'+company+'/'+trackKey(track),{})
    return json({company,track,subtitle:value.subtitle||'Certificado de conclusão',signatory:value.signatory||'Desenvolvimento Humano e Organizacional',color:value.color||'#176bc1',backgroundVersion:value.backgroundVersion||'',backgroundMime:value.backgroundMime||''})
  }
  if(path==='/api/evo/certificate/template'&&method==='POST'){
    admin(user);const body=await req.json(),track=str(body.track,100)
    invalid(color(body.color),'Selecione uma cor hexadecimal válida.')
    const key='templates/'+company+'/'+trackKey(track),before=await readObject(BUCKET,key)||{}
    return json(await putObject(BUCKET,key,{...before,track,company,subtitle:str(body.subtitle,100),signatory:str(body.signatory,120),color:body.color,updatedAt:new Date().toISOString()}))
  }
  if(path==='/api/evo/certificate/background'&&method==='GET'){
    const track=str(url.searchParams.get('track')||'',100)
    const template=await readObject(BUCKET,'templates/'+company+'/'+trackKey(track))||{}
    invalid(template.backgroundVersion&&template.backgroundMime,'Fundo não cadastrado.',404)
    const version=url.searchParams.get('version')||template.backgroundVersion
    invalid(uuid(version),'Fundo inexistente.',404)
    return asset(BUCKET,KEY+'backgrounds/'+company+'/'+trackKey(track)+'/'+version,template.backgroundMime)
  }
  if(path==='/api/evo/certificate/background'&&method==='POST'){
    admin(user);const track=str(url.searchParams.get('track')||'',100),ext=(url.searchParams.get('ext')||'').toLowerCase()
    invalid(imageFormats[ext],'Envie PNG, JPG ou WebP.')
    const bytes=await binaryBody(req,8*1024*1024)
    invalid(matchImage(bytes,ext),'Imagem de fundo inválida.')
    const version=randomUUID(),key='templates/'+company+'/'+trackKey(track)
    const result=await BUCKET.put(KEY+'backgrounds/'+company+'/'+trackKey(track)+'/'+version,bytes,{onlyIf:{etagDoesNotMatch:'*'}})
    invalid(result,'Falha ao salvar o fundo.',500)
    const current=await readObject(BUCKET,key)||{}
    return json(await putObject(BUCKET,key,{...current,company,track,backgroundVersion:version,backgroundMime:imageFormats[ext],updatedAt:new Date().toISOString()}))
  }
  if(path==='/api/evo/certificates'&&method==='GET'){
    const enrollments=state.enroll.filter(e=>e.person===user.id&&e.progress===100)
    const items=[]
    for(const e of enrollments){
      const course=state.courses.find(c=>c.id===e.course)
      if(!course)continue
      const cert=await readObject(BUCKET,'issued/'+e.id)
      items.push({enrollmentId:e.id,courseTitle:course.title,track:course.track||'Catálogo geral',minutes:course.minutes,issued:Boolean(cert),code:cert?.code||null})
    }
    return json({items})
  }
  if(path==='/api/evo/certificates/issue'&&method==='POST'){
    const {enrollmentId}=await req.json()
    invalid(uuid(enrollmentId),'Selecione uma conclusão válida.')
    const enroll=state.enroll.find(e=>e.id===enrollmentId)
    invalid(enroll&&enroll.progress===100,'Conclua o curso antes de emitir o certificado.',409)
    const {person,company}=scopeEnrollment(state,DOMAIN,user,enroll)
    const course=state.courses.find(c=>c.id===enroll.course)
    invalid(course,'Curso indisponível.',404)
    let cert=await readObject(BUCKET,'issued/'+enroll.id)
    if(!cert){
      const brand=await readObject(BUCKET,'brands/'+company)||{}
      const companyName=state.organization.companies.find(c=>c.id===company)?.name||'Empresa'
      const snapshotTemplate=await readObject(BUCKET,'templates/'+company+'/'+trackKey(course.track||'Catálogo geral'))
      cert={brandLogoVersion:brand.logoVersion||'',template:snapshotTemplate||null,enrollmentId:enroll.id,personId:person.id,personName:person.name,company,brandTitle:brand.title||'Learning '+companyName,courseId:course.id,courseTitle:course.title,track:course.track||'Catálogo geral',minutes:course.minutes,issuedAt:new Date().toISOString(),code:randomUUID()}
      try{await putObject(BUCKET,'issued/'+enroll.id,cert,{create:true})}catch(err){if(err.status!==409)throw err;cert=await readObject(BUCKET,'issued/'+enroll.id)}
    }
    if(!await readObject(BUCKET,'verification/'+cert.code)){
      try{await putObject(BUCKET,'verification/'+cert.code,{courseTitle:cert.courseTitle,issuedAt:cert.issuedAt,brandTitle:cert.brandTitle},{create:true})}catch(err){if(err.status!==409)throw err}
    }
    return json({enrollmentId:enroll.id,code:cert.code,printUrl:'/api/evo/certificates/print?id='+encodeURIComponent(enroll.id)})
  }
  if(path==='/api/evo/certificates/print'&&method==='GET'){
    const enrollId=url.searchParams.get('id')||'';invalid(uuid(enrollId),'Certificado inválido.')
    const enroll=state.enroll.find(e=>e.id===enrollId)
    const {company}=scopeEnrollment(state,DOMAIN,user,enroll)
    const cert=await readObject(BUCKET,'issued/'+enrollId)
    invalid(cert&&cert.company===company,'Certificado ainda não emitido.',404)
    const template=cert.template||await readObject(BUCKET,'templates/'+company+'/'+trackKey(cert.track))
    return new Response(printCertificate(cert,template,url),{headers:{'content-type':'text/html;charset=utf-8','cache-control':'private,no-store','x-frame-options':'DENY','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'referrer-policy':'no-referrer'}})
  }
  if(path==='/api/evo/delete'&&method==='POST'){
    admin(user);const {type,id,revision,confirm}=await req.json()
    invalid(['course','mission'].includes(type)&&uuid(id)&&confirm===true,'Confirme a exclusão de um item válido.')
    const originalData=await readState(BUCKET),s=originalData.state
    const currentUser=loggedUser(req,s);admin(currentUser)
    const list=type==='course'?s.courses:(s.missions||[])
    const item=list.find(e=>e.id===id);invalid(item,'Item não encontrado.',404)
    const existingRevision=item.revision||0
    invalid(Number(revision)===existingRevision,'O item mudou. Atualize antes de excluir.',409)
    if(type==='course'){
      invalid(!s.enroll.some(e=>e.course===id)&&!(s.missions||[]).some(m=>m.courses.includes(id))&&!s.records?.some(r=>r.course===id),'O curso possui matrículas, registros de desenvolvimento ou faz parte de uma trilha. Arquive-o para preservar o histórico.',409)
    }else invalid(!(s.missionEnrollments||[]).some(e=>e.mission===id),'A trilha já possui participantes. Preserve o histórico.',409)
    const index=list.indexOf(item);list.splice(index,1)
    s.logs.unshift({at:new Date().toISOString(),who:currentUser.name,event:'Exclusão controlada: '+type+' '+id})
    const saved=await BUCKET.put(stateKey,JSON.stringify(s),{onlyIf:{etagMatches:originalData.original.etag}})
    invalid(saved,'Dados atualizados por outro usuário. Atualize a tela.',409)
    // Binary media remains in SQLite until a future garbage-collection migration: never risk purging referenced files.
    return json({ok:true,removed:id,type,mediaCleanupPending:true})
  }
  return json({error:'Recurso inexistente.'},404)
 }catch(error){return json({error:error.status?error.message:'Não foi possível concluir a operação.'},error.status||500)}
}
