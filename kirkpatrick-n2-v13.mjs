/** Shared N2 read model. Exactly one pre/post form and paired scores; comparison is descriptive. */
const has=(db,table,cols)=>{const names=new Set(db.prepare('PRAGMA table_info('+table+')').all().map(x=>x.name));return cols.every(c=>names.has(c))}
export function pairedLearning(db,companyId,courseId,period=null){
 const unavailable={status:'not_measured',pairedPeople:0,changePoints:null,source:null}
 if(!has(db,'assessment_v6_forms',['id','kind','company_id','course_id','status'])||!has(db,'assessment_v6_attempts',['form_id','user_id','score',...(period?['submitted_at']:[])]))return unavailable
 const forms=db.prepare("SELECT id,kind FROM assessment_v6_forms WHERE company_id=? AND course_id=? AND status IN ('published','archived') AND kind IN ('pre','post')").all(companyId,courseId),pre=forms.filter(x=>x.kind==='pre'),post=forms.filter(x=>x.kind==='post')
 if(pre.length!==1||post.length!==1)return {...unavailable,status:'not_comparable',reason:'Exige exatamente um pré-teste e um pós-teste publicados para este curso.'}
 const args=period?[period.from,period.to]:[],where=period?' AND substr(submitted_at,1,10) BETWEEN ? AND ?':''
 const scores=id=>db.prepare('SELECT user_id,MAX(score) AS score FROM assessment_v6_attempts WHERE form_id=?'+where+' GROUP BY user_id').all(id,...args)
 const after=new Map(scores(post[0].id).map(x=>[x.user_id,x.score])),pairs=scores(pre[0].id).filter(x=>after.has(x.user_id)),sum=pairs.reduce((n,x)=>n+after.get(x.user_id)-x.score,0)
 return {status:pairs.length?'available':'no_paired_data',pairedPeople:pairs.length,changePoints:pairs.length?Math.round(sum*100/pairs.length)/100:null,changeSum:sum,source:'assessment_v6_attempts',method:'Melhor nota pré e pós por pessoa no recorte. A equivalência pedagógica dos instrumentos e causalidade não são comprovadas automaticamente.'}
}
export function pairedPortfolio(db,scope){
 if(!has(db,'assessment_v6_forms',['id','kind','company_id','course_id','status'])||!has(db,'assessment_v6_attempts',['form_id','user_id','score','submitted_at']))return {qualifiedLearningCohorts:null,pairedLearningRecords:null,meanLearningChangePoints:null}
 const cohorts=db.prepare("SELECT DISTINCT company_id,course_id FROM assessment_v6_forms WHERE company_id IN (SELECT value FROM json_each(?)) AND status IN ('published','archived') AND kind IN ('pre','post')").all(JSON.stringify(scope.companies));let qualified=0,records=0,sum=0
 for(const c of cohorts){const x=pairedLearning(db,c.company_id,c.course_id,scope);if(x.pairedPeople>=7){qualified++;records+=x.pairedPeople;sum+=x.changeSum}}
 return {qualifiedLearningCohorts:qualified,pairedLearningRecords:records||null,meanLearningChangePoints:records?Math.round(sum*100/records)/100:null}
}
