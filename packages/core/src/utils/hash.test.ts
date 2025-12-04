import { describe, it, expect } from 'vitest'
import { md5, sha1, hmacSHA1, toHex, toBase64 } from './hash'
import CryptoJS from 'crypto-js'

describe('Hash 函数测试', () => {
  describe('MD5 测试', () => {
    it('应该正确计算 MD5 哈希值', () => {
      const input = 'hello'
      const result = md5(input)

      // 验证返回类型
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBe(16) // MD5 输出 16 字节

      // 验证十六进制输出
      const hexResult = toHex(result)
      const expectedHex = CryptoJS.MD5(input).toString(CryptoJS.enc.Hex)
      expect(hexResult).toBe(expectedHex)
    })

    it('应该处理空字符串', () => {
      const result = md5('')
      const hexResult = toHex(result)
      const expectedHex = CryptoJS.MD5('').toString(CryptoJS.enc.Hex)
      expect(hexResult).toBe(expectedHex)
    })

    it('应该处理长字符串', () => {
      const longString = 'a'.repeat(1000)
      const result = md5(longString)
      const hexResult = toHex(result)
      const expectedHex = CryptoJS.MD5(longString).toString(CryptoJS.enc.Hex)
      expect(hexResult).toBe(expectedHex)
    })
  })

  describe('SHA-1 测试', () => {
    it('应该正确计算 SHA-1 哈希值', async () => {
      const input = 'hello'
      const result = await sha1(input)

      // 验证返回类型
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBe(20) // SHA-1 输出 20 字节

      // 验证十六进制输出
      const hexResult = toHex(result)
      const expectedHex = CryptoJS.SHA1(input).toString(CryptoJS.enc.Hex)
      expect(hexResult).toBe(expectedHex)
    })

    it('应该处理空字符串', async () => {
      const result = await sha1('')
      const hexResult = toHex(result)
      const expectedHex = CryptoJS.SHA1('').toString(CryptoJS.enc.Hex)
      expect(hexResult).toBe(expectedHex)
    })

    it('应该处理长字符串', async () => {
      const longString = 'a'.repeat(1000)
      const result = await sha1(longString)
      const hexResult = toHex(result)
      const expectedHex = CryptoJS.SHA1(longString).toString(CryptoJS.enc.Hex)
      expect(hexResult).toBe(expectedHex)
    })
  })

  describe('HMAC-SHA1 测试', () => {
    it('应该正确计算 HMAC-SHA1 哈希值', async () => {
      const message = 'hello'
      const key = 'world'
      const result = await hmacSHA1(message, key)

      // 验证返回类型
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBe(20) // HMAC-SHA1 输出 20 字节

      // 验证十六进制输出
      const hexResult = toHex(result)
      const expectedHex = CryptoJS.HmacSHA1(message, key).toString(
        CryptoJS.enc.Hex
      )
      expect(hexResult).toBe(expectedHex)
    })

    it('应该处理空消息和密钥', async () => {
      // 注意：Web Crypto API 不支持零长度密钥，所以我们使用一个字符的密钥
      const result = await hmacSHA1('', 'a')
      const hexResult = toHex(result)
      const expectedHex = CryptoJS.HmacSHA1('', 'a').toString(CryptoJS.enc.Hex)
      expect(hexResult).toBe(expectedHex)
    })

    it('应该处理长消息和密钥', async () => {
      const longMessage = 'a'.repeat(1000)
      const longKey = 'b'.repeat(100)
      const result = await hmacSHA1(longMessage, longKey)
      const hexResult = toHex(result)
      const expectedHex = CryptoJS.HmacSHA1(longMessage, longKey).toString(
        CryptoJS.enc.Hex
      )
      expect(hexResult).toBe(expectedHex)
    })
  })

  describe('编码函数测试', () => {
    it('toHex 应该正确转换字节数组为十六进制字符串', () => {
      const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]) // "Hello"
      const result = toHex(bytes)
      expect(result).toBe('48656c6c6f')
    })

    it('toBase64 应该正确转换字节数组为 Base64 字符串', () => {
      const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]) // "Hello"
      const result = toBase64(bytes)
      expect(result).toBe('SGVsbG8=')
    })
  })

  describe('集成测试', () => {
    it('MD5 + toHex 应该与 crypto-js 结果一致', () => {
      const input = 'test message'
      const result = md5(input)
      const hexResult = toHex(result)
      const expectedHex = CryptoJS.MD5(input).toString(CryptoJS.enc.Hex)
      expect(hexResult).toBe(expectedHex)
    })

    it('SHA-1 + toHex 应该与 crypto-js 结果一致', async () => {
      const input = 'test message'
      const result = await sha1(input)
      const hexResult = toHex(result)
      const expectedHex = CryptoJS.SHA1(input).toString(CryptoJS.enc.Hex)
      expect(hexResult).toBe(expectedHex)
    })

    it('HMAC-SHA1 + toHex 应该与 crypto-js 结果一致', async () => {
      const message = 'test message'
      const key = 'test key'
      const result = await hmacSHA1(message, key)
      const hexResult = toHex(result)
      const expectedHex = CryptoJS.HmacSHA1(message, key).toString(
        CryptoJS.enc.Hex
      )
      expect(hexResult).toBe(expectedHex)
    })

    it('HMAC-SHA1 + toBase64 应该产生有效的 Base64 字符串', async () => {
      const message = 'test message'
      const key = 'test key'
      const result = await hmacSHA1(message, key)
      const base64Result = toBase64(result)

      // 验证 Base64 格式
      expect(base64Result).toMatch(/^[A-Za-z0-9+/]*={0,2}$/)

      // 验证可以正确解码
      const decoded = atob(base64Result)
      expect(decoded.length).toBe(result.length)
    })
  })
})
