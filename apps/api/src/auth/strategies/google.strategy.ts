import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { AppConfig } from '../../config';

export interface GoogleUser {
  email: string;
  name: string;
  avatarUrl: string | null;
  googleId: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const googleConfig = configService.get('google', { infer: true });

    super({
      clientID: googleConfig.clientId || '',
      clientSecret: googleConfig.clientSecret || '',
      callbackURL: googleConfig.callbackUrl || '',
      scope: ['email', 'profile'],
    });
  }

  /**
   * Validate Google OAuth callback and extract user info
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const { id, emails, displayName, photos } = profile;

      // Validate that we have required data
      if (!id) {
        return done(new Error('Google profile missing ID'), false);
      }

      const email = emails?.[0]?.value;
      if (!email) {
        return done(new Error('Google profile missing email'), false);
      }

      const user: GoogleUser = {
        email,
        name: displayName || '',
        avatarUrl: photos?.[0]?.value || null,
        googleId: id,
      };

      done(null, user);
    } catch (error) {
      done(
        error instanceof Error
          ? error
          : new Error('Failed to validate Google profile'),
        false,
      );
    }
  }
}
