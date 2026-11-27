import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const readInstallerV361=()=>readFileSync(new URL("./intranet-moderacao-v36.mjs",import.meta.url),"utf8");
const runAnchorV361=s=>runInNewContext(s,Object.create(null),{timeout:100});
import {removeIntranetPost,removeIntranetComment,moderationRequested,patchPlatformV36,patchWebV36,patchRegressionV36} from './intranet-moderacao-v36.mjs';
import {candidates} from './notificacoes-v31.mjs';
const post='12345678-1234-1234-1234-123456789abc',other='22345678-1234-1234-1234-123456789abc';
const admin={id:'admin',role:'Administrador',active:true,email:'admin@example.test'},author={id:'author',role:'Colaborador',active:true,email:'author@example.test'},worker={id:'worker',role:'Colaborador',active:true,email:'worker@example.test'};
const audit=(s,u,event)=>s.logs.push({actor:u.id,event});
const at='2026-11-27T12:00:00Z',now=new Date('2026-11-27T12:05:00Z'),since=Date.parse('2026-11-26T00:00:00Z');
const fixture=()=>({users:[admin,author,worker],logs:[],records:[],socialPosts:[{id:post,author:author.id,at,comments:[{author:worker.id,text:'confidencial'}],reactions:{worker:'Curtir'},media:{id:'shared'}},{id:other,author:author.id,at,comments:[],reactions:{},media:{id:'shared'}}],notifications:{author:[{id:'n1',target:post,page:'Intranet',at},{id:'n2',target:other,page:'Intranet',at},{id:'n3',target:post,page:'PDI',at}],worker:[{id:'n4',target:post,page:'Rede social',at}]}});
test('admin removes any authors post and associated inbox entries, preserves unrelated records and shared media references',()=>{const s=fixture();assert.deepEqual(removeIntranetPost(s,admin,post,audit),{ok:true});assert.deepEqual(s.socialPosts.map(x=>x.id),[other]);assert.equal(s.socialPosts[0].media.id,'shared');assert.deepEqual(s.notifications.author.map(x=>x.id),['n2','n3']);assert.deepEqual(s.notifications.worker,[]);assert.equal(s.logs.length,1);assert.equal(s.logs[0].actor,'admin');assert.ok(s.logs[0].event.includes(post));assert.ok(!s.logs[0].event.includes('confidencial'));assert.throws(()=>removeIntranetPost(s,admin,post,audit),{status:404});assert.equal(s.logs.length,1)});
test('all non-admins including author, inactive admin and missing actor are denied without state mutation',()=>{for(const actor of [author,{...worker,role:'Líder'},{...worker,role:'RH/DHO'},{...worker,role:'Diretoria'},{...admin,active:false},null]){const s=fixture(),before=JSON.stringify(s);assert.throws(()=>removeIntranetPost(s,actor,post,audit),{status:403});assert.equal(JSON.stringify(s),before);assert.throws(()=>moderationRequested(actor,true),{status:403})}});
test('moderation is explicitly requested and restricted to active admins; invalid IDs rejected',()=>{assert.equal(moderationRequested(admin,true),true);assert.equal(moderationRequested(author,false),false);assert.equal(moderationRequested(admin,false),false);const s=fixture();assert.throws(()=>removeIntranetPost(s,admin,'bad',audit),{status:400});assert.equal(s.socialPosts.length,2)});
test('real V31 candidate generator drops pending post and legacy notification after removal',()=>{const state=fixture(),raw={state,lxp:{},assignments:state.users.map(u=>({person_id:u.id,company_id:'a',department_id:'d'})),companies:[{id:'a',active:1}],departments:[],secure:[]};const jobs=()=>candidates(raw,now,since);assert.ok(jobs().some(j=>j.page==='Intranet'&&j.target===post));assert.ok(jobs().some(j=>j.page==='Intranet'&&j.target===other));removeIntranetPost(state,admin,post,audit);assert.ok(!jobs().some(j=>j.page==='Intranet'&&j.target===post));assert.ok(jobs().some(j=>j.page==='Intranet'&&j.target===other))});
test('installer fails closed on incompatible source and HTTP regression is idempotent',()=>{assert.throws(()=>patchPlatformV36('invalid'),/contrato incompatível/);assert.throws(()=>patchWebV36('invalid'),/contrato incompatível/);const s=patchRegressionV36('/* base */');assert.equal(patchRegressionV36(s),s);assert.ok(s.includes('socialDelete'));assert.ok(s.includes('moderation=1'))});

