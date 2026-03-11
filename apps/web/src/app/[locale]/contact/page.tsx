'use client';

import { useState } from 'react';
import type React from 'react';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { sendContactMessage, type ContactRequest, ApiError } from '@/lib/api';
import { isValidEmail } from '@/lib/utils';

type Status = 'idle' | 'success' | 'error';

export default function ContactPage() {
  const t = useTranslations('contact');
  const tCommon = useTranslations('common');
  const tValidation = useTranslations('validation');

  const [form, setForm] = useState<ContactRequest>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ContactRequest, string>>>({});

  const handleChange =
    (field: keyof ContactRequest) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
      if (fieldErrors[field]) {
        setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('idle');
    setErrorMessage(null);

    const errors: Partial<Record<keyof ContactRequest, string>> = {};
    if (!form.name.trim()) errors.name = tValidation('fieldRequired');
    if (!form.email.trim()) errors.email = tValidation('fieldRequired');
    else if (!isValidEmail(form.email)) errors.email = tValidation('emailInvalid');
    if (!form.subject.trim()) errors.subject = tValidation('fieldRequired');
    if (!form.message.trim()) errors.message = tValidation('fieldRequired');

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await sendContactMessage(form);
      setStatus('success');
      setForm({
        name: '',
        email: '',
        subject: '',
        message: '',
      });
    } catch (error) {
      setStatus('error');
      if (error instanceof ApiError && error.message) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('errorGeneric'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 lg:py-10">
      <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
        {t('title')}
      </h1>
      <p className="text-gray-600 mb-6">
        {t('description')}
      </p>

      <section className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-1">
          {t('emailLabel')}
        </h2>
        <a
          href={`mailto:${t('emailValue')}`}
          className="text-sm text-blue-600 hover:text-blue-500 hover:underline break-all"
        >
          {t('emailValue')}
        </a>
      </section>

      {status === 'success' && (
        <div className="mb-4">
          <Alert variant="success">{t('successMessage')}</Alert>
        </div>
      )}
      {status === 'error' && (
        <div className="mb-4">
          <Alert variant="error">
            {errorMessage ?? t('errorGeneric')}
          </Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={t('nameLabel')}
            value={form.name}
            onChange={handleChange('name')}
            error={fieldErrors.name}
            required
          />
          <Input
            label={t('emailLabel')}
            type="email"
            value={form.email}
            onChange={handleChange('email')}
            error={fieldErrors.email}
            required
          />
        </div>

        <Input
          label={t('subjectLabel')}
          value={form.subject}
          onChange={handleChange('subject')}
          error={fieldErrors.subject}
          required
        />

        <div>
          <label
            htmlFor="contact-message"
            className="block text-sm font-medium text-muted-foreground mb-1"
          >
            {t('messageLabel')}
          </label>
          <textarea
            id="contact-message"
            className={`w-full min-h-[140px] px-3 py-2 border rounded-lg text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
              fieldErrors.message ? 'border-red-500' : 'border-border'
            }`}
            value={form.message}
            onChange={handleChange('message')}
            required
            aria-invalid={Boolean(fieldErrors.message)}
            aria-describedby={fieldErrors.message ? 'contact-message-error' : undefined}
          />
          {fieldErrors.message && (
            <p id="contact-message-error" className="mt-1 text-sm text-red-600" role="alert">
              {fieldErrors.message}
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="submit" isLoading={isSubmitting}>
            {isSubmitting ? tCommon('loading') : t('submitLabel')}
          </Button>
        </div>
      </form>
    </div>
  );
}

