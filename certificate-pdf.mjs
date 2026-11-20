function pdfEscape(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

export function renderCertificatePdf(cert) {
  const title = pdfEscape(cert.courseTitle || 'Treinamento Corporativo')
  const person = pdfEscape(cert.personName || 'Colaborador')
  const company = pdfEscape(cert.companyName || 'Sanepav Learning')
  const code = pdfEscape(cert.code || '')
  const issuedDate = pdfEscape(String(cert.issuedAt || '').slice(0, 10))
  const minutes = Number(cert.minutes || 0)
  const hoursText = minutes >= 60 ? `${(minutes / 60).toFixed(1).replace(/\.0$/, '')}h (${minutes} min)` : `${minutes} min`
  const scoreText = Number.isFinite(Number(cert.score)) ? `Aproveitamento: ${Math.round(Number(cert.score))}%` : 'Conclusao aprovada'
  const issuer = pdfEscape(cert.issuedByName || 'Universidade Corporativa Sanepav')

  const lines = [
    '0.024 0.169 0.310 rg',
    '0 515 842 80 re f',
    '0.580 0.788 0.157 rg',
    '0 509 842 6 re f',
    '0.024 0.169 0.310 RG',
    '2 w 28 28 786 539 re S',
    'BT /F2 22 Tf 1 1 1 rg 52 547 Td (' + company + ' - Certificado de Conclusao) Tj ET',
    'BT /F1 12 Tf 0.25 0.28 0.32 rg 52 462 Td (Certificamos que) Tj ET',
    'BT /F2 26 Tf 0.024 0.169 0.310 rg 52 424 Td (' + person + ') Tj ET',
    'BT /F1 12 Tf 0.25 0.28 0.32 rg 52 384 Td (concluiu com exito o treinamento corporativo:) Tj ET',
    'BT /F2 18 Tf 0.024 0.169 0.310 rg 52 352 Td (' + title.slice(0, 72) + ') Tj ET',
    'BT /F1 12 Tf 0.20 0.24 0.28 rg 52 294 Td (Carga horaria: ' + pdfEscape(hoursText) + '   |   ' + pdfEscape(scoreText) + ') Tj ET',
    'BT /F1 12 Tf 0.20 0.24 0.28 rg 52 268 Td (Data de emissao: ' + issuedDate + '   |   Emissor: ' + issuer + ') Tj ET',
    '0.94 0.96 0.98 rg',
    '52 84 738 72 re f',
    '0.024 0.169 0.310 RG',
    '1 w 52 84 738 72 re S',
    'BT /F2 11 Tf 0.024 0.169 0.310 rg 68 130 Td (Codigo de verificacao de autenticidade:) Tj ET',
    'BT /F2 16 Tf 0.024 0.169 0.310 rg 68 104 Td (' + code + ') Tj ET',
    'BT /F1 10 Tf 0.35 0.38 0.42 rg 360 112 Td (Consulte em /api/certificateVerify?code=' + code + ') Tj ET'
  ]
  const stream = lines.join('\n')
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >> endobj\n',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj\n',
    `6 0 obj << /Length ${Buffer.byteLength(stream, 'utf8')} >> stream\n${stream}\nendstream endobj\n`
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += obj
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(pdf, 'utf8')
}
