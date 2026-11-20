import {readFileSync,writeFileSync} from 'node:fs'
const manifest=JSON.parse(readFileSync(new URL('./asset-manifest.json',import.meta.url),'utf8'))
const assets={}
for(const [url,item] of Object.entries(manifest)){
 assets[url]=[item.mime,readFileSync(new URL('./'+item.file,import.meta.url)).toString('base64')]
}
writeFileSync(new URL('./assets.mjs',import.meta.url),'export const ASSETS='+JSON.stringify(assets)+'\n')
