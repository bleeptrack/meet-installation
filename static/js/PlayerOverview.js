import { sharedStyles } from './shared-styles.js';

class PlayerOverview extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.players = [];
        this.assigningChildFor = null; // Track which parent is assigning a child
        this.totalQuestions = 5; // Default value, will be updated from JSON
        console.log('Window socket before assignment:', window.socket);
        this.socket = window.socket; // Use the global socket instance
        console.log('Socket after assignment:', this.socket);
    }

    async connectedCallback() {
        if (!this.socket) {
            console.error('Socket is not available!');
            return;
        }

        // Load question count from JSON
        await this.loadQuestionCount();

        // Add socket connection status listeners
        this.socket.on('connect', () => {
            console.log('Socket connected with ID:', this.socket.id);
        });
        
        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
        });

        this.socket.on('info:sessionStatus', (sessionStatus) => {
            console.log('Received info:sessionStatus event:', sessionStatus);
            this.sessionStatus = sessionStatus.status;
            this.sessionToken = sessionStatus.token;
            this.render();
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

        this.socket.emit("action:getPlayers", {}, (data) => {
            console.log("Received players:", data);
            this.players = data.players;
            this.sessionStatus = data.sessionToken ? "started" : "ended";
            this.sessionToken = data.sessionToken;
            this.render();
        });
    }

    async loadQuestionCount() {
        try {
            const response = await fetch('/translations/de-DE.json');
            const data = await response.json();
            this.totalQuestions = data.questions ? data.questions.length : 5;
            console.log('Loaded question count:', this.totalQuestions);
        } catch (error) {
            console.error('Error loading question count:', error);
            // Keep default value of 5
        }
    }

    disconnectedCallback() {
        // Clean up socket listeners when component is removed
        this.socket.off('info:players');
        console.log('PlayerOverview disconnected');
    }

    render() {
        const isActive = this.sessionStatus === 'started';
        this.shadowRoot.innerHTML = `
            <style>
                ${sharedStyles}
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
                .status-dot {
                    display: inline-block;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    margin-right: 6px;
                    vertical-align: middle;
                }
                .status-dot.connected {
                    background: #4CAF50;
                }
                .status-dot.disconnected {
                    background: #F44336;
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
                .language-badge {
                    float: right;
                }
            </style>
            <div class="player-list">
                ${this.players.some(player => player.groupId !== undefined) ? this.renderGroupedPlayers() : this.renderPlayerList()}
            </div>
            <div class="session-status">
                <p>Session Status: ${this.sessionStatus} (${this.sessionToken})</p>
            </div>
            <button id="startSession" ${isActive ? 'disabled' : ''}>Start Session</button>
            <button id="startQuestions" ${!isActive ? 'disabled' : ''}>Start Questions</button>
            <button id="startResults" ${!isActive ? 'disabled' : ''}>Start Results</button>
            <button id="startGrouping" ${!isActive ? 'disabled' : ''}>Start Grouping</button>
            <button id="endSession" ${!isActive ? 'disabled' : ''}>End Session</button>
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
            const color = answerCount >= this.totalQuestions ? this.getPairColor(11) : this.getPairColor(0);

            // Show if player is parent or child
            let roleLabel = '';
            let connectionLabel = '';
            let removeConnectionBtn = '';
            if (player.childId) {
                roleLabel = ' (Connection)';
                // Find the child username
                const child = this.players.find(p => p.id === player.childId);
                if (child) {
                    connectionLabel = ` &rarr;  ${child.username}`;
                    removeConnectionBtn = `<button id="removeConnectionBtn-${player.username}">Remove Connection</button>`;
                }
            }
            if (player.isChild) {
                roleLabel = ' (Connection)';
                // Find the parent username
                const parent = this.players.find(p => p.childId === player.id);
                if (parent) {
                    connectionLabel = ` &larr;  ${parent.username}`;
                }
            }

            // Show dropdown if assigning child for this player
            let assignChildUI = '';
            if (this.assigningChildFor === player.username) {
                // List all players who are not this player and not already a child
                const eligibleChildren = this.players.filter(
                    p => p.username !== player.username && !p.isChild
                );
                assignChildUI = `
                    <select id="childSelect-${player.username}">
                        <option value="">Select Player</option>
                        ${eligibleChildren.map(child => `<option value="${child.username}">${child.username}</option>`).join('')}
                    </select>
                    <button id="confirmAssignChild-${player.username}">Confirm</button>
                    <button id="cancelAssignChild-${player.username}">Cancel</button>
                `;
            } else if (!player.isChild && !player.childId) {
                assignChildUI = `<button id="assignChildBtn-${player.username}">connect with...</button>`;
            }

            // Connection status icon
            const statusClass = player.connected ? 'connected' : 'disconnected';
            const statusTitle = player.connected ? 'Connected' : 'Disconnected';
            const statusDot = `<span class="status-dot ${statusClass}" title="${statusTitle}"></span>`;

            // Language display
            const language = player.language || 'de-DE';
            const languageDisplay = language === 'de-DE' ? 'DE' : 'EN';

            return `
                <div class="player-item" style="background-color: ${color}">
                    ${statusDot}${player.username} <span class="language-badge">${languageDisplay}</span> ${answerCount} ${roleLabel} ${connectionLabel}
                    <label style="margin-left: 10px;">
                        <input type="checkbox" id="dgs-${player.username}" ${player.dgs ? 'checked' : ''} style="margin-right: 5px;">DGS
                    </label>
                    ${assignChildUI}
                    ${removeConnectionBtn}
                </div>
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
                    ${(groups[0] || []).map((player, index, array) => {
                        const language = player.language || 'de-DE';
                        const languageDisplay = language === 'de-DE' ? 'DE' : 'EN';
                        const dgsDisplay = player.dgs ? 'DGS' : '';
                        const answerCount = player.answers ? player.answers.length : 0;
                        const completionIndicator = answerCount >= this.totalQuestions ? '✓' : '';
                        return `
                        ${index > 0 && player.pairIndex !== array[index - 1].pairIndex ? '<hr style="margin: 10px 0; border: 1px dashed #ccc;">' : ''}
                        <div class="player-item" style="background-color: ${this.getPairColor(player.pairIndex)}">
                            <span class="status-dot ${player.connected ? 'connected' : 'disconnected'}" title="${player.connected ? 'Connected' : 'Disconnected'}"></span>${player.username} <span class="language-badge">${languageDisplay}</span> ${dgsDisplay ? `<span style="color: #FF6B35; font-weight: bold;">${dgsDisplay}</span>` : ''} 
                            <span id="count-${player.username}">(${answerCount}${completionIndicator})</span>
                            <select id="groupSelect-${player.username}" style="margin-left: 10px; padding: 2px;">
                                <option value="0" ${player.groupId === 0 ? 'selected' : ''}>Group A</option>
                                <option value="1" ${player.groupId === 1 ? 'selected' : ''}>Group B</option>
                                <option value="2" ${player.groupId === 2 ? 'selected' : ''}>Group C</option>
                            </select>
                        </div>
                    `;
                    }).join('')}
                </div>
                <div class="group-container">
                    <h3>Group B</h3>
                    ${(groups[1] || []).map((player, index, array) => {
                        const language = player.language || 'de-DE';
                        const languageDisplay = language === 'de-DE' ? 'DE' : 'EN';
                        const dgsDisplay = player.dgs ? 'DGS' : '';
                        const answerCount = player.answers ? player.answers.length : 0;
                        const completionIndicator = answerCount >= this.totalQuestions ? '✓' : '';
                        return `
                        ${index > 0 && player.pairIndex !== array[index - 1].pairIndex ? '<hr style="margin: 10px 0; border: 1px dashed #ccc;">' : ''}
                        <div class="player-item" style="background-color: ${this.getPairColor(player.pairIndex)}">
                            <span class="status-dot ${player.connected ? 'connected' : 'disconnected'}" title="${player.connected ? 'Connected' : 'Disconnected'}"></span>${player.username} <span class="language-badge">${languageDisplay}</span> ${dgsDisplay ? `<span style="color: #FF6B35; font-weight: bold;">${dgsDisplay}</span>` : ''} ${answerCount}${completionIndicator}
                            <select id="groupSelect-${player.username}" style="margin-left: 10px; padding: 2px;">
                                <option value="0" ${player.groupId === 0 ? 'selected' : ''}>Group A</option>
                                <option value="1" ${player.groupId === 1 ? 'selected' : ''}>Group B</option>
                                <option value="2" ${player.groupId === 2 ? 'selected' : ''}>Group C</option>
                            </select>
                        </div>
                    `;
                    }).join('')}
                </div>
                <div class="group-container">
                    <h3>Group C</h3>
                    ${(groups[2] || []).map((player, index, array) => {
                        const language = player.language || 'de-DE';
                        const languageDisplay = language === 'de-DE' ? 'DE' : 'EN';
                        const dgsDisplay = player.dgs ? 'DGS' : '';
                        const answerCount = player.answers ? player.answers.length : 0;
                        const completionIndicator = answerCount >= this.totalQuestions ? '✓' : '';
                        return `
                        ${index > 0 && player.pairIndex !== array[index - 1].pairIndex ? '<hr style="margin: 10px 0; border: 1px dashed #ccc;">' : ''}
                        <div class="player-item" style="background-color: ${this.getPairColor(player.pairIndex)}">
                            <span class="status-dot ${player.connected ? 'connected' : 'disconnected'}" title="${player.connected ? 'Connected' : 'Disconnected'}"></span>${player.username} <span class="language-badge">${languageDisplay}</span> ${dgsDisplay ? `<span style="color: #FF6B35; font-weight: bold;">${dgsDisplay}</span>` : ''} ${answerCount}${completionIndicator}
                            <select id="groupSelect-${player.username}" style="margin-left: 10px; padding: 2px;">
                                <option value="0" ${player.groupId === 0 ? 'selected' : ''}>Group A</option>
                                <option value="1" ${player.groupId === 1 ? 'selected' : ''}>Group B</option>
                                <option value="2" ${player.groupId === 2 ? 'selected' : ''}>Group C</option>
                            </select>
                        </div>
                    `;
                    }).join('')}
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
        const endSessionButton = this.shadowRoot.querySelector('#endSession');
        
        startSessionButton.addEventListener('click', () => {
            console.log('Starting session');
            this.socket.emit('action:startSession');
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

        endSessionButton.addEventListener('click', () => {
            if (confirm('Are you sure you want to end the session? This will remove all players and their answers.')) {
                this.socket.emit('action:endSession');
            }
        });

        this.players.forEach(player => {
            if (!player.isChild) {
                const assignBtn = this.shadowRoot.querySelector(`#assignChildBtn-${player.username}`);
                if (assignBtn) {
                    assignBtn.addEventListener('click', () => {
                        this.assigningChildFor = player.username;
                        this.render();
                    });
                }
                const confirmBtn = this.shadowRoot.querySelector(`#confirmAssignChild-${player.username}`);
                if (confirmBtn) {
                    confirmBtn.addEventListener('click', () => {
                        const select = this.shadowRoot.querySelector(`#childSelect-${player.username}`);
                        const childUsername = select.value;
                        if (childUsername) {
                            this.socket.emit('action:assignParentChild', {
                                parentUsername: player.username,
                                childUsername
                            });
                            this.assigningChildFor = null;
                            this.render();
                        }
                    });
                }
                const cancelBtn = this.shadowRoot.querySelector(`#cancelAssignChild-${player.username}`);
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', () => {
                        this.assigningChildFor = null;
                        this.render();
                    });
                }
            }
            // Remove connection button for parents
            const removeBtn = this.shadowRoot.querySelector(`#removeConnectionBtn-${player.username}`);
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    this.socket.emit('action:removeParentChild', { parentUsername: player.username });
                });
            }
            
            // DGS checkbox event listener
            const dgsCheckbox = this.shadowRoot.querySelector(`#dgs-${player.username}`);
            if (dgsCheckbox) {
                dgsCheckbox.addEventListener('change', (event) => {
                    this.socket.emit('action:updateDGS', {
                        username: player.username,
                        dgs: event.target.checked
                    });
                });
            }
            
            // Group selection dropdown event listener
            const groupSelect = this.shadowRoot.querySelector(`#groupSelect-${player.username}`);
            if (groupSelect) {
                groupSelect.addEventListener('change', (event) => {
                    const newGroupId = parseInt(event.target.value);
                    this.socket.emit('action:reassignGroup', {
                        username: player.username,
                        newGroupId: newGroupId
                    });
                });
            }
        });
    }
}

customElements.define('player-overview', PlayerOverview);
