import { ApiProperty } from '@nestjs/swagger';
import { ResolveAssetResponse } from './resolve-asset-response.type';

/**
 * Individual result within a batch resolution response
 */
export class BatchResolveResultItem {
  @ApiProperty({
    description: 'Original input that was resolved',
    example: 'IE00B4L5Y983',
  })
  input!: string;

  @ApiProperty({
    description: 'Resolution result for this input',
    type: ResolveAssetResponse,
  })
  result!: ResolveAssetResponse;
}

/**
 * Response DTO for batch asset resolution
 */
export class BatchResolveAssetResponse {
  @ApiProperty({
    description: 'Total number of assets requested',
    example: 5,
  })
  total!: number;

  @ApiProperty({
    description:
      'Number of assets successfully resolved (from cache or external)',
    example: 4,
  })
  resolved!: number;

  @ApiProperty({
    description: 'Number of assets that need manual intervention',
    example: 1,
  })
  manualRequired!: number;

  @ApiProperty({
    description: 'Individual results for each input',
    type: [BatchResolveResultItem],
  })
  results!: BatchResolveResultItem[];
}
