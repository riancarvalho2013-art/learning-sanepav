import {readFileSync} from 'node:fs'

const headers = {
  'cache-control': 'private, no-store',
  'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'x-frame-options': 'DENY'
}

const assets = [
  ['GET /', 'pilot.html', 'text/html'],
  ['GET /pilot.css', 'pilot.css', 'text/css'],
  ['GET /pilot.js', 'pilot.js', 'text/javascript'],
  ['GET /pilot-logo.png', '../design-v22/beta-clean-logo.png', 'image/png']
]

export const browserRoutes = new Map(assets.map(([route, file, mime]) => {
  const body = readFileSync(new URL('./pilot-v30/' + file, import.meta.url))
  return [route, () => new Response(body, {headers: {...headers, 'content-type': mime + '; charset=utf-8'}})]
}))

for (const path of ['/api/login', '/api/logout']) {
  browserRoutes.set('POST ' + path, async (request, context, app) => {
    const result = await app.fetch(request, {...context, tenantPilotLogin: true})
    const resultHeaders = new Headers(result.headers)
    resultHeaders.set('cache-control', 'private, no-store')
    return new Response(result.body, {status: result.status, headers: resultHeaders})
  })
}
