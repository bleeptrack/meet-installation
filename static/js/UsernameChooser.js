import i18next from 'i18next';
import { t, i18nPromise } from '/js/i18n.js';

class UsernameChooser extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.socket = window.socket; // Use the global socket instance
    }

    async connectedCallback() {
        // Wait for i18next to be initialized
        await i18nPromise;
        this.render();
        this.addEventListeners();
        // Listen for i18next language changes
        i18next.on('languageChanged', () => {
            this.render();
            this.addEventListeners(); // Re-add event listeners after re-render
        });
    }

    disconnectedCallback() {
        // Clean up event listener when component is removed
        i18next.off('languageChanged');
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                .username-container {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    max-width: 300px;
                }
                input {
                    padding: 8px;
                    font-size: 16px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                }
                button {
                    padding: 10px 20px;
                    font-size: 16px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                button:hover {
                    background-color: #45a049;
                }
                .error {
                    color: red;
                    font-size: 14px;
                    display: none;
                }
            </style>
            <div class="username-container">
                <input type="text" placeholder="${t('usernamePlaceholder')}" id="usernameInput">
                <button id="submitUsername">${t('buttons.submit')}</button>
                <div class="error" id="errorMessage">${t('errors.usernameRequired')}</div>
            </div>
        `;
    }

    addEventListeners() {
        const input = this.shadowRoot.querySelector('#usernameInput');
        const button = this.shadowRoot.querySelector('#submitUsername');
        const errorMessage = this.shadowRoot.querySelector('#errorMessage');

        button.addEventListener('click', () => {
            const username = input.value.trim();
            if (!username) {
                errorMessage.style.display = 'block';
                return;
            }
            errorMessage.style.display = 'none';
            this.socket.emit('action:username', username);
            sessionStorage.setItem('username', username);
            document.querySelector('#username').innerHTML = username;
            this.remove();
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                button.click();
            }
        });

        this.socket.on('error:usernameTaken', () => {
            errorMessage.textContent = t('errors.usernameTaken');
            errorMessage.style.display = 'block';
        });
    }
}

customElements.define('username-chooser', UsernameChooser);
