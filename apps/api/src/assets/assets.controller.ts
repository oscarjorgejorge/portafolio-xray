import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import {
  ResolveAssetDto,
  ConfirmAssetDto,
  UpdateIsinDto,
  BatchResolveAssetDto,
} from './dto';
import {
  ResolveAssetResponse,
  BatchResolveAssetResponse,
  ResolvedAssetDto,
} from './types';
import { ApiCommonResponses } from '../common/decorators';

@ApiTags('assets')
@Controller('assets')
@ApiCommonResponses()
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post('resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve asset identifier',
    description:
      'Resolves an ISIN, Morningstar ID, or ticker to asset details. First checks the cache, then attempts external resolution if not found.',
  })
  @ApiResponse({
    status: 200,
    description: 'Asset resolved successfully',
    type: ResolveAssetResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  async resolve(@Body() dto: ResolveAssetDto): Promise<ResolveAssetResponse> {
    return this.assetsService.resolve(dto);
  }

  @Post('resolve/batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Batch resolve multiple asset identifiers',
    description:
      'Resolves multiple assets in a single request to reduce N+1 API calls. ' +
      'Optimized with batch cache lookups and parallel processing. Maximum 20 assets per request.',
  })
  @ApiResponse({
    status: 200,
    description: 'Batch resolution completed',
    type: BatchResolveAssetResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  async resolveBatch(
    @Body() dto: BatchResolveAssetDto,
  ): Promise<BatchResolveAssetResponse> {
    return this.assetsService.resolveBatch(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get cached asset by ID',
    description: 'Retrieves an asset from the cache by its internal UUID.',
  })
  @ApiParam({
    name: 'id',
    description: 'Internal asset UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Asset found',
    type: ResolvedAssetDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid UUID format',
  })
  @ApiResponse({
    status: 404,
    description: 'Asset not found',
  })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResolvedAssetDto> {
    return this.assetsService.getById(id);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Confirm/save an asset manually',
    description:
      'Manually confirms and saves an asset to the cache. Use this when automatic resolution fails and you have the correct Morningstar ID.',
  })
  @ApiResponse({
    status: 201,
    description: 'Asset confirmed and saved',
    type: ResolvedAssetDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  async confirm(@Body() dto: ConfirmAssetDto): Promise<ResolvedAssetDto> {
    return this.assetsService.confirm(dto);
  }

  @Patch(':id/isin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update ISIN for an asset',
    description:
      'Manually update the ISIN for an existing asset. Use this when automatic ISIN extraction failed.',
  })
  @ApiParam({
    name: 'id',
    description: 'Internal asset UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'ISIN updated successfully',
    type: ResolvedAssetDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid UUID format or invalid ISIN format',
  })
  @ApiResponse({
    status: 404,
    description: 'Asset not found',
  })
  async updateIsin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIsinDto,
  ): Promise<ResolvedAssetDto> {
    return this.assetsService.updateIsin(id, dto.isin);
  }
}
