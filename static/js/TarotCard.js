class TarotCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
        return ['image-url', 'text'];
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
        const imageUrl = this.getAttribute('image-url') || '';
        const text = this.getAttribute('text') || '';

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
                .text {
                    margin-top: 1rem;
                    font-size: 1.2rem;
                    text-align: center;
                }
            </style>
            <div class="card-container">
                <img class="image" src="${imageUrl}" alt="Tarot card">
                <div class="text">${text}</div>
            </div>
        `;
    }
}

customElements.define('tarot-card', TarotCard);
