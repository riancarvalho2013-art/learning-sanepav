/** Deterministic ordered build pipeline. Existing patches remain the source of truth. */
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export const stages=Object.freeze(['integrar-brevo.mjs','notificacoes-v31.mjs','email-convite-v32.mjs','email-notificacoes-v33.mjs','notificacoes-v34.mjs','notificacoes-v35.mjs','intranet-moderacao-v36.mjs','email-compatibilidade-v37.mjs','usabilidade-v38.mjs','refinamento-v39.mjs','estabilidade-v39-1.mjs']);
export function runPipeline(root='.',run=spawnSync){
 for(const file of stages)if(!existsSync(resolve(root,file)))throw Error('Arquivo obrigatório ausente: '+file);
 for(const [i,file] of stages.entries()){
  const r=run(process.execPath,[file,...(i===0?[]:['--install'])],{cwd:root,stdio:'inherit'});
  if(r.error||r.status!==0)throw Error('Falha na etapa '+file+'; build interrompido.');
 }
 return stages.length;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log('Pipeline: '+runPipeline()+' etapas concluídas.');
