/** V40.2: stable shell for explicit navigation only; session and scope refresh still redraw. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const marker='/* V40.2 stable navigation */';
const drawAnchor="</main></div>';body()}";
const navAnchor="if(act==='nav'){page=id==='Rede social'?'Intranet':id;search='';draw();window.scrollTo({top:0,behavior:'instant'});if(isIntranet())void loadSocial()}";
const drawNew="</main></div>';rememberShellV402();body()}";
const navNew="if(act==='nav'){navigateV402(id,el,ev.detail===0)}";
// Runs in the existing app's lexical scope. No storage, no response cache, no extra requests.
export const runtime=String.raw`/* V40.2 stable navigation */
const shellContextsV402=new WeakMap();
function rememberShellV402(){
 const shell=app.querySelector('.shell');if(!shell||!d?.me)return;
 shellContextsV402.set(shell,{data:d,org:organizationData,company:organizationCompany,person:d.me.id,role:d.me.role});
}
function reuseShellV402(route,trigger,keyboard){
 const shell=app.querySelector('.shell'),ctx=shell&&shellContextsV402.get(shell),root=$('inside');
 if(!ctx||!d?.me||ctx.data!==d||ctx.org!==organizationData||ctx.company!==organizationCompany||ctx.person!==d.me.id||ctx.role!==d.me.role||modal.open||!root||root.parentElement!==shell.querySelector('main'))return false;
 const nav=shell.querySelector('aside nav'),buttons=nav&&Array.from(nav.querySelectorAll('button[data-act="nav"]'));
 const selected=buttons?.find(b=>b.dataset.id===route);if(!selected)return false;
 // Only a previously rendered navigation destination is eligible. Data loading and ACL stay unchanged.
 const fromNav=nav.contains(trigger),wasOpen=shell.classList.contains('open');
 for(const b of buttons){const active=b===selected;b.classList.toggle('sel',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
 shell.classList.remove('open');
 const header=shell.querySelector('main>header');
 for(const detail of header?.querySelectorAll('.la23-profile-details[open]')||[])detail.open=false;
 const input=$('globalSearch'),results=$('globalSearchResults');
 if(input){input.value='';input.setAttribute('aria-expanded','false');}if(results){results.hidden=true;results.replaceChildren();}
 if(notificationOpen){notificationOpen=false;renderNotifications();}
 const brandName=shell.querySelector('aside .dna-brand-copy strong')?.textContent||d.theme?.title||'Learning Academy';
 const crumb=header?.querySelector('.breadcrumb');if(crumb)crumb.textContent=brandName+' / '+route;document.title=brandName+' · '+route;
 // New content node prevents late responses holding the former node from painting in the new page.
 // Never keep the previous page as an interactive overlay or snapshot.
 const next=document.createElement('div');next.id='inside';next.className='inside la40-route-enter';
 next.tabIndex=-1;next.innerHTML='<div class="la40-route-loading" role="status">Carregando conteúdo…</div>';
 delete shell.dataset.la22Route;root.replaceWith(next);
 body();
 // Preserve sidebar focus for keyboard navigation, or move it out of a removed/closed region.
 if(keyboard){if(fromNav&&selected.getClientRects().length&&!wasOpen)selected.focus({preventScroll:true});else next.focus({preventScroll:true});}
 return true;
}
function navigateV402(id,trigger,keyboard=false){
 page=id==='Rede social'?'Intranet':id;search='';
 if(!reuseShellV402(page,trigger,keyboard))draw();
 window.scrollTo({top:0,behavior:'instant'});if(isIntranet())void loadSocial();
}
`;
export const styles=String.raw`/* V40.2 stable navigation */
/* Never fade the whole application to zero or animate the sidebar on route changes. */
#app .shell main > .inside {animation:none;}
#app .shell main > .inside.la40-route-enter,
#app .shell[data-la22-route] main > .inside.la40-route-enter {animation:la402-route-in 200ms cubic-bezier(.2,.7,.25,1);}
@keyframes la402-route-in {from{opacity:.94;}to{opacity:1;}}
#app .shell aside nav button[data-act="nav"] {transition:background-color 160ms ease,color 160ms ease,box-shadow 160ms ease;}
#app .shell .la40-route-loading {padding:20px 16px;min-height:120px;color:#365378;display:flex;align-items:center;gap:12px;}
#app .shell .la40-route-loading::before {content:"";width:12px;height:12px;border:2px solid #a7c6e9;border-top-color:#0754e7;border-radius:50%;flex:none;}
@media(prefers-reduced-motion:reduce){#app .shell main > .inside.la40-route-enter,#app .shell[data-la22-route] main > .inside.la40-route-enter{animation:none!important;}#app .shell aside nav button[data-act="nav"]{transition:none!important;}}
`;
function swap(s,a,b){if(s.split(a).length!==2)throw Error('V40.2: estrutura incompatível: '+a);return s.replace(a,()=>b);}
export function patchApp(s){
 if(s.includes(marker)){if(s.includes(drawNew)&&s.includes(navNew))return s;throw Error('V40.2: instalação parcial');}
 if(!s.includes('la40-account-actions'))throw Error('V40.2: instale V40.1 antes');
 s=swap(s,'function draw(){',runtime+'\nfunction draw(){');s=swap(s,drawAnchor,drawNew);return swap(s,navAnchor,navNew);
}
export function patchCss(s){if(!s.includes('.la40-account-actions'))throw Error('V40.2: CSS V40.1 ausente');if(s.includes(marker)){if(!s.includes(styles))throw Error('V40.2: CSS parcial');return s;}return s+'\n'+styles;}
export function patchIndex(s){const prior='<link rel="stylesheet" href="/topbar-v40-1.css">',next='<link rel="stylesheet" href="/topbar-v40-1.css?v=40.2">',appOld='<script src="/app.js"></script>',appNew='<script src="/app.js?v=40.2"></script>';if(s.includes(next)&&s.includes(appNew))return s;return swap(swap(s,prior,next),appOld,appNew);}
export function install(root='.'){
 const p=f=>resolve(root,f),read=f=>readFileSync(p(f),'utf8');
 const edits=[['web-app.js',patchApp(read('web-app.js'))],['web-topbar-v40-1.css',patchCss(read('web-topbar-v40-1.css'))],['web-index.html',patchIndex(read('web-index.html'))]];
 for(const [f,s] of edits)writeFileSync(p(f),s);return edits.length;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--install'))console.log('V40.2: navegação estável integrada ('+install()+' arquivos).');
