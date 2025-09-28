import i18next from 'https://esm.sh/i18next@25.2.1';
import LanguageDetector from 'https://esm.sh/i18next-browser-languagedetector@8.1.0';
import Backend from 'https://esm.sh/i18next-http-backend@3.0.2';

// Initialize i18next
const i18nPromise = i18next
  .use(Backend)
  .use(LanguageDetector)
  .init({
    fallbackLng: 'de-DE',
    lng: 'de-DE',
    debug: true,
    backend: {
      loadPath: '/translations/{{lng}}.json',
    },
    interpolation: {
      escapeValue: false,
    },
    // Add language detection options
    detection: {
      order: ['querystring', 'cookie', 'sessionStorage', 'navigator'],
      lookupQuerystring: 'lng',
      lookupCookie: 'i18next',
      lookupSessionStorage: 'i18nextLng',
      caches: ['sessionStorage', 'cookie']
    },
    // Ensure translations are loaded immediately
    initImmediate: false,
    load: 'languageOnly',
    // Configure language fallbacks
    fallbackLng: {
      'default': ['de-DE']
    },
    // Disable loading of fallback languages
    load: 'currentOnly'
  });

// Function to change language
export function changeLanguage(lng) {
  return i18next.changeLanguage(lng).then(() => {
    document.documentElement.lang = lng;
    // Trigger a custom event that other components can listen to
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lng } }));
  });
}

// Function to get translation
export function t(key) {
  return i18next.t(key);
}

// Export i18next instance and initialization promise
export { i18nPromise };
export default i18next; 