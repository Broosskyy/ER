export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function createValidationResult(
  errors: string[] = [],
  warnings: string[] = [],
): ValidationResult {
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function mergeValidationResults(results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap((result) => result.errors);
  const warnings = results.flatMap((result) => result.warnings);

  return createValidationResult(errors, warnings);
}
