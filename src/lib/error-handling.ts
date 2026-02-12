/**
 * Error handling utilities for database constraint violations and other errors
 */

import { Course } from "@/types";

/**
 * Database error structure returned by Supabase/PostgreSQL
 */
export interface DatabaseError {
  code?: string;
  hint?: string;
  message?: string;
}

/**
 * Checks if an error is a duty leave constraint violation (P0001 error with specific hint)
 * 
 * @param error - The error object to check
 * @returns true if the error is a duty leave constraint violation, false otherwise
 * 
 * @example
 * ```ts
 * const error = { code: 'P0001', hint: 'Only 5 duty leaves allowed per semester per course' };
 * if (isDutyLeaveConstraintError(error)) {
 *   // Handle duty leave constraint violation
 * }
 * ```
 */
export function isDutyLeaveConstraintError(error: DatabaseError | any | null | undefined): boolean {
  if (!error) return false;
  
  // Check direct error properties
  const isDirectMatch = (
    error.code === "P0001" && 
    error.hint === "Only 5 duty leaves allowed per semester per course"
  );
  
  if (isDirectMatch) return true;
  
  // Check if error is wrapped in a details property or other nested structure
  if (error.details) {
    return (
      error.details.code === "P0001" &&
      error.details.hint === "Only 5 duty leaves allowed per semester per course"
    );
  }
  
  // Check error message as fallback
  if (error.message && typeof error.message === 'string') {
    return error.message.includes('Maximum') && 
           error.message.includes('Duty Leaves exceeded') &&
           error.code === "P0001";
  }
  
  return false;
}

/**
 * Generates a user-friendly error message for duty leave constraint violations
 * 
 * @param courseId - The course ID
 * @param coursesData - The courses data object containing course information
 * @returns A user-friendly error message
 * 
 * @example
 * ```ts
 * const coursesData = { courses: { '123': { name: 'Computer Science' } } };
 * const message = getDutyLeaveErrorMessage('123', coursesData);
 * // Returns: "Cannot add Duty Leave: Maximum of 5 duty leaves per semester exceeded for Computer Science"
 * ```
 */
export function getDutyLeaveErrorMessage(
  courseId: string, 
  coursesData?: { courses: Record<string, Course> }
): string {
  const courseName = coursesData?.courses?.[courseId]?.name || `course ${courseId}`;
  return `Cannot add Duty Leave: Maximum of 5 duty leaves per semester exceeded for ${courseName}`;
}
