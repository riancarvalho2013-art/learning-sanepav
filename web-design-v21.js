/* Visual adapter only: no API calls, event replacement, or injected business controls. */
(() => {
'use strict';
const icons={'Painel':'home','Catálogo LMS':'book','Missões':'route','Relatórios':'report','OKR':'target','PDI':'trend','1:1':'calendar','Feedback':'chat','Elogio':'star','Pulse':'pulse','Desempenho':'chart','Rede social':'people','Pessoas':'people','Identidade visual':'edit','Auditoria':'shield','Matriz 9 Box':'grid','Minha jornada':'route','Academia de práticas':'cap','Meu acesso':'lock','Meu perfil':'user','Estrutura':'org','Estrutura organizacional':'org','Indicadores estratégicos':'chart','Evolução da plataforma':'trend','Organograma':'org','People Analytics':'chart'};
function enhance(){
 const shell=document.querySelector('.shell');if(!shell)return;
 for(const item of shell.querySelectorAll('aside nav button[data-act="nav"]')){
  const name=item.dataset.id,key=icons[name]||'layers',icon=item.querySelector('.ico');
  if(icon&&icon.dataset.la21!==key){icon.innerHTML='<svg class="la21-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="/design-v21/icons.svg#'+key+'"></use></svg>';icon.dataset.la21=key;}
  if(item.classList.contains('sel'))item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');
 }
}
let scheduled=false;
new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;enhance()})}).observe(document.getElementById('app'),{childList:true,subtree:true});
enhance();
})();
