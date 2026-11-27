/** V42: materialize the reviewed V41 build in disposable checkouts; never touch a live DB. */
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync,mkdirSync,lstatSync,realpathSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,relative,dirname,isAbsolute,join} from 'node:path';
import {fileURLToPath} from 'node:url';
export const BASE='58c79a461699fb07fd119ceb7c8594a4d6b3afd7';
export const STAGES=['pipeline-v39-1.mjs','people-analytics-v40.mjs','topbar-v40-1.mjs','fluidez-v40-2.mjs','sidebar-v40-3.mjs','sidebar-v40-3-1.mjs','catalogo-v40-4.mjs','topbar-v40-5.mjs','security-v41.mjs','contas-v41-a.mjs'];
const oldInstall='RUN '+STAGES.map((p,i)=>'node '+p+(i?' --install':'')).join(' && ');
const oldNpm='RUN npm install --no-save --package-lock=false --ignore-scripts --omit=dev --no-audit --no-fund @aws-sdk/client-s3@3.1174.0';
const newNpm='RUN npm ci --ignore-scripts --omit=dev --no-audit --no-fund';
const allowed=new Set(['v42-consolidar.mjs','verify-v42-consolidar.mjs','.github/workflows/learning-v42.yml','V42-INSTRUCOES.md']);
const fail=(ok,msg)=>{if(!ok)throw Error(msg)};
const sha=b=>createHash('sha256').update(b).digest('hex');
export function swapOnce(s,a,b){fail(s.split(a).length===2,'Estrutura V41 diferente da referência: '+a.slice(0,100));return s.replace(a,()=>b);}
export function consolidateDocker(s){
 s=swapOnce(s,oldInstall+'\n','');
 return swapOnce(s,oldNpm,newNpm);
}
export function consolidatePackage(raw){
 const p=JSON.parse(raw);fail(p.engines?.node==='>=24'&&p.scripts?.test&&p.scripts?.start==='node serve.mjs','package.json incompatível');
 fail(!p.dependencies?.['@aws-sdk/client-s3']||p.dependencies['@aws-sdk/client-s3']==='3.1174.0','Dependência S3 diverge da V41');
 p.dependencies={...p.dependencies,'@aws-sdk/client-s3':'3.1174.0'};
 return JSON.stringify(p,null,2)+'\n';
}
function envIsolated(){const e={...process.env};for(const k of Object.keys(e))if(/^(LEARNING_|EMAIL_|BREVO_|RESEND_|APP_ORIGIN$|SETUP_KEY$|DATABASE_URL$|AWS_|GITHUB_TOKEN$|GH_TOKEN$)/.test(k))delete e[k];return {...e,NODE_ENV:'test',LEARNING_MEDIA_MODE:'sqlite',LEARNING_BACKUP_DIRECTORY:'',LEARNING_NOTIFICATIONS_ENABLED:'false'};}
function run(cmd,args,cwd,{input,capture=false,env=envIsolated()}={}){
 const r=spawnSync(cmd,args,{cwd,env,input,stdio:capture?['pipe','pipe','pipe']:(input===undefined?'inherit':['pipe','inherit','inherit']),maxBuffer:64*1024*1024});
 if(r.error||r.status!==0)throw Error(`${cmd} ${args[0]||''} falhou (${r.status??r.error?.code??'erro'}).`);
 return r.stdout;
}
export function inventory(root){
 const files={};function visit(dir){for(const ent of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const f=join(dir,ent.name),p=relative(root,f).split('\\').join('/');fail(!ent.isSymbolicLink(),'Link simbólico não permitido: '+p);if(ent.isDirectory())visit(f);else{fail(ent.isFile(),'Arquivo especial não permitido: '+p);const bytes=readFileSync(f);files[p]={sha256:sha(bytes),bytes:bytes.length};}}}visit(root);return files;
}
export function changes(before,after){const all=[...new Set([...Object.keys(before),...Object.keys(after)])].sort();return all.filter(p=>before[p]?.sha256!==after[p]?.sha256).map(path=>({path,action:!before[path]?'add':!after[path]?'delete':'replace',before:before[path]?.sha256??null,after:after[path]?.sha256??null}));}
export function assertEquivalent(a,b){const d=changes(a,b);fail(d.length===0,'Materializações não determinísticas: '+d.map(x=>x.path).join(', '));}
export function assertAllowedDiff(paths){fail(paths.every(x=>allowed.has(x)),'A branch contém alterações fora da entrega V42: '+paths.filter(x=>!allowed.has(x)).join(', '));}
function extract(source,head,dest){mkdirSync(dest);const data=run('git',['archive','--format=tar',head],source,{capture:true});run('tar',['-xf','-','-C',dest],source,{input:data});}
function materialize(root){const d=readFileSync(join(root,'Dockerfile'),'utf8');consolidateDocker(d);for(const [i,file] of STAGES.entries()){fail(existsSync(join(root,file)),'Instalador ausente: '+file);run(process.execPath,[file,...(i?['--install']:[])],root);}}
export function main(source,out){
 fail(/^24\./.test(process.versions.node),'Use Node 24 para equivalência com o Railway.');
 source=realpathSync(source);out=resolve(out);const rel=relative(source,out);fail(rel==='..'||rel.startsWith('../')||isAbsolute(rel),'Destino precisa estar fora do checkout.');fail(!existsSync(out),'Destino já existe; use uma pasta nova.');
 const head=run('git',['rev-parse','HEAD'],source,{capture:true}).toString().trim();
 const dirty=run('git',['status','--porcelain','--untracked-files=all'],source,{capture:true}).toString().trim();fail(!dirty,'Checkout sujo; commit as alterações antes de executar.');
 const changed=run('git',['diff','--name-only','-z',BASE,head],source,{capture:true}).toString().split('\0').filter(Boolean);assertAllowedDiff(changed);
 mkdirSync(out,{recursive:true});const first=join(out,'baseline-materialized'),candidate=join(out,'candidate'),report=join(out,'evidence'),upload=join(out,'upload');mkdirSync(report);
 extract(source,head,first);extract(source,head,candidate);
 const original=inventory(first);materialize(first);materialize(candidate);
 const materialized=inventory(first);assertEquivalent(materialized,inventory(candidate));
 const delta=changes(original,materialized);fail(delta.length>0,'Nenhum arquivo materializado.');fail(delta.every(x=>x.action!=='delete'),'Instaladores apagaram arquivos; revisão manual necessária.');
 const docker=join(candidate,'Dockerfile'),pkg=join(candidate,'package.json');writeFileSync(docker,consolidateDocker(readFileSync(docker,'utf8')));writeFileSync(pkg,consolidatePackage(readFileSync(pkg,'utf8')));
 run('npm',['install','--package-lock-only','--ignore-scripts','--no-audit','--no-fund'],candidate);
 const lock=JSON.parse(readFileSync(join(candidate,'package-lock.json'),'utf8'));fail(lock.packages?.['node_modules/@aws-sdk/client-s3']?.version==='3.1174.0','Lockfile não contém versão S3 esperada.');
 // Only expected build metadata may differ from the independently materialized baseline.
 const final=inventory(candidate),metadata=new Set(['Dockerfile','package.json','package-lock.json']);const extra=changes(materialized,final);fail(extra.every(x=>metadata.has(x.path)),'Mudança inesperada após consolidação: '+extra.map(x=>x.path).join(', '));
 for(const p of Object.keys(final).filter(p=>/\.(mjs|js)$/.test(p)))run(process.execPath,['--check',p],candidate);
 const all=changes(original,final);fail(all.every(x=>x.action!=='delete'),'Entrega incremental não pode apagar arquivos.');
 mkdirSync(upload);for(const x of all){const dest=join(upload,x.path);mkdirSync(dirname(dest),{recursive:true});copyFileSync(join(candidate,x.path),dest);}
 const evidence={base:BASE,checkout:head,node:process.version,materializedFiles:delta.length,changedFiles:all.length,deterministicMaterialization:true,syntaxChecked:Object.keys(final).filter(p=>/\.(mjs|js)$/.test(p)).length,changes:all,status:'CANDIDATE_NOT_HOMOLOGATED',note:'Equivalência de fontes materializadas, não equivalência funcional. Testes Docker e E2E são gates separados.'};
 writeFileSync(join(report,'consolidacao.json'),JSON.stringify(evidence,null,2)+'\n');
 writeFileSync(join(upload,'V42-MANIFESTO.json'),JSON.stringify(evidence,null,2)+'\n');
 console.log(`V42: ${delta.length} arquivos materializados; ${all.length} alterados; lockfile gerado. Candidato ainda não homologado.`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){fail(process.argv.length===4,'Uso: node v42-consolidar.mjs REPO DESTINO_NOVO');main(process.argv[2],process.argv[3]);}
