import i18next from 'i18next';
import { t, i18nPromise } from '/js/i18n.js';
import { sharedStyles } from './shared-styles.js';

class Questions extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.socket = window.socket;
        // Load current question from attribute or default to 0
        console.log("Questions constructor", this.getAttribute('current-question'));
        this.currentQuestion = parseInt(this.getAttribute('current-question')) || 0;
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
                    width: 100%;
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
                .feedback {
                    margin-top: 20px;
                    padding: 15px;
                    border-radius: 8px;
                    display: none;
                    background-color: rgba(248, 249, 250, 0.9);
                    color: #333;
                    font-size: 16px;
                    line-height: 1.5;
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 1000;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    min-width: 80%;
                    min-height: 80%;
                    overflow-y: auto;
                    animation: feedbackGrow 0.5s ease-out;
                }
                @keyframes feedbackGrow {
                    from {
                        opacity: 0;
                        transform: translate(var(--start-x), var(--start-y)) scale(0.1);
                    }
                    to {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                    }
                }
                button {
                    width: 100%;
                    min-width: 80%;
                    margin: 0 auto;
                    display: block;
                    min-height: 8vh;
                    padding: 2vh 4vw;
                    border-radius: 30px;
                    transition: min-height 1s ease, padding 1s ease, border-radius 1s ease, background-color 1s ease, color 1s ease, box-shadow 1s ease;
                }
                button.showing-feedback {
                    min-height: 50vh;
                    font-size: 22px;
                    line-height: 1.5;
                    padding: 6vh 8vw;
                    
                    border-radius: 32px;
                    background-color: #fff;
                    color: #111;
                    box-shadow: 0 8px 40px 0 rgba(0,0,0,0.13), 0 2px 8px 0 rgba(0,0,0,0.10);
                }
                .options.hide-others button:not(.showing-feedback) {
                    opacity: 0;
                    border: none;
                    pointer-events: none;
                    padding: 0;
                    height: 0px;
                    min-height: 0px;
                    overflow: hidden;
                    transition: opacity 1s ease, height 1s ease, padding 1s ease, border 1s ease;
                }
                .options {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    width: 80%;
                    position: relative;
                }
                .next-button {
                    margin-top: 20px;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.3s ease, visibility 0.3s ease;
                }
                .next-button.visible {
                    opacity: 1;
                    visibility: visible;
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
                <button class="next-button">${t('buttons.nextQuestion')}</button>
            </div>
        `;
    }

    addEventListeners() {
        const buttons = this.shadowRoot.querySelectorAll('button[data-index]');
        const nextButton = this.shadowRoot.querySelector('.next-button');
        
        buttons.forEach(button => {
            button.addEventListener('click', (event) => {
                const selectedIndex = parseInt(button.dataset.index);
                const question = this.questions[this.currentQuestion];
                
                // Send answer to server
                this.socket.emit('info:answer', {
                    questionIndex: this.currentQuestion,
                    answerIndex: selectedIndex,
                    username: localStorage.getItem('username')
                });
                
                // Only show feedback if it exists for this answer
                const feedbackKey = `a${selectedIndex + 1}-feedback`;
                if (question[feedbackKey]) {
                    button.textContent = t(`questions.${this.currentQuestion}.${feedbackKey}`);
                    
                } else {
                    // If no feedback, just disable all buttons without visual changes
                    buttons.forEach(btn => btn.disabled = true);
                }
                    
                button.classList.add('showing-feedback');
                // Still hide other buttons
                const optionsContainer = this.shadowRoot.querySelector('.options');
                optionsContainer.classList.add('hide-others');
                

                // Show next button
                nextButton.classList.add('visible');
            });
        });

        if (nextButton) {
            nextButton.addEventListener('click', () => {
                this.currentQuestion++;
                this.setAttribute('current-question', this.currentQuestion);
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
