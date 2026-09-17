import { getTranslations } from 'next-intl/server';
import {
  Callout,
  FaqItem,
  InsightCard,
  SeoButtonLink,
  seoRichLinks,
} from './SeoLanding';
import {
  ChartIcon,
  CheckIcon,
  GlobeIcon,
  LockIcon,
  SparklesIcon,
  TrendingIcon,
  WalletIcon,
} from './SeoIcons';

export async function WhatIsXrayContent() {
  const t = await getTranslations('seoWhatIs');

  return (
    <div className="text-foreground">
      <section className="relative overflow-hidden border-b border-border bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:px-8 lg:py-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[.14em] text-slate-600">
              <SparklesIcon />
              {t('eyebrow')}
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              {t.rich('h1', {
                highlight: (chunks) => (
                  <span className="text-primary">{chunks}</span>
                ),
              })}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              {t('intro1')}
            </p>
            <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
              {t.rich('intro2', seoRichLinks)}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <SeoButtonLink href="/">{t('heroCta')}</SeoButtonLink>
              <SeoButtonLink href="/como-funciona" variant="secondary">
                {t('heroSecondary')}
              </SeoButtonLink>
            </div>
            <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <LockIcon />
              {t('heroFree')}
            </p>
          </div>

          <div className="relative">
            <div className="absolute -inset-5 rounded-[2rem] bg-slate-200/70 blur-2xl" />
            <div className="relative rounded-2xl border border-border bg-card p-5 shadow-xl shadow-slate-900/10">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    {t('mockEyebrow')}
                  </p>
                  <p className="mt-1 font-semibold">{t('mockTitle')}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  {t('mockBadge')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 py-5">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-muted-foreground">{t('mockEquity')}</p>
                  <p className="mt-2 text-2xl font-semibold">72.4%</p>
                  <div className="mt-3 h-2 rounded-full bg-slate-200">
                    <div className="h-2 w-[72%] rounded-full bg-primary" />
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-muted-foreground">
                    {t('mockDiversification')}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {t('mockDiversificationValue')}
                  </p>
                  <div className="mt-3 flex gap-1">
                    <span className="h-2 flex-1 rounded-full bg-slate-800" />
                    <span className="h-2 flex-1 rounded-full bg-primary" />
                    <span className="h-2 flex-1 rounded-full bg-sky-300" />
                    <span className="h-2 flex-1 rounded-full bg-slate-200" />
                  </div>
                </div>
              </div>
              <div className="space-y-3 border-t border-border pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('mockUs')}</span>
                  <span className="font-semibold">{t('mockUsValue')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('mockEu')}</span>
                  <span className="font-semibold">{t('mockEuValue')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('mockAsia')}</span>
                  <span className="font-semibold">{t('mockAsiaValue')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight">{t('whoTitle')}</h2>
        <p className="mt-4 leading-7 text-muted-foreground">{t('whoBody')}</p>
      </section>

      <section className="bg-slate-900 text-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[.8fr_1.2fr] lg:px-8 lg:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-sky-200">
              {t('questionsEyebrow')}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              {t('includesTitle')}
            </h2>
            <p className="mt-4 leading-7 text-slate-200">{t('includesLead')}</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {[t('question1'), t('question2'), t('question3'), t('question4')].map(
              (question) => (
                <div key={question} className="flex gap-3 border-t border-white/15 pt-4">
                  <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-sky-200" />
                  <p className="text-lg text-slate-100">{question}</p>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InsightCard
            icon={<ChartIcon />}
            title={t('cardAllocationTitle')}
            text={t('cardAllocationText')}
          />
          <InsightCard
            icon={<GlobeIcon />}
            title={t('cardGeoTitle')}
            text={t('cardGeoText')}
          />
          <InsightCard
            icon={<TrendingIcon />}
            title={t('cardRiskTitle')}
            text={t('cardRiskText')}
          />
          <InsightCard
            icon={<WalletIcon />}
            title={t('cardHoldingsTitle')}
            text={t('cardHoldingsText')}
          />
        </div>

        <div className="mx-auto mt-16 max-w-3xl space-y-10">
          <div>
            <h3 className="text-xl font-semibold">{t('allocationTitle')}</h3>
            <p className="mt-3 leading-7 text-muted-foreground">{t('allocationBody')}</p>
          </div>
          <div>
            <h3 className="text-xl font-semibold">{t('geoTitle')}</h3>
            <p className="mt-3 leading-7 text-muted-foreground">{t('geoBody')}</p>
          </div>
          <div>
            <h3 className="text-xl font-semibold">{t('sectorsTitle')}</h3>
            <p className="mt-3 leading-7 text-muted-foreground">{t('sectorsBody')}</p>
          </div>
          <div>
            <h3 className="text-xl font-semibold">{t('styleTitle')}</h3>
            <p className="mt-3 leading-7 text-muted-foreground">{t('styleBody')}</p>
          </div>
          <div>
            <h3 className="text-xl font-semibold">{t('top10Title')}</h3>
            <p className="mt-3 leading-7 text-muted-foreground">{t('top10Body')}</p>
          </div>
          <div>
            <h3 className="text-xl font-semibold">{t('performanceTitle')}</h3>
            <p className="mt-3 leading-7 text-muted-foreground">{t('performanceLead')}</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-muted-foreground">
              <li>{t('performance1')}</li>
              <li>{t('performance2')}</li>
              <li>{t('performance3')}</li>
              <li>{t('performance4')}</li>
              <li>{t('performance5')}</li>
              <li>{t('performance6')}</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight">{t('unsupportedTitle')}</h2>
          <p className="mt-4 leading-7 text-muted-foreground">{t('unsupportedLead')}</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-muted-foreground">
            <li>{t('unsupported1')}</li>
            <li>{t('unsupported2')}</li>
            <li>{t('unsupported3')}</li>
          </ul>
          <p className="mt-4 leading-7 text-muted-foreground">
            {t.rich('unsupportedNote', seoRichLinks)}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight">{t('faqTitle')}</h2>
        <div className="mt-4">
          <FaqItem question={t('faq1Q')}>{t('faq1A')}</FaqItem>
          <FaqItem question={t('faq2Q')}>{t('faq2A')}</FaqItem>
          <FaqItem question={t('faq3Q')}>{t('faq3A')}</FaqItem>
          <FaqItem question={t('faq4Q')}>
            {t.rich('faq4A', seoRichLinks)}
          </FaqItem>
        </div>
        <div className="mt-10 rounded-2xl bg-slate-50 p-7">
          <p className="text-xl font-semibold">{t('ctaTitle')}</p>
          <p className="mt-2 text-muted-foreground">{t('ctaBody')}</p>
          <div className="mt-5">
            <SeoButtonLink href="/">{t('ctaButton')}</SeoButtonLink>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            {t.rich('seeAlso', seoRichLinks)}
          </p>
        </div>
      </section>
    </div>
  );
}
