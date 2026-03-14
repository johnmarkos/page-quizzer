#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const iconsDirectory = path.join(projectRoot, 'icons');

const BACKGROUND = [99, 102, 241, 255];
const FOREGROUND = [255, 255, 255, 255];
const SIZES = [16, 48, 128];
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = createCrcTable();
const SAMPLE_OFFSETS = [0.125, 0.375, 0.625, 0.875];

async function main() {
  await mkdir(iconsDirectory, { recursive: true });

  for (const size of SIZES) {
    const rgba = renderIcon(size);
    const png = encodePng(size, size, rgba);
    const outputPath = path.join(iconsDirectory, `icon-${size}.png`);
    await writeFile(outputPath, png);
    console.log(`wrote ${path.relative(projectRoot, outputPath)}`);
  }
}

function renderIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  fill(pixels, BACKGROUND);

  const center = (size - 1) / 2;
  const outerRadius = size * 0.3;
  const innerRadius = size * 0.18;
  const tailThickness = Math.max(1.2, size * 0.12);
  const tailStart = {
    x: center + size * 0.06,
    y: center + size * 0.1,
  };
  const tailEnd = {
    x: center + size * 0.3,
    y: center + size * 0.34,
  };

  paintCircle(pixels, size, center, center, outerRadius, FOREGROUND);
  paintCircle(pixels, size, center, center, innerRadius, BACKGROUND);
  paintLine(pixels, size, tailStart, tailEnd, tailThickness, FOREGROUND);

  return pixels;
}

function fill(pixels, color) {
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = color[3];
  }
}

function paintCircle(pixels, size, centerX, centerY, radius, color) {
  const radiusSquared = radius * radius;

  paintShape(pixels, size, color, (sampleX, sampleY) => {
    const deltaX = sampleX - centerX;
    const deltaY = sampleY - centerY;
    return deltaX * deltaX + deltaY * deltaY <= radiusSquared;
  });
}

function paintLine(pixels, size, start, end, thickness, color) {
  const lineLengthSquared =
    (end.x - start.x) * (end.x - start.x) + (end.y - start.y) * (end.y - start.y);
  const radius = thickness / 2;
  const radiusSquared = radius * radius;

  paintShape(pixels, size, color, (sampleX, sampleY) => {
    const projection = clamp(
      ((sampleX - start.x) * (end.x - start.x) + (sampleY - start.y) * (end.y - start.y)) /
        lineLengthSquared,
      0,
      1,
    );
    const closestX = start.x + (end.x - start.x) * projection;
    const closestY = start.y + (end.y - start.y) * projection;
    const deltaX = sampleX - closestX;
    const deltaY = sampleY - closestY;
    return deltaX * deltaX + deltaY * deltaY <= radiusSquared;
  });
}

function paintShape(pixels, size, color, containsSample) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let coveredSamples = 0;

      for (const offsetY of SAMPLE_OFFSETS) {
        for (const offsetX of SAMPLE_OFFSETS) {
          if (containsSample(x + offsetX, y + offsetY)) {
            coveredSamples += 1;
          }
        }
      }

      if (coveredSamples === 0) {
        continue;
      }

      const alpha = coveredSamples / (SAMPLE_OFFSETS.length * SAMPLE_OFFSETS.length);
      const pixelOffset = (y * size + x) * 4;
      blendPixel(pixels, pixelOffset, color, alpha);
    }
  }
}

function blendPixel(pixels, pixelOffset, sourceColor, alpha) {
  const inverseAlpha = 1 - alpha;

  pixels[pixelOffset] = Math.round(pixels[pixelOffset] * inverseAlpha + sourceColor[0] * alpha);
  pixels[pixelOffset + 1] = Math.round(
    pixels[pixelOffset + 1] * inverseAlpha + sourceColor[1] * alpha,
  );
  pixels[pixelOffset + 2] = Math.round(
    pixels[pixelOffset + 2] * inverseAlpha + sourceColor[2] * alpha,
  );
  pixels[pixelOffset + 3] = Math.round(
    pixels[pixelOffset + 3] * inverseAlpha + sourceColor[3] * alpha,
  );
}

function encodePng(width, height, rgba) {
  const rawScanlines = Buffer.alloc(height * (1 + width * 4));

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * 4);
    rawScanlines[rowStart] = 0;
    rgba.copy(rawScanlines, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', zlib.deflateSync(rawScanlines)),
    createChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const value of buffer) {
    crc = CRC_TABLE[(crc ^ value) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createCrcTable() {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      if ((value & 1) === 1) {
        value = 0xedb88320 ^ (value >>> 1);
      } else {
        value >>>= 1;
      }
    }

    table[index] = value >>> 0;
  }

  return table;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
