'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  REPORT_CURRENCIES,
  toReportCurrency,
  type ReportCurrency,
} from '@/lib/morningstar-report';

interface ReportCurrencySelectProps {
  currency: ReportCurrency;
  onChange: (currency: ReportCurrency) => void;
}

export const ReportCurrencySelect: React.FC<ReportCurrencySelectProps> = ({
  currency,
  onChange,
}) => {
  const t = useTranslations('reportCurrency');

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
      <label
        htmlFor="report-currency"
        className="text-sm font-medium text-slate-700"
      >
        {t('label')}
      </label>
      <select
        id="report-currency"
        value={currency}
        onChange={(event) => onChange(toReportCurrency(event.target.value))}
        aria-describedby="report-currency-hint"
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {REPORT_CURRENCIES.map((code) => (
          <option key={code} value={code}>
            {code} · {t(`options.${code}`)}
          </option>
        ))}
      </select>
      <p id="report-currency-hint" className="w-full text-xs text-slate-500">
        {t('hint')}
      </p>
    </div>
  );
};
