import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

/**
 * Applies common API error responses that can occur on any endpoint.
 * Use this decorator at the controller level to document common errors.
 *
 * Includes:
 * - 429: Too Many Requests (rate limiting)
 * - 500: Internal Server Error
 *
 * @example
 * ```typescript
 * @ApiTags('assets')
 * @Controller('assets')
 * @ApiCommonResponses()
 * export class AssetsController { }
 * ```
 */
export function ApiCommonResponses() {
  return applyDecorators(
    ApiResponse({
      status: 429,
      description: 'Too many requests - rate limit exceeded',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          statusCode: { type: 'number', example: 429 },
          error: { type: 'string', example: 'Too Many Requests' },
          message: {
            type: 'string',
            example:
              'ThrottlerException: Too many requests. Please try again later.',
          },
          path: { type: 'string', example: '/assets/resolve' },
          timestamp: {
            type: 'string',
            example: '2026-01-27T10:30:00.000Z',
          },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          statusCode: { type: 'number', example: 500 },
          error: { type: 'string', example: 'Internal Server Error' },
          message: {
            type: 'string',
            example: 'An unexpected error occurred. Please try again later.',
          },
          path: { type: 'string', example: '/assets/resolve' },
          timestamp: {
            type: 'string',
            example: '2026-01-27T10:30:00.000Z',
          },
          requestId: { type: 'string', example: 'abc-123-def' },
        },
      },
    }),
  );
}
