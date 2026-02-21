import { describe, it, expect } from 'vitest'
import { cn, toRoman, normalizeSession, generateSlotKey, formatSessionName, getSessionNumber, formatCourseCode, normalizeDate, redact, getClientIp, normalizeToISODate } from '@/lib/utils'

describe('Utils', () => {
  describe('cn', () => {
    it('should merge class names', () => {
      expect(cn('text-red-500', 'bg-blue-500')).toBe('text-red-500 bg-blue-500')
    })

    it('should handle conditional classes', () => {
      const condition = false
      expect(cn('base', condition && 'hidden', 'visible')).toBe('base visible')
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
    it('should generate correctly formatted slot keys', () => {
      const courseId = '101'
      const date = '20260127'
      const session = '1'
      const key = generateSlotKey(courseId, date, session)
      // Format: COURSEID_YYYYMMDD_ROMAN
      expect(key).toBe('101_20260127_I')
    })

    it('should generate consistent slot keys', () => {
      const key1 = generateSlotKey('101', '20260127', '1')
      const key2 = generateSlotKey('101', '20260127', '1')
      expect(key1).toBe(key2)
    })
  })

  describe('formatSessionName', () => {
    it('should format session names correctly', () => {
      expect(formatSessionName('I')).toBe('1st Hour')
      expect(formatSessionName('II')).toBe('2nd Hour')
      expect(formatSessionName('III')).toBe('3rd Hour')
      expect(formatSessionName('IV')).toBe('4th Hour')
    })

    it('should handle numeric sessions', () => {
      expect(formatSessionName('1')).toBe('1st Hour')
      expect(formatSessionName('2')).toBe('2nd Hour')
      expect(formatSessionName('3')).toBe('3rd Hour')
      expect(formatSessionName('11')).toBe('11th Hour')
      expect(formatSessionName('21')).toBe('21st Hour')
    })

    it('should return empty string for empty input', () => {
      expect(formatSessionName('')).toBe('')
    })
  })

  describe('getSessionNumber', () => {
    it('should extract session numbers from Roman numerals', () => {
      expect(getSessionNumber('I')).toBe(1)
      expect(getSessionNumber('II')).toBe(2)
      expect(getSessionNumber('III')).toBe(3)
    })

    it('should extract session numbers from strings', () => {
      expect(getSessionNumber('Session 1')).toBe(1)
      expect(getSessionNumber('2nd Hour')).toBe(2)
    })

    it('should return 999 for invalid input', () => {
      expect(getSessionNumber('')).toBe(999)
      expect(getSessionNumber('invalid')).toBe(999)
    })
  })

  describe('formatCourseCode', () => {
    it('should format course codes with hyphens', () => {
      expect(formatCourseCode('CS-101')).toBe('CS')
    })

    it('should remove spaces from course codes', () => {
      expect(formatCourseCode('CS 101')).toBe('CS101')
    })

    it('should handle codes without hyphens', () => {
      expect(formatCourseCode('MATH101')).toBe('MATH101')
    })
  })

  describe('normalizeToISODate', () => {
    it('should strip time part from ISO datetime strings', () => {
      expect(normalizeToISODate('2024-01-15T10:30:00Z')).toBe('2024-01-15')
      expect(normalizeToISODate('2024-01-15T00:00:00.000Z')).toBe('2024-01-15')
    })

    it('should convert DD/MM/YYYY to YYYY-MM-DD', () => {
      expect(normalizeToISODate('15/01/2024')).toBe('2024-01-15')
      expect(normalizeToISODate('01/02/2026')).toBe('2026-02-01')
    })

    it('should pad single-digit day and month', () => {
      expect(normalizeToISODate('5/3/2024')).toBe('2024-03-05')
    })

    it('should return already-normalized YYYY-MM-DD strings unchanged', () => {
      expect(normalizeToISODate('2024-01-15')).toBe('2024-01-15')
    })

    it('should return empty string for empty input', () => {
      expect(normalizeToISODate('')).toBe('')
    })
  })

  describe('normalizeDate', () => {
    it('should format Date objects to YYYYMMDD', () => {
      const date = new Date(2026, 0, 27) // January 27, 2026
      const result = normalizeDate(date)
      expect(result).toBe('20260127')
    })

    it('should handle ISO string dates', () => {
      expect(normalizeDate('2026-01-27T00:00:00.000Z')).toBe('20260127')
    })

    it('should handle YYYY-MM-DD format', () => {
      expect(normalizeDate('2026-01-27')).toBe('20260127')
    })

    it('should handle DD-MM-YYYY format', () => {
      expect(normalizeDate('27-01-2026')).toBe('20260127')
    })

    it('should return empty string for empty input', () => {
      expect(normalizeDate('')).toBe('')
    })
  })

  describe('redact', () => {
    it('should redact email addresses deterministically', () => {
      const email = 'user@example.com'
      const hash1 = redact('email', email)
      const hash2 = redact('email', email)
      
      // Should produce the same hash for the same input
      expect(hash1).toBe(hash2)
      
      // Should be 12 characters long
      expect(hash1).toHaveLength(12)
      
      // Should not contain the original email
      expect(hash1).not.toContain('@')
      expect(hash1).not.toContain('example')
    })

    it('should redact IDs deterministically', () => {
      const id = '12345'
      const hash1 = redact('id', id)
      const hash2 = redact('id', id)
      
      // Should produce the same hash for the same input
      expect(hash1).toBe(hash2)
      
      // Should be 12 characters long
      expect(hash1).toHaveLength(12)
      
      // Should not contain the original ID
      expect(hash1).not.toContain('12345')
    })

    it('should produce different hashes for different types', () => {
      const value = 'test@example.com'
      const emailHash = redact('email', value)
      const idHash = redact('id', value)
      
      // Different types should produce different hashes
      expect(emailHash).not.toBe(idHash)
    })

    it('should produce different hashes for different values', () => {
      const email1 = 'user1@example.com'
      const email2 = 'user2@example.com'
      
      const hash1 = redact('email', email1)
      const hash2 = redact('email', email2)
      
      // Different values should produce different hashes
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('getClientIp', () => {
    it('should return IP from cf-connecting-ip header', () => {
      const headers = new Headers()
      headers.set('cf-connecting-ip', '1.2.3.4')
      
      expect(getClientIp(headers)).toBe('1.2.3.4')
    })

    it('should return IP from x-real-ip header when cf-connecting-ip is not present', () => {
      const headers = new Headers()
      headers.set('x-real-ip', '5.6.7.8')
      
      expect(getClientIp(headers)).toBe('5.6.7.8')
    })

    it('should return IP from x-forwarded-for header when others are not present', () => {
      const headers = new Headers()
      headers.set('x-forwarded-for', '9.10.11.12, 192.168.1.1')
      
      expect(getClientIp(headers)).toBe('9.10.11.12')
    })

    it('should prioritize cf-connecting-ip over other headers', () => {
      const headers = new Headers()
      headers.set('cf-connecting-ip', '1.2.3.4')
      headers.set('x-real-ip', '5.6.7.8')
      headers.set('x-forwarded-for', '9.10.11.12')
      
      expect(getClientIp(headers)).toBe('1.2.3.4')
    })

    it('should prioritize x-real-ip over x-forwarded-for', () => {
      const headers = new Headers()
      headers.set('x-real-ip', '5.6.7.8')
      headers.set('x-forwarded-for', '9.10.11.12')
      
      expect(getClientIp(headers)).toBe('5.6.7.8')
    })

    it('should trim whitespace from IP addresses', () => {
      const headers = new Headers()
      headers.set('cf-connecting-ip', '  1.2.3.4  ')
      
      expect(getClientIp(headers)).toBe('1.2.3.4')
    })

    it('should handle x-forwarded-for with multiple IPs and trim', () => {
      const headers = new Headers()
      headers.set('x-forwarded-for', ' 9.10.11.12 , 192.168.1.1 ')
      
      expect(getClientIp(headers)).toBe('9.10.11.12')
    })
  })
})
