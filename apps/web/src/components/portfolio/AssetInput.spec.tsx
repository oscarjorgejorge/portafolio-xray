import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { resolveAsset } from '@/lib/api/assets';
import { AssetInput } from './AssetInput';
import {
  createResolveSuccessResponse,
  createAlternativesResponse,
  createNotFoundResponse,
} from '@/test/mocks/api';
import { createMockPortfolioAsset } from '@/test/fixtures';

// Mock the API module
vi.mock('@/lib/api/assets', () => ({
  resolveAsset: vi.fn(),
}));

const mockResolveAsset = vi.mocked(resolveAsset);

describe('AssetInput', () => {
  const mockOnAssetResolved = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render input and button', () => {
      render(<AssetInput onAssetResolved={mockOnAssetResolved} />);

      expect(
        screen.getByLabelText('Asset identifier input')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add asset/i })).toBeInTheDocument();
    });

    it('should have disabled button when input is empty', () => {
      render(<AssetInput onAssetResolved={mockOnAssetResolved} />);

      expect(screen.getByRole('button', { name: /add asset/i })).toBeDisabled();
    });
  });

  describe('empty input validation', () => {
    it('should show error when submitting empty input', async () => {
      render(<AssetInput onAssetResolved={mockOnAssetResolved} />);

      // Force submit the form (bypassing disabled button) using fireEvent
      const form = screen.getByRole('form', { name: /add asset to portfolio/i });
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getByText(/please enter an isin/i)
        ).toBeInTheDocument();
      });
    });

    it('should show error when submitting whitespace only', async () => {
      const user = userEvent.setup();
      render(<AssetInput onAssetResolved={mockOnAssetResolved} />);

      const input = screen.getByLabelText('Asset identifier input');
      await user.type(input, '   ');

      // Button should still be disabled
      expect(screen.getByRole('button', { name: /add asset/i })).toBeDisabled();
    });
  });

  describe('duplicate detection', () => {
    it('should show error when entering duplicate identifier', async () => {
      const user = userEvent.setup();
      const existingAssets = [
        createMockPortfolioAsset({ identifier: 'IE00B4L5Y983' }),
      ];

      render(
        <AssetInput
          onAssetResolved={mockOnAssetResolved}
          existingAssets={existingAssets}
        />
      );

      const input = screen.getByLabelText('Asset identifier input');
      await user.type(input, 'IE00B4L5Y983');
      await user.click(screen.getByRole('button', { name: /add asset/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/this asset is already in your portfolio/i)
        ).toBeInTheDocument();
      });

      // Should not have called the API
      expect(mockResolveAsset).not.toHaveBeenCalled();
    });

    it('should detect duplicate case-insensitively', async () => {
      const user = userEvent.setup();
      const existingAssets = [
        createMockPortfolioAsset({ identifier: 'IE00B4L5Y983' }),
      ];

      render(
        <AssetInput
          onAssetResolved={mockOnAssetResolved}
          existingAssets={existingAssets}
        />
      );

      const input = screen.getByLabelText('Asset identifier input');
      await user.type(input, 'ie00b4l5y983');
      await user.click(screen.getByRole('button', { name: /add asset/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/this asset is already in your portfolio/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('successful resolution', () => {
    it('should call onAssetResolved with resolved asset', async () => {
      const user = userEvent.setup();
      mockResolveAsset.mockResolvedValueOnce(createResolveSuccessResponse());

      render(<AssetInput onAssetResolved={mockOnAssetResolved} />);

      const input = screen.getByLabelText('Asset identifier input');
      await user.type(input, 'IE00B4L5Y983');
      await user.click(screen.getByRole('button', { name: /add asset/i }));

      await waitFor(() => {
        expect(mockOnAssetResolved).toHaveBeenCalledTimes(1);
      });

      const calledWith = mockOnAssetResolved.mock.calls[0][0];
      expect(calledWith.status).toBe('resolved');
      expect(calledWith.identifier).toBe('IE00B4L5Y983');
      expect(calledWith.asset).toBeDefined();
    });

    it('should clear input after successful resolution', async () => {
      const user = userEvent.setup();
      mockResolveAsset.mockResolvedValueOnce(createResolveSuccessResponse());

      render(<AssetInput onAssetResolved={mockOnAssetResolved} />);

      const input = screen.getByLabelText('Asset identifier input');
      await user.type(input, 'IE00B4L5Y983');
      await user.click(screen.getByRole('button', { name: /add asset/i }));

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });
  });

  describe('alternatives response', () => {
    it('should call onAssetResolved with low_confidence status', async () => {
      const user = userEvent.setup();
      mockResolveAsset.mockResolvedValueOnce(createAlternativesResponse());

      render(<AssetInput onAssetResolved={mockOnAssetResolved} />);

      const input = screen.getByLabelText('Asset identifier input');
      await user.type(input, 'VWCE');
      await user.click(screen.getByRole('button', { name: /add asset/i }));

      await waitFor(() => {
        expect(mockOnAssetResolved).toHaveBeenCalledTimes(1);
      });

      const calledWith = mockOnAssetResolved.mock.calls[0][0];
      expect(calledWith.status).toBe('low_confidence');
      expect(calledWith.alternatives).toHaveLength(2);
    });
  });

  describe('not found response', () => {
    it('should call onAssetResolved with manual_required status', async () => {
      const user = userEvent.setup();
      mockResolveAsset.mockResolvedValueOnce(createNotFoundResponse());

      render(<AssetInput onAssetResolved={mockOnAssetResolved} />);

      const input = screen.getByLabelText('Asset identifier input');
      await user.type(input, 'UNKNOWN123');
      await user.click(screen.getByRole('button', { name: /add asset/i }));

      await waitFor(() => {
        expect(mockOnAssetResolved).toHaveBeenCalledTimes(1);
      });

      const calledWith = mockOnAssetResolved.mock.calls[0][0];
      expect(calledWith.status).toBe('manual_required');
      expect(calledWith.error).toBe('Asset not found');
    });
  });

  describe('API error handling', () => {
    it('should show error message when API call fails', async () => {
      const user = userEvent.setup();
      mockResolveAsset.mockRejectedValueOnce(new Error('Network error'));

      render(<AssetInput onAssetResolved={mockOnAssetResolved} />);

      const input = screen.getByLabelText('Asset identifier input');
      await user.type(input, 'IE00B4L5Y983');
      await user.click(screen.getByRole('button', { name: /add asset/i }));

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Should not call onAssetResolved on error
      expect(mockOnAssetResolved).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should disable input and button while loading', async () => {
      const user = userEvent.setup();
      // Create a promise that never resolves to keep loading state
      mockResolveAsset.mockImplementationOnce(
        () => new Promise(() => {})
      );

      render(<AssetInput onAssetResolved={mockOnAssetResolved} />);

      const input = screen.getByLabelText('Asset identifier input');
      await user.type(input, 'IE00B4L5Y983');
      await user.click(screen.getByRole('button', { name: /add asset/i }));

      await waitFor(() => {
        expect(input).toBeDisabled();
        // When loading, button shows "Loading..." text
        expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled();
      });
    });
  });
});
