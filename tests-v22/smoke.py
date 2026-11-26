"""Smoke tests of V22 in a browser with synthetic DOM fixtures, NOT the full platform.
Usage: python tests-v22/smoke.py (requires Python playwright + Chromium).
"""
import pathlib, re, json, os
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
js=(ROOT/'web-design-v22.js').read_text(); css=(ROOT/'web-design-v22.css').read_text()
routes=re.findall(r"^    '([^']+)':\['([^']+)'",js,re.M)
base='''<style>*{box-sizing:border-box}body{margin:0;font:16px Arial} .shell{display:grid;min-height:100vh} .inside{padding:20px} aside nav button{display:flex;align-items:center;width:100%;border:0;background:transparent;color:white} .brand{color:white} header{display:flex;flex-wrap:wrap} button{font:inherit;padding:8px;border:1px solid #cbdcf4;border-radius:10px;background:white;color:#082451;cursor:pointer} h1,h2,p{margin:0 0 9px} .tiles,.stats{display:grid;gap:10px} .learning-card{display:flex;flex-direction:column;min-width:0}.learning-cover{width:100%} .la21-split,.la21-overview{display:grid;gap:12px}.menuBtn{display:none} [hidden]{display:none!important} dialog{border:0} .dna-home-columns{display:grid}.bar{height:8px;background:#ddd}.bar span{display:block;height:100%} .lxp-page{min-width:0}</style>'''
nav='<aside><div class="la21-product"><span>Learning <em>Academy</em></span></div><nav><button class="sel" data-act="nav" data-id="Painel"><span class="ico">x</span>Menu ativo</button></nav></aside>'
header='<header><span class="breadcrumb">Learning Academy</span><div class="global-search"><input placeholder="Buscar"></div></header>'
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':900}); errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
 page.route('http://academy.test/**',lambda r:r.fulfill(status=200,body=base+'<style>'+css+'</style><div id="app"><div class="shell">'+nav+'<main>'+header+'<div id="inside" class="inside"></div></main></div></div><dialog id="modal"><div id="modalBody"></div></dialog><script>let d={me:{id:"u"},courses:[{id:"c",title:"Curso",status:"published"}],enroll:[{id:"e",course:"c",person:"u",progress:50}]};</script><script>'+js+'</script>',content_type='text/html') if r.request.url=='http://academy.test/' else r.fulfill(status=200,body=(ROOT/r.request.url.split('academy.test/')[1]).read_bytes(),content_type='image/webp') if (ROOT/r.request.url.split('academy.test/')[1]).is_file() else r.fulfill(status=404,body=''))
 page.goto('http://academy.test/')
 for name,key in routes:
  page.evaluate('''([name])=>{document.querySelector('nav button').dataset.id=name;document.querySelector('#inside').innerHTML='<div class="heading"><h1>'+name+'</h1><div class="page-actions"><button id="real-action">Ação existente</button></div></div><div class="stats"><article class="stat"><span>Matrículas</span><b>5</b></article></div>';document.getElementById('real-action').onclick=()=>window.clicked=true;window.clicked=false}''',[name])
  page.wait_for_function('(key)=>document.getElementById("inside").dataset.la22Page===key && !!document.querySelector(".la22-hero")',arg=key)
  assert page.locator('.la22-hero').count()==1,name
  page.locator('#real-action').click(); assert page.evaluate('window.clicked'),name
  assert page.locator('.la22-metric-icon').count()==1,name
 # Catalog uses native existing card actions and real view mode.
 page.evaluate('''()=>{document.querySelector('nav button').dataset.id='Catálogo LMS';document.querySelector('#inside').innerHTML='<div class="heading"><h1>Catálogo LMS</h1></div><div class="tiles"><article class="learning-card"><img class="learning-cover" src="/waves.webp"><h2>Curso</h2><button id="native-course" data-act="learn" data-id="e">Acessar</button></article></div>'}''')
 page.get_by_role('button',name='Lista',exact=True).click(); assert page.locator('.la22-catalog-grid').get_attribute('data-la22-view')=='list'; assert page.locator('#native-course').get_attribute('data-id')=='e'
 # Asynchronously updated OKR count and existing button identity.
 page.evaluate('''()=>{document.querySelector('nav button').dataset.id='OKR';document.querySelector('#inside').innerHTML='<div class="lxp-page"><header class="lxp-heading"><div class="lxp-heading-body"><div><h1>Objetivos e resultados</h1></div></div></header><div id="okrCards"><section class="lxp-panel"><progress class="okr-progress" max="100" value="60"></progress><div class="lxp-line"><progress value="50" max="100"></progress></div></section></div></div>'}''')
 page.wait_for_selector('.la22-okr-summary'); assert page.locator('.la22-okr-summary').inner_text().count('60%')==1
 page.evaluate("document.querySelector('#okrCards').innerHTML='<p>Nenhum OKR</p>'")
 page.wait_for_function("document.querySelector('.la22-okr-summary').innerText.includes('—')")
 # Modals classify from actual content, no extra event interception.
 page.evaluate("document.querySelector('#modalBody').innerHTML='<h2>Detalhes</h2><div class=la21-mission-detail></div>';document.querySelector('#modal').showModal()")
 page.wait_for_function("document.querySelector('#modal').dataset.la22Modal==='mission'");page.evaluate("document.querySelector('#modal').close()")
 for width in [1920,1440,1024,390]:
  page.set_viewport_size({'width':width,'height':900});page.wait_for_timeout(100)
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+2'),width
 assert not errors,errors
 print(f'OK: {len(routes)} route aliases; click handler, catalog grid/list, OKR refresh, modal classification, 4 viewports. Synthetic fixtures only.')
 browser.close()
