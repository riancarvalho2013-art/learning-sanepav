import {createRecovery} from './recovery.mjs'
import {randomUUID, createHash} from 'node:crypto'

export const accessRoles = ['Administrador', 'Líder', 'Colaborador', 'RH/DHO', 'Diretoria']
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: {'content-type': 'application/json;charset=utf-8', 'cache-control': 'no-store'}
})
const fail = (condition, message, status = 400) => {
  if (!condition) throw Object.assign(new Error(message), {status})
}
const text = (value, maximum = 120) => {
  fail(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maximum, 'Confira os campos obrigatórios e seus limites.')
  return value.trim()
}
const optionalText = (value, maximum = 120) => value ? text(value, maximum) : ''
function date(value) {
  if (!value) return null
  const parsed = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value+'T12:00:00Z') : new Date(NaN)
  fail(Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value, 'Informe uma data válida.')
  return value
}
const hash = value => createHash('sha256').update(value).digest('hex')
const asObject = value => {
  fail(value && typeof value === 'object' && !Array.isArray(value), 'Dados inválidos.')
  return value
}

export function createDomain(database) {
  function legacyState() {
    const object = database.prepare('SELECT body FROM objects WHERE key=?').get('system/state-v1')
    return object ? JSON.parse(Buffer.from(object.body).toString()) : {users:[],sessions:[],records:[],courses:[],enroll:[]}
  }

  function authenticate(state, digest, identity) {
    const session = state.sessions.find(item => item.digest === digest && item.identity === identity && item.until > Date.now())
    const user = state.users.find(item => item.id === session?.person && item.active)
    fail(user, 'Entre para continuar.', 401)
    return user
  }

  function context(state) {
    const assignments = new Map(database.prepare('SELECT * FROM person_organizations').all().map(row => [row.person_id,row]))
    const grants = database.prepare('SELECT * FROM company_access').all()
    const companies = database.prepare('SELECT * FROM companies WHERE active=1 ORDER BY name').all()
    return {assignments, grants, companies}
  }

  function decorateState(state) {
    Object.defineProperty(state, 'organization', {value:context(state), configurable:true})
    return state
  }

  function allowedCompanies(state, user) {
    const organization = state.organization || context(state)
    if (user.role === 'Administrador') return organization.companies.map(row => row.id)
    const assigned = organization.assignments.get(user.id)
    const ids = new Set(assigned ? [assigned.company_id] : [])
    if (['RH/DHO','Diretoria'].includes(user.role)) {
      for (const grant of organization.grants) if (grant.person_id === user.id) ids.add(grant.company_id)
    }
    const active = new Set(organization.companies.map(row => row.id))
    return [...ids].filter(id => active.has(id))
  }

  function canSeePerson(state, user, targetId) {
    if (targetId === user.id) return true
    if (user.role === 'Administrador') return true // Professional administration only.
    const organization = state.organization || context(state)
    const target = organization.assignments.get(targetId)
    const own = organization.assignments.get(user.id)
    if (['RH/DHO','Diretoria'].includes(user.role)) return Boolean(target && allowedCompanies(state,user).includes(target.company_id))
    if (user.role !== 'Líder') return false
    if ((target?.company_id || null) !== (own?.company_id || null)) return false
    const visited = new Set()
    let person = state.users.find(item => item.id === targetId)
    while (person?.manager && !visited.has(person.id)) {
      visited.add(person.id)
      if (person.manager === user.id) return true
      person = state.users.find(item => item.id === person.manager)
    }
    return false
  }

  function permissions(user) {
    return {
      organization: user.role === 'Administrador',
      learning: ['Administrador','RH/DHO'].includes(user.role),
      peopleDevelopment: ['Líder','RH/DHO'].includes(user.role),
      analytics: ['Líder','RH/DHO','Diretoria'].includes(user.role),
      technical: user.role === 'Administrador'
    }
  }

  function syncPeople(state) {
    const insert = database.prepare('INSERT OR IGNORE INTO people(id) VALUES(?)')
    for (const person of state.users) insert.run(person.id)
    const organization = context(state)
    for (const person of state.users) {
      const assigned = organization.assignments.get(person.id)
      const manager = organization.assignments.get(person.manager)
      fail(!assigned || !manager || assigned.company_id === manager.company_id, 'A liderança e o colaborador precisam pertencer à mesma empresa.')
    }
  }

  function audit(user, type, id, event, before, after) {
    database.prepare('INSERT INTO domain_audit(actor_id,entity_type,entity_id,event,at,before_json,after_json) VALUES(?,?,?,?,?,?,?)')
      .run(user.id,type,id,event,new Date().toISOString(),before ? JSON.stringify(before) : null,after ? JSON.stringify(after) : null)
  }

  function bootstrap(state,user) {
    const ids = allowedCompanies(state,user)
    const allowed = new Set(ids)
    const organization = state.organization || context(state)
    const companies = organization.companies.filter(row => allowed.has(row.id))
    const units = database.prepare('SELECT * FROM units WHERE active=1 ORDER BY name').all().filter(row => allowed.has(row.company_id))
    const departments = database.prepare('SELECT * FROM departments WHERE active=1 ORDER BY name').all().filter(row => allowed.has(row.company_id))
    const people = state.users.filter(person => canSeePerson(state,user,person.id)).map(person => ({
      id:person.id, name:person.name, email:person.email, role:person.role, active:person.active,
      manager:person.manager, area:person.area, ...(organization.assignments.get(person.id) || {})
    }))
    return {companies,units,departments,people,companyRegistry:user.role==='Administrador'?database.prepare('SELECT * FROM companies ORDER BY name').all():undefined,unitRegistry:user.role==='Administrador'?database.prepare('SELECT * FROM units ORDER BY name').all():undefined,departmentRegistry:user.role==='Administrador'?database.prepare('SELECT * FROM departments ORDER BY name').all():undefined,permissions:permissions(user),role:user.role,
      companyIds:ids,unassigned:people.filter(person=>!person.company_id).length,
      grants:permissions(user).organization ? organization.grants : [],
      schemaVersion:database.prepare('SELECT max(version) AS version FROM schema_migrations').get().version}
  }

  function saveOrganization(user, type, body) {
    fail(user.role === 'Administrador', 'Acesso restrito à administração técnica.', 403)
    const tables = {company:'companies',unit:'units',department:'departments'}
    const table = tables[type]
    fail(table, 'Cadastro desconhecido.', 404)
    const id = body.id || randomUUID()
    const before = database.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id)
    fail(!body.id || before, 'Cadastro inexistente.', 404)
    const name = text(body.name)
    // Archival requires reassignment first and keeps referenced historical rows.
    const active = body.active === false ? 0 : 1
    if (table === 'companies') {
      if (!active) {
        const referenced = database.prepare('SELECT 1 FROM person_organizations WHERE company_id=? LIMIT 1').get(id)
        fail(!referenced, 'Reatribua as pessoas antes de arquivar a empresa.')
      }
      database.prepare('INSERT INTO companies(id,name,active,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,active=excluded.active')
        .run(id,name,active,before?.created_at || new Date().toISOString())
    } else {
      const company = database.prepare('SELECT * FROM companies WHERE id=? AND active=1').get(body.company_id)
      fail(company, 'Selecione uma empresa ativa.')
      fail(!before || before.company_id === company.id, 'Crie outro cadastro para usar em outra empresa.')
      const column = table === 'units' ? 'unit_id' : 'department_id'
      if (!active) fail(!database.prepare(`SELECT 1 FROM person_organizations WHERE ${column}=? LIMIT 1`).get(id), 'Reatribua as pessoas antes de arquivar o cadastro.')
      database.prepare(`INSERT INTO ${table}(id,company_id,name,active) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,active=excluded.active`)
        .run(id,company.id,name,active)
    }
    const after = database.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id)
    audit(user,type,id,before ? 'updated' : 'created',before,after)
    return {id}
  }

  function assignPerson(state,user,body) {
    fail(user.role === 'Administrador', 'Acesso restrito à administração técnica.', 403)
    const person = state.users.find(item=>item.id===body.person_id)
    fail(person, 'Pessoa inexistente.', 404)
    const company = database.prepare('SELECT * FROM companies WHERE id=? AND active=1').get(body.company_id)
    fail(company, 'Selecione uma empresa ativa.')
    for (const [field,table] of [['unit_id','units'],['department_id','departments']]) {
      if (body[field]) fail(database.prepare(`SELECT 1 FROM ${table} WHERE id=? AND company_id=? AND active=1`).get(body[field],company.id), 'Unidade ou área incompatível com a empresa.')
    }
    const before = database.prepare('SELECT * FROM person_organizations WHERE person_id=?').get(person.id)
    fail((before?.revision || 0) === Number(body.revision), 'O vínculo mudou. Atualize a página.', 409)
    const hired = date(body.hired_at), ended = date(body.ended_at)
    fail(!ended || hired && ended >= hired, 'O desligamento deve ser posterior à admissão.')
    database.prepare(`INSERT INTO person_organizations(person_id,company_id,unit_id,department_id,position,hired_at,ended_at,revision)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(person_id) DO UPDATE SET company_id=excluded.company_id,unit_id=excluded.unit_id,
      department_id=excluded.department_id,position=excluded.position,hired_at=excluded.hired_at,ended_at=excluded.ended_at,revision=excluded.revision`)
      .run(person.id,company.id,body.unit_id||null,body.department_id||null,optionalText(body.position),hired,ended,(before?.revision||0)+1)
    syncPeople(state)
    const after = database.prepare('SELECT * FROM person_organizations WHERE person_id=?').get(person.id)
    audit(user,'assignment',person.id,'updated',before,after)
    return {id:person.id,revision:after.revision}
  }

  function grantAccess(state,user,body) {
    fail(user.role === 'Administrador', 'Acesso restrito à administração técnica.', 403)
    const person = state.users.find(item=>item.id===body.person_id)
    fail(person && ['RH/DHO','Diretoria'].includes(person.role), 'Selecione uma pessoa de RH/DHO ou Diretoria.')
    fail(Array.isArray(body.company_ids) && body.company_ids.length <= 100 && new Set(body.company_ids).size === body.company_ids.length, 'Selecione empresas sem repetição.')
    for (const company of body.company_ids) fail(database.prepare('SELECT 1 FROM companies WHERE id=? AND active=1').get(company), 'Empresa indisponível.')
    const before = database.prepare('SELECT company_id FROM company_access WHERE person_id=?').all(person.id)
    database.prepare('DELETE FROM company_access WHERE person_id=?').run(person.id)
    const insert = database.prepare('INSERT INTO company_access VALUES(?,?)')
    for (const company of body.company_ids) insert.run(person.id,company)
    audit(user,'access',person.id,'updated',before,body.company_ids)
    return {id:person.id}
  }

  function analytics(state,user,url) {
    fail(permissions(user).analytics, 'Painel reservado à liderança, RH e diretoria.', 403)
    const company = url.searchParams.get('company') || ''
    const unit = url.searchParams.get('unit') || ''
    const department = url.searchParams.get('department') || ''
    const companies = allowedCompanies(state,user)
    fail(!company || companies.includes(company), 'Empresa fora do seu escopo.', 403)
    const organization = state.organization || context(state)
    const people = state.users.filter(person => {
      if (!canSeePerson(state,user,person.id)) return false
      const assignment = organization.assignments.get(person.id)
      return (!company || assignment?.company_id === company) && (!unit || assignment?.unit_id === unit) && (!department || assignment?.department_id === department)
    })
    const ids = new Set(people.map(person=>person.id))
    const enrollments = state.enroll.filter(item=>ids.has(item.person))
    const completed = enrollments.filter(item=>item.progress===100)
    const courses = new Map(state.courses.map(item=>[item.id,item]))
    const records = state.records.filter(item=>ids.has(item.person))
    const now = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
    const activePeople=people.filter(person=>{const assignment=organization.assignments.get(person.id);return person.active&&(!assignment?.hired_at||assignment.hired_at<=now)&&(!assignment?.ended_at||assignment.ended_at>now)})
    const availableDates = people.filter(person=>organization.assignments.get(person.id)?.hired_at)
    return {
      generatedAt:new Date().toISOString(), filters:{company,unit,department},
      indicators:[
        {id:'headcount',label:'Colaboradores ativos',value:activePeople.length,definition:'Pessoas ativas na data de consulta, com admissão já iniciada e desligamento futuro ou ausente, no escopo autorizado.'},
        {id:'enrollments',label:'Matrículas',value:enrollments.length,definition:'Quantidade de matrículas atribuídas às pessoas do escopo.'},
        {id:'completion',label:'Conclusão de cursos',value:enrollments.length?Math.round(completed.length/enrollments.length*100):null,unit:'%',definition:'Matrículas com progresso de 100% divididas pelo total de matrículas.'},
        {id:'hours',label:'Horas de aprendizagem',value:completed.reduce((sum,item)=>sum+Number(courses.get(item.course)?.minutes||0)/60,0),unit:'h',definition:'Soma da carga horária declarada dos cursos concluídos, por matrícula.'},
        {id:'pdi',label:'PDIs concluídos',value:records.filter(item=>item.kind==='PDI'&&item.status==='Concluído').length,definition:'Registros de desenvolvimento com status Concluído.'},
        {id:'meetings',label:'Reuniões 1:1 registradas',value:records.filter(item=>item.kind==='1:1').length,definition:'Contagem de reuniões. O conteúdo privado permanece restrito aos participantes.'},
        {id:'overdue',label:'Prazos vencidos',value:enrollments.filter(item=>item.due&&item.due<now&&item.progress<100).length,definition:'Matrículas com prazo anterior à data atual e progresso abaixo de 100%.'},
        {id:'turnover',label:'Turnover',value:null,definition:'Indisponível enquanto não houver histórico de movimentações e headcount por período.'},
        {id:'admissionCoverage',label:'Admissões com data cadastrada',value:availableDates.length,definition:'Cobertura do cadastro de admissão. Sem inferir datas dos registros antigos.'}
      ],
      byCompany:organization.companies.filter(item=>companies.includes(item.id)).map(item=>({id:item.id,name:item.name,value:activePeople.filter(person=>organization.assignments.get(person.id)?.company_id===item.id).length}))
    }
  }

  async function handle(request, credentials) {
    const url = new URL(request.url)
    const path = url.pathname.slice('/api/v2/'.length)
    const body = request.method === 'POST' ? asObject(await request.json()) : null
    fail(['GET','POST'].includes(request.method), 'Método indisponível.', 405)
    database.exec('BEGIN IMMEDIATE')
    try {
      const state = decorateState(legacyState())
      const user = authenticate(state,credentials.digest,credentials.identity)
      let result
      if (request.method === 'GET') {
        if (path === 'organization') result=bootstrap(state,user)
        else if (path === 'analytics') result=analytics(state,user,url)
        else if (path === 'audit') {
          fail(user.role==='Administrador','Acesso restrito à administração técnica.',403)
          // Technical audit returns event metadata, without HR payloads.
          result={items:database.prepare('SELECT sequence,actor_id,entity_type,entity_id,event,at FROM domain_audit ORDER BY sequence DESC LIMIT 200').all()}
        } else fail(false,'Recurso inexistente.',404)
      } else {
        if (['company','unit','department'].includes(path)) result=saveOrganization(user,path,body)
        else if (path==='assignment') result=assignPerson(state,user,body)
        else if (path==='access') result=grantAccess(state,user,body)
        else fail(false,'Operação inexistente.',404)
      }
      if(request.method==='POST')database.prepare('UPDATE objects SET etag=? WHERE key=?').run(randomUUID(),'system/state-v1')
      database.exec('COMMIT')
      return json(result)
    } catch (error) {
      database.exec('ROLLBACK')
      if (error.code?.startsWith('ERR_SQLITE') || /constraint failed/i.test(error.message)) throw Object.assign(new Error('Cadastro duplicado ou vínculo incompatível. Confira os dados.'),{status:409})
      throw error
    }
  }

  return {recovery:createRecovery(database),handle,decorateState,syncPeople,canSeePerson,allowedCompanies,permissions}
}
