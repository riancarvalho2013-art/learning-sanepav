// Missing lifecycle fields identify courses published before Learning 2.0.
export const courseStatus = course => course.status || 'published'
export const courseRevision = course => course.revision || 0
const check = (condition, message, status=400) => {
  if (!condition) throw Object.assign(new Error(message), {status})
}
export function requirePublished(course) {
  check(course && courseStatus(course)==='published', 'Somente cursos publicados podem receber novas matrículas.', 409)
}
export function checkCourseRevision(course, expected) {
  check(Number.isSafeInteger(expected) && expected===courseRevision(course),
    'O curso foi alterado. Atualize o catálogo antes de salvar.', 409)
}
export function stampCourse(course, user, event) {
  course.revision=courseRevision(course)+1
  course.updated=new Date().toISOString()
  ;(course.history??=[]).push({at:course.updated,person:user.id,event,revision:course.revision})
}
export function changeCourseState(course, user, body) {
  check(course, 'Curso inexistente.', 404)
  checkCourseRevision(course, body.revision)
  check(['published','archived'].includes(body.status), 'Escolha publicar ou arquivar.')
  check(courseStatus(course)!==body.status, 'O curso já possui este status.', 409)
  course.status=body.status
  if(body.status==='published')course.published=new Date().toISOString()
  stampCourse(course,user,body.status==='published'?'published':'archived')
}
