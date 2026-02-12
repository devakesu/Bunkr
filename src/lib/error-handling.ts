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
export function isDutyLeaveConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  
  const errorObj = error as Record<string, unknown>;
  
  // Check direct error properties
  const isDirectMatch = (
    errorObj.code === "P0001" && 
    errorObj.hint === "Only 5 duty leaves allowed per semester per course"
  );
  
  if (isDirectMatch) return true;
  
  // Check if error is wrapped in a details property or other nested structure
  if (errorObj.details && typeof errorObj.details === "object") {
    const details = errorObj.details as Record<string, unknown>;
    const isNestedMatch =
      details.code === "P0001" &&
      details.hint === "Only 5 duty leaves allowed per semester per course";

    if (isNestedMatch) {
      return true;
    }
  }
  
  // Check error message as fallback
  if (errorObj.message && typeof errorObj.message === 'string') {
    return errorObj.message.includes('Maximum') && 
           errorObj.message.includes('Duty Leaves exceeded') &&
           errorObj.code === "P0001";
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
