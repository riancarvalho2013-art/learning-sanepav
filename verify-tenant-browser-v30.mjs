import assert from 'node:assert/strict'
import {createHash, randomUUID} from 'node:crypto'
import {spawn, execFileSync} from 'node:child_process'
import {once} from 'node:events'
import {mkdir, mkdtemp, rm} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {createServer} from 'node:net'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {hashPassword} from './credentials.mjs'

const profiles = [
  ['tecnico', 'Superadministrador técnico', null],
  ['admin', 'Administrador corporativo', 'A'],
  ['rh', 'RH/DHO', 'A'],
  ['diretoria', 'Diretoria', 'A'],
  ['lider', 'Líder', 'A'],
  ['aluno', 'Colaborador', 'B']
]
const password = randomUUID()

async function seed() {
  assert.ok(/^[a-f0-9-]{36}$/.test(process.env.FIXTURE_PASSWORD || ''))
  assert.ok(process.env.LEARNING_DB && !existsSync(process.env.LEARNING_DB))
  const {BUCKET} = await import('./storage.mjs')
  const db = new DatabaseSync(process.env.LEARNING_DB)
  try {
    const users = await Promise.all(profiles.map(async ([name, role]) => ({
      id: randomUUID(), name, role, email: name + '@example.invalid', active: true,
      ...await hashPassword(process.env.FIXTURE_PASSWORD)
    })))
    const companies = new Map(['A', 'B'].map(label => [label, randomUUID()]))
    const courses = [...companies].map(([label, company]) => ({
      id: randomUUID(), title: 'Curso fictício ' + label, tenantCompanyId: company,
      status: 'published', type: 'Leitura', body: 'Material fictício'
    }))
    const missions = courses.map(course => ({
      id: randomUUID(), title: course.title.replace('Curso fictício', 'Trilha fictícia'),
      tenantCompanyId: course.tenantCompanyId, courses: [course.id]
    }))
    const scorm = Buffer.from(`<!doctype html><html lang="pt-BR"><head><title>Aula fictícia</title></head><body>
      <button onclick="API.LMSInitialize('');API.LMSSetValue('cmi.core.lesson_status','completed');API.LMSCommit('')">Concluir aula fictícia</button>
      </body></html>`)
    const scormCourse = courses[1]
    Object.assign(scormCourse, {
      type: 'SCORM', entry: 'index.html', upload: randomUUID(), revision: 1,
      tenantScormV30: {fixtureOnly: true, files: [{
        path: 'index.html', bytes: scorm.length, sha256: createHash('sha256').update(scorm).digest('hex')
      }]}
    })
    assert.ok(await BUCKET.put('files/' + scormCourse.upload + '/index.html', scorm))
    const enroll = [], missionEnrollments = []
    for (const [index, [, , label]] of profiles.entries()) {
      if (!label) continue
      const person = users[index].id
      const company = companies.get(label)
      const course = courses.find(item => item.tenantCompanyId === company)
      const mission = missions.find(item => item.tenantCompanyId === company)
      enroll.push({id: randomUUID(), person, course: course.id, tenantCompanyId: company, progress: 0})
      missionEnrollments.push({id: randomUUID(), person, mission: mission.id, tenantCompanyId: company})
    }
    assert.ok(await BUCKET.put('system/state-v1', JSON.stringify({
      users, courses, missions, enroll, missionEnrollments, sessions: [], logs: [], fails: {}
    })))
    for (const [label, id] of companies) {
      db.prepare('INSERT INTO companies(id,name,active,created_at) VALUES(?,?,1,?)')
        .run(id, 'Organização fictícia ' + label, new Date().toISOString())
    }
    for (const [index, [, , label]] of profiles.entries()) {
      if (label) db.prepare('INSERT INTO person_organizations(person_id,company_id) VALUES(?,?)')
        .run(users[index].id, companies.get(label))
    }
    const {readFinalAssessmentRequirements} = await import('./learning-assessments-v6.mjs')
    readFinalAssessmentRequirements({assessmentDb: db}, companies.get('B'), scormCourse.id)
  } finally {
    db.close()
  }
}

