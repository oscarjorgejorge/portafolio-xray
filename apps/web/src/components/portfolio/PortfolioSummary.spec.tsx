import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { PortfolioSummary } from './PortfolioSummary';

describe('PortfolioSummary', () => {
  const defaultProps = {
    totalWeight: 100,
    allocationMode: 'percentage' as const,
    isValid: true,
    isGenerating: false,
    onClearAll: vi.fn(),
    onGenerate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('percentage mode display', () => {
    it('should display total weight with percentage symbol', () => {
      render(<PortfolioSummary {...defaultProps} totalWeight={75.5} />);

      expect(screen.getByText('75.50%')).toBeInTheDocument();
    });

    it('should display green text when total is exactly 100%', () => {
      render(<PortfolioSummary {...defaultProps} totalWeight={100} />);

      const percentage = screen.getByText('100.00%');
      expect(percentage).toHaveClass('text-green-600');
    });

    it('should display green text when total is within tolerance (99.995%)', () => {
      render(<PortfolioSummary {...defaultProps} totalWeight={99.995} />);

      const percentage = screen.getByText('100.00%'); // Rounded display
      expect(percentage).toHaveClass('text-green-600');
    });

    it('should display red text when total is not 100%', () => {
      render(<PortfolioSummary {...defaultProps} totalWeight={80} />);

      const percentage = screen.getByText('80.00%');
      expect(percentage).toHaveClass('text-red-600');
    });

    it('should show warning alert when total is not 100%', () => {
      render(<PortfolioSummary {...defaultProps} totalWeight={75} />);

      expect(
        screen.getByText(/total must equal 100%/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/remaining: 25.00%/i)).toBeInTheDocument();
    });

    it('should show negative remaining when over 100%', () => {
      render(<PortfolioSummary {...defaultProps} totalWeight={110} />);

      expect(screen.getByText(/remaining: -10.00%/i)).toBeInTheDocument();
    });

    it('should not show warning when total is valid', () => {
      render(<PortfolioSummary {...defaultProps} totalWeight={100} />);

      expect(
        screen.queryByText(/total must equal 100%/i)
      ).not.toBeInTheDocument();
    });
  });

  describe('amount mode display', () => {
    it('should display total without percentage symbol', () => {
      render(
        <PortfolioSummary
          {...defaultProps}
          allocationMode="amount"
          totalWeight={1500}
        />
      );

      expect(screen.getByText('1500.00')).toBeInTheDocument();
    });

    it('should not show warning in amount mode even if total is not 100', () => {
      render(
        <PortfolioSummary
          {...defaultProps}
          allocationMode="amount"
          totalWeight={50}
        />
      );

      expect(
        screen.queryByText(/total must equal 100%/i)
      ).not.toBeInTheDocument();
    });

    it('should display with neutral text color', () => {
      render(
        <PortfolioSummary
          {...defaultProps}
          allocationMode="amount"
          totalWeight={1500}
        />
      );

      const amount = screen.getByText('1500.00');
      expect(amount).toHaveClass('text-slate-900');
    });
  });

  describe('Generate X-Ray button', () => {
    it('should be enabled when isValid is true', () => {
      render(<PortfolioSummary {...defaultProps} isValid />);

      expect(
        screen.getByRole('button', { name: /generate x-ray/i })
      ).toBeEnabled();
    });

    it('should be disabled when isValid is false', () => {
      render(<PortfolioSummary {...defaultProps} isValid={false} />);

      expect(
        screen.getByRole('button', { name: /generate x-ray/i })
      ).toBeDisabled();
    });

    it('should call onGenerate when clicked', async () => {
      const user = userEvent.setup();
      const onGenerate = vi.fn();
      render(<PortfolioSummary {...defaultProps} onGenerate={onGenerate} />);

      await user.click(screen.getByRole('button', { name: /generate x-ray/i }));

      expect(onGenerate).toHaveBeenCalledTimes(1);
    });

    it('should show loading state when isGenerating is true', () => {
      render(<PortfolioSummary {...defaultProps} isGenerating />);

      // When loading, button shows "Loading..." text
      const button = screen.getByRole('button', { name: /loading/i });
      // Button should be disabled during loading
      expect(button).toBeDisabled();
    });

    it('should not call onGenerate when disabled', async () => {
      const user = userEvent.setup();
      const onGenerate = vi.fn();
      render(
        <PortfolioSummary {...defaultProps} isValid={false} onGenerate={onGenerate} />
      );

      const button = screen.getByRole('button', { name: /generate x-ray/i });
      // Try to click disabled button
      await user.click(button);

      expect(onGenerate).not.toHaveBeenCalled();
    });
  });

  describe('Clear All button', () => {
    it('should be always enabled', () => {
      render(<PortfolioSummary {...defaultProps} isValid={false} />);

      expect(screen.getByRole('button', { name: /clear all/i })).toBeEnabled();
    });

    it('should call onClearAll when clicked', async () => {
      const user = userEvent.setup();
      const onClearAll = vi.fn();
      render(<PortfolioSummary {...defaultProps} onClearAll={onClearAll} />);

      await user.click(screen.getByRole('button', { name: /clear all/i }));

      expect(onClearAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('formatting', () => {
    it('should format decimal weights correctly', () => {
      render(<PortfolioSummary {...defaultProps} totalWeight={33.333} />);

      expect(screen.getByText('33.33%')).toBeInTheDocument();
    });

    it('should handle zero total weight', () => {
      render(<PortfolioSummary {...defaultProps} totalWeight={0} />);

      expect(screen.getByText('0.00%')).toBeInTheDocument();
    });
  });
});
