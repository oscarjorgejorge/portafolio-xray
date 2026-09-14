import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { AssetRow } from './AssetRow';
import { createMockAsset, createMockPortfolioAsset } from '@/test/fixtures';

vi.mock('@/lib/hooks/useIsinPolling', () => ({
  useIsinPolling: vi.fn(),
}));

const rowProps = {
  allocationMode: 'percentage' as const,
  totalWeight: 100,
  onWeightChange: vi.fn(),
  onRemove: vi.fn(),
};

describe('AssetRow', () => {
  it('warns when the holding is a pension plan, EPSV or FIL', () => {
    render(
      <AssetRow
        {...rowProps}
        asset={createMockPortfolioAsset({
          asset: createMockAsset({
            name: 'Myinvestor Indexado S&P 500 PP',
            type: 'FUND',
          }),
        })}
      />,
    );

    expect(
      screen.getByText(/not recommended for x-ray/i),
    ).toBeInTheDocument();
  });

  it('does not warn for a regular UCITS fund', () => {
    render(
      <AssetRow
        {...rowProps}
        asset={createMockPortfolioAsset({
          asset: createMockAsset({
            name: 'Gestión Boutique VI Argos FI',
            type: 'FUND',
          }),
        })}
      />,
    );

    expect(
      screen.queryByText(/not recommended for x-ray/i),
    ).not.toBeInTheDocument();
  });
});
