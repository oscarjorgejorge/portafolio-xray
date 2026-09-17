import { getTranslations } from 'next-intl/server';
import {
  Callout,
  SeoButtonLink,
  StepNumber,
  seoRichLinks,
} from './SeoLanding';
import { CheckIcon, ShieldIcon } from './SeoIcons';

export async function HowItWorksContent() {
  const t = await getTranslations('seoHowItWorks');

  return (
    <div className="text-foreground">
      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-sky-200">
              {t('eyebrow')}
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              {t('h1')}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
              {t('intro')}
            </p>
            <div className="mt-9">
              <SeoButtonLink href="/">{t('heroCta')}</SeoButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-3xl font-semibold tracking-tight">{t('addTitle')}</h2>
          <StepNumber value="01" />
        </div>
        <p className="mt-4 leading-7 text-muted-foreground">
          {t.rich('addIntro', seoRichLinks)}
        </p>
        <p className="mt-4 leading-7 text-muted-foreground">{t('addReliable')}</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-muted-foreground">
          <li>{t('addIsin')}</li>
          <li>{t('addMsId')}</li>
        </ul>
        <p className="mt-4 leading-7 text-muted-foreground">{t('addMatchNote')}</p>

        <h3 className="mt-10 text-xl font-semibold">{t('searchTitle')}</h3>
        <p className="mt-3 leading-7 text-muted-foreground">{t('searchIntro')}</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-muted-foreground">
          <li>{t('search1')}</li>
          <li>{t('search2')}</li>
          <li>{t('search3')}</li>
        </ul>
        <p className="mt-4 leading-7 text-muted-foreground">{t('searchTip')}</p>

        <h3 className="mt-10 text-xl font-semibold">{t('unresolvedTitle')}</h3>
        <p className="mt-3 leading-7 text-muted-foreground">{t('unresolvedIntro')}</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 leading-7 text-muted-foreground">
          <li>{t('unresolved1')}</li>
          <li>{t('unresolved2')}</li>
          <li>{t.rich('unresolved3', seoRichLinks)}</li>
        </ol>
        <p className="mt-4 leading-7 text-muted-foreground">{t('unresolvedDuplicate')}</p>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-3xl font-semibold tracking-tight">{t('weightsTitle')}</h2>
            <StepNumber value="02" />
          </div>
          <p className="mt-6 font-semibold">{t('percentTitle')}</p>
          <p className="mt-2 leading-7 text-muted-foreground">{t('percentBody')}</p>
          <p className="mt-6 font-semibold">{t('amountTitle')}</p>
          <p className="mt-2 leading-7 text-muted-foreground">{t('amountBody')}</p>
          <Callout title={t('privacyTitle')}>
            {t.rich('privacyBody', seoRichLinks)}
          </Callout>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-3xl font-semibold tracking-tight">{t('generateTitle')}</h2>
          <StepNumber value="03" />
        </div>
        <p className="mt-4 leading-7 text-muted-foreground">
          {t.rich('generateBody', seoRichLinks)}
        </p>
        <p className="mt-4 leading-7 text-muted-foreground">{t('generateFromThere')}</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-muted-foreground">
          <li>{t('generateOpenPdf')}</li>
          <li>{t('generateCopyLink')}</li>
        </ul>

        <h3 className="mt-10 text-xl font-semibold">{t('unsupportedTitle')}</h3>
        <p className="mt-3 leading-7 text-muted-foreground">{t('unsupportedBody')}</p>

        <h3 className="mt-10 text-xl font-semibold">{t('pdfIssueTitle')}</h3>
        <Callout variant="warning">
          {t.rich('pdfIssueBody', seoRichLinks)}
        </Callout>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-3xl font-semibold tracking-tight">{t('saveTitle')}</h2>
            <StepNumber value="04" />
          </div>
          <p className="mt-4 leading-7 text-muted-foreground">{t('saveBody')}</p>
          <p className="mt-4 leading-7 text-muted-foreground">{t('saveLinkTypes')}</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-muted-foreground">
            <li>{t('saveBuilderLink')}</li>
            <li>{t('saveReportLink')}</li>
          </ul>
          <p className="mt-4 leading-7 text-muted-foreground">
            {t.rich('saveAccount', seoRichLinks)}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-3xl font-semibold tracking-tight">{t('visibilityTitle')}</h2>
          <StepNumber value="05" />
        </div>
        <p className="mt-4 max-w-3xl leading-7 text-muted-foreground">
          {t('visibilityIntro')}
        </p>
        <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left font-semibold">
              <tr>
                <th className="p-4">{t('tableFeature')}</th>
                <th className="p-4">{t('tablePublic')}</th>
                <th className="p-4">{t('tablePrivate')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="p-4 text-muted-foreground">
                  {t.rich('tableExplore', seoRichLinks)}
                </td>
                <td className="p-4 font-medium">{t('tableYes')}</td>
                <td className="p-4 font-medium">{t('tableNo')}</td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-4 text-muted-foreground">{t('tableOthers')}</td>
                <td className="p-4 font-medium">{t('tableYes')}</td>
                <td className="p-4 font-medium">{t('tableNo')}</td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-4 text-muted-foreground">
                  {t.rich('tableYou', seoRichLinks)}
                </td>
                <td className="p-4 font-medium">{t('tableYes')}</td>
                <td className="p-4 font-medium">{t('tableYes')}</td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-4 text-muted-foreground">{t('tableAmounts')}</td>
                <td className="p-4 font-medium">{t('tableAmountsPublic')}</td>
                <td className="p-4 font-medium">{t('tableAmountsPrivate')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-6 max-w-3xl leading-7 text-muted-foreground">
          {t('visibilityDefault')}
        </p>
        <p className="mt-4 max-w-3xl leading-7 text-muted-foreground">
          {t.rich('myPortfoliosNote', seoRichLinks)}
        </p>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-3xl font-semibold tracking-tight">{t('socialTitle')}</h2>
            <StepNumber value="06" />
          </div>
          <p className="mt-4 leading-7 text-muted-foreground">
            {t.rich('exploreIntro', seoRichLinks)}
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-muted-foreground">
            <li>{t('explore1')}</li>
            <li>{t('explore2')}</li>
            <li>{t('explore3')}</li>
            <li>{t.rich('explore4', seoRichLinks)}</li>
          </ul>
          <p className="mt-6 leading-7 text-muted-foreground">
            {t.rich('favoritesBody', seoRichLinks)}
          </p>
          <p className="mt-4 leading-7 text-muted-foreground">
            {t.rich('commentsBody', seoRichLinks)}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-3xl font-semibold tracking-tight">{t('accountTitle')}</h2>
          <StepNumber value="07" />
        </div>
        <p className="mt-4 leading-7 text-muted-foreground">{t('accountIntro')}</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-muted-foreground">
          <li>{t.rich('account1', seoRichLinks)}</li>
          <li>{t.rich('account2', seoRichLinks)}</li>
          <li>{t('account3')}</li>
          <li>{t.rich('account4', seoRichLinks)}</li>
          <li>{t.rich('account5', seoRichLinks)}</li>
          <li>{t.rich('account6', seoRichLinks)}</li>
          <li>{t.rich('account7', seoRichLinks)}</li>
        </ul>
        <p className="mt-4 leading-7 text-muted-foreground">
          {t.rich('accountRegister', seoRichLinks)}
        </p>
      </section>

      <section className="border-t border-border bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight">{t('summaryTitle')}</h2>
          <ol className="mt-6 list-decimal space-y-3 pl-5 leading-7 text-muted-foreground">
            <li>{t.rich('summary1', seoRichLinks)}</li>
            <li>{t('summary2')}</li>
            <li>{t('summary3')}</li>
            <li>{t.rich('summary4', seoRichLinks)}</li>
            <li>{t.rich('summary5', seoRichLinks)}</li>
            <li>{t('summary6')}</li>
            <li>{t.rich('summary7', seoRichLinks)}</li>
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-slate-50 p-8 sm:p-12">
          <ShieldIcon className="h-9 w-9 text-primary" />
          <p className="mt-5 text-3xl font-semibold tracking-tight">{t('ctaTitle')}</p>
          <p className="mt-4 leading-7 text-muted-foreground">
            {t.rich('ctaWhatIs', seoRichLinks)}
          </p>
          <div className="mt-7 flex flex-wrap gap-x-7 gap-y-3 text-sm font-medium">
            <span className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 text-emerald-600" />
              {t('perk1')}
            </span>
            <span className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 text-emerald-600" />
              {t('perk2')}
            </span>
            <span className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 text-emerald-600" />
              {t('perk3')}
            </span>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <SeoButtonLink href="/que-es-un-xray-de-cartera" variant="secondary">
              {t('ctaWhatIsButton')}
            </SeoButtonLink>
            <SeoButtonLink href="/">{t('ctaBuilder')}</SeoButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
