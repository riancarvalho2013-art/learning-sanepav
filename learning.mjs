import {randomBytes, randomUUID} from 'node:crypto'

export const courseStatus = course => course.status || 'published'
export const courseRevision = course => course.revision || 0
export function missingPrerequisites(state,enrollment) {
  if(!enrollment)return []
  return (enrollment.prerequisites||[]).filter(course=>!state.enroll.some(item=>item.person===enrollment.person&&item.course===course&&item.progress===100))
}
export function requireLearningAccess(state,enrollment) {
  check(enrollment&&!missingPrerequisites(state,enrollment).length,'Conclua as etapas anteriores para acessar este conteúdo.',403)
}
const check = (condition, message, status=400) => {
  if (!condition) throw Object.assign(new Error(message), {status})
}
const str = (value, max=400) => typeof value==='string' ? value.trim().slice(0, max) : ''
const num = (value, min, max) => {
  const n = Number(value)
  check(Number.isFinite(n) && n>=min && n<=max, 'Valor numérico inválido.')
  return n
}

export function requirePublished(course) {
  check(course && courseStatus(course)==='published', 'Somente cursos publicados podem receber novas matrículas.', 409)
}
export function checkCourseRevision(course, expected) {
  check(Number.isSafeInteger(expected) && expected===courseRevision(course),
    'O curso foi alterado. Atualize o catálogo antes de salvar.', 409)
}
export function stampCourse(course, user, event) {
  course.revision=courseRevision(course)+1
  course.updated=new Date().toISOString()
  ;(course.history??=[]).push({at:course.updated,person:user.id,event,revision:course.revision})
}
export function changeCourseState(course, user, body) {
  check(course, 'Curso inexistente.', 404)
  checkCourseRevision(course, body.revision)
  check(['published','archived'].includes(body.status), 'Escolha publicar ou arquivar.')
  check(courseStatus(course)!==body.status, 'O curso já possui este status.', 409)
  course.status=body.status
  if(body.status==='published')course.published=new Date().toISOString()
  stampCourse(course,user,body.status==='published'?'published':'archived')
}

export function upsertQuestion(state, user, body, newId = randomUUID) {
  const bank = (state.questionBank ??= [])
  const prompt = str(body.prompt, 1000)
  check(prompt, 'Informe o enunciado da questão.')
  check(Array.isArray(body.options) && body.options.length>=2 && body.options.length<=8, 'Informe entre 2 e 8 alternativas.')
  const options = body.options.map(item=>str(item, 400))
  check(options.every(Boolean), 'Nenhuma alternativa pode ficar vazia.')
  const answer = num(body.answer, 0, options.length-1)
  check(Number.isInteger(answer), 'Selecione a alternativa correta.')
  const now = new Date().toISOString()
  let question = body.id ? bank.find(q=>q.id===body.id) : null
  if (body.id) check(question, 'Questão não encontrada.', 404)
  const fields = {
    title: str(body.title, 150) || prompt.slice(0, 80),
    competency: str(body.competency, 120) || 'Geral',
    category: str(body.category, 100) || 'Conhecimentos',
    difficulty: ['basico','intermediario','avancado'].includes(body.difficulty) ? body.difficulty : 'basico',
    prompt,
    options,
    answer,
    active: body.active === undefined ? true : Boolean(body.active),
    updatedAt: now,
    updatedBy: user.id
  }
  if (!question) {
    question = { id: newId(), ...fields, createdAt: now, createdBy: user.id }
    bank.push(question)
  } else {
    Object.assign(question, fields)
  }
  return question
}

export function resolveCourseQuestions(state, course) {
  if (Array.isArray(course.questionIds) && course.questionIds.length) {
    const bank = state.questionBank || []
    return course.questionIds
      .map(qid => bank.find(q => q.id === qid && q.active !== false))
      .filter(Boolean)
      .map(q => ({ id: q.id, prompt: q.prompt, options: q.options, answer: q.answer }))
  }
  if (Array.isArray(course.questions) && course.questions.length) {
    return course.questions.map((q, index) => ({
      id: q.id || `q-${index+1}`,
      prompt: q.prompt,
      options: q.options,
      answer: q.answer
    }))
  }
  if (course.type === 'Questionário' && Array.isArray(course.options)) {
    return [{ id: course.id, prompt: course.body, options: course.options, answer: course.answer }]
  }
  return []
}

