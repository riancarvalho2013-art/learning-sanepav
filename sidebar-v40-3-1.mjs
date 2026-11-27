/** V40.3.1 — correct compact rail geometry, including legacy !important styles. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const marker='/* V40.3.1 compact rail alignment */';
export const styles=String.raw`/* V40.3.1 compact rail alignment */
@media(min-width:761px){
 #app .shell.la403-compact > aside#academySidebar {
  box-sizing:border-box;width:80px;min-width:80px;max-width:80px;
  padding:14px 8px;gap:0;align-items:center;overflow:hidden;
 }
 #app .shell.la403-compact > aside#academySidebar > .la21-product,
 #app .shell.la403-compact > aside#academySidebar > .brand {
  box-sizing:border-box;display:flex;align-items:center;justify-content:center;
  width:100%;min-width:0;flex:0 0 auto;gap:0;padding:12px 0;margin:0;
  border:0;border-radius:0;
 }
 #app .shell.la403-compact > aside#academySidebar > .la21-product {padding-top:4px;padding-bottom:14px;}
 #app .shell.la403-compact > aside#academySidebar > .brand {border-block:1px solid #b9cfee44;}
 #app .shell.la403-compact > aside#academySidebar > .la21-product img {
  display:block;flex:none;width:44px;height:44px;max-width:44px;margin:0;object-fit:contain;
 }
 #app .shell.la403-compact > aside#academySidebar > .brand img {
  box-sizing:border-box;display:block;flex:none;width:48px;height:40px;max-width:48px;
  margin:0;padding:3px;border-radius:7px;object-fit:contain;
 }
 #app .shell.la403-compact > aside#academySidebar > nav {
  box-sizing:border-box;width:100%;min-width:0;min-height:0;flex:1 1 auto;
  margin:0;padding:8px 0 12px;overflow-y:auto;overflow-x:hidden;
  scrollbar-width:none;scrollbar-gutter:auto;overscroll-behavior-y:contain;
 }
 #app .shell.la403-compact > aside#academySidebar > nav::-webkit-scrollbar {display:none;width:0;height:0;}
 #app .shell.la403-compact > aside#academySidebar nav small {
  display:block;width:48px;height:1px;min-height:1px;padding:0!important;
  margin:10px auto!important;border:0;background:#b9cfee44;
  font-size:0!important;line-height:0;letter-spacing:0!important;overflow:hidden;
 }
 #app .shell.la403-compact > aside#academySidebar nav button[data-act="nav"] {
  box-sizing:border-box;position:relative;display:block;isolation:isolate;
  width:48px;min-width:48px;max-width:48px;height:44px;min-height:44px;max-height:44px;
  margin:4px auto;padding:0!important;gap:0!important;letter-spacing:0;
  font-size:0;line-height:0;border:0;border-radius:12px;text-align:center;
  overflow:hidden;
 }
 #app .shell.la403-compact > aside#academySidebar nav button[data-act="nav"] .ico {
  position:absolute;inset:0;margin:auto;display:grid;place-items:center;
  width:24px;min-width:24px;height:24px;min-height:24px;padding:0;
  font-size:20px;line-height:1;transform:none;
 }
 #app .shell.la403-compact > aside#academySidebar nav button[data-act="nav"] .ico svg,
 #app .shell.la403-compact > aside#academySidebar nav button[data-act="nav"] .ico img {
  display:block;width:22px;height:22px;max-width:22px;max-height:22px;margin:0;object-fit:contain;
 }
 #app .shell.la403-compact > aside#academySidebar nav button[data-act="nav"][data-sidebar-fallback] .ico {display:none;}
 #app .shell.la403-compact > aside#academySidebar nav button[data-act="nav"][data-sidebar-fallback]::before {
  position:absolute;inset:0;display:grid;place-items:center;
  content:attr(data-sidebar-fallback);font-size:15px;line-height:1;font-weight:700;
 }
 #app .shell.la403-compact > aside#academySidebar nav button[data-act="nav"]:focus-visible {outline:2px solid #8af1ff;outline-offset:-3px;}
}
`;
function swap(s,a,b){if(s.split(a).length!==2)throw Error('V40.3.1: estrutura incompatível: '+a);return s.replace(a,()=>b);}
export function patchCss(s){if(!s.includes('/* V40.3 sidebar */'))throw Error('V40.3.1 requer V40.3');if(s.includes(marker)){if(s.includes(styles))return s;throw Error('V40.3.1 CSS parcial');}return s+'\n'+styles;}
export function patchIndex(s){const a='/topbar-v40-1.css?v=40.3',b='/topbar-v40-1.css?v=40.3.1';if(s.includes(b)&&s.split(b).length===2)return s;return swap(s,a,b);}
export function install(root='.') {const p=f=>resolve(root,f),read=f=>readFileSync(p(f),'utf8');const edits=[['web-topbar-v40-1.css',patchCss(read('web-topbar-v40-1.css'))],['web-index.html',patchIndex(read('web-index.html'))]];for(const [f,s] of edits)writeFileSync(p(f),s);return edits.length;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--install'))console.log('V40.3.1: alinhamento do menu integrado ('+install()+' arquivos).');
