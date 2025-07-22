import i18next from 'i18next';
import { t, i18nPromise } from '/js/i18n.js';
import { sharedStyles } from './shared-styles.js';

class UsernameChooser extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.socket = window.socket; // Use the global socket instance
    }

    async connectedCallback() {
        try {
            // Wait for i18next to be initialized
            await i18nPromise;
            
            // Ensure translations are loaded by triggering a language change
            const currentLang = i18next.language;
            await i18next.changeLanguage(currentLang);
            
            this.render();
            this.addEventListeners();
            
            // Listen for session token
            this.socket.on('session:token', (token) => {
                if(!localStorage.getItem('sessionToken')) {
                    localStorage.setItem('sessionToken', token);
                    console.log('Received session token:', token);
                }
            });
            
            // Listen for i18next language changes
            i18next.on('languageChanged', () => {
                this.render();
                this.addEventListeners(); // Re-add event listeners after re-render
            });
        } catch (error) {
            console.error('Error initializing translations:', error);
        }
    }

    disconnectedCallback() {
        // Clean up event listener when component is removed
        i18next.off('languageChanged');
    }

    render() {
        // Ensure translations are available before rendering
        if (!i18next.isInitialized) {
            console.warn('i18next not initialized yet');
            return;
        }

        this.shadowRoot.innerHTML = `
            <style>
                ${sharedStyles}
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
            
            // Do NOT send session token with username anymore
            this.socket.emit('action:username', {
                username: username
            });
            
            localStorage.setItem('username', username);
            document.querySelector('#username').innerHTML = username;
            document.querySelector('main').innerHTML = `<h2 id="waitingForStart">${t('waitingForStart')}</h2>`;
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

        this.socket.on('error:invalidToken', (message) => {
            errorMessage.textContent = message || 'Invalid session token. Please refresh the page.';
            errorMessage.style.display = 'block';
        });
    }
}

customElements.define('username-chooser', UsernameChooser);
