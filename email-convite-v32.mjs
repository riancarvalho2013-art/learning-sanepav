/** Learning Academy V32 — branded first-access email. No credentials or tokens in static assets. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const files=['header','footer','line','shield','link','arrow','background'];
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const font='Inter, Arial, Helvetica, sans-serif';
export function renderInvitationV32({first,org,link,origin}){
 const base=new URL(origin);
 const access=new URL(link);
 if(base.protocol!=='https:'||base.username||base.password||access.origin!==base.origin||access.pathname!=='/'||access.search||!/^#reset=[a-f0-9]{64}$/i.test(access.hash))throw Error('Link de primeiro acesso inválido.');
 const url=escape(access.href),asset=n=>escape(new URL('/email-v32-'+n+'.png',base).href);
 const img=(n,w,h,alt='',style='')=>`<img src="${asset(n)}" width="${w}" height="${h}" alt="${escape(alt)}" border="0" style="display:block;border:0;outline:none;text-decoration:none;${style}">`;
 // Table-based structure and solid-color fallbacks are intentional for classic Outlook.
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>Learning Academy — Primeiro acesso</title><style>
 @media only screen and (max-width:480px){.la-body{padding:25px 20px!important}.la-greeting{font-size:29px!important}.la-copy{font-size:16px!important}.la-cta{font-size:16px!important;padding:14px 12px!important}.la-note{padding:12px!important}.la-shell{padding:12px 6px!important}}
 </style></head><body style="margin:0;padding:0;background-color:#e8f5fd;color:#081d50;font-family:${font};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#e8f5fd" style="background-color:#e8f5fd;background-image:url('${asset('background')}');background-size:cover;background-position:center top;"><tr><td class="la-shell" align="center" style="padding:30px 12px;">
 <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #d5e8f8;border-radius:17px;border-collapse:separate;overflow:hidden;">
 <tr><td bgcolor="#e7f6ff" style="background-color:#e7f6ff;padding:0;color:#081d50;font-size:24px;font-weight:bold;">${img('header',600,198,'Learning Academy — Aprendizagem e desenvolvimento','width:100%;max-width:600px;height:auto;')}</td></tr>
 <tr><td class="la-body" bgcolor="#ffffff" style="padding:26px 38px 30px;background-color:#ffffff;color:#081d50;font-family:${font};">
 <h1 class="la-greeting" style="font-family:${font};font-size:36px;line-height:1.18;font-weight:800;letter-spacing:-.7px;margin:0 0 10px;color:#081d50;">Olá, <span style="color:#0754e7;">${escape(first)}!</span></h1>
 ${img('line',75,8,'','margin:0 0 16px;')}
 <p class="la-copy" style="font-family:${font};font-size:18px;line-height:1.42;margin:0 0 15px;color:#081d50;">Seja bem-vindo(a) à plataforma de aprendizagem e desenvolvimento da <strong>${escape(org)}</strong>.</p>
 <p class="la-copy" style="font-family:${font};font-size:18px;line-height:1.42;margin:0 0 24px;color:#081d50;">Seu cadastro está preparado. Crie sua senha pessoal e acesse com seu e-mail corporativo para começar sua jornada.</p>
 <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 27px;max-width:100%;"><tr><td bgcolor="#0754e7" style="background-color:#0754e7;background-image:linear-gradient(115deg,#1731f5,#0754e7 62%,#009df9);border-radius:13px;" align="center">
 <a class="la-cta" href="${url}" style="display:block;border:1px solid #0754e7;border-radius:13px;padding:15px 23px;color:#ffffff;text-decoration:none;font-family:${font};font-weight:700;font-size:19px;line-height:1.25;mso-padding-alt:0;"> <span style="mso-text-raise:10pt;">Realizar meu primeiro acesso&nbsp; <img src="${asset('arrow')}" width="18" height="16" alt="→" style="display:inline-block;vertical-align:middle;border:0;color:#ffffff;"> </span> </a>
 </td></tr></table>
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#e8f5fd" style="width:100%;background-color:#e8f5fd;border-radius:11px;border-collapse:separate;"><tr><td class="la-note" style="padding:16px;">
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="42" valign="middle" style="width:42px;padding-right:12px;">${img('shield',29,34)}</td><td valign="middle" style="border-left:1px solid #b4d9f4;padding-left:12px;font-family:${font};font-size:14px;line-height:1.45;color:#081d50;"><strong>Link individual, válido por 48 horas e de uso único.</strong> Não compartilhe. Caso não reconheça este convite, procure a administração.</td></tr>
 <tr><td colspan="2" height="1" style="height:1px;padding-top:14px;border-bottom:1px solid #b4d9f4;font-size:1px;line-height:1px;">&nbsp;</td></tr>
 <tr><td width="42" valign="top" style="width:42px;padding:14px 12px 0 0;">${img('link',28,28)}</td><td valign="top" style="padding:14px 0 0 12px;font-family:${font};font-size:13px;line-height:1.5;color:#081d50;"><strong>Se o botão não abrir, copie este endereço:</strong><br><a href="${url}" style="color:#0754e7;text-decoration:underline;overflow-wrap:anywhere;word-break:break-all;">${url}</a></td></tr></table>
 </td></tr></table></td></tr>
 <tr><td bgcolor="#092756" style="padding:0;background-color:#092756;color:#ffffff;font-family:${font};font-size:13px;">${img('footer',600,60,'Learning Academy · Aprendizagem e desenvolvimento','width:100%;max-width:600px;height:auto;')}</td></tr>
 </table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}
export function patchRecovery(src){
 const imp="import {renderInvitationV32} from './email-convite-v32.mjs'";
 const call=' const html=renderInvitationV32({first,org,link,origin})';
 if(src.includes(imp)&&src.includes(call))return src;
 const start=src.indexOf('export function invitationEmail({name,company,platform,token},origin){');
 const stop=src.indexOf('\nfunction markInvitation(',start);
 if(start<0||stop<0)throw Error('V32: função de convite incompatível.');
 const part=src.slice(start,stop),a=part.indexOf(' const html=`<!doctype html>'),b=part.indexOf('\n return {subject,text,html}',a);
 if(a<0||b<0||!part.includes("link=origin+'/#reset='+token"))throw Error('V32: formato anterior do convite incompatível.');
 const result=src.slice(0,start)+part.slice(0,a)+call+part.slice(b)+src.slice(stop);
 const anchor="import {hashPassword} from './credentials.mjs'";
 if(result.split(anchor).length!==2)throw Error('V32: importação de credenciais incompatível.');
 return result.replace(anchor,anchor+'\n'+imp);
}
export function patchManifest(manifest){
 for(const n of files){const file='email-v32-'+n+'.png';const route='/'+file;const expected={file,mime:'image/png'};if(manifest[route]&&(manifest[route].file!==file||manifest[route].mime!=='image/png'))throw Error('V32: conflito de asset '+route);manifest[route]=expected;}
 return manifest;
}
function install(){
 const source=readFileSync('recovery.mjs','utf8'),patched=patchRecovery(source);
 const manifest=patchManifest(JSON.parse(readFileSync('asset-manifest.json','utf8')));
 for(const n of files){const file='email-v32-'+n+'.png';const bytes=readFileSync(file);if(bytes.length<24||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('V32: PNG inválido '+file);}
 writeFileSync('recovery.mjs',patched);writeFileSync('asset-manifest.json',JSON.stringify(manifest,null,2)+'\n');
 console.log('V32: template de primeiro acesso e assets públicos registrados.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--install'))install();
