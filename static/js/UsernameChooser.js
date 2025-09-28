import i18next from 'https://esm.sh/i18next@25.2.1';
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
        console.log(`UsernameChooser render() called ${t('buttons.submit')}`);
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
                .stored-username {
                    display: flex;
                    align-items: flex-start;
                    gap: 15px;
                    margin-bottom: 10px;
                }
                .stored-username h2 {
                    margin: 0;
                    flex: 1;
                }
                .clear-button {
                    width: auto;
                    padding: 8px 12px;
                    background-color: white;
                    color: black;
                    border: 3px solid rgba(255, 255, 255, 0.6);
                    border-radius: 30px;
                    cursor: pointer;
                    font-family: 'Chewy', 'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', sans-serif;
                    font-size: 18px;
                    box-shadow: 
                        0 0 20px rgba(255, 255, 255, 0.8),
                        0 0 40px rgba(255, 255, 255, 0.4),
                        0 0 60px rgba(255, 255, 255, 0.2);
                    transition: all 0.3s ease;
                    backdrop-filter: blur(5px);
                    -webkit-backdrop-filter: blur(5px);
                    line-height: 1.2;
                    font-weight: bold;
                    flex-shrink: 0;
                }
                .clear-button:hover {
                    background-color: #f8f8f8;
                    box-shadow: 
                        0 0 30px rgba(255, 255, 255, 0.9),
                        0 0 50px rgba(255, 255, 255, 0.5),
                        0 0 70px rgba(255, 255, 255, 0.3);
                    transform: translateY(-2px);
                }
                .clear-button:active {
                    transform: scale(0.98);
                    box-shadow: 
                        0 0 15px rgba(255, 255, 255, 0.6),
                        0 0 30px rgba(255, 255, 255, 0.3),
                        0 0 45px rgba(255, 255, 255, 0.1);
                }
            </style>
            <div class="username-container">
                <input type="text" placeholder="${t('usernamePlaceholder')}" id="usernameInput" maxlength="10">
                <button id="submitUsername">${t('buttons.submit')}</button>
                <div class="error" id="errorMessage">${t('errors.usernameRequired')}</div>
            </div>
        `;
    }

    addEventListeners() {
        const input = this.shadowRoot.querySelector('#usernameInput');
        const button = this.shadowRoot.querySelector('#submitUsername');
        const errorMessage = this.shadowRoot.querySelector('#errorMessage');
        const clearButton = this.shadowRoot.querySelector('#clearStoredUsername');

        button.addEventListener('click', () => {
            // Sanitize username: remove everything that is not a letter
            const username = input.value.trim().replace(/[^a-zA-Z]/g, '');
            if (!username) {
                errorMessage.style.display = 'block';
                return;
            }
            errorMessage.style.display = 'none';
            
            // Send username with current session token
            const currentToken = new URLSearchParams(window.location.search).get('token');
            this.socket.emit('action:username', {
                username: username,
                token: currentToken
            });
            
            // Send current language to server
            const currentLanguage = i18next.language || 'de-DE';
            this.socket.emit('action:language', {
                username: username,
                language: currentLanguage
            }, (response) => {
                if (response.success) {
                    console.log('Language set on server:', currentLanguage);
                } else {
                    console.error('Failed to set language on server:', response.error);
                }
            });
            
            // Store username with current session token
            localStorage.setItem('username', username);
            localStorage.setItem('sessionToken', currentToken);
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
