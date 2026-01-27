import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('root')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Root endpoint',
    description: 'Returns a welcome message',
  })
  @ApiResponse({
    status: 200,
    description: 'Welcome message',
    schema: { type: 'string', example: 'Portfolio X-Ray API v1.0.0' },
  })
  getHello(): string {
    return this.appService.getHello();
  }
}
