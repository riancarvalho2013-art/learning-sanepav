/** V38: register additive, same-origin CSS/JS after existing app assets. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export const assets=Object.freeze({'/web-usabilidade-v38.css':{file:'web-usabilidade-v38.css',mime:'text/css;charset=utf-8'},'/web-usabilidade-v38.js':{file:'web-usabilidade-v38.js',mime:'text/javascript;charset=utf-8'}});
const css='<link rel="stylesheet" href="/web-usabilidade-v38.css">';
const js='<script defer src="/web-usabilidade-v38.js"></script>';
export function patchManifestV38(m){
 if(!m||typeof m!=='object'||Array.isArray(m)||m['/']?.file!=='web-index.html')throw Error('V38: manifesto da página inicial incompatível.');
 const out={...m};
 for(const [route,entry] of Object.entries(assets)){
  if(out[route]&&(out[route].file!==entry.file||out[route].mime!==entry.mime))throw Error('V38: conflito de asset '+route);
  out[route]={...entry};
 }
 return out;
}
export function patchIndexV38(src){
 if(typeof src!=='string'||(src.match(/<\/head\s*>/gi)||[]).length!==1||(src.match(/<\/body\s*>/gi)||[]).length!==1||!/<[^>]+\bid\s*=\s*["']app["']/i.test(src))throw Error('V38: estrutura HTML incompatível.');
 for(const [url,tag] of [['/web-usabilidade-v38.css',css],['/web-usabilidade-v38.js',js]]){
  const count=src.split(url).length-1;
  if(count>1||(count===1&&!src.includes(tag)))throw Error('V38: referência de asset conflitante '+url);
 }
 if(!src.includes(css))src=src.replace(/<\/head\s*>/i,m=>css+'\n'+m);
 if(!src.includes(js))src=src.replace(/<\/body\s*>/i,m=>js+'\n'+m);
 return src;
}
export function installV38(root='.'){
 const path=f=>resolve(root,f);
 const m=patchManifestV38(JSON.parse(readFileSync(path('asset-manifest.json'),'utf8')));
 const html=patchIndexV38(readFileSync(path('web-index.html'),'utf8'));
 for(const a of Object.values(assets)){if(!readFileSync(path(a.file),'utf8').trim())throw Error('V38: asset vazio '+a.file);}
 writeFileSync(path('web-index.html'),html);writeFileSync(path('asset-manifest.json'),JSON.stringify(m,null,2)+'\n');
 return m;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--install')){installV38();console.log('V38: camada progressiva de usabilidade e acessibilidade registrada.');}
