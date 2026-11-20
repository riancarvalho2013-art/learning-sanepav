import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {mkdtempSync,rmSync,statSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'

const directory=mkdtempSync(join(tmpdir(),'sanepav-backup-test-'))
const databasePath=join(directory,'learning.sqlite')
const backupPath=join(directory,'backups','pre-privacy-20261119.sqlite')
const moduleUrl=new URL('./storage.mjs',import.meta.url).href
try{
 const source=new DatabaseSync(databasePath)
 source.exec('PRAGMA journal_mode=WAL; CREATE TABLE objects (key TEXT PRIMARY KEY, etag TEXT NOT NULL, body BLOB NOT NULL)')
 source.prepare('INSERT INTO objects VALUES(?,?,?)').run('system/state-v1','original',Buffer.from('{"users":[]}'))
 source.prepare('INSERT INTO objects VALUES(?,?,?)').run('files/test/example.pdf','media',Buffer.from([0,1,2,255]))
 const start=()=>{
  const result=spawnSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(moduleUrl)})`],{env:{...process.env,LEARNING_DB:databasePath},encoding:'utf8'})
  assert.equal(result.status,0,result.stderr)
 }
 start()
 const snapshot=new DatabaseSync(backupPath,{readOnly:true})
 assert.equal(snapshot.prepare('PRAGMA integrity_check').get().integrity_check,'ok')
 assert.equal(snapshot.prepare('SELECT etag FROM objects WHERE key=?').get('system/state-v1').etag,'original')
 assert.deepEqual(Buffer.from(snapshot.prepare('SELECT body FROM objects WHERE key=?').get('files/test/example.pdf').body),Buffer.from([0,1,2,255]))
 assert.equal(statSync(backupPath).mode&0o777,0o600)
 source.prepare('UPDATE objects SET etag=? WHERE key=?').run('updated','system/state-v1')
 start()
 assert.equal(snapshot.prepare('SELECT etag FROM objects WHERE key=?').get('system/state-v1').etag,'original')
 snapshot.close()
 source.close()
 console.log('OK: backup consistente com WAL e arquivos, integridade, permissões e preservação após reinício.')
}finally{
 rmSync(directory,{recursive:true,force:true})
}
