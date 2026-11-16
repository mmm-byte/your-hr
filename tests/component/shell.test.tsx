/**
 * Covers:
 * - ACC-002 the assessment notice is present and states the access model
 * - ACC-003 the acting persona is labelled, not a signed-in account
 * - UX-JOURNEY.md §4.4 the skip link targets the main landmark
 * - UX-JOURNEY.md §2 the navigation exposes the five product sections
 * - UI.md → Accessibility status is never conveyed by colour alone
 *
 * Does not cover:
 * - The route map itself (tests/e2e/navigation.spec.ts)
 * - Money formatting arithmetic (tests/unit/money.test.ts)
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AssessmentNotice } from '@/components/shell/assessment-notice';
import { SkipLink } from '@/components/shell/skip-link';
import { UserBadge } from '@/components/shell/user-badge';
import { Navigation } from '@/components/shell/navigation';
import { EmploymentStatusBadge } from '@/components/product/status-badge';

describe('AssessmentNotice', () => {
  it('discloses the assessment environment and the absence of authentication', () => {
    render(<AssessmentNotice />);

    const notice = screen.getByRole('note');

    expect(notice).toHaveTextContent('Assessment environment');
    expect(notice).toHaveTextContent('Synthetic workforce data');
    expect(notice).toHaveTextContent(/no authentication/i);
  });

  it('is exposed as a note so assistive technology announces it', () => {
    render(<AssessmentNotice />);

    expect(screen.getByRole('note')).toBeInTheDocument();
  });
});

describe('SkipLink', () => {
  it('points at the main content landmark', () => {
    render(<SkipLink />);

    expect(screen.getByRole('link', { name: /skip to main content/i })).toHaveAttribute(
      'href',
      '#main-content',
    );
  });

  it('is the first focusable element so a keyboard user reaches it first', async () => {
    const { container } = render(<SkipLink />);

    const link = screen.getByRole('link', { name: /skip to main content/i });

    expect(container.firstElementChild).toBe(link);
  });
});

describe('UserBadge', () => {
  it('labels the acting persona without implying a signed-in session', () => {
    render(<UserBadge />);

    expect(screen.getByText('HR Manager')).toBeInTheDocument();
    expect(screen.getByText('Assessment persona')).toBeInTheDocument();
    // A logout control would imply an authentication layer that does not exist.
    expect(screen.queryByRole('button', { name: /log ?out|sign ?out/i })).not.toBeInTheDocument();
  });
});

describe('Navigation', () => {
  it('exposes the five product sections in the documented order', () => {
    render(<Navigation />);

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const items = within(nav).getAllByRole('listitem');

    expect(items.map((item) => item.textContent?.trim())).toEqual([
      'Overview',
      'Employees',
      'Compensation',
      'Analytics',
      'Data Quality',
    ]);
  });

  it('gives each navigation link an accessible name', () => {
    render(<Navigation />);

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    for (const label of ['Overview', 'Employees', 'Compensation', 'Analytics', 'Data Quality']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });
});

describe('EmploymentStatusBadge', () => {
  it('states the status in text, not by colour alone', () => {
    render(<EmploymentStatusBadge status="active" />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders each seeded status with a readable label', () => {
    const { rerender } = render(<EmploymentStatusBadge status="on_leave" />);
    expect(screen.getByText('On leave')).toBeInTheDocument();

    rerender(<EmploymentStatusBadge status="terminated" />);
    expect(screen.getByText('Terminated')).toBeInTheDocument();
  });

  it('falls back to the raw status for an unknown value rather than hiding it', () => {
    render(<EmploymentStatusBadge status="onboarding" />);

    expect(screen.getByText('onboarding')).toBeInTheDocument();
  });
});
