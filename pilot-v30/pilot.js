const login = document.querySelector('#login')
const logout = document.querySelector('#logout')
const status = document.querySelector('#status')
const dashboard = document.querySelector('#dashboard')
const pilot = '/api/tenant/v30/'

async function request(path, data) {
  const response = await fetch(path, data === undefined ? {} : {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(data)
  })
  if (!response.ok) throw Object.assign(new Error('Não foi possível concluir a solicitação.'), {status: response.status})
  return response.json()
}

function node(tag, label, parent) {
  const item = document.createElement(tag)
  item.textContent = label
  parent.append(item)
  return item
}

function list(title, labels) {
  const section = node('section', '', dashboard)
  node('h2', title, section)
  if (!labels.length) return node('p', 'Nenhum item disponível.', section)
  const items = node('ul', '', section)
  for (const label of labels) node('li', label, items)
  return items
}

let pageContent = new AbortController()

async function openScorm(course, enrollment, item, signal) {
  const launch = await request('/api/scorm/v3/launch?enrollment=' + encodeURIComponent(enrollment.id))
  if (signal.aborted) return
  const url = new URL(launch.url, location.origin)
  if (url.origin !== location.origin || !url.pathname.startsWith('/scorm/v3/')) throw new Error('Aula indisponível.')
  const frame = node('iframe', '', item)
  frame.title = course.title
  frame.setAttribute('sandbox', 'allow-scripts allow-forms')
  frame.referrerPolicy = 'no-referrer'
  const feedback = node('p', '', item)
  feedback.setAttribute('role', 'status')
  let queue = Promise.resolve()
  let progress = enrollment.progress
  window.addEventListener('message', event => {
    const message = event.data
    if (event.source !== frame.contentWindow || event.origin !== 'null' ||
      message?.key !== launch.key || message.type !== 'DNA_SCORM_COMMIT_V3' ||
      !['commit', 'terminate'].includes(message.op) || !message.values ||
      typeof message.values !== 'object' || Array.isArray(message.values)) return
    const cmi = Object.fromEntries(Object.entries(message.values).filter(([key, value]) =>
      key.startsWith('cmi.') && key.length <= 160 && typeof value === 'string' &&
      value.length <= (key === 'cmi.suspend_data' ? 64000 : 4000)))
    if (JSON.stringify(cmi).length > 88000) return
    queue = queue.then(async () => {
      if (signal.aborted || progress === 100) return
      const result = await request('/api/scorm/v3/commit', {
        id: enrollment.id, token: url.pathname.split('/')[3], key: launch.key, cmi
      })
      progress = result.progress
      item.firstChild.textContent = course.title + ' · ' + progress + '%'
      feedback.textContent = 'Progresso registrado · ' + progress + '%'
    }).catch(error => { feedback.textContent = error.message })
  }, {signal})
  frame.src = url.href
}

function showEnrollments(access, courses, enroll) {
  const catalog = new Map(courses.map(course => [course.id, course]))
  const entries = enroll.filter(item => item.person === access.me.id && catalog.has(item.course))
  const items = list('Minhas matrículas', entries.map(item => catalog.get(item.course).title + ' · ' + item.progress + '%'))
  for (const [index, enrollment] of entries.entries()) {
    const course = catalog.get(enrollment.course)
    const item = items.children[index]
    if (course.type === 'Leitura' && course.body) node('p', course.body, item)
    if (course.type !== 'SCORM') continue
    const button = node('button', 'Abrir aula SCORM', item)
    button.addEventListener('click', async () => {
      button.disabled = true
      try { await openScorm(course, enrollment, item, pageContent.signal) }
      catch (error) { status.textContent = error.message; button.disabled = false }
    })
  }
}

async function load() {
  pageContent.abort()
  pageContent = new AbortController()
  dashboard.replaceChildren()
  dashboard.hidden = true
  login.hidden = true
  logout.hidden = true
  status.textContent = ''
  try {
    const access = await request(pilot + 'access')
    logout.hidden = false
    node('h1', access.me.name, dashboard)
    node('p', access.me.role, dashboard)
    if (access.technical) {
      const {companies} = await request(pilot + 'admin/companies')
      list('Organizações', companies.map(item => item.name))
    } else {
      const {courses, missions, enroll, people} = await request('/api/data')
      list('Cursos', courses.map(item => item.title))
      list('Trilhas', missions.map(item => item.title))
      showEnrollments(access, courses, enroll)
      if (access.me.role !== 'Colaborador') list('Pessoas', people.map(item => item.name))
      if (['Administrador corporativo', 'RH/DHO', 'Diretoria', 'Líder'].includes(access.me.role)) {
        const link = node('a', 'Baixar relatório Excel', dashboard)
        link.href = pilot + 'reports/export.xlsx'
      }
    }
    dashboard.hidden = false
  } catch (error) {
    if (error.status === 401) login.hidden = false
    else status.textContent = error.message
  }
}

login.addEventListener('submit', async event => {
  event.preventDefault()
  const button = login.querySelector('button')
  button.disabled = true
  try {
    await request('/api/login', Object.fromEntries(new FormData(login)))
    await load()
  } catch (error) {
    status.textContent = error.status === 401 ? 'E-mail ou senha inválidos.' : error.message
  } finally {
    login.elements.password.value = ''
    button.disabled = false
  }
})

logout.addEventListener('click', async () => {
  try {
    await request('/api/logout', {})
    await load()
  } catch (error) {
    if (error.status === 401) await load()
    else status.textContent = error.message
  }
})

load()
