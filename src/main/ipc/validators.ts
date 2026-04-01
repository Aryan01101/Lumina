/**
 * IPC Input Validation Utilities
 *
 * Provides type-safe validation functions for IPC handler payloads.
 * All validators return an error string if validation fails, or null if valid.
 */

export type ValidationError = string | null

/**
 * Validates that a value is a non-empty string within length limits
 */
export function validateString(
  value: unknown,
  fieldName: string,
  options: { minLength?: number; maxLength?: number } = {}
): ValidationError {
  const { minLength = 1, maxLength = 10_000 } = options

  if (typeof value !== 'string') {
    return `${fieldName} must be a string`
  }

  if (value.length < minLength) {
    return `${fieldName} must be at least ${minLength} characters`
  }

  if (value.length > maxLength) {
    return `${fieldName} must be at most ${maxLength} characters`
  }

  return null
}

/**
 * Validates that a value is a positive integer
 */
export function validatePositiveInteger(value: unknown, fieldName: string): ValidationError {
  if (typeof value !== 'number') {
    return `${fieldName} must be a number`
  }

  if (!Number.isInteger(value)) {
    return `${fieldName} must be an integer`
  }

  if (value <= 0) {
    return `${fieldName} must be a positive integer`
  }

  return null
}

/**
 * Validates that a value is a non-negative integer (0 or positive)
 */
export function validateNonNegativeInteger(value: unknown, fieldName: string): ValidationError {
  if (typeof value !== 'number') {
    return `${fieldName} must be a number`
  }

  if (!Number.isInteger(value)) {
    return `${fieldName} must be an integer`
  }

  if (value < 0) {
    return `${fieldName} must be non-negative`
  }

  return null
}

/**
 * Validates that a value is one of the allowed enum values
 */
export function validateEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: readonly T[]
): ValidationError {
  if (typeof value !== 'string') {
    return `${fieldName} must be a string`
  }

  if (!allowedValues.includes(value as T)) {
    return `${fieldName} must be one of: ${allowedValues.join(', ')}`
  }

  return null
}

/**
 * Validates that a payload is an object (not null or array)
 */
export function validateObject(payload: unknown, name: string = 'Payload'): ValidationError {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return `${name} must be an object`
  }

  return null
}

/**
 * Validates that a value is a valid ISO date string or null
 */
export function validateOptionalDate(value: unknown, fieldName: string): ValidationError {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== 'string') {
    return `${fieldName} must be a string or null`
  }

  const date = new Date(value)
  if (isNaN(date.getTime())) {
    return `${fieldName} must be a valid ISO date string`
  }

  return null
}

/**
 * Validates that a value is a boolean
 */
export function validateBoolean(value: unknown, fieldName: string): ValidationError {
  if (typeof value !== 'boolean') {
    return `${fieldName} must be a boolean`
  }

  return null
}

/**
 * Validates that a record has only allowed string keys and values
 */
export function validateRecord(
  value: unknown,
  fieldName: string
): ValidationError {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return `${fieldName} must be an object`
  }

  // Check all keys and values are valid
  for (const [key, val] of Object.entries(value)) {
    if (typeof key !== 'string') {
      return `${fieldName} keys must be strings`
    }

    // Values can be string, number, boolean, null, or nested objects
    if (val !== null && typeof val === 'object') {
      const nestedError = validateRecord(val, `${fieldName}.${key}`)
      if (nestedError) return nestedError
    } else if (
      typeof val !== 'string' &&
      typeof val !== 'number' &&
      typeof val !== 'boolean' &&
      val !== null
    ) {
      return `${fieldName}.${key} has invalid type`
    }
  }

  return null
}

/**
 * Helper to combine multiple validation errors
 */
export function combineValidationErrors(errors: (ValidationError)[]): ValidationError {
  const validErrors = errors.filter((e): e is string => e !== null)
  return validErrors.length > 0 ? validErrors.join('; ') : null
}
