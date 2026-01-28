import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/**
 * Custom validator that ensures all items in an array have unique values
 * for a specified property.
 *
 * @param property - The property name to check for uniqueness
 * @param validationOptions - Optional validation options
 *
 * @example
 * ```typescript
 * class PortfolioDto {
 *   @HasUniqueProperty('morningstarId')
 *   assets: AssetDto[];
 * }
 * ```
 */
export function HasUniqueProperty(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'hasUniqueProperty',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (!Array.isArray(value)) {
            return true; // Let other validators handle non-array cases
          }

          const [propertyToCheck] = args.constraints as [string];
          const values = value.map(
            (item: Record<string, unknown>) => item[propertyToCheck],
          );
          const uniqueValues = new Set(values);

          return values.length === uniqueValues.size;
        },

        defaultMessage(args: ValidationArguments): string {
          const [propertyToCheck] = args.constraints as [string];
          return `All items in ${args.property} must have unique ${propertyToCheck} values`;
        },
      },
    });
  };
}
