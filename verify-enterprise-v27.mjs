import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {randomBytes} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {backupOptions,createBackupJob} from './backup-scheduler-v27.mjs'
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {createMediaAdapter,mediaConfig,seal,unseal,verifyRemote} from './media-storage-v27.mjs'
let checks=0
const ok=(v,m)=>{assert.ok(v,m);checks++},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++}
const expect=async(p,pattern)=>{await assert.rejects(p,pattern);checks++}
const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE objects(key TEXT PRIMARY KEY, etag TEXT NOT NULL, body BLOB NOT NULL)')
const legacy={async get(k){const x=db.prepare('SELECT * FROM objects WHERE key=?').get(k);return x?{etag:x.etag,body:Buffer.from(x.body),json:async()=>JSON.parse(Buffer.from(x.body).toString())}:null},async put(k,v,o){const tag='old-'+Math.random(),expected=o?.onlyIf?.etagMatches,result=expected?db.prepare('UPDATE objects SET etag=?,body=? WHERE key=? AND etag=?').run(tag,Buffer.from(v),k,expected):db.prepare('INSERT OR IGNORE INTO objects VALUES(?,?,?)').run(k,tag,Buffer.from(v));return result.changes?{etag:tag}:null},async countExisting(keys){return keys.filter(k=>db.prepare('SELECT 1 FROM objects WHERE key=?').get(k)).length},async deleteSocialVideoParts(id){db.prepare('DELETE FROM objects WHERE key GLOB ?').run('social-video/'+id+'/*')}}
const records=new Map();let failPut=false,corruptRead=false
const remote={async put(k,b){if(failPut)throw Error('offline');records.set(k,Buffer.from(b))},async get(k){if(!records.has(k))throw Error('missing');const b=Buffer.from(records.get(k));if(corruptRead)b[0]^=1;return b},async remove(k){records.delete(k)}}
const config={mode:'external',key:randomBytes(32),keyId:'key-fixture',storeId:'store-fixture',prefix:'test'}
const bytes=Buffer.from('mídia fictícia'),key='files/test/demo.mp4'
try{
 eq(mediaConfig({}).mode,'sqlite');assert.throws(()=>mediaConfig({LEARNING_MEDIA_MODE:'external'}),/incompleta/);checks++
 const c=seal(bytes,config.key,'test/v27/a');eq(unseal(c,config.key,'test/v27/a'),bytes);assert.throws(()=>unseal(c,config.key,'test/v27/b'),/Integridade/);checks++
 await verifyRemote(config,remote);eq(records.size,0)
 const defaultMode=createMediaAdapter({db,legacy,config:{mode:'sqlite'}});eq(defaultMode.bucket,legacy)
 await legacy.put('files/legacy/demo.pdf','antigo');await legacy.put('system/state-v1','{"users":[]}')
 const a=createMediaAdapter({db,legacy,config,remote}),b=a.bucket
 eq((await b.get('files/legacy/demo.pdf')).body.toString(),'antigo');eq((await b.get('system/state-v1')).body.toString(),'{"users":[]}')
 const saved=await b.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'}});ok(saved?.etag);eq(a.externalCount(),1);eq((await b.get(key)).body,bytes)
 eq(db.prepare('SELECT length(body) n FROM objects WHERE key=?').get(key).n,0);eq(await b.countExisting([key]),1)
 eq(await b.put(key,Buffer.from('duplicate'),{onlyIf:{etagDoesNotMatch:'*'}}),null);eq(await b.put(key,Buffer.from('bad'),{onlyIf:{etagMatches:'wrong'}}),null)
 failPut=true;await expect(b.put(key,'replacement',{onlyIf:{etagMatches:saved.etag}}),/offline/);failPut=false;eq((await b.get(key)).body,bytes)
 corruptRead=true;await expect(b.get(key),/Integridade/);await expect(b.put('files/test/other.pdf','x',{onlyIf:{etagDoesNotMatch:'*'}}),/verificação/);corruptRead=false;eq(await b.get('files/test/other.pdf'),null)
 const changed=await b.put(key,'novo',{onlyIf:{etagMatches:saved.etag}});ok(changed?.etag!==saved.etag);eq((await b.get(key)).body.toString(),'novo')
 const sid='12345678-1234-1234-1234-123456789abc',part='social-video/'+sid+'/0';await b.put(part,'part');eq(a.externalCount(),2);await b.deleteSocialVideoParts(sid);eq(await b.get(part),null);eq(a.externalCount(),1)
 assert.throws(()=>createMediaAdapter({db,legacy,config:{mode:'sqlite'}}),/rehydrate/);checks++;assert.throws(()=>createMediaAdapter({db,legacy,config:{...config,keyId:'wrong'},remote}),/diferente/);checks++
 const back=createMediaAdapter({db,legacy,config:{...config,mode:'rehydrate'},remote});eq(await back.rehydrate(),1);eq(back.externalCount(),0);eq((await legacy.get(key)).body.toString(),'novo');eq(createMediaAdapter({db,legacy,config:{mode:'sqlite'}}).bucket,legacy)
}finally{db.close()}
const sandbox={};runInNewContext(readFileSync(new URL('./web-okr-report-v27.js',import.meta.url),'utf8'),sandbox);const {buildSheets,workbook}=sandbox.LearningOkrExportV27
const fake={access:{mode:'self',label:'Meu departamento',allowedScopes:['department','individual'],canSelectCompany:false},items:[{id:'o1',title:'=HYPERLINK("bad")',scope:'department',companyId:'c1',companyName:'Empresa',departmentName:'RH',ownerName:'Gestor',startsOn:'2026-01-01',endsOn:'2026-12-31',status:'active',progress:55,results:[{id:'k1',title:'A & B',unit:'%',baseline:0,target:100,current:55,weight:1,progress:55,checkinCount:1,canSeeHistory:false,checkins:[{note:'SECRET_NOT_AUTHORIZED',actorName:'SECRET_ACTOR'}]},{id:'k2',title:'Autorizado',unit:'pt',baseline:1,target:2,current:2,weight:1,progress:100,checkinCount:1,canSeeHistory:true,checkins:[{businessDate:'2026-02-01',at:'2026-02-01T10:00:00Z',value:2,note:'Nota permitida',actorName:'Gestor'}]}]},{id:'o2',title:'Encerrado',scope:'individual',companyId:'c1',startsOn:'2025-01-01',endsOn:'2025-12-31',status:'closed',results:[]}]}
const sheets=buildSheets(fake,{scope:'department',status:'active',from:'2026-02-01'});eq(sheets.length,4);eq(sheets[0][1].length,2);eq(sheets[1][1].length,3);eq(sheets[2][1].length,2);ok(!JSON.stringify(sheets).includes('SECRET_'));ok(JSON.stringify(sheets).includes('Nota permitida'));assert.throws(()=>buildSheets(fake,{scope:'company'}),/indisponível/);checks++;assert.throws(()=>buildSheets(fake,{company:'c2'}),/indisponível/);checks++;assert.throws(()=>buildSheets(fake,{from:'2026-02-30'}),/Confira/);checks++;eq(buildSheets(fake,{from:'2027-01-01'})[0][1].length,1)
class CaptureZip{constructor(){this.parts={}}file(k,v){this.parts[k]=v}async generateAsync(){return this.parts}}
const parts=await workbook(sheets,CaptureZip);ok(parts['xl/worksheets/sheet1.xml'].includes('t="inlineStr"'));ok(parts['xl/worksheets/sheet1.xml'].includes('=HYPERLINK(&quot;bad&quot;)'));ok(!parts['xl/worksheets/sheet1.xml'].includes('<f>'));ok(parts['xl/worksheets/sheet2.xml'].includes('A &amp; B'));ok(!Object.values(parts).join('').includes('SECRET_'));ok(parts['xl/worksheets/sheet1.xml'].includes('autoFilter'));ok(parts['xl/styles.xml'].includes('cellXfs'))
const manifest=JSON.parse(readFileSync(new URL('./asset-manifest.json',import.meta.url),'utf8')),html=readFileSync(new URL('./web-index.html',import.meta.url),'utf8');ok(manifest['/design-v27.css']?.file==='web-design-v27.css');ok(manifest['/okr-report-v27.js']?.file==='web-okr-report-v27.js');ok(html.indexOf('/design-v27.css')>html.indexOf('/design-v26.css'));ok(html.indexOf('/okr-report-v27.js')>html.indexOf('/zip.js'))
eq(backupOptions({}),null);eq(backupOptions({LEARNING_BACKUP_DIRECTORY:'/backups'}).hours,24);assert.throws(()=>backupOptions({LEARNING_BACKUP_DIRECTORY:'relative'}),/inválida/);checks++
const tmp=mkdtempSync(join(tmpdir(),'learning-backup-v27-test-'));try{const primary=join(tmp,'fixture.sqlite');writeFileSync(primary,'fake');let called=false;const events=[];const job=createBackupJob({primary,options:{dir:join(tmp,'backup'),max:14},snapshot:async()=>{called=true},log:v=>events.push(v)});eq((await job()).status,'failed');eq(called,false);ok(events.some(v=>v.includes('failed')))}finally{rmSync(tmp,{recursive:true,force:true})}
console.log(`PASS V27: ${checks} verificações isoladas de armazenamento, integridade, recuperação, privacidade, filtros, Excel e manifesto. Não substitui a suíte completa, S3 real ou QA autenticado.`)
