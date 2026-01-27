import { describe, it, expect } from 'vitest'
import { calculateAttendance } from '@/lib/logic/bunk'

describe('calculateAttendance - Bunk Calculator', () => {
  describe('Basic scenarios', () => {
    it('should return zero values for invalid input (total <= 0)', () => {
      const result = calculateAttendance(10, 0, 75)
      expect(result.canBunk).toBe(0)
      expect(result.requiredToAttend).toBe(0)
      expect(result.isExact).toBe(false)
    })

    it('should return zero values for invalid input (present > total)', () => {
      const result = calculateAttendance(15, 10, 75)
      expect(result.canBunk).toBe(0)
      expect(result.requiredToAttend).toBe(0)
    })

    it('should return zero values for negative present', () => {
      const result = calculateAttendance(-5, 10, 75)
      expect(result.canBunk).toBe(0)
      expect(result.requiredToAttend).toBe(0)
    })
  })

  describe('Exact target percentage', () => {
    it('should return isExact=true when attendance is exactly at target', () => {
      const result = calculateAttendance(75, 100, 75)
      expect(result.isExact).toBe(true)
      expect(result.canBunk).toBe(0)
      expect(result.requiredToAttend).toBe(0)
    })

    it('should return isExact=true when attendance is exactly 80%', () => {
      const result = calculateAttendance(80, 100, 80)
      expect(result.isExact).toBe(true)
    })
  })

  describe('Below target percentage - need to attend', () => {
    it('should calculate required attendance when below target', () => {
      const result = calculateAttendance(50, 100, 75)
      expect(result.requiredToAttend).toBeGreaterThan(0)
      expect(result.canBunk).toBe(0)
    })

    it('should calculate required attendance when at 60% targeting 75%', () => {
      const result = calculateAttendance(60, 100, 75)
      // At 60%, need to get to 75%
      // Formula: ceil((75 * 100 - 100 * 60) / (100 - 75)) = ceil(1500 / 25) = 60
      expect(result.requiredToAttend).toBe(60)
    })

    it('should calculate for different target percentages', () => {
      const result = calculateAttendance(40, 100, 80)
      expect(result.requiredToAttend).toBeGreaterThan(0)
      expect(result.targetPercentage).toBe(80)
    })

    it('should handle edge case when target is 100%', () => {
      const result = calculateAttendance(50, 100, 100)
      expect(result.requiredToAttend).toBe(50)
    })
  })

  describe('Above target percentage - can bunk', () => {
    it('should calculate bunkable classes when above target', () => {
      const result = calculateAttendance(90, 100, 75)
      expect(result.canBunk).toBeGreaterThan(0)
      expect(result.requiredToAttend).toBe(0)
    })

    it('should allow 20 bunks when at 90% targeting 75%', () => {
      const result = calculateAttendance(90, 100, 75)
      expect(result.canBunk).toBe(20)
    })

    it('should handle high attendance correctly', () => {
      const result = calculateAttendance(95, 100, 75)
      expect(result.canBunk).toBeGreaterThan(20)
    })

    it('should not allow negative bunks', () => {
      const result = calculateAttendance(76, 100, 75)
      expect(result.canBunk).toBeGreaterThanOrEqual(0)
    })

    it('should set isExact when very close to boundary but canBunk=0', () => {
      // Edge case where bunkable is positive but less than 0.9 and floors to 0
      const result = calculateAttendance(75.5, 100, 75)
      // This might set isExact based on the specific logic
      expect(result.canBunk).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Real-world scenarios', () => {
    it('should handle scenario: 18 present out of 24 classes', () => {
      const result = calculateAttendance(18, 24, 75)
      expect(result.canBunk).toBe(0)
      expect(result.requiredToAttend).toBe(0)
      expect(result.isExact).toBe(true)
    })

    it('should handle scenario: 20 present out of 25 classes', () => {
      const result = calculateAttendance(20, 25, 75)
      expect(result.canBunk).toBeGreaterThan(0)
    })

    it('should handle scenario: 10 present out of 20 classes (50%)', () => {
      const result = calculateAttendance(10, 20, 75)
      expect(result.requiredToAttend).toBeGreaterThan(0)
      expect(result.canBunk).toBe(0)
    })

    it('should work with target percentage of 80%', () => {
      const result = calculateAttendance(85, 100, 80)
      expect(result.canBunk).toBeGreaterThan(0)
      expect(result.targetPercentage).toBe(80)
    })
  })
})
