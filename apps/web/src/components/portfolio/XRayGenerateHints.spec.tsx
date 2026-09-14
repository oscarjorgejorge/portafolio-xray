import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { XRayGenerateHints } from './XRayGenerateHints';

describe('XRayGenerateHints', () => {
  it('warns that pension/FIL holdings are not recommended', () => {
    render(
      <XRayGenerateHints unsupportedCount={4} holdingsUsingFallback={4} />,
    );

    expect(
      screen.getByText(/not compatible with instant x-ray/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/could not be mapped to instant x-ray/i),
    ).not.toBeInTheDocument();
  });

  it('shows an unmapped hint for remaining 0P fallbacks', () => {
    render(
      <XRayGenerateHints unsupportedCount={0} holdingsUsingFallback={2} />,
    );

    expect(
      screen.getByText(/2 funds could not be mapped to instant x-ray/i),
    ).toBeInTheDocument();
  });

  it('shows both hints when unsupported and unmapped holdings coexist', () => {
    render(
      <XRayGenerateHints unsupportedCount={4} holdingsUsingFallback={5} />,
    );

    expect(
      screen.getByText(/not compatible with instant x-ray/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/1 fund could not be mapped to instant x-ray/i),
    ).toBeInTheDocument();
  });

  it('renders nothing when there is nothing to report', () => {
    const { container } = render(
      <XRayGenerateHints unsupportedCount={0} holdingsUsingFallback={0} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
