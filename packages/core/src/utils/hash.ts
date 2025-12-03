export type InputLike = string | ArrayBuffer | ArrayBufferView

const te = new TextEncoder()

function toBytes(input: InputLike): Uint8Array {
  if (typeof input === 'string') return te.encode(input)
  if (input instanceof ArrayBuffer) return new Uint8Array(input)
  if (ArrayBuffer.isView(input))
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  throw new TypeError('Unsupported input type')
}

export function toHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    const h = bytes[i].toString(16).padStart(2, '0')
    out += h
  }
  return out
}

export function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

async function getSubtle(): Promise<SubtleCrypto> {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    return globalThis.crypto.subtle
  }
  throw new Error('WebCrypto Subtle API is not available in this environment.')
}

export async function sha1(input: InputLike): Promise<Uint8Array> {
  const subtle = await getSubtle()
  const digest = await subtle.digest(
    'SHA-1',
    toBytes(input) as unknown as BufferSource
  )
  return new Uint8Array(digest)
}

export async function hmacSHA1(
  message: InputLike,
  key: InputLike
): Promise<Uint8Array> {
  const subtle = await getSubtle()
  const keyData = toBytes(key)
  const cryptoKey = await subtle.importKey(
    'raw',
    keyData as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )
  const signature = await subtle.sign(
    'HMAC',
    cryptoKey,
    toBytes(message) as unknown as BufferSource
  )
  return new Uint8Array(signature)
}

function rotl(x: number, n: number): number {
  return (x << n) | (x >>> (32 - n))
}

const S: number[] = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5,
  9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11,
  16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15,
  21,
]

const K: number[] = new Array(64)
  .fill(0)
  .map((_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0)

export function md5(input: InputLike): Uint8Array {
  const bytes = toBytes(input)

  // 计算 padding 后长度
  const padLen = (56 - ((bytes.length + 1) % 64) + 64) % 64
  const totalLen = bytes.length + 1 + padLen + 8

  const buf = new Uint8Array(totalLen)
  buf.set(bytes, 0)
  buf[bytes.length] = 0x80

  // 64-bit 长度（单位：bit），用两个 32 位数表示（小端）
  const lenBytes = bytes.length
  const bitLenLo = (lenBytes << 3) >>> 0
  const bitLenHi = (lenBytes >>> 29) >>> 0

  const view = new DataView(buf.buffer)
  view.setUint32(totalLen - 8, bitLenLo, true)
  view.setUint32(totalLen - 4, bitLenHi, true)

  // 初始化寄存器
  let a = 0x67452301,
    b = 0xefcdab89,
    c = 0x98badcfe,
    d = 0x10325476

  const M = new Uint32Array(16)
  for (let offset = 0; offset < buf.length; offset += 64) {
    for (let i = 0; i < 16; i++) M[i] = view.getUint32(offset + i * 4, true)

    let A = a,
      B = b,
      C = c,
      D = d
    for (let i = 0; i < 64; i++) {
      let F: number, g: number
      if (i < 16) {
        F = (B & C) | (~B & D)
        g = i
      } else if (i < 32) {
        F = (D & B) | (~D & C)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        F = B ^ C ^ D
        g = (3 * i + 5) % 16
      } else {
        F = C ^ (B | ~D)
        g = (7 * i) % 16
      }

      const tmp = D
      const sum = (A + F + K[i] + M[g]) >>> 0
      D = C
      C = B
      B = (B + rotl(sum, S[i])) >>> 0
      A = tmp
    }
    a = (a + A) >>> 0
    b = (b + B) >>> 0
    c = (c + C) >>> 0
    d = (d + D) >>> 0
  }

  const out = new Uint8Array(16)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, a, true)
  dv.setUint32(4, b, true)
  dv.setUint32(8, c, true)
  dv.setUint32(12, d, true)
  return out
}
