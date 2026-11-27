/** V40.3: collapsible desktop sidebar, existing mobile menu preserved. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const marker='/* V40.3 sidebar */';
const anchor="<div class=\"shell\"><aside><div class=\"la21-product\">";
const sidebar="<div class=\"shell\"><aside id=\"academySidebar\" aria-label=\"Menu lateral\"><div class=\"la21-product\">";
const header="+btn('Menu','menu','','menuBtn')+'<span class=\"breadcrumb\">";
const headerNew="+btn('Menu','menu','','menuBtn')+'<button type=\"button\" class=\"la403-toggle\" data-act=\"sidebarToggle\" aria-controls=\"academySidebar\" aria-expanded=\"true\" aria-label=\"Recolher menu lateral\" title=\"Recolher menu lateral\"><svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"3\"/><path d=\"M9 4v16M15 9l-3 3 3 3\" class=\"la403-chevron\"/></svg></button><span class=\"breadcrumb\">";
const mountAnchor='rememberShellV402();body()';
const mountNew='rememberShellV402();mountSidebarV403();body()';
const clickAnchor="if(act==='menu')document.querySelector('.shell').classList.toggle('open')";
export const runtime=String.raw`/* V40.3 sidebar */
const sidebarKeyV403='learning-academy.sidebar.compact.v1';
let sidebarCompactV403=false,sidebarLoadedV403=false,sidebarNavObserverV403=null;
function sidebarLabelsV403(nav){
 for(const b of nav.querySelectorAll('button[data-act="nav"][data-id]')){
  const route=b.dataset.id, label=route==='Missões'?'Trilhas de aprendizagem':route==='Pulse'?'Pulse de sentimentos':route;
  if(!b.hasAttribute('aria-label'))b.setAttribute('aria-label',label);
  if(!b.hasAttribute('title'))b.title=label;
  const icon=b.querySelector('.ico');
  if(!icon||(!icon.textContent.trim()&&!icon.querySelector('svg,img,use'))){b.dataset.sidebarFallback=Array.from(label.trim()).slice(0,2).join('').toLocaleUpperCase('pt-BR');}
  else delete b.dataset.sidebarFallback;
 }
}
function applySidebarV403(shell){
 if(!shell)return;
 shell.classList.toggle('la403-compact',sidebarCompactV403);
 const toggle=shell.querySelector('.la403-toggle');
 if(toggle){const label=sidebarCompactV403?'Expandir menu lateral':'Recolher menu lateral';toggle.setAttribute('aria-expanded',String(!sidebarCompactV403));toggle.setAttribute('aria-label',label);toggle.title=label;}
}
function mountSidebarV403(){
 const shell=app.querySelector('.shell');if(!shell)return;
 if(!sidebarLoadedV403){sidebarLoadedV403=true;try{sidebarCompactV403=localStorage.getItem(sidebarKeyV403)==='1';}catch{}}
 applySidebarV403(shell);
 sidebarNavObserverV403?.disconnect();
 const nav=shell.querySelector('aside nav');if(!nav)return;
 sidebarLabelsV403(nav);
 // Existing module extensions append buttons and icons after shell rendering. No DOM nodes are added by this observer.
 sidebarNavObserverV403=new MutationObserver(()=>{if(nav.isConnected)sidebarLabelsV403(nav);else sidebarNavObserverV403?.disconnect();});
 sidebarNavObserverV403.observe(nav,{childList:true,subtree:true});
}
function toggleSidebarV403(){
 const shell=app.querySelector('.shell');if(!shell||!window.matchMedia('(min-width:761px)').matches)return;
 sidebarCompactV403=!sidebarCompactV403;
 applySidebarV403(shell);
 try{localStorage.setItem(sidebarKeyV403,sidebarCompactV403?'1':'0');}catch{}
}
`;
export const styles=String.raw`/* V40.3 sidebar */
#app .shell > main > header .la403-toggle {display:inline-grid;place-items:center;flex:0 0 42px;width:42px;height:42px;min-height:42px;padding:0;margin:0;border-radius:12px;border:1px solid #c6dcf7;background:#f5f9ff;color:#092756;}
#app .shell .la403-toggle:focus-visible {outline:3px solid #0754e7;outline-offset:2px;}
#app .shell .la403-toggle .la403-chevron {transform-origin:14px 12px;}
#app .shell.la403-compact .la403-toggle .la403-chevron {transform:rotate(180deg);}
@media(min-width:761px){
 #app .shell.la403-compact,#app .shell.la403-compact[data-la22-route] {grid-template-columns:80px minmax(0,1fr);}
 #app .shell.la403-compact > aside,#app .shell.la403-compact[data-la22-route] > aside {padding:14px 7px;gap:10px;min-width:0;overflow-x:hidden;}
 #app .shell.la403-compact > aside .la21-product {padding:8px 0 12px;justify-content:center;gap:0;}
 #app .shell.la403-compact > aside .la21-product img {width:44px;height:44px;max-width:100%;flex:none;}
 #app .shell.la403-compact > aside .la21-product > div {display:none;}
 #app .shell.la403-compact > aside .brand {min-height:0;padding:12px 0;gap:0;justify-content:center;}
 #app .shell.la403-compact > aside .brand img {width:44px;height:44px;max-width:100%;object-fit:contain;}
 #app .shell.la403-compact > aside .brand > span,#app .shell.la403-compact > aside > .profile {display:none;}
 #app .shell.la403-compact > aside nav {min-height:0;min-width:0;overflow-x:hidden;}
 #app .shell.la403-compact > aside nav small {height:1px;min-height:1px;display:block;overflow:hidden;font-size:0;margin:8px 5px;background:#b9cfee55;}
 #app .shell.la403-compact > aside nav button[data-act="nav"],#app .shell.la403-compact[data-la22-route] > aside nav button[data-act="nav"] {display:flex;justify-content:center;align-items:center;width:100%;min-height:44px;padding:8px 2px;gap:0;font-size:0;line-height:1;white-space:nowrap;overflow:hidden;}
 #app .shell.la403-compact > aside nav button[data-act="nav"] .ico {display:inline-flex;align-items:center;justify-content:center;width:24px;min-width:24px;font-size:20px;}
 #app .shell.la403-compact > aside nav button[data-act="nav"][data-sidebar-fallback] .ico {display:none;}
 #app .shell.la403-compact > aside nav button[data-act="nav"][data-sidebar-fallback]::before {content:attr(data-sidebar-fallback);font-size:15px;font-weight:700;}
 #app .shell.la403-compact > aside nav button[data-act="nav"]:focus-visible {outline-offset:-3px;}
}
@media(max-width:760px){
 #app .shell > main > header .la403-toggle {display:none;}
 /* Same mobile behaviour even while V40.2 replaces the content and route marker. */
 #app .shell,#app .shell[data-la22-route] {display:block;}
 #app .shell > aside,#app .shell[data-la22-route] > aside {display:none;position:relative;height:auto;max-height:65dvh;width:100%;}
 #app .shell.open > aside,#app .shell[data-la22-route].open > aside {display:flex;}
 #app .shell > main > header .menuBtn {display:inline-block;}
}
@media(prefers-reduced-motion:no-preference){#app .shell .la403-toggle .la403-chevron {transition:transform 160ms ease;}}
`;
function swap(s,a,b){if(s.split(a).length!==2)throw Error('V40.3: estrutura incompatível: '+a);return s.replace(a,()=>b);}
export function patchApp(s){if(s.includes(marker)){if(s.includes(mountNew)&&s.includes(headerNew)&&s.includes(sidebar)&&s.includes("if(act==='sidebarToggle')toggleSidebarV403()"))return s;throw Error('V40.3: instalação parcial');}if(!s.includes('/* V40.2 stable navigation */'))throw Error('V40.3 requer V40.2');s=swap(s,'function draw(){',runtime+'\nfunction draw(){');s=swap(s,anchor,sidebar);s=swap(s,header,headerNew);s=swap(s,mountAnchor,mountNew);return swap(s,clickAnchor,clickAnchor+"\n if(act==='sidebarToggle')toggleSidebarV403()");}
export function patchCss(s){if(!s.includes('/* V40.2 stable navigation */'))throw Error('V40.3 requer CSS V40.2');if(s.includes(marker)){if(s.includes(styles))return s;throw Error('V40.3 CSS parcial');}return s+'\n'+styles;}
export function patchIndex(s){const a='/topbar-v40-1.css?v=40.2',b='/topbar-v40-1.css?v=40.3',c='/app.js?v=40.2',d='/app.js?v=40.3';if(s.includes(b)&&s.includes(d))return s;return swap(swap(s,a,b),c,d);}
export function install(root='.') {const p=f=>resolve(root,f),read=f=>readFileSync(p(f),'utf8');const edits=[['web-app.js',patchApp(read('web-app.js'))],['web-topbar-v40-1.css',patchCss(read('web-topbar-v40-1.css'))],['web-index.html',patchIndex(read('web-index.html'))]];for(const [f,s] of edits)writeFileSync(p(f),s);return edits.length;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--install'))console.log('V40.3: menu lateral integrado ('+install()+' arquivos).');
