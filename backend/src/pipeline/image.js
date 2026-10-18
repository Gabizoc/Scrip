import sharp from 'sharp';
import { log } from '../lib/logger.js';

const MAX_SIDE = parseInt(process.env.IMAGE_MAX_SIDE ?? '', 10) || 1600;
const ENHANCE = process.env.IMAGE_ENHANCE !== 'false';
const TILING = process.env.IMAGE_TILING !== 'false';

// Chevauchement entre les deux bandes d'une page découpée, pour ne couper aucune ligne.
const TILE_OVERLAP = 0.12;

function finish(img, maxSide, quality) {
  let out = img.resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true });
  // Étire le contraste (photos jaunies, ombre du téléphone) sans passer en gris : la couleur
  // des titres et du surlignage aide à repérer la structure.
  if (ENHANCE) out = out.normalise({ lower: 1, upper: 99 });
  return out.jpeg({ quality }).toBuffer();
}

const toImage = (buffer) => ({ base64: buffer.toString('base64'), mimeType: 'image/jpeg' });

// rotate() sans argument applique l'orientation EXIF : sans lui, les photos de téléphone
// enregistrées « couchées » arrivent tournées de 90° au modèle.
export async function prepareImage(imagePath, { maxSide = MAX_SIDE, quality = 85 } = {}) {
  const buffer = await finish(sharp(imagePath).rotate(), maxSide, quality);
  log.debug(`[image] ${buffer.length} bytes`);
  return toImage(buffer);
}

// Renvoie les images à envoyer pour une page : la page entière, ou deux bandes horizontales
// qui se chevauchent quand la page est en portrait et que la réduire ferait perdre du détail.
// Les modèles à résolution d'entrée fixe lisent ainsi l'écriture environ 1,3× plus grande.
export async function preparePage(imagePath, { maxSide = MAX_SIDE, quality = 85, tiling = TILING } = {}) {
  if (!tiling) return [{ ...(await prepareImage(imagePath, { maxSide, quality })), part: null }];

  const { data, info } = await sharp(imagePath).rotate().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const raw = { raw: { width, height, channels } };

  if (height < width * 1.15 || height < maxSide * 1.3) {
    return [{ ...toImage(await finish(sharp(data, raw), maxSide, quality)), part: null }];
  }

  const tileHeight = Math.round(height * (0.5 + TILE_OVERLAP / 2));
  const [top, bottom] = await Promise.all([
    finish(sharp(data, raw).extract({ left: 0, top: 0, width, height: tileHeight }), maxSide, quality),
    finish(sharp(data, raw).extract({ left: 0, top: height - tileHeight, width, height: tileHeight }), maxSide, quality),
  ]);
  log.debug(`[image] page découpée en 2 bandes (${width}x${height}) : ${top.length + bottom.length} bytes`);
  return [{ ...toImage(top), part: 'haut' }, { ...toImage(bottom), part: 'bas' }];
}

export function preparePages(imagePaths, options) {
  return Promise.all(imagePaths.map(p => preparePage(p, options)));
}
