import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { fail } from './erros.mjs';

// Sem cache de arquivos abertos: as fotos são lidas da memória e o Windows não deixa apagar arquivo aberto.
sharp.cache(false);

// Fotos enviadas pelo painel (contrato 12.4): tipo real pelo conteúdo (não pelo cabeçalho), até 8 MB e 40 megapixels,
// orientação corrigida e EXIF/GPS descartados (o sharp não copia metadados), WebP em 3 larguras sem ampliar.
export const MAX_BYTES=8*1024*1024;
export const LARGURAS=[320,800,1600];
export function tipoReal(buf) {
  if(buf.length>12&&buf[0]===0xff&&buf[1]===0xd8&&buf[2]===0xff)return 'image/jpeg';
  if(buf.length>8&&buf.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))return 'image/png';
  if(buf.length>12&&buf.subarray(0,4).toString('latin1')==='RIFF'&&buf.subarray(8,12).toString('latin1')==='WEBP')return 'image/webp';
  return null;
}
export async function salvarFoto(buf,{dir,id,declarado=''}) {
  if(buf.length>MAX_BYTES)throw fail('A foto pode ter até 8 MB.',413,'arquivo');
  const mime=tipoReal(buf);
  if(!mime||declarado&&declarado.split(';')[0].trim()!==mime)throw fail('Envie uma foto em JPEG, PNG ou WebP.',415,'arquivo');
  const abrir=()=>sharp(buf,{failOn:'error',limitInputPixels:40_000_000});
  let meta;try{meta=await abrir().metadata();}catch{throw fail('Não foi possível ler esta foto. Envie outra.',422,'arquivo');}
  // Orientação 5 a 8 gira 90°: largura e altura trocam depois do rotate().
  const girada=(meta.orientation||1)>=5,width=girada?meta.height:meta.width,height=girada?meta.width:meta.height;
  const pasta=join(dir,id),sizes=[];
  await mkdir(pasta,{recursive:true});
  try {
    for(const w of LARGURAS) {
      const out=await abrir().rotate().resize({width:Math.min(w,width),withoutEnlargement:true}).webp({quality:80}).toBuffer({resolveWithObject:true});
      await writeFile(join(pasta,`${w}.webp`),out.data);
      sizes.push({w,largura:out.info.width,altura:out.info.height,bytes:out.data.length});
    }
  } catch(e){await rm(pasta,{recursive:true,force:true});if(e.status)throw e;throw fail('Não foi possível ler esta foto. Envie outra.',422,'arquivo');}
  return {mime,width,height,bytes:buf.length,sha256:createHash('sha256').update(buf).digest('hex'),sizes};
}
