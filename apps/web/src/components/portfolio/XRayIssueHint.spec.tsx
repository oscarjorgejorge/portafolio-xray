import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { XRayIssueHint } from './XRayIssueHint';

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe('XRayIssueHint', () => {
  it('renders the recovery copy with a contact form link', () => {
    render(<XRayIssueHint />);

    expect(
      screen.getByText(/if the x-ray is incomplete or missing assets/i),
    ).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /contact form/i });
    expect(link).toHaveAttribute('href', '/contact');
  });
});
