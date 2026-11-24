/** Administrative creation-only import; no shadow directory, no plaintext credential persistence. */
import {randomUUID} from 'node:crypto'
import {hashPassword} from './credentials.mjs'
import {resolveActor} from './completion-v11.mjs'
import {workbook} from './report-xlsx-v12.mjs'
const ROOT='/api/users/v14/import/', KEY='system/state-v1', MAX=100
export const IMPORT_COLUMNS=['nome','email','perfil','empresa','departamento','unidade','cargo','gestor_email','admissao','senha_inicial']
const roles=['Colaborador','Líder','RH/DHO','Diretoria']
const fail=(ok,error,status=400)=>{if(!ok)throw Object.assign(new Error(error),{status})}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'private,no-store','x-content-type-options':'nosniff'}})
const clean=(v)=>typeof v==='string'?v.trim():''
const key=v=>clean(v).normalize('NFC').toLocaleLowerCase('pt-BR')
const emailOk=v=>v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const active=x=>x.active!==0&&x.active!==false
const dateOk=v=>!v||/^\d{4}-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v
const same=(items,input,company)=>items.filter(x=>active(x)&&(!company||x.company_id===company)&&(x.id===input||key(x.name)===key(input)))
const lookup=(items,input,company)=>{const matches=same(items,input,company);return matches.length===1?matches[0]:null}
export function validateImport(state,input){
 fail(Array.isArray(input)&&input.length>=1&&input.length<=MAX,`Envie de 1 a ${MAX} usuários por lote.`)
 const org=state.organization||{},companies=org.companies||[],departments=org.departments||[],units=org.units||[],existing=new Map((state.users||[]).map(x=>[key(x.email),x])),seen=new Map(),errors=[],rows=[]
 const issue=(line,field,message)=>errors.push({line,field,message})
 for(let i=0;i<input.length;i++){
  const raw=input[i],line=i+2; if(!raw||typeof raw!=='object'||Array.isArray(raw)){issue(line,'linha','Linha inválida.');continue}
  if(Object.keys(raw).some(k=>!IMPORT_COLUMNS.includes(k))||Object.values(raw).some(v=>typeof v!=='string')){issue(line,'linha','Campos desconhecidos ou tipos inválidos.');continue}
  const name=clean(raw.nome),email=key(raw.email),role=roles.find(r=>key(r)===key(raw.perfil||'Colaborador')),company=lookup(companies,clean(raw.empresa)),department=company&&lookup(departments,clean(raw.departamento),company.id),unit=raw.unidade&&company?lookup(units,clean(raw.unidade),company.id):null,position=clean(raw.cargo),managerEmail=key(raw.gestor_email),hired=clean(raw.admissao),password=raw.senha_inicial
  if(!name||name.length>90)issue(line,'nome','Informe nome de até 90 caracteres.')
  if(!emailOk(email))issue(line,'email','E-mail inválido.')
  if(existing.has(email))issue(line,'email','E-mail já cadastrado. O lote não atualiza usuários existentes.')
  if(seen.has(email))issue(line,'email','E-mail duplicado na planilha.');else seen.set(email,line)
  if(!role)issue(line,'perfil','Perfil inválido. Administrador não pode ser criado em lote.')
  if(!company)issue(line,'empresa','Empresa ativa inexistente ou ambígua.')
  if(!department)issue(line,'departamento','Departamento ativo obrigatório e pertencente à empresa.')
  if(raw.unidade&&!unit)issue(line,'unidade','Unidade inexistente ou incompatível com a empresa.')
  if(position.length>120)issue(line,'cargo','Cargo limitado a 120 caracteres.')
  if(!dateOk(hired))issue(line,'admissao','Data inválida. Use AAAA-MM-DD.')
  if(typeof password!=='string'||password.length<12||password.length>150||!password.trim())issue(line,'senha_inicial','Informe senha individual de 12 a 150 caracteres.')
  if(managerEmail&&!emailOk(managerEmail))issue(line,'gestor_email','E-mail do gestor inválido.')
  rows.push({line,name,email,role,companyId:company?.id,companyName:company?.name,departmentId:department?.id,departmentName:department?.name,unitId:unit?.id||null,position,managerEmail,hired,password,id:randomUUID()})
 }
 const proposed=new Map(rows.map(r=>[r.email,r])),byId=new Map((state.users||[]).map(p=>[p.id,p]))
 for(const r of rows){if(!r.managerEmail)continue;const newManager=proposed.get(r.managerEmail),old=existing.get(r.managerEmail),manager=newManager||old;const tenant=newManager?.companyId||org.assignments?.get(old?.id)?.company_id
  if(!manager||manager.active===false||manager.role==='Colaborador'||!manager.role||tenant!==r.companyId||manager.id===r.id){issue(r.line,'gestor_email','Gestor deve estar ativo, ser liderança e pertencer à mesma empresa.');continue}r.managerId=manager.id
 }
 // Detect cycles in the proposed manager graph, including pre-existing chains.
 const next=new Map(rows.map(r=>[r.id,r.managerId||'']));for(const [id,p] of byId)next.set(id,p.manager||'')
 for(const r of rows){const visited=new Set();let id=r.id;while(id){if(visited.has(id)){issue(r.line,'gestor_email','Hierarquia circular.');break}visited.add(id);id=next.get(id)}}
 return {rows,errors}
}
function preview(result,raw,state){return {valid:result.errors.length===0,total:result.rows.length,errors:result.errors,revision:raw.etag,organizationRevision:state.organization?.revision||null,rows:result.rows.map(({line,name,email,role,companyName,departmentName,managerEmail})=>({line,name,email,role,companyName,departmentName,managerEmail}))}}
function template(state){const org=state.organization||{};return workbook([['Usuarios',[IMPORT_COLUMNS]],['Instrucoes',[['Campo','Como preencher'],['nome','Obrigatório; até 90 caracteres'],['email','Obrigatório; único; não altera cadastros existentes'],['perfil','Colaborador (padrão), Líder, RH/DHO ou Diretoria. Administrador somente cadastro individual.'],['empresa','Nome ou ID da empresa ativa'],['departamento','Nome ou ID de departamento da empresa (obrigatório)'],['unidade','Opcional; nome ou ID da unidade da empresa'],['cargo','Opcional'],['gestor_email','Opcional; e-mail de gestor ativo da mesma empresa, existente ou no próprio lote'],['admissao','Opcional; AAAA-MM-DD ou data Excel'],['senha_inicial','Obrigatória; senha individual de 12 a 150 caracteres. Trate o arquivo como confidencial.'],['Limite','100 usuários por lote. Nenhum cadastro é salvo se houver erro.']]],['Empresas',[['ID','Empresa'],...(org.companies||[]).filter(active).map(c=>[c.id,c.name])]],['Departamentos',[['ID','Departamento','Empresa ID'],...(org.departments||[]).filter(active).map(c=>[c.id,c.name,c.company_id])]],['Unidades',[['ID','Unidade','Empresa ID'],...(org.units||[]).filter(active).map(c=>[c.id,c.name,c.company_id])]]])}
export async function handleUserImport(req,{BUCKET}){
 const url=new URL(req.url);if(!url.pathname.startsWith(ROOT))return null
 try{const raw=await BUCKET.get(KEY);fail(raw,'Entre para continuar.',401);const state=await raw.json(),actor=resolveActor(req,state);fail(actor.role==='Administrador','Importação restrita à administração.',403);const action=url.pathname.slice(ROOT.length)
  if(action==='template'&&req.method==='GET')return new Response(template(state),{headers:{'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':'attachment; filename="modelo-importacao-usuarios.xlsx"','cache-control':'private,no-store','x-content-type-options':'nosniff'}})
  fail(req.method==='POST'&&['preview','commit'].includes(action),'Operação indisponível.',405);fail(req.headers.get('origin')===url.origin,'Origem inválida.',403)
  const b=await req.json();fail(b&&typeof b==='object'&&!Array.isArray(b),'Dados inválidos.');const result=validateImport(state,b.rows)
  if(action==='preview')return json(preview(result,raw,state))
  fail(result.errors.length===0,'Há erros na planilha. Valide novamente.',400);fail(b.revision===raw.etag&&b.organizationRevision===(state.organization?.revision||null),'Cadastros ou estrutura alterados. Valide novamente.',409)
  const assignments=[],created=[]
  // Hash sequentially: bound CPU and memory, keep passwords out of audit and response.
  for(const r of result.rows){const secret=await hashPassword(r.password);created.push({id:r.id,name:r.name,email:r.email,role:r.role,active:true,manager:r.managerId||'',area:r.departmentName,...secret});assignments.push({actorId:actor.id,body:{person_id:r.id,company_id:r.companyId,department_id:r.departmentId,unit_id:r.unitId,position:r.position,hired_at:r.hired,revision:0}})}
  // Recheck expiration after expensive password hashing; CAS below protects revocation.
  resolveActor(req,state)
  state.users.push(...created);state.logs??=[];state.logs.unshift({at:new Date().toISOString(),who:actor.name,event:`Importação de ${created.length} usuários`});state.logs=state.logs.slice(0,5000)
  const saved=await BUCKET.put(KEY,JSON.stringify(state),{onlyIf:{etagMatches:raw.etag},requireOrganizationRevision:state.organization?.revision,organizationAssignments:assignments})
  fail(saved,'Cadastros ou estrutura alterados. Valide novamente.',409);return json({created:created.length,users:created.map(({id,name,email})=>({id,name,email}))})
 }catch(e){return json({error:e.status?e.message:e instanceof SyntaxError?'Dados JSON inválidos.':'Não foi possível importar os usuários.'},e.status||(e instanceof SyntaxError?400:500))}
}
