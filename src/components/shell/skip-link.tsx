/**
 * Skip link (UX-JOURNEY.md §4.4).
 *
 * The first focusable element in the document. It is visually hidden until it
 * receives keyboard focus, at which point it becomes visible — so a keyboard
 * user can jump past the navigation straight to the page content.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
    >
      Skip to main content
    </a>
  );
}
