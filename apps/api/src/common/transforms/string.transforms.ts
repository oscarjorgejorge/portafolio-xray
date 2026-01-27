import { TransformFnParams } from 'class-transformer';

/**
 * Common string transformation functions for DTOs.
 * Use with @Transform decorator from class-transformer.
 *
 * @example
 * ```typescript
 * import { Transform } from 'class-transformer';
 * import { trimUppercase, trimString } from '../common/transforms';
 *
 * export class MyDto {
 *   @Transform(trimUppercase)
 *   isin: string;
 *
 *   @Transform(trimString)
 *   name: string;
 * }
 * ```
 */

/**
 * Trims whitespace and converts string to uppercase.
 * Use for identifiers like ISIN, Morningstar ID, ticker symbols.
 */
export const trimUppercase = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/**
 * Trims whitespace from string.
 * Use for names, URLs, and other text that shouldn't be uppercased.
 */
export const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;
