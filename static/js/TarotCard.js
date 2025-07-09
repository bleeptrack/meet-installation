import i18next from 'i18next';
import { t, i18nPromise } from '/js/i18n.js';
import { sharedStyles } from '/js/shared-styles.js';

class TarotCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
        return ['number'];
    }

    async connectedCallback() {
        // Wait for i18next to be initialized
        await i18nPromise;
        this.render();

        // Listen for i18next language changes
        i18next.on('languageChanged', () => {
            this.render();
        });
    }

    disconnectedCallback() {
        // Clean up event listener when component is removed
        i18next.off('languageChanged');
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            this.render();
        }
    }

    render() {
        const number = this.getAttribute('number') || '';
        const imageUrl = `/static/images/cards/${number}.jpg`;

        this.shadowRoot.innerHTML = `
            <style>
                ${sharedStyles}
                :host {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    min-height: 100%;
                    overflow-x: hidden;
                    box-sizing: border-box;
                }
                .card-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    text-align: center;
                    box-sizing: border-box;
                }
                .image {
                    max-width: 100%;
                    max-height: 80vh;
                    object-fit: contain;
                    margin: 20px 0;
                }
                .text {
                    font-size: 1rem;
                    line-height: 1.5;
                    margin: 10px 0;
                    width: 100%;
                }
                .placeholder {
                    width: 200px;
                    height: 280px;
                    background: white;
                    border: 2px solid #333;
                    border-radius: 10px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size: 48px;
                    font-weight: bold;
                    color: #333;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                @media (max-width: 768px) {
                    .card-container {
                        padding: 15px;
                    }
                    .image {
                        max-height: 60vh;
                    }
                }
            </style>
            <div class="card-container">
                <p class="text">${t('congratulations')}</p>
                <img class="image" src="${imageUrl}" alt="Card ${number}" onerror="this.style.display='none'; this.parentElement.querySelector('.placeholder').style.display='flex';">
                <div class="placeholder" style="display: none;">${number}</div>
                <p class="text">${t('tarotCardText')}</p>
                <a href="${imageUrl}" download="card-${number}.jpg" class="download-link">${t('downloadCard')}</a>
            </div>
        `;
    }
}

customElements.define('tarot-card', TarotCard);
