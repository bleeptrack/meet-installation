class PlayerOverview extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.players = [];
        console.log('Window socket before assignment:', window.socket);
        this.socket = window.socket; // Use the global socket instance
        console.log('Socket after assignment:', this.socket);
    }

    connectedCallback() {
        if (!this.socket) {
            console.error('Socket is not available!');
            return;
        }
        
        // Add socket connection status listeners
        this.socket.on('connect', () => {
            console.log('Socket connected with ID:', this.socket.id);
        });
        
        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
        });

        this.socket.on('info:players', (players) => {
            console.log('Received info:players event:', players);
            this.players = players;
            this.render();
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });

        this.render();
    }

    disconnectedCallback() {
        // Clean up socket listeners when component is removed
        this.socket.off('info:players');
        console.log('PlayerOverview disconnected');
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                .player-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                .group-container {
                    border: 2px solid #4CAF50;
                    margin: 10px;
                    padding: 10px;
                    border-radius: 8px;
                }
                .pair-container {
                    border: 1px solid #2196F3;
                    margin: 5px;
                    padding: 5px;
                    border-radius: 4px;
                }
                .player-item {
                    padding: 10px;
                    margin: 5px;
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
                    margin: 5px;
                }
                button:hover {
                    background-color: #45a049;
                }
                button:disabled {
                    background-color: #cccccc;
                    cursor: not-allowed;
                }
            </style>
            <div class="player-list">
                ${this.players.some(player => player.groupId !== undefined) ? this.renderGroupedPlayers() : this.renderPlayerList()}
            </div>
            <button id="startSession">Start Session</button>
            <button id="startQuestions">Start Questions</button>
            <button id="startResults">Start Results</button>
            <button id="startGrouping">Start Grouping</button>
        `;
        this.addEventListeners();
    }

    getPairColor(pairIndex) {
        const colors = [
            '#FFE4E1', // Misty Rose
            '#E0FFFF', // Light Cyan
            '#F0FFF0', // Honeydew
            '#FFF0F5', // Lavender Blush
            '#F5F5DC', // Beige
            '#E6E6FA', // Lavender
            '#FFEFD5', // Peach Puff
            '#F0F8FF', // Alice Blue
            '#FFFACD', // Lemon Chiffon
            '#F5FFFA', // Mint Cream
            '#FFFAF0', // Floral White
            '#F8F8FF'  // Ghost White
        ];
        return colors[pairIndex % colors.length];
    }

    renderPlayerList() {
        return this.players.map(player => {
            const answerCount = player.answers ? player.answers.length : 0;
            const color = answerCount >= 5 ? this.getPairColor(11) : this.getPairColor(0);
            return `
                <div class="player-item" style="background-color: ${color}">${player.username} ${answerCount}</div>
            `;
        }).join('');
    }


    renderGroupedPlayers() {
        // Group players by groupID
        const groups = {};
        this.players.forEach(player => {
            if (player.groupId !== undefined) {
                if (!groups[player.groupId]) {
                    groups[player.groupId] = [];
                }
                groups[player.groupId].push(player);
                // Sort players by pairIndex after adding to group
                groups[player.groupId].sort((a, b) => a.pairIndex - b.pairIndex);
            }
            console.log("Groups:", groups);
        });

        // Create three boxes for groups A, B, and C
        return `
            <div class="groups-container" style="display: flex; justify-content: space-between; gap: 20px;">
                <div class="group-container">
                    <h3>Group A</h3>
                    ${(groups[0] || []).map((player, index, array) => `
                        ${index > 0 && player.pairIndex !== array[index - 1].pairIndex ? '<hr style="margin: 10px 0; border: 1px dashed #ccc;">' : ''}
                        <div class="player-item" style="background-color: ${this.getPairColor(player.pairIndex)}">${player.username}</div>
                    `).join('')}
                </div>
                <div class="group-container">
                    <h3>Group B</h3>
                    ${(groups[1] || []).map((player, index, array) => `
                        ${index > 0 && player.pairIndex !== array[index - 1].pairIndex ? '<hr style="margin: 10px 0; border: 1px dashed #ccc;">' : ''}
                        <div class="player-item" style="background-color: ${this.getPairColor(player.pairIndex)}">${player.username}</div>
                    `).join('')}
                </div>
                <div class="group-container">
                    <h3>Group C</h3>
                    ${(groups[2] || []).map((player, index, array) => `
                        ${index > 0 && player.pairIndex !== array[index - 1].pairIndex ? '<hr style="margin: 10px 0; border: 1px dashed #ccc;">' : ''}
                        <div class="player-item" style="background-color: ${this.getPairColor(player.pairIndex)}">${player.username}</div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    addEventListeners() {
        console.log('Setting up info:players listener');
        
        const startSessionButton = this.shadowRoot.querySelector('#startSession');
        const startQuestionsButton = this.shadowRoot.querySelector('#startQuestions');
        const startResultsButton = this.shadowRoot.querySelector('#startResults');
        const startGroupingButton = this.shadowRoot.querySelector('#startGrouping');
        
        startSessionButton.addEventListener('click', () => {
            console.log('Starting session');
            if (confirm('Are you sure you want to clear the session? This will remove all players and their answers.')) {
                this.socket.emit('action:clearSession');
            }
        });

        startQuestionsButton.addEventListener('click', () => {
            this.socket.emit('action:startQuestions');
        });

        startResultsButton.addEventListener('click', () => {
            this.socket.emit('action:startResults');
        });

        startGroupingButton.addEventListener('click', () => {
            this.socket.emit('action:startGrouping');
        });
    }
}

customElements.define('player-overview', PlayerOverview);
