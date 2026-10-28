// Génère les icônes PWA (planète + anneau) sans aucune dépendance.
// Lancé automatiquement par "npm run build" avant la construction Vite.
import zlib from "node:zlib";
import fs from "node:fs";

function crc32(buf) {
  let c, crcTable = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function makeIcon(size) {
  const cx = size / 2, cy = size / 2, R = size * 0.34;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const d = Math.hypot(dx, dy);
      const i = 1 + x * 4;
      row[i] = Math.round(5 + (y / size) * 8);
      row[i + 1] = Math.round(7 + (y / size) * 12);
      row[i + 2] = Math.round(25 + (y / size) * 35);
      row[i + 3] = 255;
      if (((x * 31 + y * 17) % 233) === 0) { row[i] = 255; row[i + 1] = 255; row[i + 2] = 255; }
      if (d <= R) {
        const t = 1 - d / R;
        row[i] = Math.round(56 * t + 12);
        row[i + 1] = Math.round(189 * t + 20);
        row[i + 2] = Math.round(248 * t + 40);
      }
      const ellipse = (dx / (R * 1.7)) ** 2 + (dy / (R * 0.45)) ** 2;
      if (ellipse < 1 && ellipse > 0.55 && d > R * 0.98) {
        row[i] = 250; row[i + 1] = 204; row[i + 2] = 21;
      }
      if (Math.hypot(dx + R * 0.3, dy + R * .3) < R * 0.35) { row[i] = 224; row[i + 1] = 242; row[i + 2] = 254; }
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

fs.mkdirSync("public", { recursive: true });
fs.writeFileSync("public/icon-192.png", makeIcon(192));
fs.writeFileSync("public/icon-512.png", makeIcon(512));
console.log("Icônes générées dans public/");
