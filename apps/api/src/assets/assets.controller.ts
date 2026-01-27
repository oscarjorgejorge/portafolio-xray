import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { ResolveAssetDto, ConfirmAssetDto, UpdateIsinDto } from './dto';
import type { Asset } from '@prisma/client';
import type { ResolveAssetResponse } from './interfaces';

@ApiTags('assets')
@Controller('assets')
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
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        source: {
          type: 'string',
          enum: ['cache', 'resolved', 'manual_required'],
          example: 'cache',
        },
        asset: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'uuid' },
            isin: { type: 'string', example: 'IE00B4L5Y983' },
            morningstarId: { type: 'string', example: '0P0000YXJO' },
            name: {
              type: 'string',
              example: 'iShares Core MSCI World UCITS ETF',
            },
            type: { type: 'string', enum: ['ETF', 'FUND', 'STOCK', 'ETC'] },
          },
        },
      },
    },
  })
  async resolve(@Body() dto: ResolveAssetDto): Promise<ResolveAssetResponse> {
    return this.assetsService.resolve(dto);
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
  })
  @ApiResponse({
    status: 404,
    description: 'Asset not found',
  })
  async getById(@Param('id') id: string): Promise<Asset> {
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
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  async confirm(@Body() dto: ConfirmAssetDto): Promise<Asset> {
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
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid ISIN format',
  })
  @ApiResponse({
    status: 404,
    description: 'Asset not found',
  })
  async updateIsin(
    @Param('id') id: string,
    @Body() dto: UpdateIsinDto,
  ): Promise<Asset> {
    return this.assetsService.updateIsin(id, dto.isin);
  }
}
