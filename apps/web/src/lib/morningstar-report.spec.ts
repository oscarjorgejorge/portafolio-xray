import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openMorningstarReport, toReportCurrency } from './morningstar-report';

describe('toReportCurrency', () => {
  it('accepts supported codes in any case', () => {
    expect(toReportCurrency('NOK')).toBe('NOK');
    expect(toReportCurrency(' usd ')).toBe('USD');
  });

  it('falls back to EUR for missing or unknown values', () => {
    expect(toReportCurrency(null)).toBe('EUR');
    expect(toReportCurrency(undefined)).toBe('EUR');
    expect(toReportCurrency('XYZ')).toBe('EUR');
  });
});

describe('openMorningstarReport', () => {
  let submitted: HTMLFormElement | null;

  beforeEach(() => {
    document.body.innerHTML = '';
    submitted = null;
    window.open = vi.fn();
    vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function (
      this: HTMLFormElement,
    ) {
      submitted = this;
    });
  });

  it('opens a short fund URL with GET', () => {
    openMorningstarReport(
      'https://lt.morningstar.com/j2uwuwirpv/xraypdf/default.aspx?LanguageId=es-ES&securityIds=F00000THA5%7C&typeids=FO%7C',
    );

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('securityIds='),
      '_blank',
      'noopener,noreferrer',
    );
    expect(document.querySelector('form')).toBeNull();
  });

  it('posts SecurityTokenList fields instead of navigating the long query', () => {
    openMorningstarReport(
      'https://lt.morningstar.com/j2uwuwirpv/xraypdf/default.aspx?LanguageId=es-ES&PortfolioType=2&SecurityTokenList=F00000THA5%5D2%5D0%5DFOESP%24%24ALL_1340%7C0P000003RE%5D3%5D0%5DE0WWE%24%24ALL_1340&values=5000%7C5000',
    );

    expect(window.open).not.toHaveBeenCalled();
    const form = submitted;
    expect(form).not.toBeNull();
    expect(form?.method).toBe('post');
    expect(form?.action).toBe(
      'https://lt.morningstar.com/j2uwuwirpv/xraypdf/default.aspx?LanguageId=es-ES',
    );
    expect(form?.target).toBe('_blank');

    const fields = Object.fromEntries(
      [...form!.querySelectorAll('input')].map((input) => [
        input.name,
        input.value,
      ]),
    );
    expect(fields.LanguageId).toBe('es-ES');
    expect(fields.PortfolioType).toBe('2');
    expect(fields.SecurityTokenList).toBe(
      'F00000THA5]2]0]FOESP$$ALL_1340|0P000003RE]3]0]E0WWE$$ALL_1340',
    );
    expect(fields.values).toBe('5000|5000');
    expect(HTMLFormElement.prototype.submit).toHaveBeenCalled();
  });

  it('rewrites a stored Spanish report to English before opening it', () => {
    openMorningstarReport(
      'https://lt.morningstar.com/j2uwuwirpv/xraypdf/default.aspx?LanguageId=es-ES&securityIds=F00000THA5%7C&typeids=FO%7C',
      'en',
    );

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('LanguageId=en-GB'),
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('posts the English language on a stock token report', () => {
    openMorningstarReport(
      'https://lt.morningstar.com/j2uwuwirpv/xraypdf/default.aspx?LanguageId=es-ES&PortfolioType=2&SecurityTokenList=0P000003RE%5D3%5D0%5DE0WWE%24%24ALL_1340&values=10000',
      'en',
    );

    const fields = Object.fromEntries(
      [...submitted!.querySelectorAll('input')].map((input) => [
        input.name,
        input.value,
      ]),
    );
    expect(submitted?.action).toContain('LanguageId=en-GB');
    expect(fields.LanguageId).toBe('en-GB');
    expect(fields.SecurityTokenList).toContain('0P000003RE]3]0]E0WWE$$ALL_1340');
  });

  it('keeps the report currency on a posted stock token report', () => {
    openMorningstarReport(
      'https://lt.morningstar.com/j2uwuwirpv/xraypdf/default.aspx?LanguageId=es-ES&CurrencyId=NOK&PortfolioType=2&SecurityTokenList=0P000003RE%5D3%5D0%5DE0WWE%24%24ALL_1340&values=10000',
    );

    expect(submitted?.action).toBe(
      'https://lt.morningstar.com/j2uwuwirpv/xraypdf/default.aspx?LanguageId=es-ES&CurrencyId=NOK',
    );
  });

  it('keeps the report currency when switching a short URL language', () => {
    openMorningstarReport(
      'https://lt.morningstar.com/j2uwuwirpv/xraypdf/default.aspx?LanguageId=es-ES&CurrencyId=NOK&securityIds=F000011IM4%7C&typeids=FO%7C',
      'en',
    );

    const opened = vi.mocked(window.open).mock.calls[0][0] as string;
    expect(opened).toContain('LanguageId=en-GB');
    expect(opened).toContain('CurrencyId=NOK');
  });
});
