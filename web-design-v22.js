/* Learning Academy V22 — presentation layer over existing authorized renderers.
 * No API calls, no copied business controls, no new permissions or synthetic data. */
(() => {
  'use strict';
  const routes = {
    'Painel':['dashboard','home','Plataforma de aprendizagem','Desenvolvimento que conecta conhecimento e prática.'],
    'Catálogo LMS':['catalog','book','Aprendizagem','Conhecimento na prática para resultados reais.'],
    'Missões':['journeys','route','Trilhas de aprendizagem','Aprenda com jornadas estruturadas.'],
    'Trilhas de aprendizagem':['journeys','route','Trilhas de aprendizagem','Aprenda com jornadas estruturadas.'],
    'Relatórios':['reports','report','Inteligência de aprendizagem','Acompanhe os indicadores e suas fontes.'],
    'OKR':['okr','target','Gestão de objetivos','Conecte objetivos, pessoas e resultados.'],
    'PDI':['pdi','trend','Desenvolvimento individual','Transforme competências em ações.'],
    '1:1':['meetings','calendar','Conversas de desenvolvimento','Crie conexões e combinados claros.'],
    'Feedback':['feedback','chat','Cultura de feedback','Converse, reconheça e evolua.'],
    'Elogio':['praise','star','Reconhecimento','Valorize as conquistas do seu time.'],
    'Pulse':['pulse','pulse','Clima e sentimentos','Sua voz faz parte da evolução.'],
    'Pulse de sentimentos':['pulse','pulse','Clima e sentimentos','Sua voz faz parte da evolução.'],
    'Desempenho':['performance','chart','Gestão de desempenho','Competências e resultados em evolução.'],
    'Rede social':['social','people','Intranet','Compartilhe experiências e conquistas.'],
    'Meu perfil':['profile','user','Pessoas e organização','Conheça sua trajetória profissional.'],
    'Indicadores estratégicos':['analytics','chart','People Analytics','Dados confiáveis para melhores decisões.'],
    'Evolução da plataforma':['evolution','trend','Learning Academy','Acompanhe a evolução da plataforma.'],
    'Matriz 9 Box':['ninebox','grid','Gestão de talentos','Desempenho e potencial no seu contexto.'],
    'Certificados':['certificates','award','Conquistas','Celebre cada etapa concluída.'],
    'Caderno de notas':['gradebook','clipboard','Aprendizagem','Acompanhe notas e conclusões.'],
    'Minha jornada':['myjourney','route','Experiência e autonomia','Seu desenvolvimento em um só lugar.'],
    'Academia de práticas':['academy','cap','Experiência e autonomia','Aprenda a usar cada recurso da plataforma.'],
    'Meu acesso':['access','lock','Experiência e autonomia','Entenda seu perfil e permissões.'],
    'Minha lista':['saved','bookmark','Aprendizagem autônoma','Organize os conteúdos que deseja explorar.'],
    'Descobertas LXP':['discovery','search','Learning experience','Entenda os eventos de aprendizagem registrados.'],
    'Pulse Seguro':['securepulse','shield','Escuta protegida','Privacidade e confiança em cada resposta.'],
    'Avaliações educacionais':['assessments','clipboard','Evidências de aprendizagem','Avalie conhecimento com critérios claros.'],
    'Eficácia dos treinamentos':['effectiveness','target','Kirkpatrick','Da reação aos resultados observados.'],
    'Pessoas':['people','people','Administração','Gerencie acessos e vínculos profissionais.'],
    'Organograma':['orgchart','org','Pessoas e organização','Explore as relações de liderança.'],
    'Estrutura organizacional':['organization','building','Pessoas e organização','Organize empresas, áreas e unidades.'],
    'Marca por empresa':['branding','edit','Administração','Personalize cada organização.'],
    'Identidade visual':['theme','settings','Administração','Configure a identidade do ambiente.'],
    'Auditoria':['audit','shield','Administração','Consulte os eventos registrados.'],
    'People Analytics':['analytics','chart','People Analytics','Dados confiáveis para melhores decisões.']
  };
  const icon=(key)=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.classList.add('la22-svg');const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','/design-v21/icons.svg#'+key);svg.append(use);return svg;};
  const node=(tag,cls,txt)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=txt;return el;};
  const direct=(root,selectors)=>[...root.children].find(el=>el.matches(selectors));
  const heroSelector='.dna-hero,.lxp-heading,.r3-hero,.d4-header,.p5-hero,.a6-hero,.kp7-hero,.oc-hero,.social-hero,.dna-page-heading,.hero';
  function currentRoute(shell){const selected=shell.querySelector('aside nav [data-act="nav"].sel');if(selected?.dataset.id)return selected.dataset.id;try{return typeof page==='string'?page:''}catch{return ''}}
  function decorateTitle(h){if(!h||h.dataset.la22Title)return;h.dataset.la22Title='1';if(h.querySelector('span,em,strong'))return;const raw=h.textContent.trim();const words=raw.split(/\s+/);if(words.length<2)return;let n=words.length===2?1:Math.ceil(words.length/2);const first=words.slice(0,n).join(' '),last=words.slice(n).join(' ');h.replaceChildren(document.createTextNode(first+' '),node('span','la22-title-accent',last));}
  function decorateHero(root,config){
    let hero=direct(root,heroSelector);if(!hero){const wrapper=direct(root,'.dna-home,.lxp-page,.r3-wrapper,.d4-screen,.p5-screen,.a6-root,.kp7-root,.oc9,.social-hub');if(wrapper)hero=direct(wrapper,heroSelector);}
    if(!hero){hero=direct(root,'.heading');if(hero&&!hero.querySelector('h1'))hero=null;}
    if(!hero)return;
    if(hero.dataset.la22Hero===config[0])return;
    hero.classList.add('la22-hero');hero.dataset.la22Hero=config[0];
    const title=hero.querySelector('h1');if(!title)return;
    decorateTitle(title);
    // Keep native controls and text nodes in place; append only decorative elements.
    if(!hero.querySelector('.la21-module-icon,.la22-hero-icon')){const badge=node('span','la22-hero-icon');badge.append(icon(config[1]));hero.prepend(badge);}
    if(!hero.querySelector('.over,.dna-eyebrow,.lxp-overline,.r3-overline,.p5-eyebrow,.a6-kicker,.d4-over,.la22-kicker')&&title.parentElement){title.before(node('div','la22-kicker',config[2]));}
    if(!hero.querySelector('.la21-hero-copy,.la22-hero-copy')){hero.append(node('div','la22-hero-copy',config[3]));}
  }
  function markMetrics(root){
    for(const el of root.querySelectorAll('.stat,.dna-metric,.lxp-metric,.r3-card,.oc-stat,.d4-kpis>article,.a6-kpis>article,.p5-kpis>article,.kp7-stat')){
      if(el.dataset.la22Metric)continue;el.dataset.la22Metric='1';
      if(el.querySelector('svg,.dna-metric-icon,.la22-metric-icon,i'))continue;
      const text=el.textContent.toLowerCase();let key=/conclu|aprova|finaliz/.test(text)?'check':/hora|tempo|prazo|próxim/.test(text)?'clock':/nota|certific|conquista/.test(text)?'award':/pessoa|equipe|colabor|gestor/.test(text)?'people':/curso|matríc|trilha/.test(text)?'book':/objetiv|meta|ação|ações/.test(text)?'target':'chart';
      const badge=node('span','la22-metric-icon');badge.append(icon(key));el.prepend(badge);
    }
  }
  function addGridSwitch(root,grid){
    if(!grid||grid.dataset.la22Tools)return;grid.dataset.la22Tools='1';
    const tools=node('div','la22-grid-tools');const label=node('h2','','Conteúdos disponíveis');tools.append(label);
    const group=node('div','la22-view-switch');group.setAttribute('role','group');group.setAttribute('aria-label','Visualização do catálogo');
    for(const [mode,key,caption] of [['grid','grid','Grade'],['list','list','Lista']]){const b=node('button','la22-view-button');b.type='button';b.title=caption;b.setAttribute('aria-label',caption);b.setAttribute('aria-pressed',String(mode===(grid.dataset.la22View||'grid')));b.append(icon(key));b.addEventListener('click',()=>{grid.dataset.la22View=mode;for(const button of group.children)button.setAttribute('aria-pressed',String(button===b));});group.append(b);}
    tools.append(group);grid.before(tools);
  }
  function coverFor(card){const cover=card.querySelector('.learning-cover');if(cover&&cover.getAttribute('src')==='/waves.webp')cover.src='/design-v22/course-cover.webp';}
  function catalog(root){const grid=direct(root,'.tiles');if(!grid)return;grid.classList.add('la22-catalog-grid');if(!grid.dataset.la22View)grid.dataset.la22View='grid';addGridSwitch(root,grid);for(const card of grid.querySelectorAll('.learning-card'))coverFor(card);}
  function stat(label,value,key){const el=node('article','la22-summary-stat');const b=node('span','la22-summary-icon');b.append(icon(key));const copy=node('div','');copy.append(node('small','',label),node('strong','',String(value)));el.append(b,copy);return el;}
  function ring(value,label){const el=node('div','la22-ring-block');const dial=node('div','la22-ring');dial.style.setProperty('--pct',String(value)+'%');dial.setAttribute('role','img');dial.setAttribute('aria-label',label+': '+value+'%');dial.append(node('b','',value+'%'));el.append(dial,node('span','',label));return el;}
  function dashboard(root){
    const hero=root.querySelector('.dna-hero');const title=hero?.querySelector('h1');if(title&&!hero.dataset.la22Home){hero.dataset.la22Home='1';const greeting=title.textContent.trim();title.replaceChildren(document.createTextNode('Learning '),node('span','la22-title-accent','Academy'));if(greeting)title.after(node('p','la22-greeting',greeting));const orbit=hero.querySelector('.dna-hero-orbit');if(orbit)orbit.hidden=true;}
    const side=root.querySelector('.dna-community');if(side&&!side.querySelector('.la22-ring-block')){try{const mine=d.enroll.filter(x=>x.person===d.me.id);if(mine.length){const percent=Math.round(mine.filter(x=>x.progress===100).length/mine.length*100);const r=ring(percent,'Cursos atribuídos concluídos');side.querySelector('h2')?.after(r);}}catch{}}
    const next=root.querySelector('.dna-next');if(next&&!next.dataset.la22Next){next.dataset.la22Next='1';try{
      const mine=d.enroll.filter(x=>x.person===d.me.id&&x.progress<100);const en=mine.find(x=>d.courses.some(c=>c.id===x.course&&!c.blockedBy?.length))||mine[0];const c=d.courses.find(x=>x.id===en?.course);
      if(c&&en){const visual=next.querySelector('.dna-next-icon');if(visual){const im=node('img','la22-next-cover');im.alt='';im.src=c.cover?'/cover/course/'+encodeURIComponent(c.id):'/design-v22/course-cover.webp';visual.replaceChildren(im);}const b=next.querySelector('button[data-act="nav"][data-id="Catálogo LMS"]');if(b&&!c.blockedBy?.length){b.dataset.act='learn';b.dataset.id=en.id;b.textContent='Continuar';}}
      }catch{/* no fabricated data or access */}}
    for(const card of root.querySelectorAll('.dna-featured-card')){if(card.dataset.la22Featured)continue;card.dataset.la22Featured='1';const visual=card.querySelector('.dna-course-visual');if(visual)visual.classList.add('la22-course-visual');}
  }
  function saved(root){for(const card of root.querySelectorAll('.d4-course')){if(card.dataset.la22Saved)continue;card.dataset.la22Saved='1';const visual=node('div','la22-saved-cover');visual.append(icon('book'));card.prepend(visual);try{const b=card.querySelector('[data-course]');const c=d.courses.find(c=>c.id===b?.dataset.course);if(c?.cover){const img=node('img','');img.alt='';img.src='/cover/course/'+encodeURIComponent(c.id);visual.replaceChildren(img);}const en=d.enroll.find(x=>x.person===d.me.id&&x.course===c?.id);if(en&&Number.isFinite(Number(en.progress))){const p=Math.max(0,Math.min(100,Number(en.progress)));const block=node('div','la22-saved-progress');const meter=node('progress','');meter.max=100;meter.value=p;meter.setAttribute('aria-label','Progresso do curso');block.append(meter,node('small','',p+'% concluído'));card.querySelector('.d4-actions')?.before(block);}}catch{}}}
  function reports(root){const wrapper=root.querySelector('.r3-wrapper');if(!wrapper)return;const panels=[...wrapper.children].filter(x=>x.matches('.r3-panel'));for(const panel of panels){const h=panel.querySelector('h2');if(!h)continue;panel.classList.toggle('la22-report-chart',!!panel.querySelector('.r3-chart'));panel.classList.toggle('la22-report-table',!!panel.querySelector('.r3-table-scroll'));}
    const chart=wrapper.querySelector('.r3-chart');if(chart&&!chart.parentElement.querySelector('.la22-ring-block')){const metric=[...wrapper.querySelectorAll('.r3-card')].find(c=>/taxa de conclus[aã]o/i.test(c.querySelector('.r3-card-label')?.textContent||''));const raw=metric?.querySelector('.r3-number')?.textContent||'';if(/^\s*\d+(?:[,.]\d+)?\s*%\s*$/.test(raw)){const pct=Number(raw.replace('%','').trim().replace(',','.'));if(Number.isFinite(pct)&&pct>=0&&pct<=100){const layout=node('div','la22-chart-split');chart.before(layout);layout.append(chart,ring(pct,'Taxa de conclusão no recorte'));}}}
  }
  function okr(root){const cards=root.querySelector('#okrCards');if(!cards)return;const objectives=[...cards.children].filter(x=>x.querySelector('.okr-progress'));const values=objectives.map(x=>Number(x.querySelector('.okr-progress').getAttribute('value'))).filter(x=>Number.isFinite(x)&&x>=0&&x<=100);const kr=objectives.reduce((sum,x)=>sum+x.querySelectorAll('.lxp-line progress').length,0);const average=values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length)+'%':'—';const signature=[objectives.length,kr,average].join('|');let summary=cards.previousElementSibling;if(!summary?.classList.contains('la22-okr-summary')){summary=node('div','la22-okr-summary');cards.before(summary);}if(summary.dataset.signature===signature)return;summary.dataset.signature=signature;summary.replaceChildren(stat('Objetivos no recorte',objectives.length,'target'),stat('Resultados-chave',kr,'check'),stat('Média simples dos objetivos',average,'chart'));}

  function ninebox(root){const nine=root.querySelector('.nine');if(nine){nine.classList.add('la22-nine');nine.setAttribute('aria-label','Matriz de desempenho e potencial');}}
  function modalStyle(){const dialog=document.getElementById('modal');if(!dialog?.open)return;const content=document.getElementById('modalBody');if(!content)return;const category=content.querySelector('.la21-mission-detail')?'mission':content.querySelector('.scorm-v3-canvas,.lxp-lesson-top,iframe')?'player':content.querySelector('.a6-answer,.a6-immersive')?'exam':content.querySelector('form')?'form':'detail';dialog.dataset.la22Modal=category;const h=content.querySelector('h1,h2');if(h&&!h.classList.contains('la22-modal-title'))h.classList.add('la22-modal-title');}
  function run(){const shell=document.querySelector('#app .shell');if(!shell)return;const root=shell.querySelector('#inside');if(!root)return;const route=currentRoute(shell),config=routes[route];if(!config)return;root.dataset.la22Page=config[0];shell.dataset.la22Route=config[0];
    for(const b of shell.querySelectorAll('aside nav [data-act="nav"]')){const c=routes[b.dataset.id];if(!c)continue;const ic=b.querySelector('.ico');if(ic&&ic.dataset.la22Icon!==c[1]){ic.dataset.la22Icon=c[1];ic.replaceChildren(icon(c[1]));ic.dataset.la21=c[1];}}
    decorateHero(root,config);markMetrics(root);
    if(config[0]==='dashboard')dashboard(root);if(config[0]==='catalog')catalog(root);if(config[0]==='saved')saved(root);if(config[0]==='reports')reports(root);if(config[0]==='okr')okr(root);if(config[0]==='ninebox')ninebox(root);if(config[0]==='journeys')for(const c of root.querySelectorAll('.journey-card'))coverFor(c);
    modalStyle();
  }
  let pending=false;const schedule=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;run();});};
  const app=document.getElementById('app');if(app)new MutationObserver(schedule).observe(app,{childList:true,subtree:true});const dialog=document.getElementById('modal');if(dialog)new MutationObserver(schedule).observe(dialog,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});schedule();
})();
