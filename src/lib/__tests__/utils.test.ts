import { describe, it, expect } from 'vitest'
import { cn, toRoman, normalizeSession, generateSlotKey } from '@/lib/utils'

describe('Utils', () => {
  describe('cn', () => {
    it('should merge class names', () => {
      expect(cn('text-red-500', 'bg-blue-500')).toBe('text-red-500 bg-blue-500')
    })

    it('should handle conditional classes', () => {
      expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
    })
  })

  describe('toRoman', () => {
    it('should convert numbers to Roman numerals', () => {
      expect(toRoman(1)).toBe('I')
      expect(toRoman(2)).toBe('II')
      expect(toRoman(5)).toBe('V')
      expect(toRoman(10)).toBe('X')
    })

    it('should handle invalid inputs', () => {
      expect(toRoman(0)).toBe('0')
      expect(toRoman(-1)).toBe('-1')
      expect(toRoman('abc')).toBe('abc')
    })
  })

  describe('normalizeSession', () => {
    it('should normalize session strings', () => {
      expect(normalizeSession('Session 1')).toBe('1')
      expect(normalizeSession('2nd Hour')).toBe('2')
      expect(normalizeSession('III')).toBe('3')
      expect(normalizeSession('Extra')).toBe('EXTRA')
    })
  })

  describe('generateSlotKey', () => {
    it('should generate consistent slot keys', () => {
      const key1 = generateSlotKey('20260127', '101', '1')
      const key2 = generateSlotKey('20260127', '101', '1')
      expect(key1).toBe(key2)
    })
  })
})
