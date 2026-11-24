import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,readFileSync,rmSync,symlinkSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {collectAssets,buildAssets} from './build.mjs'
const root=mkdtempSync(join(tmpdir(),'learning-build-v10-'))
let checks=0
const html='<html><head><link rel="stylesheet" href="/style.css?v=1"></head><body><script src="/app.js?v=9"></script></body></html>'
const initial={'/':{file:'index.html',mime:'text/html;charset=utf-8'},'/app.js':{file:'app.js',mime:'text/javascript;charset=utf-8'},'/style.css':{file:'style.css',mime:'text/css;charset=utf-8'}}
const write=(name,data)=>writeFileSync(join(root,name),data)
const manifest=value=>write('asset-manifest.json',JSON.stringify(value))
const valid=()=>{manifest(initial);write('index.html',html);write('app.js','console.log("test")');write('style.css','body{color:#000}')}
const reject=(mutate,expected)=>{valid();mutate();const before=readFileSync(join(root,'assets.mjs'),'utf8');assert.throws(()=>buildAssets(root),expected);assert.equal(readFileSync(join(root,'assets.mjs'),'utf8'),before,'Build inválido não deve sobrescrever o bundle anterior');checks+=2}
try{
 valid();assert.equal(buildAssets(root),3);checks++
 assert.equal(Buffer.from(collectAssets(root)['/app.js'][1],'base64').toString(),'console.log("test")');checks++
 reject(()=>rmSync(join(root,'app.js')),/Arquivo ausente: app\.js/)
 reject(()=>write('app.js',''),/Arquivo vazio: app\.js/)
 reject(()=>manifest({...initial,'/app.js':{file:'app.js',mime:'text/css'}}),/MIME incompatível/)
 reject(()=>manifest({...initial,'/app.js':{file:'../app.js',mime:'text/javascript'}}),/fora do projeto/)
 reject(()=>{const x={...initial};delete x['/app.js'];manifest(x)},/rota ausente no manifesto/)
 reject(()=>write('index.html',html.replace('</body>','<script src="/app.js"></script></body>')),/carregado duas vezes/)
 reject(()=>write('index.html',html.replace('/app.js?v=9','https://external.example/app.js')),/Referência não local/)
 reject(()=>manifest({...initial,'/../app.js':initial['/app.js']}),/Rota inválida/)
 reject(()=>{rmSync(join(root,'app.js'));symlinkSync('/etc/hosts',join(root,'app.js'))},/aponta para fora do projeto/)
 console.log(`PASSOU: build V10 — ${checks} verificações de manifesto, assets, MIME, HTML e preservação do bundle.`)
}finally{rmSync(root,{recursive:true,force:true})}
