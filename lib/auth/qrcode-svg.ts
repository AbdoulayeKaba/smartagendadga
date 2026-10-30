/**
 * Minimal QR Code generator (byte mode) → SVG data URL.
 * Adapted for otpauth:// setup URIs without external deps.
 */

const ECC_CODEWORDS_PER_BLOCK = [
  // L, M, Q, H for versions 1..10 (enough for otpauth URIs)
  [-1, 7, 10, 13, 17, 26, 34, 40, 48, 60, 72],
  [-1, 10, 16, 22, 28, 44, 56, 66, 82, 100, 124],
  [-1, 13, 22, 36, 44, 64, 82, 100, 122, 146, 176],
  [-1, 17, 28, 44, 56, 80, 104, 130, 156, 186, 224],
] as const;

const NUM_ERROR_CORRECTION_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
  [-1, 1, 1, 2, 4, 4, 4, 6, 6, 8, 8],
] as const;

function getQrSize(version: number) {
  return version * 4 + 17;
}

function reedSolomonComputeDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = reedSolomonMultiply(result[j]!, root);
      if (j + 1 < result.length) result[j]! ^= result[j + 1]!;
    }
    root = reedSolomonMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonComputeRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ result[0]!;
    result.shift();
    result.push(0);
    for (let i = 0; i < result.length; i++) {
      result[i]! ^= reedSolomonMultiply(divisor[i]!, factor);
    }
  }
  return result;
}

function reedSolomonMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = ((z << 1) ^ ((z >>> 7) * 0x11d)) & 0xff;
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function setFunctionModule(modules: boolean[][], x: number, y: number, isDark: boolean) {
  modules[y]![x] = isDark;
}

function drawFinder(modules: boolean[][], isFunction: boolean[][], x: number, y: number) {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || xx >= modules.length || yy < 0 || yy >= modules.length) continue;
      const dark =
        (dx >= 0 && dx <= 6 && (dy === 0 || dy === 6)) ||
        (dy >= 0 && dy <= 6 && (dx === 0 || dx === 6)) ||
        (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
      modules[yy]![xx] = dark;
      isFunction[yy]![xx] = true;
    }
  }
}

function drawTiming(modules: boolean[][], isFunction: boolean[][]) {
  for (let i = 0; i < modules.length; i++) {
    if (!isFunction[6]![i]) {
      modules[6]![i] = i % 2 === 0;
      isFunction[6]![i] = true;
    }
    if (!isFunction[i]![6]) {
      modules[i]![6] = i % 2 === 0;
      isFunction[i]![6] = true;
    }
  }
}

function drawAlignment(modules: boolean[][], isFunction: boolean[][], version: number) {
  if (version === 1) return;
  const pos = [6, version * 4 + 10];
  for (const y of pos) {
    for (const x of pos) {
      if (isFunction[y]![x]) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const dark = Math.max(Math.abs(dx), Math.abs(dy)) !== 1;
          modules[y + dy]![x + dx] = dark;
          isFunction[y + dy]![x + dx] = true;
        }
      }
    }
  }
}

function getNumRawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function getNumDataCodewords(version: number, ecl: number): number {
  return (
    Math.floor(getNumRawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[ecl]![version]! * NUM_ERROR_CORRECTION_BLOCKS[ecl]![version]!
  );
}

function addEccAndInterleave(data: number[], version: number, ecl: number): number[] {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl]![version]!;
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl]![version]!;
  const rawCodewords = Math.floor(getNumRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const blocks: number[][] = [];
  const rsDiv = reedSolomonComputeDivisor(blockEccLen);
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(
      k,
      k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1)
    );
    k += dat.length;
    const ecc = reedSolomonComputeRemainder(dat, rsDiv);
    if (i < numShortBlocks) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const result: number[] = [];
  for (let i = 0; i < blocks[0]!.length; i++) {
    for (let j = 0; j < blocks.length; j++) {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
        result.push(blocks[j]![i]!);
      }
    }
  }
  return result;
}

