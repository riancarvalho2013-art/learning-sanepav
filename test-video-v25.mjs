import assert from 'node:assert/strict'
import {readVideoDuration,videoTick,videoSatisfied,prepareVideoPolicy,saveVideoPolicy} from './video-policy-v25.mjs'
import {readFileSync} from 'node:fs'

const mp4=process.argv[2],webm=process.argv[3]

if(mp4&&webm){
 for(const name of [mp4,webm])assert.ok(Math.abs(readVideoDuration(readFileSync(name),name)-3)<0.2)
 assert.throws(()=>readVideoDuration(Buffer.from('invalid'),'a.mp4'))
 const body=await prepareVideoPolicy(
  {get:async()=>({body:readFileSync(mp4)})},
  {uploads:[{id:'up',owner:'u',paths:['a.mp4']}]},
  {id:'u',role:'RH/DHO'},
  'course',
  {type:'Vídeo',allowVideoSkip:'false',upload:'up',entry:'a.mp4',videoDurationSeconds:1}
 )
 const course={type:'Vídeo'}
 saveVideoPolicy(course,body)
 assert.equal(course.allowVideoSkip,false)
 assert.ok(course.videoDurationSeconds>2.9)
 await assert.rejects(
  ()=>prepareVideoPolicy({}, {}, {role:'Colaborador'}, 'course',{type:'Vídeo'}),
  {status:403}
 )
}

const course={type:'Vídeo',allowVideoSkip:false,videoDurationSeconds:30,revision:2}
const enrollment={progress:0}
const session='12345678-1234-1234-1234-123456789abc'
const tick=(action,position,at,token=session)=>videoTick(enrollment,course,{action,position,session:token},at)

assert.equal(tick('start',0,1000).watched,0)
assert.throws(()=>tick('end',30,1100),{status:409})
assert.throws(()=>tick('tick',10,2000),{status:409})
assert.equal(videoSatisfied(enrollment,course),false)
for(let i=1;i<=9;i++)tick('tick',i*3,1000+i*3000)
assert.equal(enrollment.progress,90)
assert.throws(()=>tick('end',30,28000),{status:409})
tick('end',30,31000)
assert.equal(enrollment.progress,99)
assert.equal(videoSatisfied(enrollment,course),true)
assert.equal(videoSatisfied(enrollment,{...course,revision:3}),false)
assert.equal(tick('start',0,32000).watched,30)
assert.throws(()=>tick('tick',30,33000,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),{status:409})

console.log('OK: duração, política, salto, sessão, conclusão e revisão.')
