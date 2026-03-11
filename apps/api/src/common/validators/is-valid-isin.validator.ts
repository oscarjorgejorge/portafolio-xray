import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { IdentifierClassifier } from '../utils/identifier-classifier';

/**
 * Custom validator constraint for ISIN validation
 * Uses ISO 6166 Luhn algorithm checksum validation
 */
@ValidatorConstraint({ name: 'isValidIsin', async: false })
export class IsValidIsinConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    // undefined/null are not valid ISINs; optionality is handled by @IsOptional() which skips this validator
    if (value === undefined || value === null) {
      return false;
    }
    if (typeof value !== 'string') {
      return false;
    }
    return IdentifierClassifier.validateISINChecksum(value);
  }

  defaultMessage(): string {
    return 'Invalid ISIN format or checksum. ISIN must be 2 letters followed by 10 alphanumeric characters with a valid check digit.';
  }
}

/**
 * Decorator for validating ISIN codes
 *
 * Validates both format (2 letters + 10 alphanumeric) and checksum (ISO 6166 Luhn algorithm).
 * This helps reject garbage values that might pass simple format checks but aren't real ISINs.
 *
 * @param validationOptions - Optional validation options
 *
 * @example
 * ```typescript
 * class MyDto {
 *   @IsValidIsin()
 *   isin: string;
 * }
 * ```
 */
export function IsValidIsin(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'isValidIsin',
      target: object.constructor,
      propertyName: String(propertyName),
      options: validationOptions,
      constraints: [],
      validator: IsValidIsinConstraint,
    });
  };
}
