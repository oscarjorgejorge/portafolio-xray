import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config';
import { MailService } from '../mail/mail.service';
import { Public } from '../auth/decorators/public.decorator';
import { ApiCommonResponses } from '../common/decorators';
import { ContactDto } from './contact.dto';

@ApiTags('contact')
@Controller('contact')
@ApiCommonResponses()
export class ContactController {
  constructor(
    private readonly mailService: MailService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Send contact message',
    description:
      'Sends a contact form message to the configured contact email address.',
  })
  @ApiResponse({
    status: 204,
    description: 'Message sent successfully',
  })
  async send(@Body() dto: ContactDto): Promise<void> {
    const emailConfig = this.configService.get('email', { infer: true });
    const to = emailConfig.contactEmail;

    const sent = await this.mailService.sendContactEmail(
      to,
      dto.name,
      dto.email,
      dto.subject,
      dto.message,
    );

    if (!sent) {
      throw new InternalServerErrorException(
        'Unable to send contact message. Please try again later.',
      );
    }
  }
}
