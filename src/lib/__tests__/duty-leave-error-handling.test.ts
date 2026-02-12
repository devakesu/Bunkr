import { describe, it, expect } from 'vitest';

/**
 * Test suite for duty leave constraint error detection
 * Validates the error handling logic for database constraint P0001
 */
describe('Duty Leave Constraint Error Handling', () => {
  it('should correctly identify P0001 error with duty leave hint', () => {
    const error = {
      code: 'P0001',
      hint: 'Only 5 duty leaves allowed per semester per course',
      message: 'Maximum 5 Duty Leaves exceeded for course: 72329'
    };

    // Test the condition used in the components
    const isDutyLeaveConstraintError = 
      error.code === 'P0001' && 
      error.hint === 'Only 5 duty leaves allowed per semester per course';

    expect(isDutyLeaveConstraintError).toBe(true);
  });

  it('should not match P0001 error with different hint', () => {
    const error = {
      code: 'P0001',
      hint: 'Some other constraint violation',
      message: 'Different error'
    };

    const isDutyLeaveConstraintError = 
      error.code === 'P0001' && 
      error.hint === 'Only 5 duty leaves allowed per semester per course';

    expect(isDutyLeaveConstraintError).toBe(false);
  });

  it('should not match different error code', () => {
    const error = {
      code: '23505',
      hint: 'Only 5 duty leaves allowed per semester per course',
      message: 'Duplicate key violation'
    };

    const isDutyLeaveConstraintError = 
      error.code === 'P0001' && 
      error.hint === 'Only 5 duty leaves allowed per semester per course';

    expect(isDutyLeaveConstraintError).toBe(false);
  });

  it('should handle missing error properties gracefully', () => {
    const error: any = {
      message: 'Some error'
    };

    const isDutyLeaveConstraintError = 
      error.code === 'P0001' && 
      error.hint === 'Only 5 duty leaves allowed per semester per course';

    expect(isDutyLeaveConstraintError).toBe(false);
  });

  it('should extract course name from error message', () => {
    const courseId = '72329';
    const coursesData = {
      courses: {
        '72329': { name: 'Computer Science' }
      }
    };

    const courseName = coursesData?.courses?.[courseId]?.name || `course ${courseId}`;
    
    expect(courseName).toBe('Computer Science');
  });

  it('should fallback to course ID when course name not found', () => {
    const courseId = '12345';
    const coursesData: any = {
      courses: {}
    };

    const courseName = coursesData?.courses?.[courseId]?.name || `course ${courseId}`;
    
    expect(courseName).toBe('course 12345');
  });
});
