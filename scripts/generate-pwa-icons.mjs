import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length, 0);
  name.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return output;
}
function png(size) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      const offset = 1 + x * 4;
      let color = [5, 150, 105, 255];
      const centerX = x - size / 2;
      const centerY = y - size / 2;
      if (centerX ** 2 + centerY ** 2 < size ** 2 * 0.145) color = [255, 255, 255, 255];
      const book = y > size * 0.32 && y < size * 0.69 && x > size * 0.29 && x < size * 0.71;
      if (book) color = [255, 255, 255, 255];
      if (book && Math.abs(x - size / 2) < size * 0.018) color = [5, 150, 105, 255];
      if (book && y > size * 0.39 && y < size * 0.43 && (x < size * 0.46 || x > size * 0.54)) color = [5, 150, 105, 255];
      row.set(color, offset);
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const outputDirectory = path.join(here, "..", "public", "icons");
fs.mkdirSync(outputDirectory, { recursive: true });
for (const size of [192, 512]) fs.writeFileSync(path.join(outputDirectory, `icon-${size}x${size}.png`), png(size));
