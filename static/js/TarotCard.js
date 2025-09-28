import i18next from 'https://esm.sh/i18next@25.2.1';
import { t, i18nPromise } from '/js/i18n.js';
import { sharedStyles } from '/js/shared-styles.js';

class TarotCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
        return ['number', 'pair-index', 'image-index'];
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
        const pairIndex = Number(this.getAttribute('pair-index'))+1 || '';
        const imageIndex = this.getAttribute('image-index') || '';
        
        // Construct image URL using the new naming scheme: pairIndex-imageIndex.png
        let order = `${pairIndex}-${imageIndex}`;
        let imageUrl = `/cards/${order}.png`;
    

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
                    text-align: center;
                    box-sizing: border-box;
                }
                .image {
                    max-width: 100%;
                    max-height: 50vh;
                    object-fit: contain;
                }
                .text {
                    font-size: 0.7rem;
                    line-height: 1.5;
                    margin: 10px 0;
                    width: 100%;
                }
            </style>
            <div class="card-container">
                <p class="text">${t('congratulations')}</p>
                <img class="image" src="${imageUrl}" alt="Card ${order}">
                <p class="text">${t('tarotCardText')}</p>
                <!-- <a href="${imageUrl}" download="card-${order}.png" class="download-link">${t('downloadCard')}</a> -->
            </div>
        `;
    }
}

customElements.define('tarot-card', TarotCard);
