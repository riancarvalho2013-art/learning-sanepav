/** Run ONLY against an authorized consistent backup in an isolated environment. */
import {DatabaseSync} from 'node:sqlite'
import {inspectLegacyOwnership} from './tenant-policy-v30.mjs'
import {existsSync} from 'node:fs'
const path=process.argv[2]
if(!path||!existsSync(path))throw new Error('Informe uma cópia consistente do SQLite, não o volume de produção.')
const db=new DatabaseSync(path,{readOnly:true})
try{
 db.exec('PRAGMA query_only=ON; BEGIN')
 const row=db.prepare('SELECT body FROM objects WHERE key=?').get('system/state-v1')
 if(!row)throw new Error('Estado legado não encontrado.')
 const state=JSON.parse(Buffer.from(row.body).toString())
 state.organization={companies:db.prepare('SELECT id,active FROM companies').all(),assignments:new Map(db.prepare('SELECT person_id,company_id FROM person_organizations').all().map(r=>[r.person_id,r]))}
 console.log(JSON.stringify(inspectLegacyOwnership(state),null,2))
 db.exec('ROLLBACK')
}finally{db.close()}
