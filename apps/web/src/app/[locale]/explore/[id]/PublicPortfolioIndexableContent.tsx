import {
  buildPortfolioPageCopy,
  formatHoldingIdentifier,
  type PortfolioHoldingView,
} from '@/lib/portfolio-seo';

interface PublicPortfolioIndexableContentProps {
  locale: string;
  portfolioName: string | null | undefined;
  holdings: PortfolioHoldingView[];
}

/**
 * Server-rendered portfolio identity and holdings.
 * This is the HTML crawlers see, not a client-only fetch.
 */
export function PublicPortfolioIndexableContent({
  locale,
  portfolioName,
  holdings,
}: PublicPortfolioIndexableContentProps) {
  const copy = buildPortfolioPageCopy(locale, portfolioName, holdings);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{copy.headline}</h1>
      <p className="text-sm text-slate-700">{copy.summary}</p>
      <table className="w-full border-collapse overflow-hidden rounded-lg bg-white text-sm">
        <caption className="sr-only">{copy.headline}</caption>
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-600">
            <th scope="col" className="px-3 py-2 font-medium">
              {copy.columnAsset}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {copy.columnIdentifier}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {copy.columnWeight}
            </th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => (
            <tr key={holding.morningstarId} className="border-b border-slate-100">
              <th scope="row" className="px-3 py-2 text-left font-medium text-slate-900">
                {holding.name}
              </th>
              <td className="px-3 py-2 text-slate-600">
                {formatHoldingIdentifier(holding)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                {holding.weight.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
