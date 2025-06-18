import i18next from 'i18next';
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
          position: fixed;
          top: 10px;
          right: 10px;
          z-index: 1000;
          
        }
        select {
          appearance: none;
          background: transparent;
          border: none;
          font-size: 24px;
          cursor: pointer;
          padding: 5px;
          outline: none;
          width: 100%;
          height: 100%;
          color: white;
        }
        select option {
          font-size: 24px;
          padding: 5px;
          background: transparent;
        }
        select:hover {
          opacity: 0.8;
        }
      </style>
      <div class="language-switcher">
        <select>
          <option value="en-US">EN</option>
          <option value="de-DE">DE</option>
        </select>
      </div>
    `;
  }

  addEventListeners() {
    const select = this.shadowRoot.querySelector('select');
    
    // Set initial value
    select.value = i18next.language;
    
    select.addEventListener('change', (e) => {
      changeLanguage(e.target.value);
    });
  }
}

customElements.define('language-switcher', LanguageSwitcher); 