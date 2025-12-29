import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { XRayService } from './xray.service';
import type { GenerateXRayResponse } from './xray.service';
import { GenerateXRayDto } from './dto';

@ApiTags('xray')
@Controller('xray')
export class XRayController {
  constructor(private readonly xrayService: XRayService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate Morningstar X-Ray URL',
    description:
      'Generates a Morningstar X-Ray PDF URL from a portfolio of assets. The total weight of all assets must equal 100%.',
  })
  @ApiResponse({
    status: 200,
    description: 'X-Ray URL generated successfully',
    schema: {
      type: 'object',
      properties: {
        morningstarUrl: {
          type: 'string',
          description: 'Direct URL to Morningstar X-Ray PDF',
          example:
            'https://lt.morningstar.com/j2uwuwirpv/xray/default.aspx?PortfolioType=2&values=0P0000YXJO|40|F00000THA5|30|0P000168Z7|30',
        },
        shareableUrl: {
          type: 'string',
          description: 'Shareable app URL with portfolio encoded',
          example: '/xray?assets=0P0000YXJO:40,F00000THA5:30,0P000168Z7:30',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input - total weight must equal 100%',
  })
  generate(@Body() dto: GenerateXRayDto): GenerateXRayResponse {
    return this.xrayService.generate(dto);
  }
}

