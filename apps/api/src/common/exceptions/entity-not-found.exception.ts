import { NotFoundException } from '@nestjs/common';

/**
 * Domain exception for entity not found errors
 * Extends NestJS NotFoundException for seamless HTTP handling
 *
 * Usage in repositories:
 * ```typescript
 * throw new EntityNotFoundException('Asset', id);
 * // Results in: "Asset with id "123" not found"
 * ```
 *
 * This exception:
 * - Provides consistent error messages across all repositories
 * - Is automatically handled by NestJS (returns 404)
 * - Can be caught and re-thrown with additional context if needed
 */
export class EntityNotFoundException extends NotFoundException {
  constructor(entityName: string, identifier: string, identifierField = 'id') {
    super(`${entityName} with ${identifierField} "${identifier}" not found`);
    this.name = 'EntityNotFoundException';
  }
}