export function ensureCertificate(state, enrollment, course, person, issuer, companyName='') {
  check(enrollment && enrollment.progress === 100, 'Conclua 100% do curso para emitir o certificado.', 409)
  const certs = (state.certificates ??= [])
  const existing = certs.find(c => c.person === enrollment.person && c.course === enrollment.course && c.status !== 'revoked')
  if (existing) return existing
  const code = `SNPV-${randomBytes(2).toString('hex').toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`
  const cert = {
    id: randomUUID(),
    code,
    person: enrollment.person,
    personName: person?.name || 'Colaborador',
    companyId: person?.companyId || '',
    companyName: companyName || 'Sanepav Learning',
    course: enrollment.course,
    courseTitle: course?.title || 'Treinamento',
    enrollmentId: enrollment.id,
    minutes: Number(course?.minutes || 0),
    score: Number.isFinite(Number(enrollment.score)) ? Number(enrollment.score) : null,
    issuedAt: new Date().toISOString(),
    issuedBy: issuer?.id || enrollment.person,
    issuedByName: issuer?.name || 'Universidade Corporativa Sanepav',
    status: 'valid'
  }
  certs.push(cert)
  return cert
}

export function submitAssessment(state, user, enrollment, course, body, issuer, companyName='') {
  requireLearningAccess(state, enrollment)
  check(course && courseStatus(course) !== 'draft', 'Curso indisponível.', 403)
  const questions = resolveCourseQuestions(state, course)
  check(questions.length > 0, 'Este curso não possui avaliação configurada.')
  const maxAttempts = Number.isInteger(course.maxAttempts) && course.maxAttempts >= 0 ? course.maxAttempts : 3
  const attempts = (enrollment.attempts ??= [])
  if (maxAttempts > 0 && attempts.length >= maxAttempts && !enrollment.passed) {
    check(false, `Limite de ${maxAttempts} tentativa(s) atingido para esta avaliação.`, 409)
  }
  const answers = Array.isArray(body.answers) ? body.answers.map(Number) : []
  check(answers.length === questions.length, 'Responda todas as questões antes de enviar.')
  let correctCount = 0
  questions.forEach((q, idx) => {
    check(Number.isInteger(answers[idx]) && answers[idx] >= 0 && answers[idx] < q.options.length, 'Resposta inválida.')
    if (answers[idx] === q.answer) correctCount += 1
  })
  const score = Math.round((correctCount / questions.length) * 100)
  const passingScore = Number.isFinite(Number(course.passingScore)) ? Number(course.passingScore) : 70
  const passed = score >= passingScore
  const now = new Date().toISOString()
  const attempt = { id: randomUUID(), at: now, score, correctCount, totalCount: questions.length, passingScore, passed, answers }
  attempts.push(attempt)
  enrollment.score = Math.max(Number(enrollment.score || 0), score)
  enrollment.passed = Boolean(enrollment.passed || passed)
  enrollment.updated = now
  let certificate = null
  if (passed) {
    enrollment.progress = 100
    if (!enrollment.completed) enrollment.completed = now
    certificate = ensureCertificate(state, enrollment, course, user, issuer, companyName)
  } else {
    enrollment.progress = Math.max(Number(enrollment.progress || 0), 1)
  }
  return { attempt, passed, score, passingScore, remainingAttempts: maxAttempts > 0 ? Math.max(0, maxAttempts - attempts.length) : null, certificate }
}

