/* V38 | Additive accessibility enhancements. No API calls or application state writes. */
(() => {
 'use strict';
 if (window.__learningUsabilidadeV38) return;
 window.__learningUsabilidadeV38 = true;
 let scheduled = false, observedHeader = null;
 const set = (el, key, value) => { if (el && el.getAttribute(key) !== value) el.setAttribute(key, value); };
 const label = (el, value) => { if (el && !el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby') && !el.labels?.length) set(el,'aria-label',value); };
 const headerHeight = () => {
   if (!observedHeader?.isConnected) return;
   const position = getComputedStyle(observedHeader).position;
   const px = ['sticky','fixed'].includes(position) ? Math.ceil(observedHeader.getBoundingClientRect().height) : 0;
   document.documentElement.style.setProperty('--la38-header-height',`${Math.max(0,px)}px`);
 };
 const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(headerHeight) : null;
 function ensureTableRegions(root) {
   for (const table of root.querySelectorAll('table')) {
     if (!table.querySelector('th') || table.closest('[role="presentation"],[role="none"],[data-la38-no-wrap]')) continue;
     // Preserve native table semantics and application selectors. Do not reparent nodes.
     const parent = table.parentElement;
     if (!parent || parent === root || parent.matches('form,fieldset,table,thead,tbody,tfoot,tr,td,th,details')) continue;
     // Only a dedicated table container gets its overflow altered.
     if (parent.children.length !== 1 || parent.firstElementChild !== table) continue;
     if (!parent.classList.contains('la38-table-scroll')) parent.classList.add('la38-table-scroll');
     if (parent.scrollWidth > parent.clientWidth + 2) {
       if (!parent.hasAttribute('tabindex')) { set(parent,'tabindex','0'); set(parent,'data-la38-tab','1'); }
       if (!parent.hasAttribute('role')) { set(parent,'role','region'); set(parent,'data-la38-role','1'); }
       label(parent,table.querySelector('caption')?.textContent.trim() || 'Tabela com rolagem horizontal');
     } else if (parent.dataset.la38Tab === '1') {
       parent.removeAttribute('tabindex'); parent.removeAttribute('data-la38-tab');
       if (parent.dataset.la38Role === '1') { parent.removeAttribute('role'); parent.removeAttribute('data-la38-role'); }
     }
   }
 }
 function sync() {
   scheduled = false;
   const shell = document.querySelector('#app .shell');
   const inside = shell?.querySelector('#inside');
   if (!shell || !inside) { if (observedHeader) observer?.unobserve(observedHeader); observedHeader=null;return; }
   const header = shell.querySelector(':scope > main > header');
   if (header !== observedHeader) { if (observedHeader) observer?.unobserve(observedHeader); observedHeader=header; if (header) observer?.observe(header); }
   headerHeight();
   if (!inside.hasAttribute('tabindex')) set(inside,'tabindex','-1');
   if (!shell.querySelector('#la38-skip')) {
     const a=document.createElement('a');a.id='la38-skip';a.href='#inside';a.textContent='Ir para o conteúdo principal';
     a.addEventListener('click',ev=>{ev.preventDefault();const target=document.querySelector('#app #inside');if(target){target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'instant'});}});
     shell.prepend(a);
   }
   const nav=shell.querySelector('aside nav');
   if (nav) {
     label(nav,'Navegação principal');
     for (const b of nav.querySelectorAll('button[data-act="nav"]')) {
       if (b.classList.contains('sel')) set(b,'aria-current','page');
       else if (b.getAttribute('aria-current')==='page') b.removeAttribute('aria-current');
     }
     const menu=header?.querySelector('button[data-act="menu"]');
     if(menu){set(menu,'aria-expanded',String(shell.classList.contains('open')));label(menu,'Abrir ou fechar menu');}
   }
   label(inside.querySelector('#filterPerson'),'Filtrar por pessoa');
   label(inside.querySelector('#query'),'Pesquisar cursos ou trilhas');
   label(header?.querySelector('.global-search input, input[type="search"]'),'Buscar na plataforma');
   ensureTableRegions(inside);
   const modal=document.querySelector('#modal[open]:not(.lxp-immersive):not(.a6-immersive):not([data-la22-modal=player]) #modalBody');
   if(modal) ensureTableRegions(modal);
 }
 function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(sync);}}
 function start(){new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','open']});window.addEventListener('resize',schedule,{passive:true});schedule();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
