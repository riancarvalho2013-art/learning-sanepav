// Optional installer: merges V22 into a working copy without replacing its other manifest entries.
// Usage: node /path/to/extracted/install-v22.mjs /path/to/repository
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const from=path.dirname(fileURLToPath(import.meta.url));
if(!process.argv[2])throw Error('Informe o caminho do repositório de homologação.');
const to=path.resolve(process.argv[2]);
if(to===from)throw Error('O destino deve ser o clone do repositório, não a pasta do pacote.');
for(const f of ['asset-manifest.json','web-index.html','web-design-v21.css','web-design-v21.js','package.json'])if(!fs.existsSync(path.join(to,f)))throw Error('Base V21 não localizada: '+f);
const manifestPath=path.join(to,'asset-manifest.json'),indexPath=path.join(to,'web-index.html');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8')),addition=JSON.parse(fs.readFileSync(path.join(from,'asset-manifest.json'),'utf8'));
let html=fs.readFileSync(indexPath,'utf8');if(!html.includes('/design-v21.css')||!html.includes('/design-v21.js'))throw Error('V21 não carregada no HTML atual.');
if(!html.includes('</head>')||!html.includes('</body>'))throw Error('HTML atual não reconhecido.');
const keys=Object.keys(addition).filter(k=>k.includes('design-v22'));
for(const key of keys){const entry=addition[key];if(!fs.existsSync(path.join(from,entry.file)))throw Error('Asset ausente: '+entry.file);if(manifest[key]&&JSON.stringify(manifest[key])!==JSON.stringify(entry))throw Error('Conflito no manifesto: '+key);}
for(const key of keys){const entry=addition[key];const dest=path.join(to,entry.file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(from,entry.file),dest);manifest[key]=entry;}
if(!html.includes('/design-v22.css'))html=html.replace('</head>','  <link rel="stylesheet" href="/design-v22.css?v=22">\n</head>');
if(!html.includes('/design-v22.js'))html=html.replace('</body>','  <script src="/design-v22.js?v=22"></script>\n</body>');
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(indexPath,html);
console.log('V22 aplicado. Revise git diff, execute build e testes antes de publicar.');
