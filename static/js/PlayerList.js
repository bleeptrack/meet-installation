import { sharedStyles } from './shared-styles.js';

class PlayerList extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.players = [];
        this.socket = window.socket; // Use the global socket instance
    }

    connectedCallback() {
        if (!this.socket) {
            console.error('Socket is not available!');
            return;
        }

        this.socket.on('info:players', (players) => {
            this.players = players;
            this.render();
        });

        this.render();

        this.socket.emit("action:getPlayers", {}, (data) => {
            this.players = data.players;
            this.render();
        });
    }

    disconnectedCallback() {
        // Clean up socket listeners when component is removed
        this.socket.off('info:players');
        console.log('PlayerList disconnected');
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                ${sharedStyles}
                .player-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                .player-item {
                    padding: 8px 12px;
                    margin: 2px 0;
                    border-radius: 4px;
                    background-color: rgba(255, 255, 255, 0.5);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }
                .status-dot {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    margin-right: 8px;
                    vertical-align: middle;
                }
                .status-dot.connected {
                    background: #4CAF50;
                }
                .status-dot.disconnected {
                    background: #F44336;
                }
                .language-badge {
                    float: right;
                }
            </style>
            <div class="player-list">
                ${this.renderPlayerList()}
            </div>
        `;
    }

    renderPlayerList() {
        return this.players.map(player => {
            // Connection status icon
            const statusClass = player.connected ? 'connected' : 'disconnected';
            const statusTitle = player.connected ? 'Connected' : 'Disconnected';
            const statusDot = `<span class="status-dot ${statusClass}" title="${statusTitle}"></span>`;

            // Language display
            const language = player.language || 'de-DE';
            const languageDisplay = language === 'de-DE' ? 'DE' : 'EN';

            return `
                <div class="player-item">
                    ${statusDot}${player.username} <span class="language-badge">${languageDisplay}</span>
                </div>
            `;
        }).join('');
    }

}

customElements.define('player-list', PlayerList);
