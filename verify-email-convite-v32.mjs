import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderInvitationV32,patchRecovery,patchManifest} from './email-convite-v32.mjs';
const origin='https://learning.example.test',link=origin+'/#reset='+'a'.repeat(64);
const sample={first:'Maria <Silva>',org:'Sanepav & Beta Clean',origin,link};
test('personalização e escape de conteúdo',()=>{
 const html=renderInvitationV32(sample);
 assert.ok(html.includes('Maria &lt;Silva&gt;'));assert.ok(!html.includes('Maria <Silva>'));
 assert.ok(html.includes('Sanepav &amp; Beta Clean'));assert.ok(html.includes('48 horas'));assert.ok(html.includes('uso único'));
});
test('botão e link de contingência usam o mesmo token legítimo',()=>{
 const html=renderInvitationV32(sample);assert.equal(html.split('href="'+link+'"').length-1,2);
 assert.ok(html.includes('Realizar meu primeiro acesso'));assert.ok(html.includes('Se o botão não abrir'));
 assert.ok(!html.includes('learningacademy.com.br'));assert.ok(!html.includes('javascript:'));
 for(const bad of ['https://other.example.test/#reset='+'a'.repeat(64),origin+'/#reset=invalid',origin+'/x#reset='+'a'.repeat(64)])assert.throws(()=>renderInvitationV32({...sample,link:bad}));
});
test('assets reais e registros de manifesto sem sobrescrever rotas existentes',()=>{
 const manifest=patchManifest({'/':{file:'web-index.html',mime:'text/html'}});
 for(const n of ['header','footer','line','shield','link','arrow','background']){
  const f='email-v32-'+n+'.png';assert.equal(manifest['/'+f].file,f);assert.equal(manifest['/'+f].mime,'image/png');assert.equal(readFileSync(new URL(f,import.meta.url)).subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.ok(renderInvitationV32(sample).includes(origin+'/'+f));
 }
 assert.equal(manifest['/'].file,'web-index.html');assert.deepEqual(patchManifest(manifest),manifest);
 assert.throws(()=>patchManifest({'/email-v32-header.png':{file:'other.png',mime:'image/png'}}));
});
test('HTML de e-mail com tabelas, alternativa textual nas imagens e fallback de cores',()=>{
 const html=renderInvitationV32(sample);assert.ok(html.includes('role="presentation"'));assert.ok(html.includes('<!--[if mso]>'));assert.ok(html.includes('bgcolor="#0754e7"'));assert.ok(html.includes('alt="Learning Academy'));assert.ok(!/<script\b|<form\b|data:image|<svg\b/i.test(html));
});
test('instalador altera apenas a apresentação e falha se a base mudar',()=>{
 const fixture=`import {hashPassword} from './credentials.mjs'\nexport function invitationEmail({name,company,platform,token},origin){\n const first=name,org=company,link=origin+'/#reset='+token\n const subject='subject',text='text'\n const html=\`<!doctype html><html>original</html>\`\n return {subject,text,html}\n}\nfunction markInvitation(db,hash,status){return status}\n`;
 const patched=patchRecovery(fixture);assert.ok(patched.includes('renderInvitationV32({first,org,link,origin})'));assert.ok(patched.includes("const subject='subject',text='text'"));assert.ok(patched.includes('function markInvitation(db,hash,status){return status}'));assert.equal(patchRecovery(patched),patched);assert.throws(()=>patchRecovery('incompatible'));
});
