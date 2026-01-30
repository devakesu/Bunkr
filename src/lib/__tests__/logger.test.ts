/**
 * Tests for logger utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger } from '@/lib/logger'

describe('logger', () => {
  let consoleLogSpy: any
  let consoleWarnSpy: any
  let consoleErrorSpy: any

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('info', () => {
    it('should log info messages', () => {
      logger.info('test info message')
      expect(consoleLogSpy).toHaveBeenCalledWith('test info message')
    })

    it('should handle multiple arguments', () => {
      logger.info('info:', { data: 'test' })
      expect(consoleLogSpy).toHaveBeenCalledWith('info:', { data: 'test' })
    })
  })

  describe('warn', () => {
    it('should log warning messages', () => {
      logger.warn('test warning')
      expect(consoleWarnSpy).toHaveBeenCalledWith('test warning')
    })

    it('should handle multiple arguments', () => {
      logger.warn('warning:', 123, true)
      expect(consoleWarnSpy).toHaveBeenCalledWith('warning:', 123, true)
    })
  })

  describe('error', () => {
    it('should log error messages', () => {
      logger.error('test error')
      expect(consoleErrorSpy).toHaveBeenCalledWith('test error')
    })

    it('should handle Error objects', () => {
      const error = new Error('test error')
      logger.error('Error occurred:', error)
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error occurred:', error)
    })

    it('should handle multiple arguments', () => {
      logger.error('error:', { code: 500 }, 'details')
      expect(consoleErrorSpy).toHaveBeenCalledWith('error:', { code: 500 }, 'details')
    })
  })
})
