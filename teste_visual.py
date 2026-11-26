# Fixture isolated: copies the relevant legacy cascade and uses the actual hotfix file.
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
css=(ROOT/'GIT/web-design-v27.css').read_text()
legacy='''*{box-sizing:border-box}body{margin:0;font:14px/1.5 Arial}input,textarea,select{width:100%;padding:12px;background:white;border:1px solid #a9c3e4;border-radius:9px}textarea{min-height:108px}button{padding:10px 14px;border:1px solid #c9ddef;border-radius:10px;background:white}button.primary{background:linear-gradient(105deg,#0739e5,#00869d);color:white}label{display:block;margin-top:12px}dialog{padding:clamp(20px,3vw,36px);width:min(840px,96vw);max-height:91dvh}dialog .heading{border-bottom:1px solid #e5eff8;padding-bottom:17px}.actions{display:flex;gap:9px;margin-top:20px;justify-content:flex-end}#editor>.actions{position:sticky;bottom:-22px;background:#fffffff5;padding:15px 0 3px;border-top:1px solid #eaf2f9}body:has(#app .shell[data-la22-route]) #modal{background:#f4f9ff url('/design-v22/canvas-claro.webp') center/cover;border:1px solid #b9d6f7;border-radius:24px;padding:24px;max-height:92dvh;width:min(900px,96vw);color:#081d50}body:has(#app .shell[data-la22-route]) #modal[data-la22-modal=mission]{width:min(1150px,96vw)}body:has(#app .shell[data-la22-route]) #modal.lxp-immersive{padding:0;max-width:none;max-height:100dvh;width:100vw;margin:0;border-radius:0;overflow-y:auto}body:has(#app .shell[data-la22-route]) #modal.lxp-immersive #editor>.actions{position:static;background:white}.p5-footer{display:flex;justify-content:space-between;gap:20px}.a6-form-footer{margin-top:23px;border-top:1px solid #e1eef8}.lxp-form-actions{display:flex;justify-content:flex-end}.kp7-actions{display:flex;justify-content:flex-end}.field-pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}'''
html='''<div id="app"><div class="shell" data-la22-route="missions"></div></div><dialog id="modal" data-la22-modal="mission"><div id="modalBody"><div class="heading"><h2>Criar trilha</h2><button type="button">Fechar</button></div><form id="editor"><label>Nome da trilha<input required></label><label>Descrição<textarea></textarea></label><label>Ordem de estudo<select><option>Sequencial — concluir etapas anteriores</option></select></label><label>Imagem de capa (opcional)<input type="file"></label><label>Escolher curso para adicionar<select><option>Boas-vindas à Sanepav</option></select></label><button type="button">Adicionar etapa</button><p class="err" role="alert"></p><div class="FOOT"><button class="primary">Salvar trilha</button></div></form></div></dialog>'''
count=0
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for w,h in [(320,568),(390,844),(768,700),(1064,784),(1440,900)]:
  page=b.new_page(viewport={'width':w,'height':h})
  for footer in ['actions','lxp-form-actions','p5-footer','a6-form-footer','kp7-actions']:
   page.set_content('<style>'+legacy+css+'</style>'+html.replace('FOOT',footer));page.evaluate('modal.showModal()')
   result=page.evaluate('''() => {let d=document.querySelector('#modal'),f=document.querySelector('#editor > div:last-child'),btn=f.querySelector('button');btn.scrollIntoView({block:'end'});let a=d.getBoundingClientRect(),c=btn.getBoundingClientRect(),s=getComputedStyle(f);return {inside:a.left>=0&&a.right<=innerWidth+1&&a.top>=0&&a.bottom<=innerHeight+1,button:c.left>=a.left&&c.right<=a.right&&c.bottom<=a.bottom+1&&c.top>=a.top,static:s.position==='static',clear:s.backgroundColor==='rgba(0, 0, 0, 0)',noArt:!getComputedStyle(d).backgroundImage.includes('url('),noOverflow:d.scrollWidth<=d.clientWidth+1,clickable:document.elementFromPoint(c.x+c.width/2,c.y+c.height/2)===btn}}''')
   assert all(result.values()),(w,footer,result);count+=len(result)
   if w==1064 and footer=='actions':page.screenshot(path=str(ROOT/'GUIA/previa-modal-fixture.png'))
  # classroom excluded; preserve the fixture's immersive rules.
  page.set_content('<style>'+legacy+css+'</style>'+html.replace('FOOT','actions'));page.evaluate("modal.classList.add('lxp-immersive');modal.showModal()")
  assert page.evaluate("getComputedStyle(modal).borderRadius==='0px' && getComputedStyle(document.querySelector('#editor>.actions')).backgroundColor==='rgb(255, 255, 255)'");count+=2
  page.close()
 b.close()
print(f'{count} verificações de layout aprovadas (fixture isolada, cinco tamanhos e cinco rodapés).')
