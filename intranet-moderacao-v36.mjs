/** V36 — administrative moderation. Never trusts a client role or deletes shared binary objects. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const idOK=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v);
const fail=(ok,message,status)=>{if(!ok)throw Object.assign(new Error(message),{status});};
export function removeIntranetPost(state,actor,postId,audit){
 fail(actor?.active&&actor.role==='Administrador','Exclusão exclusiva da administração.',403);
 fail(idOK(postId),'Publicação inválida.',400);
 const posts=Array.isArray(state.socialPosts)?state.socialPosts:[];
 const index=posts.findIndex(p=>p.id===postId);
 fail(index>=0,'Publicação indisponível.',404);
 posts.splice(index,1);
 // Comments/reactions are embedded in the deleted record. Remove associated inbox entries.
 for(const [id,items] of Object.entries(state.notifications||{})){
  if(Array.isArray(items))state.notifications[id]=items.filter(n=>!(n.target===postId&&['Intranet','Rede social'].includes(n.page)));
 }
 audit(state,actor,'Publicação da Intranet excluída pela administração: '+postId);
 // Binary storage is intentionally retained: no dangling shared references or non-atomic storage deletes.
 return {ok:true};
}
export function moderationRequested(user,requested){
 if(requested)fail(user?.active&&user.role==='Administrador','Moderação exclusiva da administração.',403);
 return Boolean(requested);
}
function swap(s,old,next){if(s.includes(next))return s;if(s.split(old).length!==2)throw Error('V36: contrato incompatível: '+old.slice(0,110));return s.replace(old,()=>next);}
export function patchPlatformV36(s){
 const imp="import {removeIntranetPost,moderationRequested} from './intranet-moderacao-v36.mjs'";
 if(!s.includes(imp))s=imp+'\n'+s;
 s=swap(s,`function socialFeed(state,user,cursor,postId){
  const posts=(state.socialPosts||[]).filter(post=>sameOrganization(state,user,post.author))`, `function socialFeed(state,user,cursor,postId,moderation=false){
  const all=moderationRequested(user,moderation);
  const posts=(state.socialPosts||[]).filter(post=>all||sameOrganization(state,user,post.author))`);
 s=swap(s,"reaction:post.reactions[user.id]||'',reactions:counts,canEdit:post.author===user.id}","reaction:post.reactions[user.id]||'',reactions:counts,canEdit:post.author===user.id,canDelete:user.role==='Administrador',canInteract:sameOrganization(state,user,post.author)}");
 s=swap(s,"  const posts=state.socialPosts??=[]\n  if(operation==='socialPost'){","  if(operation==='socialDelete')return removeIntranetPost(state,user,body.id,audit)\n  const posts=state.socialPosts??=[]\n  if(operation==='socialPost'){");
 s=swap(s,"  requireOk(item&&sameOrganization(state,user,owner),'Mídia indisponível.',404)","  const moderation=kind==='post'&&new URL(req.url).searchParams.get('moderation')==='1'&&moderationRequested(user,true)\n  requireOk(item&&(moderation||sameOrganization(state,user,owner)),'Mídia indisponível.',404)");
 s=swap(s,"return response(socialFeed(state,u,url.searchParams.get('after'),url.searchParams.get('post')))","return response(socialFeed(state,u,url.searchParams.get('after'),url.searchParams.get('post'),url.searchParams.get('moderation')==='1'))");
 s=swap(s,"['/api/avatar','/api/socialPost','/api/socialComment','/api/socialReaction'].includes(path)","['/api/avatar','/api/socialPost','/api/socialComment','/api/socialReaction','/api/socialDelete'].includes(path)");
 return s;
}
export function patchWebV36(s){
 s=swap(s,"const openComments=new Set()","const openComments=new Set()\nlet socialModerationV36=false\nconst deletingPostsV36=new Set()");
 s=swap(s,"if(act==='socialReact')await reactSocial(id,el.dataset.reaction)","if(act==='socialDeleteV36')await deleteSocialV36(id,el)\n if(act==='socialModerationV36'){if(!admin())return;socialModerationV36=!socialModerationV36;resetSocial();draw();await loadSocial();if(d?.me&&isIntranet())draw()}\n if(act==='socialReact')await reactSocial(id,el.dataset.reaction)");
 s=swap(s,"notificationOpen=false;resetSocial();await start()","notificationOpen=false;socialModerationV36=false;resetSocial();await start()");
 s=swap(s,`    '<form class="comment-form" data-post="'+esc(post.id)+'"><label>Escreva um comentário<input name="text" maxlength="800" required></label>'+\n    '<button type="submit" class="primary">Enviar</button><p class="err" role="alert"></p></form></details>'`,`    (post.canInteract===false?'':'<form class="comment-form" data-post="'+esc(post.id)+'"><label>Escreva um comentário<input name="text" maxlength="800" required></label>'+\n    '<button type="submit" class="primary">Enviar</button><p class="err" role="alert"></p></form>')+'</details>'`);
 s=swap(s,"const source='/social/post/'+encodeURIComponent(post.id)","const source='/social/post/'+encodeURIComponent(post.id)+(socialModerationV36&&admin()?'?moderation=1':'')");
 s=swap(s,`'" data-reaction="'+esc(label)+'" aria-pressed="'+(post.reaction===label)+'" title="'+esc(label)+'"><span aria-hidden="true">'+emoji+`,`'" data-reaction="'+esc(label)+'" aria-pressed="'+(post.reaction===label)+'" title="'+esc(label)+'"'+(post.canInteract===false?' disabled':'')+'><span aria-hidden="true">'+emoji+`);
 s=swap(s,"(post.canEdit?btn('Editar','composeSocial',post.id,'smallBtn'):'')+'</div>'+","'<div class=\"actions\">'+(post.canEdit?btn('Editar','composeSocial',post.id,'smallBtn'):'')+(admin()&&post.canDelete?btn('Excluir','socialDeleteV36',post.id,'smallBtn danger'):'')+'</div></div>'+");
 s=swap(s,"btn('Atualizar','socialRefresh')+btn('Criar publicação','composeSocial','','primary')+","btn('Atualizar','socialRefresh')+(admin()?btn(socialModerationV36?'Voltar ao meu escopo':'Moderar todas as publicações','socialModerationV36','','smallBtn'):'')+btn('Criar publicação','composeSocial','','primary')+");
 s=swap(s,"const result=await api('socialFeed'+(more?'?after='+encodeURIComponent(feedCursor):''))","const params=new URLSearchParams();if(more)params.set('after',feedCursor);if(admin()&&socialModerationV36)params.set('moderation','1');\n    const result=await api('socialFeed'+(params.size?'?'+params.toString():''))");
 s=swap(s,"async function socialChange(id,operation,body){\n  await api(operation,{...body,id})\n  const result=await api('socialFeed?post='+encodeURIComponent(id))\n  const updated=",`async function deleteSocialV36(id,control){
  if(!admin()||deletingPostsV36.has(id))return;
  if(!confirm('Excluir esta publicação? Os comentários e as reações também serão removidos. Esta ação não pode ser desfeita pela interface.'))return;
  deletingPostsV36.add(id);control.disabled=true;
  try{
    await api('socialDelete',{id});
    if(d?.me&&isIntranet()){resetSocial();draw();await loadSocial();if(d?.me&&isIntranet())draw()}
    void refreshNotifications();toast('Publicação excluída.');
  }finally{deletingPostsV36.delete(id);if(control.isConnected)control.disabled=false;}
}
async function socialChange(id,operation,body){
  const view=feedVersion;
  await api(operation,{...body,id})
  const result=await api('socialFeed?post='+encodeURIComponent(id))
  if(view!==feedVersion)return;
  const updated=`);
 return s;
}
export function patchRegressionV36(s){
 const marker='// V36 moderation: HTTP regression on the real worker.';
 if(s.includes(marker))return s;
 return s+'\n'+marker+`
await good('socialPost',cookies.employee,{text:'Publicação de outro autor V36'});
const other=(await (await raw('/api/socialFeed',cookies.employee)).json()).items.find(p=>p.text==='Publicação de outro autor V36');assert.ok(other);
assert.equal(other.canDelete,false);
assert.equal((await call('socialDelete',cookies.employee,{id:other.id})).status,403);
for(const name of ['director','leader','rh'])assert.equal((await call('socialDelete',cookies[name],{id:other.id})).status,403);
assert.equal((await raw('/api/socialFeed?moderation=1',cookies.employee)).status,403);
assert.equal((await raw('/api/socialDelete','',JSON.stringify({id:other.id}),'POST',{'content-type':'application/json'})).status,401);
assert.equal((await raw('/api/socialDelete',admin,JSON.stringify({id:other.id}),'POST',{origin:'https://other.test','content-type':'application/json'})).status,403);
await good('socialComment',cookies.employee,{id:other.id,text:'Comentário V36'});
await good('socialReaction',cookies.employee,{id:other.id,reaction:'Curtir'});
const allV36=await (await raw('/api/socialFeed?moderation=1',admin)).json();assert.ok(allV36.items.some(p=>p.id===other.id&&p.canDelete&&p.comments.length===1&&p.reactions.Curtir===1));
await good('socialDelete',admin,{id:other.id});
assert.equal((await call('socialDelete',admin,{id:other.id})).status,404);
assert.equal((await (await raw('/api/socialFeed?post='+other.id,cookies.employee)).json()).items.length,0);
assert.equal((await call('socialComment',cookies.employee,{id:other.id,text:'Não deve existir'})).status,404);
await good('socialDelete',admin,{id:post.id});
assert.equal((await raw('/social/post/'+post.id,admin)).status,404);
assert.equal((await (await raw('/api/socialFeed?post='+post.id,admin)).json()).items.length,0);
console.log('PASS V36: exclusão administrativa, acesso, CSRF, comentários, reações e mídia indisponível.');
`;
}
function install(){const files=[['platform.mjs',patchPlatformV36],['web-app.js',patchWebV36],['verify-social-v24.mjs',patchRegressionV36]];const results=files.map(([f,fn])=>[f,fn(readFileSync(f,'utf8'))]);for(const [f,src] of results)writeFileSync(f,src);console.log('V36: moderação administrativa da Intranet instalada.');}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--install'))install();
