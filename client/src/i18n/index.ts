import { createI18n } from 'vue-i18n';
import fr from './locales/fr.json';
import en from './locales/en.json';
import nl from './locales/nl.json';

const savedPrefs = localStorage.getItem('userPreferences');
let savedLocale = 'fr';
if (savedPrefs) {
  try {
    const prefs = JSON.parse(savedPrefs);
    if (prefs.language && ['fr', 'en', 'nl'].includes(prefs.language)) {
      savedLocale = prefs.language;
    }
  } catch {
    // ignore
  }
}

const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'fr',
  messages: { fr, en, nl },
});

export default i18n;
