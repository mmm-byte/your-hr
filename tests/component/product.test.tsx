/**
 * Covers:
 * - MON-003 every money value carries its currency code
 * - MON-005 the USD equivalent is labelled and visually distinct from local pay
 * - RPT-006 the displayed amount keeps the database value's precision
 * - QRY-007 the no-match empty state names the filters
 * - UI.md → Reusable product components the page header states its context
 *
 * Does not cover:
 * - Money arithmetic and formatting rules (tests/unit/money.test.ts)
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  BonusDisplay,
  MoneyDisplay,
  UsdEquivalentDisplay,
} from '@/components/product/money-display';
import { EmptyState, NoMatchState } from '@/components/product/empty-state';
import { PageHeader } from '@/components/product/page-header';

describe('MoneyDisplay', () => {
  it('shows the currency code alongside the amount', () => {
    render(<MoneyDisplay amount="54206.05" currency="USD" />);

    expect(screen.getByText(/54,206\.05/)).toBeInTheDocument();
    expect(screen.getByText(/USD/)).toBeInTheDocument();
  });

  it('keeps the currency code for a non-USD amount', () => {
    render(<MoneyDisplay amount="4200000.00" currency="INR" />);

    expect(screen.getByText(/INR/)).toBeInTheDocument();
  });

  it('renders tabular numerals so digits align in a column', () => {
    const { container } = render(<MoneyDisplay amount="54206.05" currency="USD" />);

    expect(container.querySelector('.tabular-nums')).not.toBeNull();
  });
});

describe('UsdEquivalentDisplay', () => {
  it('labels the value as a synthetic equivalent so it is not read as actual pay', () => {
    render(<UsdEquivalentDisplay amount="51000.00" />);

    expect(screen.getByText(/USD equivalent \(synthetic\)/)).toBeInTheDocument();
  });

  it('names the currency once, not twice', () => {
    // The label already says "USD equivalent"; repeating the code would read
    // as a mistake rather than as emphasis.
    const { container } = render(<UsdEquivalentDisplay amount="51000.00" />);

    expect(container.textContent).toContain('51,000.00 USD equivalent (synthetic)');
    expect(container.textContent).not.toContain('USD USD');
  });
});

describe('BonusDisplay', () => {
  it('shows the percentage with a bonus label so it is never a bare number', () => {
    render(<BonusDisplay bonusPct="12.5" />);

    expect(screen.getByText(/12\.5%/)).toBeInTheDocument();
    expect(screen.getByText(/bonus/)).toBeInTheDocument();
  });
});

describe('PageHeader', () => {
  it('states the reporting context so the reader knows which date the numbers describe', () => {
    render(<PageHeader title="Compensation" context="As of 2026-09-30" />);

    expect(screen.getByRole('heading', { name: 'Compensation' })).toBeInTheDocument();
    expect(screen.getByText(/Reporting context:/)).toBeInTheDocument();
    expect(screen.getByText(/2026-09-30/)).toBeInTheDocument();
  });

  it('omits the context line when no context is given', () => {
    render(<PageHeader title="Overview" />);

    expect(screen.queryByText(/Reporting context:/)).not.toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('states the situation rather than showing a blank region', () => {
    render(<EmptyState title="No employees match these filters" description="Try widening the date range." />);

    expect(screen.getByText('No employees match these filters')).toBeInTheDocument();
    expect(screen.getByText('Try widening the date range.')).toBeInTheDocument();
  });
});

describe('NoMatchState', () => {
  it('distinguishes "no match" from "no data" by naming the filters', () => {
    render(<NoMatchState description="Department: Legal, Status: Active" />);

    expect(screen.getByText('No employees match these filters')).toBeInTheDocument();
    expect(screen.getByText(/Department: Legal/)).toBeInTheDocument();
  });
});
