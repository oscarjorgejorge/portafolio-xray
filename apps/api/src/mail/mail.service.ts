import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { AppConfig } from '../config';
import {
  getEmailTranslations,
  type SupportedLocale,
} from './translations/email-translations';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly frontendUrl: string;
  private readonly isConfigured: boolean;
  private readonly templateVerificationId: string;
  private readonly templatePasswordResetId: string;
  private readonly templateContactId: string;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const emailConfig = this.configService.get('email', { infer: true });
    this.from = emailConfig.from;
    this.frontendUrl = this.configService.get('frontendUrl', { infer: true });
    this.templateVerificationId = emailConfig.templateVerificationId;
    this.templatePasswordResetId = emailConfig.templatePasswordResetId;
    this.templateContactId = emailConfig.templateContactId;

    if (emailConfig.resendApiKey) {
      this.resend = new Resend(emailConfig.resendApiKey);
      this.isConfigured = true;
      this.logger.log('Mail service initialized with Resend');
    } else {
      this.resend = null;
      this.isConfigured = false;
      this.logger.warn('Mail service not configured - RESEND_API_KEY not set');
    }
  }

  /**
   * Check if mail service is properly configured
   */
  isEnabled(): boolean {
    return this.isConfigured;
  }

  /**
   * Send a generic email
   */
  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn(
        `Mail not sent (service not configured): ${options.subject} to ${options.to}`,
      );
      return false;
    }

    try {
      const result = await this.resend.emails.send({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      if (result.error) {
        this.logger.error(`Failed to send email: ${result.error.message}`);
        return false;
      }

      this.logger.log(
        `Email sent successfully to ${options.to}: ${options.subject}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error sending email to ${options.to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  /**
   * Send email verification link using Resend template
   */
  async sendVerificationEmail(
    email: string,
    token: string,
    locale: SupportedLocale = 'es',
  ): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn(
        `Mail not sent (service not configured): verification email to ${email}`,
      );
      return false;
    }

    // Ensure locale is valid, default to 'es' if not
    const validLocale = locale === 'es' || locale === 'en' ? locale : 'es';
    const verifyUrl = `${this.frontendUrl}/${validLocale}/verify-email?token=${token}`;
    const translations = getEmailTranslations(validLocale, 'verification');

    // Log the URL being sent for debugging
    this.logger.log(
      `[EMAIL DEBUG] Received locale: "${locale}", Valid locale: "${validLocale}", Generated URL: ${verifyUrl}`,
    );

    try {
      const result = await this.resend.emails.send({
        from: this.from,
        to: email,
        template: {
          id: this.templateVerificationId,
          variables: {
            subject: translations.subject,
            greeting: translations.greeting,
            body: translations.body,
            buttonText: translations.buttonText,
            linkFallback: translations.linkFallback,
            verifyUrl: verifyUrl,
            expiryNotice: translations.expiryNotice,
            footer: translations.footer,
          },
        },
      });

      if (result.error) {
        this.logger.error(
          `Failed to send verification email: ${result.error.message}`,
        );
        return false;
      }

      this.logger.log(
        `Verification email sent successfully to ${email} (locale: ${validLocale}, URL: ${verifyUrl})`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error sending verification email to ${email}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return false;
    }
  }

  /**
   * Send password reset link using Resend template
   */
  async sendPasswordResetEmail(
    email: string,
    token: string,
    locale: SupportedLocale = 'es',
  ): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn(
        `Mail not sent (service not configured): password reset email to ${email}`,
      );
      return false;
    }

    // Ensure locale is valid, default to 'es' if not
    const validLocale = locale === 'es' || locale === 'en' ? locale : 'es';
    const resetUrl = `${this.frontendUrl}/${validLocale}/reset-password?token=${token}`;
    const translations = getEmailTranslations(validLocale, 'passwordReset');

    try {
      const result = await this.resend.emails.send({
        from: this.from,
        to: email,
        template: {
          id: this.templatePasswordResetId,
          variables: {
            subject: translations.subject,
            greeting: translations.greeting,
            body: translations.body,
            buttonText: translations.buttonText,
            linkFallback: translations.linkFallback,
            resetUrl: resetUrl,
            expiryNotice: translations.expiryNotice,
            footer: translations.footer,
          },
        },
      });

      if (result.error) {
        this.logger.error(
          `Failed to send password reset email: ${result.error.message}`,
        );
        return false;
      }

      this.logger.log(
        `Password reset email sent successfully to ${email} (locale: ${validLocale})`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error sending password reset email to ${email}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return false;
    }
  }

  /**
   * Send contact form notification using Resend template
   */
  async sendContactEmail(
    to: string,
    name: string,
    email: string,
    subject: string,
    message: string,
  ): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn(
        `Mail not sent (service not configured): contact email to ${to}`,
      );
      return false;
    }

    try {
      const result = await this.resend.emails.send({
        from: this.from,
        to,
        subject: `[Contacto] ${subject}`,
        template: {
          id: this.templateContactId,
          variables: {
            name,
            email,
            subject,
            message,
          },
        },
      });

      if (result.error) {
        this.logger.error(
          `Failed to send contact email: ${result.error.message}`,
        );
        return false;
      }

      this.logger.log(
        `Contact email sent successfully to ${to}: ${subject}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error sending contact email to ${to}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return false;
    }
  }
}
