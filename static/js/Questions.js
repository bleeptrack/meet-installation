import i18next from 'i18next';
import { t, i18nPromise } from '/js/i18n.js';

class Questions extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.socket = window.socket;
        this.currentQuestion = 0;
        this.questions = null;
    }

    async connectedCallback() {
        // Wait for i18next to be initialized
        await i18nPromise;
        
        // Load questions structure once
        try {
            const response = await fetch('/translations/en-US.json');
            const data = await response.json();
            this.questions = data.questions;
            console.log(this.questions);
            this.render();
            this.addEventListeners();
        } catch (error) {
            console.error('Error loading questions:', error);
        }

        // Only update translations when language changes
        i18next.on('languageChanged', () => {
            this.render();
            this.addEventListeners();
        });
    }

    render() {
        const question = this.questions[this.currentQuestion];
        this.shadowRoot.innerHTML = `
            <style>
                .question-container {
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .question {
                    font-size: 20px;
                    margin-bottom: 20px;
                }
                .options {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                button {
                    padding: 10px 20px;
                    font-size: 16px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    text-align: left;
                }
                button:hover {
                    background-color: #45a049;
                }
                button:disabled {
                    background-color: #cccccc;
                    cursor: not-allowed;
                }
                .feedback {
                    margin-top: 20px;
                    padding: 10px;
                    border-radius: 4px;
                    display: none;
                    background-color: #f8f9fa;
                    color: #333;
                }
                .next-button {
                    margin-top: 20px;
                    display: none;
                }
            </style>
            <div class="question-container">
                <div class="question">${t(`questions.${this.currentQuestion}.question`)}</div>
                <div class="options">
                    ${Object.keys(question)
                        .filter(key => key.startsWith('a') && !key.includes('feedback'))
                        .map(key => `
                            <button data-index="${key.substring(1) - 1}">${t(`questions.${this.currentQuestion}.${key}`)}</button>
                        `).join('')}
                </div>
                <div class="feedback"></div>
                <button class="next-button">${t('buttons.nextQuestion')}</button>
            </div>
        `;
    }

    addEventListeners() {
        const buttons = this.shadowRoot.querySelectorAll('button[data-index]');
        const nextButton = this.shadowRoot.querySelector('.next-button');
        
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const selectedIndex = parseInt(button.dataset.index);
                const question = this.questions[this.currentQuestion];
                const feedback = this.shadowRoot.querySelector('.feedback');
                
                // Send answer to server
                this.socket.emit('info:answer', {
                    questionIndex: this.currentQuestion,
                    answerIndex: selectedIndex,
                    username: sessionStorage.getItem('username')
                });
                
                // Only show feedback if it exists for this answer
                const feedbackKey = `a${selectedIndex + 1}-feedback`;
                if (question[feedbackKey]) {
                    feedback.textContent = t(`questions.${this.currentQuestion}.${feedbackKey}`);
                    feedback.style.display = "block";
                }

                // Disable all option buttons after answering
                buttons.forEach(btn => btn.disabled = true);
                
                // Show next button
                nextButton.style.display = "block";
            });
        });

        nextButton.addEventListener('click', () => {
            this.currentQuestion++;
            if (this.currentQuestion < this.questions.length) {
                this.render();
                this.addEventListeners();
            } else {
                this.shadowRoot.innerHTML = `
                    <div class="question-container">
                        <h2>${t('congratulations')}</h2>
                    </div>
                `;
            }
        });
    }
}

customElements.define('questions-component', Questions);
