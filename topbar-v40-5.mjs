/** V40.5: one measured header layout; no API or permission changes. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const marker='/* V40.5 topbar geometry */';
const oldHead='<main><header>',newHead='<main><header id="academyTopbar">';
const oldGroup=`+companyContext()+'<div class="la40-account-actions">'+notificationBell()+profileButton()+'</div></header>`;
const newGroup=`+'<div class="la405-right">'+companyContext()+'<div class="la40-account-actions">'+notificationBell()+profileButton()+'</div></div></header>`;
export const styles=String.raw`/* V40.5 topbar geometry */
#app #academyTopbar {
 --la405-control:44px;--la405-gap:12px;
 box-sizing:border-box;display:flex;align-items:center;justify-content:flex-start;
 flex-wrap:wrap;gap:8px var(--la405-gap);padding:10px 16px;
 width:100%;min-width:0;max-width:100%;height:auto;min-height:65px;
 position:sticky;top:0;z-index:12;overflow:visible;
 container:academy-topbar / inline-size;
}
#app #academyTopbar > .breadcrumb {position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden;white-space:nowrap;pointer-events:none;}
#app #academyTopbar > :is(.la403-toggle,.menuBtn) {
 box-sizing:border-box;order:0;align-items:center;justify-content:center;
 flex:0 0 var(--la405-control);width:var(--la405-control);height:var(--la405-control);
 min-width:var(--la405-control);min-height:var(--la405-control);padding:0;margin:0;
 border-radius:12px;border:1px solid #c6dcf7;background:#f5f9ff;color:#092756;
 line-height:1;box-shadow:0 2px 5px #337bcc18;
}
#app #academyTopbar > .la403-toggle {display:grid;place-items:center;}
#app #academyTopbar > .la403-toggle svg {display:block;width:22px;height:22px;min-width:22px;max-width:22px;margin:0;flex:none;}
#app #academyTopbar > .menuBtn {display:none;}
#app #academyTopbar > .global-search {order:1;position:relative;flex:1 1 200px;min-width:0;min-inline-size:0;max-width:none;max-inline-size:none;margin:0;}
#app #academyTopbar .global-search label {display:block;position:relative;margin:0;padding:0;}
#app #academyTopbar .global-search input {box-sizing:border-box;display:block;width:100%;height:var(--la405-control);min-height:var(--la405-control);margin:0;padding:0 14px 0 42px;font-size:13px;line-height:normal;border-radius:999px;}
#app #academyTopbar .la23-search-icon {position:absolute;left:14px;top:50%;transform:translateY(-50%);width:18px;height:18px;pointer-events:none;}
#app #academyTopbar > .la405-right {order:2;display:flex;align-items:center;justify-content:flex-end;gap:16px;flex:0 0 auto;min-width:0;max-width:100%;margin:0;}
#app #academyTopbar .company-context {box-sizing:border-box;display:flex;align-items:center;gap:8px;flex:0 1 auto;min-width:0;max-width:none;margin:0;padding:0;font-size:12px;line-height:1.2;}
#app #academyTopbar .company-context > span {display:block;white-space:nowrap;flex:none;}
#app #academyTopbar .company-context select {box-sizing:border-box;display:block;flex:0 1 184px;width:184px;min-width:0;max-width:none;height:var(--la405-control);min-height:var(--la405-control);margin:0;padding:0 8px;font-size:12px;line-height:normal;border-radius:11px;}
#app #academyTopbar .la40-account-actions {box-sizing:border-box;display:flex;align-items:center;justify-content:flex-end;position:relative;flex:0 0 auto;gap:10px;min-width:0;max-width:100%;margin:0;overflow:visible;}
#app #academyTopbar .notification-area {position:static;flex:none;margin:0;}
#app #academyTopbar .bell {box-sizing:border-box;display:grid;place-items:center;position:relative;width:var(--la405-control);height:var(--la405-control);min-width:var(--la405-control);min-height:var(--la405-control);padding:0;margin:0;border:1px solid #c6dcf7;border-radius:12px;background:#f5f9ff;color:#092756;box-shadow:0 2px 5px #337bcc18;}
#app #academyTopbar .bell .la23-bell-svg {display:block;width:22px;height:22px;max-width:22px;margin:0;}
#app #academyTopbar .la23-profile {display:flex;align-items:center;gap:8px;flex:none;margin:0;padding:0 0 0 10px;min-width:0;border-left:1px solid #b9cfee;}
#app #academyTopbar .avatar-trigger {box-sizing:border-box;display:grid;place-items:center;flex:none;width:var(--la405-control);height:var(--la405-control);min-width:var(--la405-control);min-height:var(--la405-control);margin:0;padding:0;border:0;border-radius:50%;}
#app #academyTopbar .avatar-trigger .social-avatar {box-sizing:border-box;display:grid;place-items:center;width:var(--la405-control);height:var(--la405-control);min-width:var(--la405-control);margin:0;border-radius:50%;}
#app #academyTopbar .la23-profile-details {margin:0;padding:0;min-width:0;max-width:190px;}
#app #academyTopbar .la23-profile-summary {box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:8px;min-height:var(--la405-control);padding:0;margin:0;}
#app #academyTopbar .la23-profile-copy {display:grid;gap:2px;line-height:1.25;min-width:0;}
#app #academyTopbar .la23-profile-copy strong {font-size:13px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
#app #academyTopbar .la23-profile-copy small {font-size:11px;white-space:nowrap;}
#app #academyTopbar .notification-list {right:0;left:auto;top:calc(100% + 8px);width:min(25rem,calc(100vw - 32px));max-width:calc(100vw - 32px);max-height:65dvh;z-index:40;overflow:auto;}
#app #academyTopbar .notification-list[hidden] {display:none;}
#app #academyTopbar .la23-profile-menu {top:calc(100% + 8px);right:0;max-width:calc(100vw - 32px);}
@container academy-topbar (max-width:860px){
 #app #academyTopbar > .global-search {order:4;flex:1 1 100%;width:100%;}
 #app #academyTopbar > .la405-right {flex:1 1 0;gap:12px;}
 #app #academyTopbar .la23-profile-copy strong {max-width:110px;}
}
@container academy-topbar (max-width:600px){
 #app #academyTopbar .la23-profile-copy {display:none;}
 #app #academyTopbar .la23-profile-summary {min-width:24px;}
 #app #academyTopbar > .la405-right {gap:8px;}
 #app #academyTopbar .la40-account-actions {gap:6px;}
 #app #academyTopbar .la23-profile {gap:4px;padding-left:6px;}
 #app #academyTopbar .company-context > span {position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden;}
 #app #academyTopbar .company-context select {width:168px;flex-basis:168px;}
}
@container academy-topbar (max-width:345px){
 #app #academyTopbar > .la405-right {display:contents;}
 #app #academyTopbar .la40-account-actions {order:1;margin-inline-start:auto;}
 #app #academyTopbar .company-context {order:2;flex:1 1 100%;width:100%;gap:8px;}
 #app #academyTopbar .company-context > span {position:static;width:auto;height:auto;clip-path:none;overflow:visible;}
 #app #academyTopbar .company-context select {flex:1 1 auto;width:auto;}
}
@media(max-width:760px){
 #app #academyTopbar {padding:8px 12px;--la405-gap:8px;}
 #app #academyTopbar > .la403-toggle {display:none;}
 #app #academyTopbar > .menuBtn {display:flex;flex-basis:auto;width:auto;padding:0 8px;font-size:12px;}
}
@media(prefers-reduced-motion:no-preference){
 #app #academyTopbar :is(.la403-toggle,.menuBtn,.bell,.company-context select,.avatar-trigger) {transition:background-color 160ms ease,border-color 160ms ease,box-shadow 160ms ease;}
}
@media(prefers-reduced-motion:reduce){
 #app #academyTopbar :is(.la403-toggle,.menuBtn,.bell,.company-context select,.avatar-trigger,.la403-chevron) {transition:none!important;animation:none!important;}
}
`;
function swap(s,a,b){if(s.split(a).length!==2)throw Error('V40.5: estrutura incompatível: '+a);return s.replace(a,()=>b);}
export function patchApp(s){if(s.includes(newHead)&&s.includes(newGroup)&&!s.includes(oldHead)&&!s.includes(oldGroup))return s;if(!s.includes('/* V40.3 sidebar */')||!s.includes('la404-catalog-grid'))throw Error('V40.5 requer V40.4');return swap(swap(s,oldHead,newHead),oldGroup,newGroup);}
export function patchCss(s){if(!s.includes('/* V40.4 compact catalog */'))throw Error('V40.5 requer V40.4');if(s.includes(marker)){if(s.includes(styles))return s;throw Error('V40.5 CSS parcial');}return s+'\n'+styles;}
export function patchIndex(s){const a='/topbar-v40-1.css?v=40.4',b='/topbar-v40-1.css?v=40.5',c='/app.js?v=40.4',d='/app.js?v=40.5';if(s.includes(b)&&s.includes(d))return s;return swap(swap(s,a,b),c,d);}
export function install(root='.') {const p=f=>resolve(root,f),read=f=>readFileSync(p(f),'utf8');const edits=[['web-app.js',patchApp(read('web-app.js'))],['web-topbar-v40-1.css',patchCss(read('web-topbar-v40-1.css'))],['web-index.html',patchIndex(read('web-index.html'))]];for(const [f,s] of edits)writeFileSync(p(f),s);return edits.length;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--install'))console.log('V40.5: régua visual do cabeçalho integrada ('+install()+' arquivos).');
