/** V40.1 — contiguous account controls; no business API changes. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const cssRoute='/topbar-v40-1.css',cssFile='web-topbar-v40-1.css',tag=`<link rel="stylesheet" href="${cssRoute}">`;
const anchor="+companyContext()+notificationBell()+profileButton()+'</header>";
const grouped="+companyContext()+'<div class=\"la40-account-actions\">'+notificationBell()+profileButton()+'</div></header>";
const summaryAnchor="const sum=el('summary','la23-profile-summary');";
const summaryNew=summaryAnchor+"sum.setAttribute('aria-label','Menu da conta de '+d.me.name);";
function swap(s,a,b){if(s.split(a).length!==2)throw Error('V40.1: estrutura incompatível: '+a);return s.replace(a,()=>b);}
export function patchApp(s){if(s.includes(grouped)&&!s.includes(anchor))return s;return swap(s,anchor,grouped);}
export function patchDesign(s){if(s.includes(summaryNew))return s;return swap(s,summaryAnchor,summaryNew);}
export function patchIndex(s){if(s.includes(tag)&&s.split(cssRoute).length===2)return s;if(s.includes(cssRoute))throw Error('V40.1: referência CSS conflitante');if(!s.includes('/web-usabilidade-v38.css'))throw Error('V40.1: V38 precisa ser instalada primeiro');return swap(s,'</head>',tag+'\n</head>');}
export function patchManifest(m){if(m['/']?.file!=='web-index.html')throw Error('V40.1: manifesto incompatível');const entry={file:cssFile,mime:'text/css;charset=utf-8'};if(m[cssRoute]&&(m[cssRoute].file!==entry.file||m[cssRoute].mime!==entry.mime))throw Error('V40.1: conflito de asset');return {...m,[cssRoute]:entry};}
export function install(root='.') {const p=f=>resolve(root,f),read=f=>readFileSync(p(f),'utf8');if(!read(cssFile).includes('.la40-account-actions'))throw Error('V40.1: CSS ausente');const edits=[['web-app.js',patchApp(read('web-app.js'))],['web-design-v23.js',patchDesign(read('web-design-v23.js'))],['web-index.html',patchIndex(read('web-index.html'))],['asset-manifest.json',JSON.stringify(patchManifest(JSON.parse(read('asset-manifest.json'))),null,2)+'\n']];for(const [f,s] of edits)writeFileSync(p(f),s);return edits.length;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--install'))console.log('V40.1: cabeçalho integrado ('+install()+' arquivos).');
