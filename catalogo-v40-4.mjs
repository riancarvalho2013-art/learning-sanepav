/** V40.4: compact catalog grid only; existing course actions remain delegated. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const marker='/* V40.4 compact catalog */';
const gridOld=`+filters(true)+statusFilter+'<div class="tiles">'`;
const gridNew=`+filters(true)+statusFilter+'<div class="tiles la404-catalog-grid">'`;
const designOld='group.before(detail);detail.append(group);} }\n }';
const designNew=`group.before(detail);detail.append(group);} }
  if(kind==='course'&&card.closest('.la404-catalog-grid')){
   const removal=card.querySelector(':scope > .dna-admin-actions');
   if(removal){let detail=card.querySelector(':scope > details.la23-manage');if(!detail){detail=el('details','la23-manage');detail.append(el('summary','','Gerenciar curso'));removal.before(detail);}detail.append(removal);}
  }
 }`;
const evoOld='   card.appendChild(wrap)\n }\n}';
const evoNew=`   const management=card.closest('.la404-catalog-grid')&&card.querySelector(':scope > details.la23-manage');
   (management||card).appendChild(wrap)
 }
}`;
export const styles=String.raw`/* V40.4 compact catalog */
/* Measure the actual available container, not the viewport. No fixed three-column grid. */
#app .shell #inside .la404-catalog-grid:not([data-la22-view=list]) {
 display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr));
 gap:14px;align-items:start;min-width:0;max-width:100%;
}
#app .shell #inside .la404-catalog-grid:not([data-la22-view=list]) > :not(.learning-card) {grid-column:1/-1;}
#app .shell #inside .la404-catalog-grid:not([data-la22-view=list]) > .learning-card {
 display:flex;flex-direction:column;align-items:stretch;min-width:0;min-height:0;height:auto;
 padding:10px;gap:7px;margin:0;border-radius:14px;overflow:hidden;
}
#app .shell #inside .la404-catalog-grid:not([data-la22-view=list]) .learning-card > .la23-cover,
#app .shell #inside .la404-catalog-grid:not([data-la22-view=list]) .learning-card > img.learning-cover {
 display:block;width:100%;height:auto;aspect-ratio:2.25/1;min-height:100px;max-height:132px;
 flex:none;margin:0;border-radius:9px;overflow:hidden;object-fit:cover;
}
#app .shell #inside .la404-catalog-grid:not([data-la22-view=list]) .la23-cover > .learning-cover {
 display:block;width:100%;height:100%;max-height:100%;aspect-ratio:auto;object-fit:cover;margin:0;border-radius:0;
}
#app .shell #inside .la404-catalog-grid:not([data-la22-view=list]) .learning-card > h2 {
 font-size:16px;line-height:1.35;letter-spacing:-.01em;overflow-wrap:anywhere;margin:0;padding:0 2px;
}
#app .shell #inside .la404-catalog-grid:not([data-la22-view=list]) .learning-card > p {
 font-size:12px;line-height:1.45;margin:0;padding:0 2px;overflow-wrap:anywhere;
}
#app .shell #inside .la404-catalog-grid:not([data-la22-view=list]) .learning-card > .bar {
 width:100%;height:6px;min-height:6px;margin:3px 0 0;border-radius:99px;
}
#app .shell #inside .la404-catalog-grid:not([data-la22-view=list]) .learning-card > small {
 font-size:12px;line-height:1.35;margin:0;padding:0 2px;
}
#app .shell #inside .la404-catalog-grid:not([data-la22-view=list]) .learning-card > .actions {
 margin:0;padding:0 2px;gap:6px;min-width:0;
}
#app .shell #inside .la404-catalog-grid:not([data-la22-view=list]) .learning-card .actions button {
 min-height:36px;padding:7px 11px;font-size:12px;line-height:1.3;white-space:normal;
}
#app .shell #inside .la404-catalog-grid .la23-manage {margin:2px 0 0;padding:2px 2px 0;min-width:0;}
#app .shell #inside .la404-catalog-grid .la23-manage summary {font-size:12px;line-height:1.4;min-height:30px;padding:6px 0;}
#app .shell #inside .la404-catalog-grid .la23-manage .actions {margin:0;padding:3px 0;gap:6px;}
#app .shell #inside .la404-catalog-grid .la23-manage .dna-admin-actions {margin:6px 0 0;padding-top:6px;}
#app .shell #inside .la404-catalog-grid .la23-manage .dna-admin-actions button {min-height:36px;white-space:normal;max-width:100%;}
#app .shell #inside .la404-catalog-grid:not([data-la22-view=list]) .d4-card-bookmark {margin-top:0;}
#app .shell #inside .la404-catalog-grid .la23-manage summary:focus-visible {outline:2px solid #0754e7;outline-offset:2px;border-radius:4px;}
@media(pointer:coarse){
 #app .shell #inside .la404-catalog-grid .learning-card .actions button,
 #app .shell #inside .la404-catalog-grid .la23-manage summary,
 #app .shell #inside .la404-catalog-grid .la23-manage .dna-admin-actions button {min-height:44px;}
}
@media(prefers-reduced-motion:reduce){#app .shell #inside .la404-catalog-grid .learning-card {transition:none!important;transform:none!important;}}
`;
function swap(s,a,b){if(s.split(a).length!==2)throw Error('V40.4: estrutura incompatível: '+a);return s.replace(a,()=>b);}
export function patchApp(s){if(s.includes(gridNew)&&!s.includes(gridOld))return s;return swap(s,gridOld,gridNew);}
export function patchDesign(s){if(s.includes(designNew))return s;return swap(s,designOld,designNew);}
export function patchEvolution(s){if(s.includes(evoNew))return s;return swap(s,evoOld,evoNew);}
export function patchCss(s){if(!s.includes('/* V40.3.1 compact rail alignment */'))throw Error('V40.4 requer V40.3.1');if(s.includes(marker)){if(s.includes(styles))return s;throw Error('V40.4 CSS parcial');}return s+'\n'+styles;}
export function patchIndex(s){const changes=[['/topbar-v40-1.css?v=40.3.1','/topbar-v40-1.css?v=40.4'],['/app.js?v=40.3','/app.js?v=40.4'],['/design-v23.js?v=23','/design-v23.js?v=40.4'],['/evolution.js"','/evolution.js?v=40.4"']];for(const [a,b] of changes){if(!s.includes(b))s=swap(s,a,b);}return s;}
export function install(root='.') {const p=f=>resolve(root,f),read=f=>readFileSync(p(f),'utf8');const edits=[['web-app.js',patchApp(read('web-app.js'))],['web-design-v23.js',patchDesign(read('web-design-v23.js'))],['web-evolution.js',patchEvolution(read('web-evolution.js'))],['web-topbar-v40-1.css',patchCss(read('web-topbar-v40-1.css'))],['web-index.html',patchIndex(read('web-index.html'))]];for(const [f,s] of edits)writeFileSync(p(f),s);return edits.length;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--install'))console.log('V40.4: catálogo compacto integrado ('+install()+' arquivos).');
