/** Explicit prefix/exact ownership. No fall-through after a module claims a route. */
export function createRouteRegistry(entries,fallback){
 if(typeof fallback!=='function')throw new TypeError('Roteador sem fallback legado.')
 const rules=entries.map(e=>{
  if(Boolean(e.exact)===Boolean(e.prefix)||typeof e.handler!=='function')throw new TypeError('Registro de rota inválido.')
  const path=e.exact||e.prefix;if(typeof path!=='string'||!path.startsWith('/')||(e.prefix&&!path.endsWith('/')))throw new TypeError('Caminho de rota inválido.')
  return Object.freeze({...e})
 })
 for(let i=0;i<rules.length;i++)for(let j=i+1;j<rules.length;j++){
  const a=rules[i],b=rules[j],x=a.exact||a.prefix,y=b.exact||b.prefix
  if(x===y||a.prefix&&y.startsWith(x)||b.prefix&&x.startsWith(y))throw Error('Conflito entre rotas: '+x+' e '+y)
 }
 return async request=>{
  const path=new URL(request.url).pathname,route=rules.find(r=>r.exact?path===r.exact:path.startsWith(r.prefix))
  if(!route)return fallback(request)
  const result=await route.handler(request)
  if(!(result instanceof Response))throw Error('Módulo registrado não retornou uma resposta HTTP.')
  return result
 }
}