const comment1='32345678-1234-1234-1234-123456789abc',comment2='42345678-1234-1234-1234-123456789abc';
function commentsFixture(){
 const s=fixture();s.socialPosts[0].comments=[{id:comment1,author:worker.id,text:'privado'},{id:comment2,author:author.id,text:'preservado'}];
 s.notifications.author.push({id:'exact1',target:post,page:'Intranet',commentId:comment1,at},{id:'exact2',target:post,page:'Intranet',commentId:comment2,at});return s;
}
test('V36.1 admin deletes only selected comment and exactly linked alerts; post, reactions, media and other alerts remain',()=>{
 const s=commentsFixture(),before=structuredClone(s.socialPosts[0]);assert.deepEqual(removeIntranetComment(s,admin,post,comment1,audit),{ok:true});
 assert.deepEqual(s.socialPosts[0],{...before,comments:[before.comments[1]]});assert.equal(s.socialPosts.length,2);
 assert.ok(!s.notifications.author.some(n=>n.id==='exact1'));assert.ok(s.notifications.author.some(n=>n.id==='exact2'));assert.ok(s.notifications.author.some(n=>n.id==='n1'));
 assert.equal(s.logs.length,1);assert.ok(s.logs[0].event.includes(comment1));assert.ok(!s.logs[0].event.includes('privado'));
});
test('V36.1 prohibits non-ADM and inactive admin including the author, without writes',()=>{
 for(const u of [author,worker,{...worker,role:'Líder'},{...worker,role:'RH/DHO'},{...worker,role:'Diretoria'},{...admin,active:false},null]){
  const s=commentsFixture(),before=JSON.stringify(s);assert.throws(()=>removeIntranetComment(s,u,post,comment1,audit),{status:403});assert.equal(JSON.stringify(s),before);
 }
});
test('V36.1 rejects invalid, mismatched, missing and already deleted IDs',()=>{
 const s=commentsFixture();assert.throws(()=>removeIntranetComment(s,admin,post,'bad',audit),{status:400});assert.throws(()=>removeIntranetComment(s,admin,other,comment1,audit),{status:404});assert.throws(()=>removeIntranetComment(s,admin,comment2,comment1,audit),{status:404});assert.equal(s.logs.length,0);
 removeIntranetComment(s,admin,post,comment1,audit);assert.throws(()=>removeIntranetComment(s,admin,post,comment1,audit),{status:404});assert.equal(s.logs.length,1);
});
test('V36.1 removes only the corresponding queued legacy candidate; post and unrelated comments remain eligible',()=>{
 const state=commentsFixture(),raw={state,lxp:{},assignments:state.users.map(u=>({person_id:u.id,company_id:'a',department_id:'d'})),companies:[{id:'a',active:1}],departments:[],secure:[]};
 const jobs=()=>candidates(raw,now,since);const before=jobs();removeIntranetComment(state,admin,post,comment1,audit);const after=jobs();assert.equal(before.length-after.length,1);assert.ok(after.some(j=>j.kind==='post'&&j.target===post));assert.ok(after.some(j=>j.kind==='legacy'&&j.target===post));
});
test('V36.1 installer contracts preserve prior functionality and are idempotent on anchor fixtures',()=>{
 const source=readInstallerV361();
 for(const [name,patch] of [['patchPlatformV36',patchPlatformV36],['patchWebV36',patchWebV36]]){
  const body=source.split('export function '+name+'(s){')[1].split('\n return s;')[0];
  // Extract the exact original source anchors from the installer itself; no application code runs here.
  const literals=[...body.matchAll(/s=swap\(s,("(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`),/gs)].map(m=>m[1]);
  const fixture=literals.map(l=>runAnchorV361(l)).join('\n/* anchor boundary */\n');
  assert.ok(literals.length>=7);const patched=patch(fixture);assert.equal(patch(patched),patched);assert.ok(patched.includes('socialCommentDelete'));
 }
});
