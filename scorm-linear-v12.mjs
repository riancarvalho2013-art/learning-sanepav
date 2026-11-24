/** Bounded linear SCORM 1.2 and explicit flow-only SCORM 2004 subset. No claim of IMS/ADL sequencing conformance. */
import {createHash} from 'node:crypto'
const fail=message=>({mode:'unsupported',reason:message})
const local=name=>name.split(':').at(-1).toLowerCase()
const decode=value=>value.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g,(_,x)=>x[0]==='#'?String.fromCodePoint(x[1]==='x'?parseInt(x.slice(2),16):Number(x.slice(1))):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[x]))
// Parse only the structural XML needed here. Reject unknown entity references, DTDs,
// ambiguous namespace-local attributes, unbalanced elements and excessive size/depth.
function parse(xml){
 if(typeof xml!=='string'||xml.length>2_000_000||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Manifesto não suportado.')
 const source=xml.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>/g,'')
 const root={name:'#root',attrs:{},children:[],text:''},stack=[root];let end=0,nodes=0
 for(const m of source.matchAll(/<\/?[\w:.-]+(?:"[^"]*"|'[^']*'|[^'">])*>/g)){
  const text=source.slice(end,m.index);if(text.includes('<'))throw Error('XML inválido.');stack.at(-1).text+=decode(text);end=m.index+m[0].length
  const tag=m[0],close=tag.startsWith('</'),name=tag.match(/^<\/?([\w:.-]+)/)[1]
  if(close){if(stack.length<2||stack.at(-1).name!==name)throw Error('XML desequilibrado.');stack.pop();continue}
  const attrs=Object.create(null);const body=tag.slice(1+name.length,-1).replace(/\/\s*$/,'');let consumed=0
  for(const a of body.matchAll(/([\w:.-]+)\s*=\s*(['"])([\s\S]*?)\2/g)){
   if(body.slice(consumed,a.index).trim())throw Error('Atributo inválido.');consumed=a.index+a[0].length
   if(a[1]==='xmlns'||a[1].startsWith('xmlns:'))continue
   const k=local(a[1]);if(Object.hasOwn(attrs,k)||/&(?!#x[0-9a-fA-F]+;|#\d+;|amp;|lt;|gt;|quot;|apos;)/.test(a[3]))throw Error('Atributo ambíguo.')
   attrs[k]=decode(a[3])
  }
  if(body.slice(consumed).trim())throw Error('Atributo não interpretado.')
  const node={name,attrs,children:[],text:''};stack.at(-1).children.push(node);if(++nodes>20000)throw Error('Manifesto extenso.')
  if(!/\/\s*>$/.test(tag)){stack.push(node);if(stack.length>64)throw Error('Manifesto profundo.')}
 }
 if(stack.length!==1||source.slice(end).trim()||root.children.length!==1||local(root.children[0].name)!=='manifest')throw Error('Manifesto inválido.')
 return root.children[0]
}
const children=(node,name)=>node.children.filter(x=>local(x.name)===name)
const walk=function*(node){yield node;for(const child of node.children)yield* walk(child)}
function launchPath(href,folder){
 if(typeof href!=='string'||!href||href.length>700||/^[\/]|[\\?#:\x00-\x1f]/.test(href))return null
 let decoded;try{decoded=decodeURIComponent(href)}catch{return null}
 if(/[\\?#:\x00-\x1f]/.test(decoded)||decoded.startsWith('/'))return null
 const p=folder+decoded;return p.split('/').every(x=>x&&x!=='.'&&x!=='..')&&/\.html?$/i.test(p)?p:null
}
/** Only selected default organization, unique item identifiers, simple HTML SCO resources. */
export function linearScormPlan(xml,folder=''){
 let root;try{root=parse(xml)}catch(e){return fail(e.message)}
 const orgs=children(root,'organizations')[0],resources=children(root,'resources')[0]
 if(!orgs||!resources)return {mode:'single_or_unknown'}
 const allResources=children(resources,'resource'),resourceMap=new Map(allResources.map(x=>[x.attrs.identifier,x]))
 const organizations=children(orgs,'organization'),org=orgs.attrs.default?organizations.find(x=>x.attrs.identifier===orgs.attrs.default):organizations.length===1?organizations[0]:null
 if(!org)return fail('Organização SCORM não determinada.')
 const items=[...walk(org)].filter(x=>local(x.name)==='item'&&x.attrs.identifierref)
 const sco=items.filter(x=>resourceMap.get(x.attrs.identifierref)?.attrs.scormtype?.toLowerCase()==='sco')
 if(sco.length<=1)return {mode:'single_or_unknown'}
 if(sco.length>50||resourceMap.size!==allResources.length||items.length!==sco.length)return fail('Pacote misto ou acima do limite de 50 SCOs.')
 const all=[...walk(root)],schemaVersion=all.filter(x=>local(x.name)==='schemaversion').map(x=>x.text.trim()).join(' ')
 const version=/^2004(?: (?:2nd|3rd|4th) Edition)?$/i.test(schemaVersion)?'2004':/\b1\.2\b/.test(schemaVersion)&&!/2004/.test(schemaVersion)?'1.2':null
 if(!version)return fail('Versão SCORM não identificada para sequência linear.')
 const sequencingNames=['sequencing','sequencingcollection','controlmode','sequencingrules','prerequisites','masteryscore','timelimitaction','maxtimeallowed','datafromlms']
 let forwardOnly=false
 if(version==='1.2'){
  if(all.some(x=>Object.hasOwn(x.attrs,'base')||sequencingNames.includes(local(x.name))))return fail('Regras de sequenciamento, dados de LMS ou base XML exigem suporte adicional.')
 }else{
  // Only an explicit flat flow-only organization is supported. Unknown sequencing
  // behavior is rejected, never flattened into a fabricated ADL sequence.
  const seq=children(org,'sequencing'),control=seq.length===1?children(seq[0],'controlmode'):[]
  const mode=control.length===1?control[0]:null,attrs=mode?.attrs||{}
  if(!mode||attrs.flow!=='true'||attrs.choice!=='false'||Object.keys(attrs).some(k=>!['flow','choice','forwardonly'].includes(k))||attrs.forwardonly!==undefined&&!['true','false'].includes(attrs.forwardonly)||seq[0].children.length!==1||mode.children.length||Object.keys(seq[0].attrs).length)return fail('SCORM 2004 exige controlMode explícito: flow=true, choice=false; regras adicionais não suportadas.')
  const direct=children(org,'item');if(direct.length!==items.length||direct.some(x=>!x.attrs.identifierref||children(x,'item').length))return fail('SCORM 2004: apenas organização plana de SCOs obrigatórios.')
  if(all.some(x=>Object.hasOwn(x.attrs,'base')||x!==seq[0]&&x!==mode&&(/(?:sequenc|rollup|objective|controlmode|limitconditions|deliverycontrols|randomization|presentation|navigation|hidelmsui|completionthreshold|timeLimitAction|datafromlms)/i.test(local(x.name)))))return fail('SCORM 2004 contém regras ou controles fora da matriz suportada.')
  if(items.some(x=>x.attrs.isvisible==='false'||Object.keys(x.attrs).some(k=>!['identifier','identifierref','isvisible'].includes(k))))return fail('SCORM 2004 contém atividade oculta ou parâmetro não suportado.')
  forwardOnly=attrs.forwardonly==='true'
 }
 const seen=new Set(),plan=[]
 for(const item of sco){const res=resourceMap.get(item.attrs.identifierref),entry=launchPath(res.attrs.href,folder),id=item.attrs.identifier
  if(!id||id.length>160||seen.has(id)||!entry||item.attrs.parameters)return fail('Identificador ou endereço de SCO incompatível.')
  seen.add(id);plan.push({id,entry,title:(children(item,'title')[0]?.text.trim()||id).slice(0,150)})
 }
 return {mode:'linear',version,forwardOnly,id:createHash('sha256').update(xml).update('\0'+folder).digest('hex'),items:plan}
}

/** Bounded manifest inspection, not XML validation or a sequencer. Explicitly refuse DTDs. */
export function inspectManifest(xml){
 if(!xml)return {status:'absent',scoResources:null,linkedScoItems:null,sequencing:null,warning:'Manifesto ausente; compatibilidade não determinada.'}
 if(xml.length>2_000_000||/<!DOCTYPE|<!ENTITY/i.test(xml))return {status:'unsupported',scoResources:null,linkedScoItems:null,sequencing:null,warning:'Manifesto acima do limite ou contém DTD/entidades; inspecione fora do player.'}
 const clean=xml.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>/g,'')
 const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w:.-]+)\s*=\s*(['"])([\s\S]*?)\2/g)].map(m=>[m[1].split(':').at(-1).toLowerCase(),m[3]]))
 const resources=[...clean.matchAll(/<(?:[\w.-]+:)?resource(?=\s|\/?>)(?:"[^"]*"|'[^']*'|[^'">])*>/gi)].map(m=>attrs(m[0]))
 const sco=new Set(resources.filter(a=>a.scormtype?.toLowerCase()==='sco'&&a.identifier).map(a=>a.identifier))
 const linked=[...clean.matchAll(/<(?:[\w.-]+:)?item(?=\s|\/?>)(?:"[^"]*"|'[^']*'|[^'">])*>/gi)].map(m=>attrs(m[0])).filter(a=>sco.has(a.identifierref)).length
 const sequencing=/<(?:[\w.-]+:)?(?:sequencing|sequencingCollection|controlMode|sequencingRules)(?=\s|\/?>)/i.test(clean)
 return {status:'heuristic',scoResources:sco.size,linkedScoItems:linked,sequencing,warning:sco.size>1||linked>1||sequencing?'Possível pacote multi-SCO ou com regras de sequenciamento. Runtime atual não garante a execução completa de todos os SCOs.':sco.size===0?'SCO não identificado nesta inspeção.':'Um recurso SCO identificado; compatibilidade requer teste do pacote.'}
}

/** Prevent pending pre-V12 single-SCO evidence from bypassing an actual multi-SCO plan. */
export async function canReconcileScorm(bucket,course,enrollment){
 if(course.type!=='SCORM')return true
 if(!course.upload||!course.entry)return false
 const folder=course.entry.slice(0,course.entry.lastIndexOf('/')+1)
 let base='',manifest=await bucket.get('files/'+course.upload+'/imsmanifest.xml')
 if(!manifest&&folder){base=folder;manifest=await bucket.get('files/'+course.upload+'/'+folder+'imsmanifest.xml')}
 if(!manifest)return !enrollment.scormMultiV12
 const xml=await manifest.text(),plan=linearScormPlan(xml,base),inspection=inspectManifest(xml)
 if(plan.mode==='linear')return enrollment.completionV11?.content?.planId===plan.id&&enrollment.scormMultiV12?.planId===plan.id&&plan.items.every((item,i)=>enrollment.scormMultiV12.items[i]?.id===item.id&&enrollment.scormMultiV12.items[i]?.complete===true)
 if(inspection.scoResources>1||inspection.linkedScoItems>1||enrollment.scormMultiV12)return false
 return true
}
