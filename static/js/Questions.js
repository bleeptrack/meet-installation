import i18next from 'i18next';
import { t, i18nPromise } from '/js/i18n.js';
import { sharedStyles } from './shared-styles.js';

class Questions extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.socket = window.socket;
        // Load current question from localStorage or default to 0
        this.currentQuestion = parseInt(localStorage.getItem('currentQuestion')) || 0;
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
        if(!question) {
            this.showEndScreen();
            return;
        }
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
                }
                .question-container {
                    
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .question {
                    font-size: clamp(18px, 5vw, 24px);
                    margin-bottom: 20px;
                    line-height: 1.4;
                    text-align: center;
                    width: 100%;
                }
                .options {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    max-width: 500px;
                }
                .feedback {
                    margin-top: 20px;
                    padding: 15px;
                    border-radius: 8px;
                    display: none;
                    background-color: rgba(248, 249, 250, 0.9);
                    color: #333;
                    font-size: 16px;
                    line-height: 1.5;
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
                    username: localStorage.getItem('username')
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

        if (nextButton) {
            nextButton.addEventListener('click', () => {
                this.currentQuestion++;
                // Save current question to localStorage
                localStorage.setItem('currentQuestion', this.currentQuestion);
                this.proceedToNextQuestion();
            });
        }
    }

    proceedToNextQuestion() {
        if (this.currentQuestion < this.questions.length) {
            this.render();
            this.addEventListeners();
        } else {
            // Clear the question state when completed
            //localStorage.removeItem('currentQuestion');
            this.showEndScreen();
        }
    }

    showEndScreen() {
        this.shadowRoot.innerHTML = `
            <div class="question-container">
                <h2>${t('questions-wait-to-finish')}</h2>
            </div>
        `;
    }
}

customElements.define('questions-component', Questions);
