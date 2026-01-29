import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { AppConfig } from '../config';

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

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const emailConfig = this.configService.get('email', { infer: true });
    this.from = emailConfig.from;
    this.frontendUrl = this.configService.get('frontendUrl', { infer: true });

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
   * Send email verification link
   */
  async sendVerificationEmail(email: string, token: string): Promise<boolean> {
    const verifyUrl = `${this.frontendUrl}/verify-email?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify your email</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">Portfolio X-Ray</h1>
          </div>
          
          <h2 style="color: #1f2937;">Verify your email address</h2>
          
          <p>Thank you for signing up! Please click the button below to verify your email address:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" 
               style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Verify Email
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:
            <br>
            <a href="${verifyUrl}" style="color: #2563eb; word-break: break-all;">${verifyUrl}</a>
          </p>
          
          <p style="color: #6b7280; font-size: 14px;">
            This link will expire in 24 hours.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            If you didn't create an account, you can safely ignore this email.
          </p>
        </body>
      </html>
    `;

    const text = `
Verify your email address

Thank you for signing up for Portfolio X-Ray! Please verify your email by visiting the following link:

${verifyUrl}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.
    `.trim();

    return this.sendEmail({
      to: email,
      subject: 'Verify your email - Portfolio X-Ray',
      html,
      text,
    });
  }

  /**
   * Send password reset link
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset your password</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">Portfolio X-Ray</h1>
          </div>
          
          <h2 style="color: #1f2937;">Reset your password</h2>
          
          <p>We received a request to reset your password. Click the button below to choose a new password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:
            <br>
            <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
          </p>
          
          <p style="color: #6b7280; font-size: 14px;">
            This link will expire in 1 hour.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            If you didn't request a password reset, you can safely ignore this email.
            Your password will remain unchanged.
          </p>
        </body>
      </html>
    `;

    const text = `
Reset your password

We received a request to reset your password for Portfolio X-Ray. Visit the following link to choose a new password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
    `.trim();

    return this.sendEmail({
      to: email,
      subject: 'Reset your password - Portfolio X-Ray',
      html,
      text,
    });
  }
}
