/** Observation-time history, additive. Current organization remains authoritative. */
import {resolveActor} from './completion-v11.mjs'
const iso=()=>new Date().toISOString(), timestamp="strftime('%Y-%m-%dT%H:%M:%fZ','now')"
const ROOT='/api/organization/v11/history'
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'private,no-store','x-content-type-options':'nosniff'}})
export function installOrganizationHistory(db,existingState){
 db.exec('BEGIN IMMEDIATE')
 try{
  db.exec(`CREATE TABLE IF NOT EXISTS org_history_v11_schema(version INTEGER PRIMARY KEY,observed_from TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS org_assignment_history_v11(
    sequence INTEGER PRIMARY KEY AUTOINCREMENT, person_id TEXT NOT NULL,company_id TEXT NOT NULL,unit_id TEXT,department_id TEXT,position TEXT NOT NULL,
    source_revision INTEGER NOT NULL,valid_from TEXT NOT NULL,valid_to TEXT,origin TEXT NOT NULL CHECK(origin IN ('baseline','insert','update')),
    CHECK(valid_to IS NULL OR valid_to>=valid_from));
   CREATE UNIQUE INDEX IF NOT EXISTS org_assignment_history_v11_open ON org_assignment_history_v11(person_id) WHERE valid_to IS NULL;
   CREATE INDEX IF NOT EXISTS org_assignment_history_v11_person ON org_assignment_history_v11(person_id,valid_from,sequence);
   CREATE INDEX IF NOT EXISTS org_assignment_history_v11_company ON org_assignment_history_v11(company_id,valid_from,sequence);
   CREATE TABLE IF NOT EXISTS org_manager_history_v11(
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,person_id TEXT NOT NULL,manager_id TEXT,valid_from TEXT NOT NULL,valid_to TEXT,origin TEXT NOT NULL CHECK(origin IN ('baseline','change')),
    CHECK(valid_to IS NULL OR valid_to>=valid_from));
   CREATE UNIQUE INDEX IF NOT EXISTS org_manager_history_v11_open ON org_manager_history_v11(person_id) WHERE valid_to IS NULL;
   CREATE INDEX IF NOT EXISTS org_manager_history_v11_person ON org_manager_history_v11(person_id,valid_from,sequence);`)
  if(!db.prepare('SELECT 1 FROM org_history_v11_schema WHERE version=1').get()){
   const at=iso();db.prepare('INSERT INTO org_history_v11_schema VALUES(1,?)').run(at)
   db.prepare("INSERT INTO org_assignment_history_v11(person_id,company_id,unit_id,department_id,position,source_revision,valid_from,origin) SELECT person_id,company_id,unit_id,department_id,position,revision,?,'baseline' FROM person_organizations").run(at)
   if(existingState)recordManagerHistory(db,existingState,at,'baseline')
  }
  // Direct v2 assignment requests and legacy user/organization transactions both execute these triggers.
  db.exec(`CREATE TRIGGER IF NOT EXISTS org_assignment_history_v11_insert AFTER INSERT ON person_organizations BEGIN
   INSERT INTO org_assignment_history_v11(person_id,company_id,unit_id,department_id,position,source_revision,valid_from,origin)
   VALUES(NEW.person_id,NEW.company_id,NEW.unit_id,NEW.department_id,NEW.position,NEW.revision,${timestamp},'insert'); END;
   CREATE TRIGGER IF NOT EXISTS org_assignment_history_v11_update AFTER UPDATE ON person_organizations
   WHEN OLD.company_id IS NOT NEW.company_id OR OLD.unit_id IS NOT NEW.unit_id OR OLD.department_id IS NOT NEW.department_id OR OLD.position IS NOT NEW.position BEGIN
   UPDATE org_assignment_history_v11 SET valid_to=MAX(valid_from,${timestamp}) WHERE person_id=OLD.person_id AND valid_to IS NULL;
   INSERT INTO org_assignment_history_v11(person_id,company_id,unit_id,department_id,position,source_revision,valid_from,origin)
   VALUES(NEW.person_id,NEW.company_id,NEW.unit_id,NEW.department_id,NEW.position,NEW.revision,
    MAX(${timestamp},COALESCE((SELECT MAX(valid_to) FROM org_assignment_history_v11 WHERE person_id=NEW.person_id),${timestamp})),'update'); END;
   CREATE TRIGGER IF NOT EXISTS org_assignment_history_v11_delete AFTER DELETE ON person_organizations BEGIN
   UPDATE org_assignment_history_v11 SET valid_to=MAX(valid_from,${timestamp}) WHERE person_id=OLD.person_id AND valid_to IS NULL; END;`)
  db.exec('COMMIT')
 }catch(e){db.exec('ROLLBACK');throw e}
}
/** Caller owns the existing state mutation transaction. No write for unchanged manager links. */
export function recordManagerHistory(db,state,at=iso(),origin='change'){
 const current=new Map(db.prepare('SELECT person_id,manager_id,valid_from FROM org_manager_history_v11 WHERE valid_to IS NULL').all().map(x=>[x.person_id,x]))
 const close=db.prepare('UPDATE org_manager_history_v11 SET valid_to=MAX(valid_from,?) WHERE person_id=? AND valid_to IS NULL')
 const add=db.prepare('INSERT INTO org_manager_history_v11(person_id,manager_id,valid_from,origin) VALUES(?,?,?,?)')
 for(const user of state.users||[]){const manager=user.manager||null,prev=current.get(user.id);current.delete(user.id);if(prev&&prev.manager_id===manager)continue
  const when=prev&&prev.valid_from>at?prev.valid_from:at
  if(prev)close.run(when,user.id);add.run(user.id,manager,when,origin)
 }
 for(const person of current.keys())close.run(at,person)
}
export function readOrganizationHistory(db,{personId='',companyId='',limit=50,offset=0}={}){
 const args=[],clauses=[]
 if(personId){clauses.push('person_id=?');args.push(personId)}if(companyId){clauses.push('company_id=?');args.push(companyId)}
 const where=clauses.length?' WHERE '+clauses.join(' AND '):''
 const total=db.prepare('SELECT COUNT(*) AS n FROM org_assignment_history_v11'+where).get(...args).n
 const rows=db.prepare('SELECT sequence,person_id,company_id,unit_id,department_id,position,source_revision,valid_from,valid_to,origin FROM org_assignment_history_v11'+where+' ORDER BY sequence DESC LIMIT ? OFFSET ?').all(...args,limit,offset)
 // Manager history can cross tenant boundaries; only global admin access, no company-only manager inference.
 const managerRows=personId&&!companyId?db.prepare('SELECT sequence,person_id,manager_id,valid_from,valid_to,origin FROM org_manager_history_v11 WHERE person_id=? ORDER BY sequence DESC LIMIT ? OFFSET ?').all(personId,limit,offset):[]
 return {observedFrom:db.prepare('SELECT observed_from FROM org_history_v11_schema WHERE version=1').get()?.observed_from||null,total,limit,offset,assignments:rows,managers:managerRows,method:'Histórico observado após instalação; não comprova vínculos anteriores.'}
}
export async function handleOrganizationHistory(req,ctx){
 const url=new URL(req.url);if(url.pathname!==ROOT)return null
 try{
  if(req.method!=='GET')return json({error:'Método não permitido.'},405)
  const raw=await ctx.BUCKET.get('system/state-v1');if(!raw)return json({error:'Entre para continuar.'},401)
  const state=await raw.json(),user=resolveActor(req,state)
  if(user.role!=='Administrador')return json({error:'Histórico restrito à administração global.'},403)
  if(typeof ctx.DOMAIN.organizationHistory!=='function')return json({error:'Histórico indisponível.'},503)
  const personId=url.searchParams.get('person')||'',companyId=url.searchParams.get('company')||'',validId=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i
  if(personId&&!validId.test(personId)||companyId&&!validId.test(companyId))return json({error:'Filtro inválido.'},400)
  const integer=(s,min,max,def)=>s!==null&&/^\d+$/.test(s)?Math.max(min,Math.min(max,Number(s))):def
  return json(ctx.DOMAIN.organizationHistory({personId,companyId,limit:integer(url.searchParams.get('limit'),1,100,50),offset:integer(url.searchParams.get('offset'),0,1000000,0)}))
 }catch(e){return json({error:e.status?e.message:'Falha ao consultar histórico.'},e.status||500)}
}