export function upsertClass(state, user, body, newId = randomUUID) {
  const classes = (state.classes ??= [])
  const course = state.courses.find(c => c.id === body.course)
  check(course, 'Curso não encontrado.', 404)
  requirePublished(course)
  const title = str(body.title, 150) || `Turma · ${course.title}`
  const instructor = str(body.instructor, 120)
  check(instructor, 'Informe o nome do instrutor.')
  const location = str(body.location, 150) || 'Presencial'
  const sessions = Array.isArray(body.sessions) ? body.sessions.map((item, i) => {
    const date = str(item.date, 30)
    check(/^\d{4}-\d{2}-\d{2}$/.test(date), 'Data de sessão inválida (use AAAA-MM-DD).')
    return { id: str(item.id, 64) || newId(), date, topic: str(item.topic, 150) || `Encontro ${i+1}` }
  }) : []
  check(sessions.length > 0, 'Adicione pelo menos uma sessão presencial.')
  const minAttendance = body.minAttendance === undefined ? 75 : num(body.minAttendance, 1, 100)
  const capacity = body.capacity === undefined ? 30 : num(body.capacity, 1, 500)
  const status = ['scheduled','completed','cancelled'].includes(body.status) ? body.status : 'scheduled'
  let cls = body.id ? classes.find(c => c.id === body.id) : null
  if (body.id) check(cls, 'Turma não encontrada.', 404)
  const now = new Date().toISOString()
  if (!cls) {
    cls = {
      id: newId(),
      course: course.id,
      title,
      instructor,
      location,
      companyId: str(body.companyId, 64),
      capacity,
      minAttendance,
      sessions,
      participants: [],
      attendance: {},
      status,
      createdAt: now,
      createdBy: user.id,
      updatedAt: now
    }
    classes.push(cls)
  } else {
    Object.assign(cls, { title, instructor, location, companyId: str(body.companyId, 64) || cls.companyId, capacity, minAttendance, sessions, status, updatedAt: now })
  }
  return cls
}

export function enrollClass(state, body, newId = randomUUID) {
  const cls = (state.classes || []).find(c => c.id === body.classId)
  check(cls, 'Turma não encontrada.', 404)
  const peopleIds = Array.isArray(body.people) ? [...new Set(body.people.filter(Boolean))] : (body.person ? [body.person] : [])
  check(peopleIds.length > 0, 'Selecione ao menos um participante.')
  check(peopleIds.length <= cls.capacity, `Capacidade máxima da turma (${cls.capacity}) excedida.`, 409)
  cls.participants = peopleIds
  for (const personId of peopleIds) {
    if (!state.enroll.some(e => e.person === personId && e.course === cls.course)) {
      state.enroll.push({ id: newId(), person: personId, course: cls.course, progress: 0, due: cls.sessions.at(-1)?.date || '' })
    }
  }
  cls.updatedAt = new Date().toISOString()
  return cls
}

export function recordClassAttendance(state, user, body, resolvePerson) {
  const cls = (state.classes || []).find(c => c.id === body.classId)
  check(cls, 'Turma não encontrada.', 404)
  const session = cls.sessions.find(s => s.id === body.sessionId)
  check(session, 'Sessão não encontrada nesta turma.', 404)
  check(Array.isArray(body.records) && body.records.length > 0, 'Informe a lista de presença.')
  const course = state.courses.find(c => c.id === cls.course)
  cls.attendance ??= {}
  const now = new Date().toISOString()
  const completedPeople = []
  for (const rec of body.records) {
    check(cls.participants.includes(rec.personId), 'Participante não inscrito na turma.', 400)
    check(['present','absent','excused'].includes(rec.status), 'Status de presença inválido.')
    ;(cls.attendance[rec.personId] ??= {})[session.id] = rec.status
  }
  for (const personId of cls.participants) {
    const personAtt = cls.attendance[personId] || {}
    const recordedCount = cls.sessions.filter(s => Boolean(personAtt[s.id])).length
    if (recordedCount === cls.sessions.length) {
      const presentCount = cls.sessions.filter(s => personAtt[s.id] === 'present').length
      const rate = Math.round((presentCount / cls.sessions.length) * 100)
      const enrollment = state.enroll.find(e => e.person === personId && e.course === cls.course)
      if (enrollment && rate >= cls.minAttendance) {
        enrollment.progress = 100
        enrollment.score = Math.max(Number(enrollment.score || 0), rate)
        enrollment.updated = now
        if (!enrollment.completed) enrollment.completed = now
        const person = resolvePerson(personId)
        ensureCertificate(state, enrollment, course, person, user, person?.companyName || '')
        completedPeople.push(personId)
      }
    }
  }
  cls.updatedAt = now
  return { classId: cls.id, sessionId: session.id, completedPeople }
}
