// Optional safe merge; no git push. node install-v23.mjs /path/to/clone
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const src=path.dirname(fileURLToPath(import.meta.url));
if(!process.argv[2])throw Error('Informe o caminho do clone de homologação.');
const dst=path.resolve(process.argv[2]);
if(src===dst)throw Error('Destino deve ser o repositório, não a pasta do ZIP.');
const files=['asset-manifest.json','web-index.html','web-design-v22.js','web-design-v22.css'];
for(const f of files)if(!fs.existsSync(path.join(dst,f)))throw Error('Base V22 ausente: '+f);
const manifest=JSON.parse(fs.readFileSync(path.join(dst,files[0]),'utf8'));
const add=JSON.parse(fs.readFileSync(path.join(src,files[0]),'utf8'));
let html=fs.readFileSync(path.join(dst,files[1]),'utf8');
if(!html.includes('/design-v22.css')||!html.includes('/design-v22.js')||!html.includes('</head>')||!html.includes('</body>'))throw Error('HTML V22 não reconhecido.');
const entries=Object.entries(add).filter(([k])=>k.startsWith('/design-v23'));
for(const [k,v] of entries){if(!fs.existsSync(path.join(src,v.file)))throw Error('Arquivo ausente: '+v.file);if(manifest[k]&&JSON.stringify(manifest[k])!==JSON.stringify(v))throw Error('Conflito de manifesto: '+k);}
for(const [k,v] of entries){const target=path.join(dst,v.file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(src,v.file),target);manifest[k]=v;}
if(!html.includes('/design-v23.css'))html=html.replace('</head>','  <link rel="stylesheet" href="/design-v23.css?v=23">\n</head>');
if(!html.includes('/design-v23.js'))html=html.replace('</body>','  <script src="/design-v23.js?v=23"></script>\n</body>');
fs.writeFileSync(path.join(dst,files[0]),JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(dst,files[1]),html);
console.log('V23 instalada. Revise git diff; teste e publique somente em homologacao-dna.');
