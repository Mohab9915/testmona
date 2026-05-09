import { en } from './en';
import { fa } from './fa';
import { ar } from './ar';

export const translations = {
  en,
  fa,
  ar
};

export type TranslationKey = keyof typeof en;
export type Language = 'en' | 'fa' | 'ar';
