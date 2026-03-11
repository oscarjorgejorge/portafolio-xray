import { Module } from '@nestjs/common';
import { ConfigModule } from '../config';
import { MailModule } from '../mail/mail.module';
import { ContactController } from './contact.controller';

@Module({
  imports: [ConfigModule, MailModule],
  controllers: [ContactController],
})
export class ContactModule {}
