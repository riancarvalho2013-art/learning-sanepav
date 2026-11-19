import {DatabaseSync} from 'node:sqlite'
import {randomUUID} from 'node:crypto'
import {mkdirSync} from 'node:fs'
mkdirSync('data',{recursive:true});const db=new DatabaseSync(process.env.LEARNING_DB||'data/learning.sqlite')
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS objects (key TEXT PRIMARY KEY, etag TEXT NOT NULL, body BLOB NOT NULL)')
export const BUCKET={async get(key){const r=db.prepare('SELECT * FROM objects WHERE key=?').get(key);if(!r)return null;const body=Buffer.from(r.body);return {etag:r.etag,body,text:async()=>body.toString(),json:async()=>JSON.parse(body.toString())}},async put(key,value,opts){const etag=randomUUID(),body=Buffer.from(value);const expected=opts?.onlyIf?.etagMatches;let res;if(expected)res=db.prepare('UPDATE objects SET etag=?,body=? WHERE key=? AND etag=?').run(etag,body,key,expected);else res=db.prepare('INSERT OR IGNORE INTO objects VALUES(?,?,?)').run(key,etag,body);return res.changes?{etag}:null}}
