import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const file=f=>readFileSync(new URL('./'+f,import.meta.url),'utf8')
const manifest=JSON.parse(file('asset-manifest.json'))
const html=file('web-index.html'),server=file('serve.mjs')
const pkg=JSON.parse(file('package.json'))
for(const [url,asset] of [['/pulse-v5.js','web-pulse-v5.js'],['/pulse-v5.css','web-pulse-v5.css'],['/assessments-v6.js','web-assessments-v6.js'],['/assessments-v6.css','web-assessments-v6.css']]){
 assert.equal(manifest[url]?.file,asset,'Manifest incorreto: '+url)
 assert.ok(html.includes(url+'?v='),'HTML não carrega '+url)
 assert.ok(file(asset).length>1000,'Asset incompleto: '+asset)
}
for(const module of ['handleAssessmentsV6','handleIntelligenceV6','handlePulseV5','handleDiscoveryV4','handleReportsV3','handleScormV3','handleLxpV2','handleEvolution']){
 assert.ok(server.includes(module),'Handler ausente: '+module)
}
for(const m of ['verify-assessments-v6.mjs','verify-intelligence-v6.mjs','verify-pulse-v5.mjs','verify-pulse-integration.mjs','verify-scorm-v3.mjs'])assert.ok(pkg.scripts.test.includes(m),'Teste ausente do npm test: '+m)
assert.ok(file('web-reports-v3.js').includes('Inteligência integrada'),'Relatórios não incluem a nova visão')
assert.ok(file('web-reports-v3.js').includes('intelligence/v6/summary'),'Relatório não consulta a camada semântica V6')
assert.ok(html.indexOf('pulse-v5.js')<html.indexOf('assessments-v6.js'),'Ordem de integração alterada')
assert.ok(!file('reports-v3.mjs').includes('Pulse anônimo protege'),'Relatório legado não deve declarar anonimato')
assert.ok(!file('learning-assessments-v6.mjs').includes('SETUP_KEY'),'Nova API não deve ler credenciais de ativação')
console.log('PASSOU: Release V6 — manifest, HTML, integração de APIs, regressão SCORM/LXP e scripts de QA conferidos.')
