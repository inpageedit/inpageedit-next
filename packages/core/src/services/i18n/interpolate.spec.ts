import { describe, expect, it } from 'vitest'
import { interpolate } from './interpolate.js'

describe('interpolate', () => {
  it('should return empty string for missing variable', () => {
    expect(interpolate('hello, {{ name }}')).toBe('hello, ')
  })

  it('should evaluate simple expression with fallback', () => {
    expect(interpolate('hello, {{ name || "world" }}')).toBe('hello, world')
    expect(interpolate('hello, {{ name || "world" }}', { name: 'dragon' })).toBe('hello, dragon')
  })

  it('should interpolate positional arguments', () => {
    expect(interpolate('hello, {{ $1 }}. {{ $2 }}', 'dragon', 'yeah')).toBe('hello, dragon. yeah')
    expect(interpolate('hello, {{ $1 }}. {{ $2 }}', ['dragon', 'yeah'])).toBe('hello, dragon. yeah')
  })

  it('should mix named and positional arguments', () => {
    expect(
      interpolate('hello, {{ $1 }}. {{ greeting || "" }}', { $1: 'dragon', greeting: 'yeah' })
    ).toBe('hello, dragon. yeah')
  })

  it('should handle missing positional arguments as empty string', () => {
    expect(interpolate('hi, {{ $1 }} and {{ $2 }}')).toBe('hi,  and ')
    expect(interpolate('hi, {{ $1 }} and {{ $2 }}', 'foo')).toBe('hi, foo and ')
  })

  it('should escape \\{ and \\} as literals', () => {
    expect(interpolate('foo \\{ not an arg \\}')).toBe('foo { not an arg }')
    expect(interpolate('foo \\{{ name }}', { name: 'bar' })).toBe('foo {{ name }}')
  })

  it('should support complex expressions', () => {
    expect(interpolate('sum: {{ a + b }}', { a: 1, b: 2 })).toBe('sum: 3')
    expect(interpolate('cond: {{ a > 1 ? "yes" : "no" }}', { a: 2 })).toBe('cond: yes')
    expect(interpolate('cond: {{ a > 1 ? "yes" : "no" }}', { a: 1 })).toBe('cond: no')
  })

  it('should treat falsy values correctly', () => {
    expect(interpolate('zero: {{ num }}', { num: 0 })).toBe('zero: 0')
    expect(interpolate('bool: {{ flag }}', { flag: false })).toBe('bool: false')
    expect(interpolate('empty: {{ str }}', { str: '' })).toBe('empty: ')
  })

  it('should handle multiple occurrences of the same variable', () => {
    expect(interpolate('{{ name }}, {{ name }}', { name: 'foo' })).toBe('foo, foo')
  })

  it('should return empty string for empty template', () => {
    expect(interpolate('')).toBe('')
    expect(interpolate('', { foo: 'bar' })).toBe('')
  })

  it('multi level fallbacks', () => {
    expect(interpolate('hello, {{ name || $1 || "world" }}')).toBe('hello, world')
    expect(interpolate('hello, {{ name || $1 || "world" }}', 'dragon')).toBe('hello, dragon')
    expect(interpolate('hello, {{ name || $1 || "world" }}', { name: 'fish' })).toBe('hello, fish')
  })

  it('deep object access', () => {
    expect(
      interpolate('user: {{ user.name.first || "Guest" }}', { user: { name: { first: 'Alice' } } })
    ).toBe('user: Alice')
    expect(interpolate('user: {{ user.name.first || "Guest" }}', { user: { name: {} } })).toBe(
      'user: Guest'
    )
    expect(interpolate('user: {{ user?.name?.first || "Guest" }}')).toBe('user: Guest')
  })

  // Why not? Because we can.
  it('crazy cases', () => {
    expect(
      interpolate('Value: {{ obj.arr[0].prop || $1 || "default" }}', {
        obj: { arr: [{ prop: 'value' }] },
      })
    ).toBe('Value: value')
    expect(
      interpolate(
        `hello {{
  name.first[0].toUpperCase() + name.first.slice(1).toLowerCase() }}·{{ name.last[0].toUpperCase() + name.last.slice(1).toLowerCase() }}!`,
        { name: { first: 'foo', last: 'bar' } }
      )
    ).toBe('hello Foo·Bar!')
    expect(
      interpolate('Result: {{ ((a + b) * c - d) / e }}', { a: 2, b: 3, c: 4, d: 10, e: 2 })
    ).toBe('Result: 5')
    expect(interpolate('{{ Math.random() > 0.5 ? "High" : "Low" }}')).toMatch(/^(High|Low)$/)
  })
})
