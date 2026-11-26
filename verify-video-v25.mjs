import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {DatabaseSync} from 'node:sqlite'
import {applyProgress,completionClassification} from './completion-v11.mjs'
import {videoSatisfied} from './video-policy-v25.mjs'

const id=()=>randomUUID()
const company=id()
const user={id:id(),name:'Pessoa QA',role:'Colaborador',active:true}
const strictCourse={
 id:id(),title:'Vídeo sequencial QA',type:'Vídeo',track:'QA',minutes:1,
 status:'published',revision:1,allowVideoSkip:false,videoDurationSeconds:9
}
const freeCourse={
 id:id(),title:'Vídeo livre QA',type:'Vídeo',track:'QA',minutes:1,
 status:'published',revision:1,allowVideoSkip:true
}
const strictEnrollment={id:id(),course:strictCourse.id,person:user.id,progress:0}
const freeEnrollment={id:id(),course:freeCourse.id,person:user.id,progress:0}
const state={
 users:[user],courses:[strictCourse,freeCourse],enroll:[strictEnrollment,freeEnrollment],
 records:[],missions:[],missionEnrollments:[],
 organization:{assignments:new Map([[user.id,{company_id:company,department_id:'qa'}]])}
}
const db=new DatabaseSync(':memory:')
const ctx={assessmentDb:db}
const at=seconds=>new Date(Date.UTC(2026,0,1,0,0,seconds)).toISOString()
const session='12345678-1234-1234-1234-123456789abc'

try{
 assert.throws(
  ()=>applyProgress(state,user,{id:strictEnrollment.id,progress:100},ctx,{at:at(0)}),
  error=>error.status===403&&/Assista ao vídeo/.test(error.message)
 )
 let result=applyProgress(state,user,{id:strictEnrollment.id,videoV25:{action:'start',position:0,session}},ctx,{at:at(0)})
 assert.equal(result.videoV25.watched,0)
 assert.throws(
  ()=>applyProgress(state,user,{id:strictEnrollment.id,videoV25:{action:'tick',position:5,session}},ctx,{at:at(1)}),
  error=>error.status===409&&/Avanço não permitido/.test(error.message)
 )
 for(let second=1;second<9;second++){
  result=applyProgress(state,user,{id:strictEnrollment.id,videoV25:{action:'tick',position:second,session}},ctx,{at:at(second)})
  assert.equal(result.progress,Math.floor(second/9*100))
 }
 result=applyProgress(state,user,{id:strictEnrollment.id,videoV25:{action:'end',position:9,session}},ctx,{at:at(9)})
 assert.equal(result.progress,99)
 assert.equal(result.videoV25.ended,true)
 assert.equal(videoSatisfied(strictEnrollment,strictCourse),true)
 result=applyProgress(state,user,{id:strictEnrollment.id,progress:100},ctx,{at:at(10)})
 assert.equal(result.progress,100)
 assert.equal(completionClassification(strictEnrollment),'manual')
 assert.equal(strictEnrollment.completionV11.content.assurance,'self_attested')
 assert.equal(videoSatisfied(strictEnrollment,{...strictCourse,revision:2}),false)
 assert.throws(
  ()=>applyProgress(state,user,{id:strictEnrollment.id,videoV25:{action:'start',position:0,session}},ctx,{at:at(11)}),
  error=>error.status===409
 )
 result=applyProgress(state,user,{id:freeEnrollment.id,progress:100},ctx,{at:at(12)})
 assert.equal(result.progress,100)
 assert.equal(completionClassification(freeEnrollment),'manual')
 console.log('PASS V25: bloqueio de salto, sessão sequencial, conclusão autorizada, revisão e vídeo livre.')
}finally{
 db.close()
}
