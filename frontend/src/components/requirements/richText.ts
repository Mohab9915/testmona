import { htmlToMarkdown } from '@/components/ui/content-editor';

// Requirement bodies are stored exactly as the editor produced them. Text used
// to arrive HTML-escaped (sometimes twice) because the API escaped on write, so
// every reader here had to decode first; the API now stores text verbatim and
// escaping happens at render time, so these helpers work on the raw value.

// `isHtmlMarkup` / `htmlToReadableText` now live in the dependency-free
// `@/lib/htmlText` (so pages can use them without pulling in the editor stack);
// re-exported here to keep existing imports working.
export { isHtmlMarkup, htmlToReadableText } from '@/lib/htmlText';
import { isHtmlMarkup } from '@/lib/htmlText';

export const richTextToMarkdownForEdit = (value?: string | null): string => {
  if (!value) return '';
  return isHtmlMarkup(value) ? htmlToMarkdown(value) : value;
};
