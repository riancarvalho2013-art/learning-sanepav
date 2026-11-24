import {readFileSync,writeFileSync,renameSync,rmSync,statSync,realpathSync} from 'node:fs'
import {resolve,relative,isAbsolute,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {randomUUID} from 'node:crypto'

const root=dirname(fileURLToPath(import.meta.url))
const fail=(message)=>{throw new Error('Build Learning: '+message)}
function inside(base,file){
 if(typeof file!=='string'||!file||isAbsolute(file)||file.includes('\\'))fail('Caminho inválido: '+file)
 const full=resolve(base,file),rel=relative(base,full)
 if(!rel||rel==='..'||rel.startsWith('../')||rel.startsWith('..\\')||isAbsolute(rel))fail('Caminho fora do projeto: '+file)
 let actual
 try{actual=realpathSync(full)}catch{fail('Arquivo ausente: '+file)}
 const actualRel=relative(realpathSync(base),actual)
 if(actualRel==='..'||actualRel.startsWith('../')||actualRel.startsWith('..\\')||isAbsolute(actualRel))fail('Arquivo aponta para fora do projeto: '+file)
 if(!statSync(actual).isFile())fail('Não é um arquivo: '+file)
 return actual
}
const expectedMime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'}
const mediaType=value=>String(value||'').split(';')[0].trim().toLowerCase()
export function collectAssets(base){
 const manifest=JSON.parse(readFileSync(inside(base,'asset-manifest.json'),'utf8'))
 if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)||!manifest['/'])fail('Manifesto inválido ou página inicial ausente.')
 const assets=Object.create(null)
 for(const [route,item] of Object.entries(manifest)){
  if(!/^\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]*$/.test(route)||route.split('/').some(x=>x==='.'||x==='..'))fail('Rota inválida: '+route)
  if(!item||typeof item.mime!=='string'||!item.mime.trim())fail('MIME ausente para '+route)
  const full=inside(base,item.file),suffix=item.file.slice(item.file.lastIndexOf('.')).toLowerCase()
  if(expectedMime[suffix]&&expectedMime[suffix]!==mediaType(item.mime))fail('MIME incompatível: '+route+' ('+item.mime+')')
  const content=readFileSync(full)
  if(!content.length)fail('Arquivo vazio: '+item.file)
  assets[route]=[item.mime,content.toString('base64')]
 }
 if(mediaType(assets['/'][0])!=='text/html')fail('A página inicial deve ser HTML.')
 // HTML uses absolute, same-origin URLs for scripts and styles, including cache versions.
 // Validate every local reference before emitting the embedded asset bundle.
 const html=Buffer.from(assets['/'][1],'base64').toString('utf8')
 const used=new Set()
 for(const tag of html.matchAll(/<(script|link)\b[^>]*>/gi)){
  const kind=tag[1].toLowerCase(),attr=kind==='script'?'src':'href'
  const match=tag[0].match(new RegExp('\\b'+attr+'\\s*=\\s*["\']([^"\']+)["\']','i'))
  if(!match)continue
  const value=match[1]
  if(!value.startsWith('/')||value.startsWith('//'))fail('Referência não local no HTML: '+value)
  const route=value.split(/[?#]/)[0],asset=assets[route]
  if(!asset)fail('HTML referencia rota ausente no manifesto: '+route)
  if(kind==='script'){
   if(mediaType(asset[0])!=='text/javascript')fail('Script com MIME incorreto: '+route)
   if(used.has(route))fail('Script carregado duas vezes: '+route)
   used.add(route)
  }
  if(kind==='link'&&/\brel\s*=\s*["\']stylesheet["\']/i.test(tag[0])&&mediaType(asset[0])!=='text/css')fail('CSS com MIME incorreto: '+route)
 }
 return assets
}
export function buildAssets(base=root){
 const assets=collectAssets(base)
 // Write only after all inputs pass. A failed build must not leave a partial bundle.
 const destination=resolve(base,'assets.mjs'),temporary=destination+'.'+randomUUID()+'.tmp'
 try{writeFileSync(temporary,'export const ASSETS='+JSON.stringify(assets)+'\n',{flag:'wx'});renameSync(temporary,destination)}
 finally{rmSync(temporary,{force:true})}
 return Object.keys(assets).length
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log('Build Learning: '+buildAssets()+' assets verificados e compilados.')
