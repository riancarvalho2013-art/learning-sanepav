/* Opt-in single-instance scheduling. Never treats a local snapshot as a remote backup. */
import {isAbsolute,resolve} from 'node:path'
import {mkdirSync,readdirSync,realpathSync,statSync} from 'node:fs'
export function backupOptions(env=process.env){
 const dir=env.LEARNING_BACKUP_DIRECTORY?.trim();if(!dir)return null
 const hours=Number(env.LEARNING_BACKUP_INTERVAL_HOURS||24),max=Number(env.LEARNING_BACKUP_MAX_SNAPSHOTS||14)
 if(!isAbsolute(dir)||!Number.isInteger(hours)||hours<6||hours>168||!Number.isInteger(max)||max<2||max>90)throw Error('Configuração de backup V27 inválida.')
 return {dir,hours,max}
}
export function createBackupJob({primary,options,snapshot,log=console.info}){
 let running=false
 return async()=>{
  if(running)return {status:'busy'};running=true
  try{
   mkdirSync(options.dir,{recursive:true,mode:0o700});const source=realpathSync(primary),dest=realpathSync(options.dir)
   if(statSync(source).dev===statSync(dest).dev)throw Error('Dispositivo independente não comprovado.')
   const files=readdirSync(dest),count=files.filter(x=>/^learning-.*\.sqlite$/.test(x)).length
   if(count>=options.max){log(JSON.stringify({event:'backup_v27',status:'retention_limit',snapshots:count}));return {status:'retention_limit'}}
   const result=await snapshot(source,dest)
   if(!result.ok||!result.independent||!result.dataHashVerified)throw Error('Backup sem verificação completa.')
   log(JSON.stringify({event:'backup_v27',status:'verified',bytes:result.bytes,createdAt:result.createdAt}));return {status:'verified'}
  }catch{log(JSON.stringify({event:'backup_v27',status:'failed'}));return {status:'failed'}}finally{running=false}
 }
}
export function startBackupScheduler(primary,snapshot,env=process.env){
 let options;try{options=backupOptions(env)}catch{console.warn(JSON.stringify({event:'backup_v27',status:'invalid_configuration'}));return null}
 if(!options)return null
 if(primary===':memory:'){console.warn(JSON.stringify({event:'backup_v27',status:'not_persistent'}));return null}
 const job=createBackupJob({primary:resolve(primary),options,snapshot}),interval=options.hours*3600000
 // Run after startup, then periodically. A single application replica is required.
 const first=setTimeout(()=>void job(),60000),timer=setInterval(()=>void job(),interval);first.unref();timer.unref()
 return ()=>{clearTimeout(first);clearInterval(timer)}
}
