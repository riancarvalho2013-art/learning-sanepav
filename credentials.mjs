import {randomUUID,timingSafeEqual} from 'node:crypto'
const encode = value => new TextEncoder().encode(value)
export async function hashPassword(value,salt=randomUUID(),iterations=600000){
 if(typeof value!=='string'||value.length<12||value.length>150)throw Object.assign(new Error('Use uma senha de 12 a 150 caracteres.'),{status:400})
 const key=await crypto.subtle.importKey('raw',encode(value),'PBKDF2',false,['deriveBits'])
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encode(salt),iterations},key,256)
 return {salt,digest:Buffer.from(bits).toString('hex'),iterations}
}
export async function verifyPassword(value,user){
 if(typeof value!=='string'||value.length<12||value.length>150||!/^[a-f0-9]{64}$/.test(user.digest||''))return false
 const computed=await hashPassword(value,user.salt,user.iterations||100000)
 return timingSafeEqual(Buffer.from(computed.digest,'hex'),Buffer.from(user.digest,'hex'))
}
