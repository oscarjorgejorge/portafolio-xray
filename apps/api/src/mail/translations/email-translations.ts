/**
 * Email translations for multi-language support
 * Used to populate Resend email templates with localized content
 */
export const emailTranslations = {
  en: {
    verification: {
      subject: 'Verify your email - Portfolio X-Ray',
      greeting: 'Verify your email address',
      body: 'Thank you for signing up! Please click the button below to verify your email address:',
      buttonText: 'Verify Email',
      linkFallback:
        "If the button doesn't work, copy and paste this link into your browser:",
      expiryNotice: 'This link will expire in 24 hours.',
      footer:
        "If you didn't create an account, you can safely ignore this email.",
    },
    passwordReset: {
      subject: 'Reset your password - Portfolio X-Ray',
      greeting: 'Reset your password',
      body: 'We received a request to reset your password. Click the button below to choose a new password:',
      buttonText: 'Reset Password',
      linkFallback:
        "If the button doesn't work, copy and paste this link into your browser:",
      expiryNotice: 'This link will expire in 1 hour.',
      footer:
        "If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.",
    },
  },
  es: {
    verification: {
      subject: 'Verifica tu correo electrónico - Portfolio X-Ray',
      greeting: 'Verifica tu dirección de correo electrónico',
      body: '¡Gracias por registrarte! Por favor, haz clic en el botón de abajo para verificar tu dirección de correo electrónico:',
      buttonText: 'Verificar Correo',
      linkFallback:
        'Si el botón no funciona, copia y pega este enlace en tu navegador:',
      expiryNotice: 'Este enlace expirará en 24 horas.',
      footer:
        'Si no creaste una cuenta, puedes ignorar este correo de forma segura.',
    },
    passwordReset: {
      subject: 'Restablece tu contraseña - Portfolio X-Ray',
      greeting: 'Restablece tu contraseña',
      body: 'Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para elegir una nueva contraseña:',
      buttonText: 'Restablecer Contraseña',
      linkFallback:
        'Si el botón no funciona, copia y pega este enlace en tu navegador:',
      expiryNotice: 'Este enlace expirará en 1 hora.',
      footer:
        'Si no solicitaste un restablecimiento de contraseña, puedes ignorar este correo de forma segura. Tu contraseña permanecerá sin cambios.',
    },
  },
} as const;

export type SupportedLocale = keyof typeof emailTranslations;
export type EmailType = 'verification' | 'passwordReset';

/**
 * Get email translations for a specific locale and email type
 */
export function getEmailTranslations(
  locale: SupportedLocale,
  type: EmailType,
): typeof emailTranslations.en.verification {
  const translations =
    emailTranslations[locale]?.[type] || emailTranslations.en[type];
  return translations as typeof emailTranslations.en.verification;
}

/**
 * Normalize locale string to supported locale
 * Defaults to 'es' if locale is not supported
 */
export function normalizeLocale(locale?: string): SupportedLocale {
  if (locale === 'en' || locale === 'es') {
    return locale;
  }
  // Default to Spanish as per frontend configuration
  return 'es';
}
