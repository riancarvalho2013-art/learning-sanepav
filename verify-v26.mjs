import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=file=>readFileSync(file,'utf8')
const app=read('web-app.js'),lxp=read('web-lxp-v2.js'),reports=read('web-reports-v3.js')
const css=read('web-design-v26.css'),foundation=read('web-foundation.js'),platform=read('platform.mjs')
const index=read('web-index.html'),manifest=JSON.parse(read('asset-manifest.json'))
let checks=0
const check=(value,message)=>{assert(value,message);checks++}

check(app.includes("nav('Intranet','▧')"),'navegação usa Intranet')
check(app.includes("const talentReviewer=()=>['Administrador','Líder','RH/DHO','Diretoria']"),'9Box restrito aos quatro perfis autorizados')
check(app.includes('Ver perfil, PDI e histórico'),'9Box integra perfil e desenvolvimento')
check(app.includes('não automatiza decisões de emprego'),'9Box declara limite decisório')
check(!/[✦★☆✨]/.test(app),'interface principal sem estrelas decorativas')
check(reports.includes('role="tablist"')&&reports.includes('aria-selected'),'relatórios usam abas acessíveis')
check(css.includes('grid-auto-flow:column')&&css.includes('.r3-tabs>.r3-tab'),'abas analíticas horizontais e isoladas do menu global')
check(css.includes('height:176px')&&css.includes('min-height:176px'),'banners internos padronizados')
check(lxp.includes('Liderança responsável')&&lxp.includes('okr-kr-row'),'OKR exibe responsável e resultados-chave estruturados')
check(lxp.includes('okr-executive-summary')&&lxp.includes('data-okr-scope'),'OKR possui indicadores e segmentação funcional')
check(foundation.includes('plataforma enviará automaticamente um convite'),'cadastro informa envio automático')
check(foundation.includes("api('first-access/invite'"),'cadastro dispara convite de primeiro acesso')
check(lxp.includes("el.textContent='Acessos criados. Enviando convites corporativos"),'importação em lote dispara convites automáticos')
check(platform.includes("else if(op==='user'&&!b.id)"),'novo acesso recebe segredo técnico não utilizável')
check(index.includes('/design-v26.css?v=26')&&manifest['/design-v26.css'],'camada V26 incluída no build')

console.log('PASS V26: '+checks+' verificações de banners, relatórios, OKR, Intranet, 9Box, convites e remoção de estrelas.')
