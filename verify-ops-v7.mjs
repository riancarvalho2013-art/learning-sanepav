import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
const tmp=await mkdtemp(join(tmpdir(),'dna-ops-v7-'))
const dbFile=join(tmp,'learning.sqlite'),snapshot=join(tmp,'independent','learning-backup.sqlite')
let checks=0
const run=(mode,path)=>{
 const result=spawnSync(process.execPath,['ops/backup-verify.mjs',mode,path],{cwd:process.cwd(),env:{...process.env,LEARNING_DB:dbFile},encoding:'utf8'})
 checks++;return result
}
try{
 const db=new DatabaseSync(dbFile)
 db.exec('CREATE TABLE records(id INTEGER PRIMARY KEY, value TEXT NOT NULL)')
 db.prepare('INSERT INTO records(value) VALUES(?)').run('amostra de integridade')
 db.close()
 let res=run('--create',snapshot);assert.equal(res.status,0,res.stderr);assert.match(res.stdout,/backup_created/)
 res=run('--verify',snapshot);assert.equal(res.status,0,res.stderr);assert.match(res.stdout,/"records":1/)
 res=run('--restore-test',snapshot);assert.equal(res.status,0,res.stderr);assert.match(res.stdout,/restore_test_passed/)
 res=run('--create',dbFile);assert.notEqual(res.status,0,'Bloquear sobrescrita do banco principal')
 res=run('--verify',dbFile);assert.notEqual(res.status,0,'Bloquear uso do banco principal como backup')
 const after=new DatabaseSync(snapshot)
 assert.equal(after.prepare('SELECT value FROM records').get().value,'amostra de integridade');checks++
 after.close()
 console.log(`PASSOU: backup/restore V7 — ${checks} verificações (integridade, contagem, isolamento e proteção do banco original)`)
}finally{await rm(tmp,{recursive:true,force:true})}
