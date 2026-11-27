"""Full-checkout browser smoke + isolated restore. Requires Python Playwright and Node 24.
Never accepts an existing database or a remote URL. Uses an empty temporary DB only.
Run from repository root: python verify-browser-v13.py
"""
import json, os, pathlib, secrets, socket, subprocess, tempfile, time, urllib.request, urllib.error, shutil
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent
NODE = os.getenv('LEARNING_NODE', 'node')
assert subprocess.check_output([NODE,'--version'],text=True).startswith('v24.'), 'Use Node.js 24'
subprocess.run([NODE,'build.mjs'],cwd=ROOT,check=True)
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*a,**k): return None
opener=urllib.request.build_opener(NoRedirect())
def request(origin,path,body=None,cookie='',expect=200,form=False):
    if body is not None:
        from urllib.parse import urlencode
        raw=urlencode(body).encode() if form else json.dumps(body).encode()
    else: raw=None
    req=urllib.request.Request(origin+path,data=raw,headers={'Origin':origin,'Cookie':cookie,'Content-Type':'application/x-www-form-urlencoded' if form else 'application/json'})
    try: r=opener.open(req,timeout=10)
    except urllib.error.HTTPError as exc:r=exc
    with r:
        data=r.read();assert r.status==expect,(path,r.status,data[:300]);return (json.loads(data) if r.headers.get_content_type()=='application/json' else data),r.headers

def start(database,key,logs):
    with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
    origin=f'http://127.0.0.1:{port}'
    env=dict(os.environ,LEARNING_DB=str(database),NODE_ENV='test',SETUP_KEY=key)
    child=subprocess.Popen([NODE,'serve.mjs','--port',str(port)],cwd=ROOT,env=env,stdout=logs,stderr=logs)
    try:
        for _ in range(150):
            if child.poll() is not None:raise RuntimeError('Servidor encerrou. Confira logs locais.')
            try:request(origin,'/readyz');return child,origin
            except (OSError,AssertionError):time.sleep(.1)
        raise RuntimeError('Readiness não atingida.')
    except BaseException:stop(child);raise

def stop(child):
    if child and child.poll() is None:
        child.terminate()
        try:child.wait(5)
        except subprocess.TimeoutExpired:child.kill();child.wait()

with tempfile.TemporaryDirectory(prefix='learning-e2e-v13-') as tmp:
    p=pathlib.Path(tmp); primary=p/'primary'/'learning.sqlite'; primary.parent.mkdir(); external=p/'recovery'/'snapshot.sqlite'; external.parent.mkdir(); key=secrets.token_hex(32); password=secrets.token_hex(18); child=None
    with (p/'server.log').open('w+') as logs:
        try:
            child,origin=start(primary,key,logs)
            _,headers=request(origin,'/ativar',{'code':key},expect=303,form=True)
            activation=headers['Set-Cookie'].split(';')[0]
            _,headers=request(origin,'/api/login',{'name':'QA Admin','email':'qa-v13@example.test','password':password},cookie=activation)
            cookie=headers['Set-Cookie'].split(';')[0]
            company,_=request(origin,'/api/v2/company',{'name':'QA V13'},cookie)
            me,_=request(origin,'/api/data',cookie=cookie); admin=me['me']['id']
            request(origin,'/api/v2/assignment',{'person_id':admin,'company_id':company['id'],'revision':0},cookie)
            with sync_playwright() as pw:
                launch={'headless':True}
                if os.getenv('LEARNING_CHROMIUM'):launch['executable_path']=os.environ['LEARNING_CHROMIUM']
                browser=pw.chromium.launch(**launch)
                for width in (1440,390):
                    ctx=browser.new_context(viewport={'width':width,'height':900});name,value=cookie.split('=',1);ctx.add_cookies([{'name':name,'value':value,'url':origin,'httpOnly':True}]);tab=ctx.new_page();errors=[];tab.on('pageerror',lambda error:errors.append(str(error)));tab.set_default_timeout(10000);tab.goto(origin);tab.locator('aside nav').wait_for(state='attached')
                    def go(name):
                        button = tab.locator('aside nav button[data-id="'+name+'"]').first
                        button.wait_for(state='attached')
                        button.evaluate('(e)=>e.click()')

                    go('OKR')
                    tab.get_by_text('Objetivos e resultados-chave', exact=True).wait_for()

                    if width == 1440:
                        tab.get_by_role('button', name='Novo objetivo').click()
                        tab.locator('#okr13Form [name=title]').fill('Objetivo QA V13')
                        tab.locator('#okr13Form [name=krTitle]').fill('Entregas')
                        tab.locator('#okr13Form [name=unit]').fill('unidades')
                        tab.locator('#okr13Form button[type=submit]').click()
                        tab.get_by_text('Objetivo QA V13', exact=True).wait_for()
                        tab.get_by_role('button', name='Publicar', exact=True).click()
                        tab.locator('#okr13Form button[type=submit]').click()
                        tab.get_by_role('button', name='Registrar check-in').click()
                        tab.locator('#okr13Form [name=value]').fill('50')
                        tab.locator('#okr13Form [name=note]').fill('Evidência QA')
                        tab.locator('#okr13Form button[type=submit]').click()

                    objective = tab.locator('.okr-objective').filter(
                        has=tab.get_by_text('Objetivo QA V13', exact=True)
                    )
                    objective.locator('progress.okr-progress[value="50"]').wait_for(state='visible')

                    go('Relatórios')
                    tab.get_by_role('button', name='Indicadores unificados').click()
                    tab.get_by_text('Catálogo e valores', exact=True).wait_for()
                    assert tab.get_by_role('link', name='Exportar indicadores XLSX').count() == 1

                    go('Pulse')
                    tab.get_by_text('Pulse de sentimentos', exact=True).first.wait_for()

                    go('Eficácia dos treinamentos')
                    tab.get_by_text('Nenhum treinamento disponível neste recorte.', exact=False).wait_for()

                    assert not errors, errors
                    ctx.close()
                    print(f'PASS navegador real {width}px: OKR, relatórios, Pulse, Kirkpatrick')
                browser.close()
            stored,_=request(origin,'/api/lxp/v2/okr',cookie=cookie);assert stored['items'][0]['progress']==50
            env=dict(os.environ,LEARNING_DB=str(primary),NODE_ENV='test');subprocess.run([NODE,'recovery-v13.mjs','create',str(external),'--test-same-device'],cwd=ROOT,env=env,check=True)
            stop(child);child=None
            restored=p/'restored'/'learning.sqlite';restored.parent.mkdir();shutil.copyfile(external,restored)
            child,origin=start(restored,key,logs)
            recovered,_=request(origin,'/api/lxp/v2/okr',cookie=cookie);assert recovered==stored
            request(origin,'/api/lxp/v2/okr',expect=401);print('PASS restauração: servidor real reiniciado sobre snapshot, OKR idêntico, autorização preservada')
        except BaseException:
            logs.flush();logs.seek(0);print(logs.read()[-3000:]);raise
        finally:stop(child)