function drawCodewords(modules: boolean[][], isFunction: boolean[][], data: number[]) {
  let i = 0;
  for (let right = modules.length - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < modules.length; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? modules.length - 1 - vert : vert;
        if (!isFunction[y]![x] && i < data.length * 8) {
          modules[y]![x] = ((data[i >>> 3]! >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }
}

function applyMask(modules: boolean[][], isFunction: boolean[][], mask: number) {
  for (let y = 0; y < modules.length; y++) {
    for (let x = 0; x < modules.length; x++) {
      if (isFunction[y]![x]) continue;
      let invert = false;
      switch (mask) {
        case 0:
          invert = (x + y) % 2 === 0;
          break;
        case 1:
          invert = y % 2 === 0;
          break;
        case 2:
          invert = x % 3 === 0;
          break;
        case 3:
          invert = (x + y) % 3 === 0;
          break;
        case 4:
          invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
          break;
        case 5:
          invert = ((x * y) % 2) + ((x * y) % 3) === 0;
          break;
        case 6:
          invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
          break;
        default:
          invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
      }
      if (invert) modules[y]![x] = !modules[y]![x];
    }
  }
}

function drawFormatBits(modules: boolean[][], isFunction: boolean[][], ecl: number, mask: number) {
  const data = (ecl << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  for (let i = 0; i <= 5; i++) setFunctionModule(modules, 8, i, ((bits >>> i) & 1) !== 0);
  setFunctionModule(modules, 8, 7, ((bits >>> 6) & 1) !== 0);
  setFunctionModule(modules, 8, 8, ((bits >>> 7) & 1) !== 0);
  setFunctionModule(modules, 7, 8, ((bits >>> 8) & 1) !== 0);
  for (let i = 9; i < 15; i++) setFunctionModule(modules, 14 - i, 8, ((bits >>> i) & 1) !== 0);
  for (let i = 0; i < 8; i++)
    setFunctionModule(modules, modules.length - 1 - i, 8, ((bits >>> i) & 1) !== 0);
  for (let i = 8; i < 15; i++)
    setFunctionModule(modules, 8, modules.length - 15 + i, ((bits >>> i) & 1) !== 0);
  setFunctionModule(modules, 8, modules.length - 8, true);
  for (let y = 0; y < 9; y++) isFunction[y]![8] = true;
  for (let x = 0; x < 8; x++) isFunction[8]![x] = true;
  for (let i = 0; i < 8; i++) isFunction[8]![modules.length - 1 - i] = true;
  for (let i = 0; i < 7; i++) isFunction[modules.length - 1 - i]![8] = true;
  isFunction[modules.length - 8]![8] = true;
}

function encodeSegments(text: string, version: number): number[] {
  const bytes = Array.from(new TextEncoder().encode(text));
  const bits: number[] = [];
  const append = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  append(0b0100, 4);
  append(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) append(b, 8);
  const dataCapacityBits = getNumDataCodewords(version, 0) * 8;
  append(0, Math.min(4, dataCapacityBits - bits.length));
  append(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < dataCapacityBits; pad ^= 0xec ^ 0x11) append(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j]!;
    data.push(byte);
  }
  return data;
}

function createModules(version: number, ecl: number, text: string, mask: number): boolean[][] {
  const size = getQrSize(version);
  const modules = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const isFunction = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  drawFinder(modules, isFunction, 0, 0);
  drawFinder(modules, isFunction, size - 7, 0);
  drawFinder(modules, isFunction, 0, size - 7);
  drawAlignment(modules, isFunction, version);
  drawTiming(modules, isFunction);
  setFunctionModule(modules, 8, size - 8, true);
  isFunction[size - 8]![8] = true;
  drawFormatBits(modules, isFunction, ecl, mask);
  const data = addEccAndInterleave(encodeSegments(text, version), version, ecl);
  drawCodewords(modules, isFunction, data);
  applyMask(modules, isFunction, mask);
  drawFormatBits(modules, isFunction, ecl, mask);
  return modules;
}

function modulesToSvgDataUrl(modules: boolean[][], moduleSize = 4, margin = 2): string {
  const n = modules.length;
  const dim = (n + margin * 2) * moduleSize;
  let path = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!modules[y]![x]) continue;
      const px = (x + margin) * moduleSize;
      const py = (y + margin) * moduleSize;
      path += `M${px} ${py}h${moduleSize}v${moduleSize}h-${moduleSize}z`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path fill="#111" d="${path}"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Returns SVG data URL for a QR encoding `text` (M ECC, auto version 2–7). */
export function qrCodeDataUrl(text: string): string {
  const ecl = 1; // M
  const bytesLen = new TextEncoder().encode(text).length;
  let version = 2;
  for (; version <= 7; version++) {
    const capacity = getNumDataCodewords(version, ecl) - (version <= 9 ? 2 : 3);
    if (bytesLen <= capacity) break;
  }
  if (version > 7) version = 7;
  const modules = createModules(version, ecl, text, 0);
  return modulesToSvgDataUrl(modules, 3, 2);
}
