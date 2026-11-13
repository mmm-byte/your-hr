import type { Metadata } from 'next';
import { AppShell } from '@/components/shell/app-shell';
import { AssessmentNotice } from '@/components/shell/assessment-notice';
import { SkipLink } from '@/components/shell/skip-link';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Your HR',
    template: '%s · Your HR',
  },
  description:
    'Salary-centered HR management for a multinational workforce: employee directory, effective-dated salary history, and currency-safe compensation analytics.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <SkipLink />
        <AssessmentNotice />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
