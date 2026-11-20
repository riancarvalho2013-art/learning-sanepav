import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {migrate} from './migrations.mjs'
import {createRecovery} from './recovery.mjs'
import {hashPassword,verifyPassword} from './credentials.mjs'
const db=new DatabaseSync(':memory:')
db.exec('CREATE TABLE objects(key TEXT PRIMARY KEY,etag TEXT,body BLOB)')
migrate(db)
const original='original-test-password-1234',replacement='updated-test-password-1234'
const person={id:'test-person',email:'person@example.test',active:true,...await hashPassword(original,'legacy-test-salt',100000)}
assert.equal(await verifyPassword(original,person),true)
assert.equal(await verifyPassword('incorrect-test-password',person),false)
db.prepare('INSERT INTO people VALUES(?)').run(person.id)
db.prepare('INSERT INTO objects VALUES(?,?,?)').run('system/state-v1','before',Buffer.from(JSON.stringify({users:[person],sessions:[{person:person.id}],logs:[]})))
const messages=[]
const handle=createRecovery(db,async message=>messages.push(message))
const settings={origin:'https://learning.example.test'}
const request=(path,body)=>new Request('https://learning.example.test/api/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
assert.equal((await handle(request('request-password-reset',{email:person.email}),'test',null)).status,503)
const known=await handle(request('request-password-reset',{email:person.email}),'test',settings)
const unknown=await handle(request('request-password-reset',{email:'unknown@example.test'}),'test',settings)
assert.deepEqual(await known.json(),await unknown.json())
assert.equal(messages.length,1)
const token=messages[0].token
assert.equal(db.prepare('SELECT token_hash FROM password_resets').get().token_hash.includes(token),false)
assert.equal((await handle(request('reset-password',{token:'bad',password:replacement}),'test',settings)).status,400)
const results=await Promise.allSettled(Array.from({length:2},()=>handle(request('reset-password',{token,password:replacement}),'test',settings)))
assert.equal(results.filter(item=>item.status==='fulfilled'&&item.value.status===200).length,1)
const stored=JSON.parse(Buffer.from(db.prepare('SELECT body FROM objects').get().body).toString())
assert.equal(stored.sessions.length,0)
assert.equal(await verifyPassword(replacement,stored.users[0]),true)
assert.equal(await verifyPassword(original,stored.users[0]),false)
assert.equal(stored.users[0].iterations,600000)
await handle(request('request-password-reset',{email:person.email}),'expired-test',settings)
db.exec('UPDATE password_resets SET expires_at=0')
assert.equal((await handle(request('reset-password',{token:messages.at(-1).token,password:original}),'test',settings)).status,400)
for(let i=0;i<5;i++)assert.equal((await handle(request('request-password-reset',{email:'unknown@example.test'}),'rate-test',settings)).status,200)
assert.equal((await handle(request('request-password-reset',{email:'unknown@example.test'}),'rate-test',settings)).status,429)
db.close()
console.log('OK: recuperação configurável, resposta genérica, token com hash, expiração, uso único concorrente e revogação de sessões.')
