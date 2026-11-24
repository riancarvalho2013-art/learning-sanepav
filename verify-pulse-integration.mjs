import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const file=path=>readFileSync(new URL('./'+path,import.meta.url),'utf8')
const manifest=JSON.parse(file('asset-manifest.json'))
const html=file('web-index.html'),server=file('serve.mjs'),packageJson=JSON.parse(file('package.json'))
for(const [path,name,mime] of [['/pulse-v5.js','web-pulse-v5.js','text/javascript'],['/pulse-v5.css','web-pulse-v5.css','text/css']]){
 assert.equal(manifest[path]?.file,name)
 assert.ok(manifest[path].mime.startsWith(mime))
 assert.ok(html.includes(path+'?v='))
 assert.ok(file(name).length>1000)
}
assert.ok(server.includes("import {handlePulseV5} from './pulse-secure-v5.mjs'"))
assert.ok(server.includes("{prefix:'/api/pulse/v5/',handler:request=>handlePulseV5(request,context)}"), 'Pulse V5 deve ficar antes dos handlers legados')
assert.ok(!file('reports-v3.mjs').includes('Pulse anônimo protege'), 'Não rotular respostas identificadas como anônimas nos relatórios')
assert.ok(packageJson.scripts.test.includes('verify-pulse-v5.mjs'))
assert.ok(packageJson.scripts.test.includes('verify-pulse-integration.mjs'))
for(const moduleName of ['handleScormV3','handleDiscoveryV4','handleReportsV3','handleLxpV2'])assert.ok(server.includes(moduleName),'O módulo pré-existente deve ser preservado: '+moduleName)
console.log('PASSOU: rotas, manifesto, assets frontend, scripts de QA e preservação de SCORM V3, Discovery V4, Relatórios V3 e LXP V2.')
