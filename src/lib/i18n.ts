import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import es from '../locales/es.json';

// compatibilityJSON 'v4' sidesteps relying on full ICU plural rules (Hermes's
// Intl support is still partial on some SDK/device combos) — fine for this
// app since none of its strings need anything beyond i18next's simple
// singular/plural `_one`/`_other` suffixes.
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export default i18n;
