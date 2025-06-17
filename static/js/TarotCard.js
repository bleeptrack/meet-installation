import { t } from '/js/i18n.js';

class TarotCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
        return ['number'];
    }

    connectedCallback() {
        this.render();
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
                :host {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    width: 100%;
                    height: 100%;
                }
                .card-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    width: 100%;
                    height: 100%;
                }
                .image {
                    max-width: 100%;
                    max-height: 80vh;
                    object-fit: contain;
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
                .download-link {
                    margin-top: 1rem;
                    color: #2196F3;
                    text-decoration: none;
                    font-size: 1rem;
                }
                .download-link:hover {
                    text-decoration: underline;
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
