import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {spawnSync} from 'node:child_process'

const html=readFileSync('web-index.html','utf8')
const server=readFileSync('serve.mjs','utf8')
const packageJson=JSON.parse(readFileSync('package.json','utf8'))
const manifest=JSON.parse(readFileSync('asset-manifest.json','utf8'))
const roles=[
 ['SCORM V3','/scorm-v3.js','handleScormV3'],
 ['LXP V2','/lxp-v2.js','handleLxpV2'],
 ['Discovery V4','/discovery-v4.js','handleDiscoveryV4'],
 ['Pulse Seguro V5','/pulse-v5.js','handlePulseV5'],
 ['Avaliações V7','/assessments-v6.js','handleAssessmentsV6'],
 ['People Intelligence V6','/reports-v3.js','handleIntelligenceV6'],
 ['Kirkpatrick V7','/kirkpatrick-v7.js','handleKirkpatrickV7'],
]
let checks=0
for(const [label,asset,handler] of roles){
 assert.ok(manifest[asset],label+': asset indisponível no manifesto');checks++
 assert.ok(html.includes(asset),label+': referência ausente no HTML');checks++
 assert.ok(server.includes(handler+'(request'),label+': dispatch ausente');checks++
}
const baselineAssetsNotInPatch=new Set(['web-marca.png','web-waves.webp','web-style.css','web-zip.js','web-app.js','web-foundation.js'])
let baselineSkipped=0
for(const [route,entry] of Object.entries(manifest)){
 if(!existsSync(entry.file)&&baselineAssetsNotInPatch.has(entry.file)){baselineSkipped++;continue}
 const content=readFileSync(entry.file)
 assert.ok(content.length>0,'Arquivo vazio: '+route);checks++
 if(/\.(js|mjs)$/.test(entry.file)){
   const result=spawnSync(process.execPath,['--check',entry.file],{encoding:'utf8'})
   assert.equal(result.status,0,entry.file+' erro de sintaxe: '+result.stderr);checks++
 }
}
for(const filepath of ['kirkpatrick-v7.mjs','learning-assessments-v6.mjs','people-intelligence-v6.mjs','ops/backup-verify.mjs','verify-server-v7.mjs','verify-kirkpatrick-v7.mjs']){
 const result=spawnSync(process.execPath,['--check',filepath],{encoding:'utf8'})
 assert.equal(result.status,0,filepath+' erro de sintaxe: '+result.stderr);checks++
}
assert.ok(packageJson.scripts.test.includes('verify-release-v7.mjs'));checks++
assert.ok(server.includes("'/readyz'"));checks++
assert.ok(server.includes('logRoute(req.url)'));checks++
assert.ok(!/course\.completed/.test(readFileSync('kirkpatrick-v7.mjs','utf8')),'Kirkpatrick não deve escrever conclusão no LMS');checks++
console.log('PASSOU: Release V7 — '+checks+' verificações de assets, sintaxe, integração e rotas; arquivos da baseline externos ao patch não inspecionados: '+baselineSkipped)
