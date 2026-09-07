import { htmlToMarkdown } from '@/components/ui/content-editor';

// Requirement bodies are stored exactly as the editor produced them. Text used
// to arrive HTML-escaped (sometimes twice) because the API escaped on write, so
// every reader here had to decode first; the API now stores text verbatim and
// escaping happens at render time, so these helpers work on the raw value.

export const isHtmlMarkup = (value: string): boolean => /<[a-z][\s\S]*>/i.test(value);

export const htmlToReadableText = (value?: string | null): string => {
  if (!value || !value.trim()) return '';
  if (typeof window === 'undefined' || !isHtmlMarkup(value)) return value;
  const parsed = new DOMParser().parseFromString(value, 'text/html');
  return parsed.body.textContent?.replace(/\n{3,}/g, '\n\n').trim() || value;
};

export const richTextToMarkdownForEdit = (value?: string | null): string => {
  if (!value) return '';
  return isHtmlMarkup(value) ? htmlToMarkdown(value) : value;
};
