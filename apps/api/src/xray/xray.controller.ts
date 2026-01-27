import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { XRayService } from './xray.service';
import { GenerateXRayDto } from './dto';
import { GenerateXRayResponse } from './types';
import { ApiCommonResponses } from '../common/decorators';

@ApiTags('xray')
@Controller('xray')
@ApiCommonResponses()
export class XRayController {
  constructor(private readonly xrayService: XRayService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate Morningstar X-Ray URL',
    description:
      'Generates a Morningstar X-Ray PDF URL from a portfolio of assets. The total weight of all assets must equal 100%. Each morningstarId must be unique.',
  })
  @ApiResponse({
    status: 200,
    description: 'X-Ray URL generated successfully',
    type: GenerateXRayResponse,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid input - total weight must equal 100% or duplicate morningstarId found',
  })
  async generate(@Body() dto: GenerateXRayDto): Promise<GenerateXRayResponse> {
    return this.xrayService.generate(dto);
  }
}