async function verify() {
  const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
  const dir = await mkdtemp(join(tmpdir(), 'learning-browser-'))
  const env = {
    ...process.env, LEARNING_DB: join(dir, 'fixture.sqlite'), NODE_ENV: 'test',
    LEARNING_BACKUP_DIRECTORY: '', LEARNING_MEDIA_MODE: 'sqlite', RESEND_API_KEY: '',
    EMAIL_FROM: '', APP_ORIGIN: '', SETUP_KEY: '',
    LEARNING_TENANT_READ_MODE: 'pilot', LEARNING_TENANT_WRITE_MODE: 'pilot',
    LEARNING_TENANT_MEDIA_MODE: 'off', LEARNING_TENANT_SCORM_MODE: 'pilot',
    LEARNING_TENANT_CHECKPOINT_MODE: 'off', LEARNING_TENANT_GOVERNANCE_MODE: 'pilot',
    LEARNING_TENANT_ADVANCED_MODE: 'pilot', LEARNING_TENANT_BROWSER_MODE: 'pilot'
  }
  let browser, child, logs = ''
  try {
    execFileSync(process.execPath, [import.meta.filename, '--seed'], {env: {...env, FIXTURE_PASSWORD: password}, stdio: 'inherit'})
    const socket = createServer()
    socket.listen(0, '127.0.0.1')
    await once(socket, 'listening')
    const port = socket.address().port
    await new Promise(resolve => socket.close(resolve))
    const origin = 'http://127.0.0.1:' + port
    child = spawn(process.execPath, ['serve.mjs', '--port', String(port)], {env, stdio: ['ignore', 'pipe', 'pipe']})
    child.stdout.on('data', chunk => { logs += chunk })
    child.stderr.on('data', chunk => { logs += chunk })
    let ready = false
    for (let i = 0; i < 100; i++) {
      const response = await fetch(origin + '/healthz').catch(() => null)
      if (response?.ok) { ready = true; break }
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    assert.ok(ready, logs)
    browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_EXECUTABLE || undefined})
    const evidence = process.env.LEARNING_BROWSER_EVIDENCE
    if (evidence) await mkdir(evidence, {recursive: true})
    for (const [name, role, company] of profiles) {
      const context = await browser.newContext({viewport: name === 'aluno' ? {width: 390, height: 844} : {width: 1280, height: 900}})
      try {
        const page = await context.newPage()
        page.setDefaultTimeout(10000)
        await page.goto(origin)
        await page.getByLabel('E-mail').fill(name + '@example.invalid')
        if (name === 'aluno') {
          await page.getByLabel('Senha').fill('senha inválida de teste')
          await page.getByRole('button', {name: 'Entrar'}).click()
          await page.getByText('E-mail ou senha inválidos.').waitFor()
        }
        await page.getByLabel('Senha').fill(password)
        await page.getByRole('button', {name: 'Entrar'}).click()
        await page.getByText(role, {exact: true}).waitFor()
        assert.equal((await context.cookies()).find(cookie => cookie.name === 'learning')?.httpOnly, true)
        for (const route of ['/ativar', '/api/v2/bootstrap', '/api/socialFeed']) {
          assert.equal((await page.request.get(origin + route)).status(), 403, route)
        }
        if (company) {
          await page.getByText('Curso fictício ' + company, {exact: true}).waitFor()
          await page.getByText('Trilha fictícia ' + company, {exact: true}).waitFor()
          const other = company === 'A' ? 'B' : 'A'
          assert.equal(await page.getByText('Curso fictício ' + other).count(), 0)
          const companies = await page.request.get(origin + '/api/tenant/v30/admin/companies')
          assert.equal(companies.status(), 403)
          const people = await page.request.get(origin + '/api/tenant/v30/admin/people')
          assert.equal(people.status(), name === 'admin' ? 200 : 403)
          const report = await page.request.get(origin + '/api/tenant/v30/reports/export.xlsx')
          assert.equal(report.status(), name === 'aluno' ? 403 : 200)
          if (report.ok()) assert.equal((await report.body()).readUInt32LE(0), 0x04034b50)
          if (name === 'aluno') {
            await page.getByRole('button', {name: 'Abrir aula SCORM'}).click()
            const saved = page.waitForResponse(response => new URL(response.url()).pathname === '/api/scorm/v3/commit')
            await page.frameLocator('iframe').getByRole('button', {name: 'Concluir aula fictícia'}).click()
            const response = await saved
            assert.equal(response.status(), 200, await response.text())
            await page.getByText('Progresso registrado · 100%').waitFor()
          }
        } else {
          await page.getByText('Organização fictícia A', {exact: true}).waitFor()
          await page.getByText('Organização fictícia B', {exact: true}).waitFor()
          assert.equal((await page.request.get(origin + '/api/data')).status(), 403)
        }
        if (evidence) await page.screenshot({path: join(evidence, name + '.png'), fullPage: true})
        await page.getByRole('button', {name: 'Sair'}).click()
        await page.getByLabel('E-mail').waitFor()
        assert.equal((await page.request.get(origin + '/api/tenant/v30/access')).status(), 401)
        console.log('PASS navegador autenticado · ' + role)
      } finally {
        await context.close()
      }
    }
  } finally {
    await browser?.close()
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill()
      await exited
    }
    await rm(dir, {recursive: true, force: true, maxRetries: 4, retryDelay: 150})
  }
}

if (process.argv[2] === '--seed') await seed()
else await verify()
