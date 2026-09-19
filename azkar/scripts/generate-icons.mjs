/**
 * Генерация иконок PWA без внешних зависимостей.
 *
 * Рисуем простой геометрический знак (полумесяц и звезду) попиксельно
 * со сглаживанием 4×4 и кодируем результат в PNG средствами zlib.
 * Так в репозитории нет бинарных «чёрных ящиков» — иконку всегда можно
 * пересобрать командой `node scripts/generate-icons.mjs`.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const BG = [10, 60, 44]; // глубокий изумруд
const FG = [232, 246, 239]; // молочно-белый
const ACCENT = [76, 196, 142];

function crc32(buf) {
  let c;
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0; // фильтр None
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 бит на канал
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

/** Возвращает цвет знака в точке или null, если это фон. */
function markAt(u, v) {
  // Полумесяц: большой круг минус смещённый круг.
  if (inCircle(u, v, 0.47, 0.5, 0.3) && !inCircle(u, v, 0.56, 0.44, 0.255)) return FG;
  // Звезда рядом с полумесяцем — просто маленький круг, читается на всех размерах.
  if (inCircle(u, v, 0.665, 0.395, 0.058)) return ACCENT;
  return null;
}

function render(size, { padding = 0 } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 4; // сглаживание 4×4
  const scale = 1 - padding * 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const u = ((x + (sx + 0.5) / SS) / size - padding) / scale;
          const v = ((y + (sy + 0.5) / SS) / size - padding) / scale;
          const color = u < 0 || u > 1 || v < 0 || v > 1 ? BG : (markAt(u, v) ?? BG);
          r += color[0];
          g += color[1];
          b += color[2];
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      rgba[i] = Math.round(r / n);
      rgba[i + 1] = Math.round(g / n);
      rgba[i + 2] = Math.round(b / n);
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

const targets = [
  { file: 'public/icons/icon-192.png', size: 192 },
  { file: 'public/icons/icon-512.png', size: 512 },
  // Maskable: знак ужат внутрь, чтобы систему не обрезала по краям.
  { file: 'public/icons/icon-maskable-512.png', size: 512, padding: 0.14 },
  { file: 'public/icons/apple-touch-icon.png', size: 180, padding: 0.06 },
];

for (const target of targets) {
  const out = resolve(ROOT, target.file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, render(target.size, { padding: target.padding ?? 0 }));
  console.log('✓', target.file, `${target.size}×${target.size}`);
}
