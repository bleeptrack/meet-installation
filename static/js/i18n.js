import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

// Initialize i18next
const i18nPromise = i18next
  .use(Backend)
  .use(LanguageDetector)
  .init({
    fallbackLng: 'en',
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
    }
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