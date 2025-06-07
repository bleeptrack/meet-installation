import { changeLanguage, t, i18nPromise } from './i18n.js';

class LanguageSwitcher extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  async connectedCallback() {
    // Wait for i18next to be initialized
    await i18nPromise;
    this.render();
    this.addEventListeners();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        .language-switcher {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        select {
          padding: 5px;
          border-radius: 4px;
          border: 1px solid #ccc;
        }
      </style>
      <div class="language-switcher">
        <span>${t('language')}:</span>
        <select>
          <option value="en-US">English</option>
          <option value="de-DE">Deutsch</option>
        </select>
      </div>
    `;
  }

  addEventListeners() {
    const select = this.shadowRoot.querySelector('select');
    select.addEventListener('change', (e) => {
      changeLanguage(e.target.value);
    });
  }
}

customElements.define('language-switcher', LanguageSwitcher); 