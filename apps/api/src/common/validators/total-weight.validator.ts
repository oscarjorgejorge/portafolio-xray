import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { WEIGHT_VALIDATION } from '../constants';

/**
 * Interface for items that have a weight property
 */
interface WeightedItem {
  weight: number;
}

/**
 * Custom validator that ensures the total weight of all items in an array
 * equals 100% (within a small tolerance for floating point comparison).
 *
 * @param validationOptions - Optional validation options
 *
 * @example
 * ```typescript
 * class PortfolioDto {
 *   @HasTotalWeight100()
 *   assets: AssetDto[];
 * }
 * ```
 */
export function HasTotalWeight100(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'hasTotalWeight100',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (!Array.isArray(value)) {
            return true; // Let other validators handle non-array cases
          }

          const items = value as WeightedItem[];
          const totalWeight = items.reduce(
            (sum, item) => sum + (item.weight || 0),
            0,
          );

          return (
            Math.abs(totalWeight - WEIGHT_VALIDATION.TARGET_TOTAL) <=
            WEIGHT_VALIDATION.TOLERANCE
          );
        },

        defaultMessage(args: ValidationArguments): string {
          if (!Array.isArray(args.value)) {
            return `${args.property} must be an array`;
          }

          const items = args.value as WeightedItem[];
          const totalWeight = items.reduce(
            (sum, item) => sum + (item.weight || 0),
            0,
          );

          return `Total weight must equal ${WEIGHT_VALIDATION.TARGET_TOTAL}%. Current total: ${totalWeight.toFixed(2)}%`;
        },
      },
    });
  };
}
