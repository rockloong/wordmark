// ID 与哈希工具。
// nanoid 生成书签 id;同步 sha1 用于 urlHash / textHash(去重 + 缓存键)。

import { customAlphabet } from 'nanoid';

// 仅用小写字母+数字,避免出现在 CSS highlight name / 文件名里出问题
const nano = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12);

export function newId(): string {
  return nano();
}

// 同步 SHA1(Node 与浏览器均可用,不依赖 crypto.subtle 的异步性)。
// 来自公开 domain 的参考实现,适合短文本(选中文本/URL)。
export function sha1(input: string): string {
  const msg = new TextEncoder().encode(input);
  // 1. padding
  const ml = msg.length;
  const bitLen = ml * 8;
  const withOne = ml + 1;
  const totalLen = withOne + ((56 - (withOne % 64) + 64) % 64) + 8;
  const buf = new Uint8Array(totalLen);
  buf.set(msg);
  buf[ml] = 0x80;
  // 64-bit big-endian length(这里高位一般为0)
  const dv = new DataView(buf.buffer);
  dv.setUint32(totalLen - 4, bitLen >>> 0, false);
  dv.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);

  // 2. process
  let h0 = 0x67452301,
    h1 = 0xefcdab89,
    h2 = 0x98badcfe,
    h3 = 0x10325476,
    h4 = 0xc3d2e1f0;

  const w = new Int32Array(80);
  for (let chunk = 0; chunk < totalLen; chunk += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = dv.getInt32(chunk + i * 4, false);
    }
    for (let i = 16; i < 80; i++) {
      const x = (w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]) | 0;
      w[i] = ((x << 1) | (x >>> 31)) | 0;
    }
    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4;
    for (let i = 0; i < 80; i++) {
      let f = 0,
        k = 0;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const tmp = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) | 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) | 0;
      b = a;
      a = tmp;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  return [h0, h1, h2, h3, h4].map((h) => (h >>> 0).toString(16).padStart(8, '0')).join('');
}

// URL 规范化:去掉 hash(#...),用于跨刷新/SPA 匹配同一页。
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = '';
    return u.href;
  } catch {
    return raw.split('#')[0];
  }
}

export function urlHashOf(raw: string): string {
  return sha1(canonicalUrl(raw));
}
