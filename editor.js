/**
 * Copyright 2025 Eyevinn Technology AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// WebRTCPlayer is loaded via script tag

class LiveBroadcastEditor {
    constructor() {
        this.streams = new Map();
        this.players = new Map();
        this.refreshInterval = null;
        this.isConnected = false;
        this.selectedChannelId = null;
        this.allStreams = [];
        this.currentPage = 0;
        this.gridColumns = 4;
        this.gridRows = 3;
        this.streamsPerPage = this.gridColumns * this.gridRows;
        this.streamToNumberMap = new Map(); // Maps streamId to its display number
        
        this.mosaicContainer = document.getElementById('mosaicContainer');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.sourceBtn = document.getElementById('sourceBtn');
        this.qrBtn = document.getElementById('qrBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.errorMessage = document.getElementById('errorMessage');
        this.prevPageBtn = document.getElementById('prevPageBtn');
        this.nextPageBtn = document.getElementById('nextPageBtn');
        this.pageInfo = document.getElementById('pageInfo');
        this.settingsModal = document.getElementById('settingsModal');
        this.closeModalBtn = document.getElementById('closeModalBtn');
        this.gridColumnsInput = document.getElementById('gridColumns');
        this.gridRowsInput = document.getElementById('gridRows');
        this.applyGridBtn = document.getElementById('applyGridBtn');
        this.countdownToggle = document.getElementById('countdownToggle');
        this.countdownStatus = document.getElementById('countdownStatus');
        
        // Countdown state
        this.countdownEnabled = false;
        this.countdownTimer = null;
        this.pendingSelection = null;
        
        // Audio notification settings
        this.audioNotificationsEnabled = localStorage.getItem('audioNotificationsEnabled') === 'true' || localStorage.getItem('audioNotificationsEnabled') === null; // Default to true
        this.notificationAudio = null;
        
        this.loadConfiguration();
        this.initializeAudioNotification();
        this.initializeEventListeners();
        this.initializeWebSocket();
        this.loadSelectedChannel();
        this.startAutoRefresh();
    }
    
    loadConfiguration() {
        this.whepGatewayUrl = window.WHEP_GATEWAY_URL || window.WHIP_GATEWAY_URL || 'https://eyevinnlab-livevibe.eyevinn-smb-whip-bridge.auto.prod.osaas.io';
        this.whepAuthKey = window.WHEP_AUTH_KEY || window.WHIP_AUTH_KEY || null;
        
        // Construct WHEP channel list endpoint
        this.whepChannelEndpoint = this.whepGatewayUrl + '/whep/channel';
        
        console.log('WHEP Gateway:', this.whepGatewayUrl);
        console.log('WHEP Channel Endpoint:', this.whepChannelEndpoint);
    }
    
    loadSelectedChannel() {
        this.selectedChannelId = localStorage.getItem('selectedChannelId');
        console.log('Loaded selected channel:', this.selectedChannelId);
    }
    
    initializeEventListeners() {
        this.refreshBtn.addEventListener('click', () => this.refreshStreams());
        this.sourceBtn.addEventListener('click', () => this.openSource());
        this.qrBtn.addEventListener('click', () => this.openQRCode());
        this.settingsBtn.addEventListener('click', () => this.showSettings());
        this.prevPageBtn.addEventListener('click', () => this.previousPage());
        this.nextPageBtn.addEventListener('click', () => this.nextPage());
        this.closeModalBtn.addEventListener('click', () => this.hideSettings());
        this.applyGridBtn.addEventListener('click', () => this.applyGridSettings());
        this.countdownToggle.addEventListener('click', () => this.toggleCountdown());
        
        // Audio notification toggle
        const audioNotificationToggle = document.getElementById('audioNotificationToggle');
        audioNotificationToggle.addEventListener('click', () => this.toggleAudioNotifications());
        
        // Close modal when clicking outside
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.hideSettings();
            }
        });
        
        // Close modal with Escape key and handle number key shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.settingsModal.style.display === 'block') {
                this.hideSettings();
                return;
            }
            
            // Handle number key shortcuts (1-9, 0)
            if (!this.settingsModal.style.display || this.settingsModal.style.display === 'none') {
                this.handleKeyboardShortcut(e);
            }
        });
    }
    
    initializeAudioNotification() {
        // Create audio element with a subtle notification sound (using Web Audio API to generate a tone)
        this.createNotificationSound();
        
        // Set initial toggle state
        const audioNotificationToggle = document.getElementById('audioNotificationToggle');
        if (this.audioNotificationsEnabled) {
            audioNotificationToggle.classList.add('active');
        }
    }
    
    createNotificationSound() {
        // Create a subtle notification sound using Web Audio API
        if (!window.AudioContext && !window.webkitAudioContext) {
            console.warn('Web Audio API not supported');
            return;
        }
        
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    playNotificationSound() {
        if (!this.audioNotificationsEnabled || !this.audioContext) return;
        
        try {
            // Resume audio context if suspended (required by some browsers)
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            // Create a pleasant notification sound
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Create a pleasant two-tone chime
            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime + 0.1);
            
            // Set volume envelope
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.3);
            
        } catch (error) {
            console.warn('Failed to play notification sound:', error);
        }
    }
    
    toggleAudioNotifications() {
        this.audioNotificationsEnabled = !this.audioNotificationsEnabled;
        localStorage.setItem('audioNotificationsEnabled', this.audioNotificationsEnabled.toString());
        
        const audioNotificationToggle = document.getElementById('audioNotificationToggle');
        if (this.audioNotificationsEnabled) {
            audioNotificationToggle.classList.add('active');
            // Play test sound when enabling
            setTimeout(() => this.playNotificationSound(), 100);
        } else {
            audioNotificationToggle.classList.remove('active');
        }
        
        console.log(`Audio notifications ${this.audioNotificationsEnabled ? 'enabled' : 'disabled'}`);
    }
    
    async refreshStreams() {
        try {
            this.updateConnectionStatus('loading');
            this.refreshBtn.disabled = true;
            this.refreshBtn.textContent = 'Refreshing...';
            
            const streams = await this.fetchAvailableStreams();
            await this.updateStreamMosaic(streams);
            
            this.updateConnectionStatus('connected');
            this.hideError();
            
        } catch (error) {
            console.error('Failed to refresh streams:', error);
            this.updateConnectionStatus('disconnected');
            this.showError(`Failed to fetch streams: ${error.message}`);
        } finally {
            this.refreshBtn.disabled = false;
            this.refreshBtn.textContent = 'Refresh Streams';
        }
    }
    
    async fetchAvailableStreams() {
        const headers = {};
        if (this.whepAuthKey) {
            headers['Authorization'] = `Bearer ${this.whepAuthKey}`;
        }
        
        const response = await fetch(this.whepChannelEndpoint, {
            method: 'GET',
            headers: headers
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Available streams:', data);
        
        // Handle different response formats
        if (Array.isArray(data)) {
            return data;
        } else if (data.streams && Array.isArray(data.streams)) {
            return data.streams;
        } else if (data.channels && Array.isArray(data.channels)) {
            return data.channels;
        } else {
            return [];
        }
    }
    
    async updateStreamMosaic(streams) {
        // Store all streams for pagination
        this.allStreams = streams;
        
        // Clear mosaic if no streams
        if (streams.length === 0) {
            this.showNoStreamsMessage();
            this.updatePagination();
            return;
        }
        
        this.hideNoStreamsMessage();
        
        // Clean up existing players
        for (const [streamId, player] of this.players) {
            player.destroy();
        }
        this.players.clear();
        this.mosaicContainer.innerHTML = '';
        
        // Display current page
        await this.displayCurrentPage();
        this.updatePagination();
    }
    
    async displayCurrentPage() {
        const startIndex = this.currentPage * this.streamsPerPage;
        const endIndex = Math.min(startIndex + this.streamsPerPage, this.allStreams.length);
        const currentPageStreams = this.allStreams.slice(startIndex, endIndex);
        
        // Clear stream-to-number mapping for current page
        this.streamToNumberMap.clear();
        
        // Add streams for current page with numbers
        for (let i = 0; i < currentPageStreams.length; i++) {
            const streamData = currentPageStreams[i];
            const streamId = streamData.channelId || streamData.id || streamData.streamId || streamData.channel;
            if (streamId) {
                // Assign number: 1-9, then 0 for 10th stream
                const streamNumber = i < 9 ? (i + 1).toString() : (i === 9 ? '0' : (i + 1).toString());
                this.streamToNumberMap.set(streamId, streamNumber);
                await this.addOrUpdateStream(streamId, streamData, streamNumber);
            }
        }
    }
    
    updatePagination() {
        const totalPages = Math.ceil(this.allStreams.length / this.streamsPerPage);
        
        // Update page info
        this.pageInfo.textContent = `Page ${this.currentPage + 1} of ${Math.max(1, totalPages)}`;
        
        // Update button states
        this.prevPageBtn.disabled = this.currentPage === 0;
        this.nextPageBtn.disabled = this.currentPage >= totalPages - 1 || totalPages === 0;
    }
    
    previousPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.refreshCurrentPage();
        }
    }
    
    nextPage() {
        const totalPages = Math.ceil(this.allStreams.length / this.streamsPerPage);
        if (this.currentPage < totalPages - 1) {
            this.currentPage++;
            this.refreshCurrentPage();
        }
    }
    
    async refreshCurrentPage() {
        // Clean up existing players
        for (const [streamId, player] of this.players) {
            player.destroy();
        }
        this.players.clear();
        this.mosaicContainer.innerHTML = '';
        
        // Display current page
        await this.displayCurrentPage();
        this.updatePagination();
    }
    
    async addOrUpdateStream(streamId, streamData, streamNumber) {
        if (this.players.has(streamId)) {
            // Stream already exists, just update info
            this.updateStreamInfo(streamId, streamData);
            return;
        }
        
        // Check if tile already exists (from failed previous attempt)
        const existingTile = document.getElementById(`tile-${streamId}`);
        if (existingTile) {
            // Remove existing failed tile
            existingTile.remove();
        }
        
        // Create new stream tile
        const streamTile = this.createStreamTile(streamId, streamData, streamNumber);
        this.mosaicContainer.appendChild(streamTile);
        
        // Initialize WHEP player
        try {
            await this.initializePlayer(streamId, streamData);
        } catch (error) {
            console.error(`Failed to initialize player for stream ${streamId}:`, error);
            this.updateStreamStatus(streamId, 'error', error.message);
            // Don't remove the tile here - keep it to show the error state
        }
    }
    
    createStreamTile(streamId, streamData, streamNumber) {
        const tile = document.createElement('div');
        tile.className = 'stream-tile';
        tile.id = `tile-${streamId}`;
        
        // Check if this is the selected stream
        if (streamId === this.selectedChannelId) {
            tile.classList.add('selected');
        }
        
        tile.innerHTML = `
            <video id="video-${streamId}" class="stream-video" autoplay playsinline muted></video>
            <div class="stream-number">${streamNumber}</div>
            <div class="stream-overlay">
                <div class="stream-info">
                    <div class="stream-id">${streamId}</div>
                    <div id="status-${streamId}" class="stream-status">Connecting...</div>
                </div>
                <div class="stream-selection">
                    <div class="selection-indicator">
                        <span class="selection-text">Press ${streamNumber} or click to put on air</span>
                        <span class="on-air-indicator">
                            <span class="on-air-dot"></span>
                            <span class="on-air-text">ON AIR</span>
                        </span>
                    </div>
                </div>
            </div>
            <div id="loading-${streamId}" class="stream-loading">
                <div class="spinner"></div>
                <div>Loading stream...</div>
            </div>
        `;
        
        // Add click handler for selection
        tile.addEventListener('click', () => this.selectStream(streamId));
        
        return tile;
    }
    
    async initializePlayer(streamId, streamData) {
        const videoElement = document.getElementById(`video-${streamId}`);
        if (!videoElement) {
            throw new Error('Video element not found');
        }
        
        // Construct WHEP playback URL
        let whepPlaybackUrl;
        if (streamData.resource) {
            // Resource path is relative, combine with gateway base URL
            whepPlaybackUrl = `${this.whepGatewayUrl}${streamData.resource}`;
        } else if (streamData.url) {
            whepPlaybackUrl = streamData.url;
        } else if (streamData.whepUrl) {
            whepPlaybackUrl = streamData.whepUrl;
        } else {
            // Fallback to constructed URL
            whepPlaybackUrl = `${this.whepGatewayUrl}/whep/${streamId}`;
        }
        
        console.log(`Initializing player for ${streamId} at ${whepPlaybackUrl}`);
        
        // Check if WebRTCPlayer is available
        if (!window.WebRTCPlayer) {
            throw new Error('WebRTCPlayer library not loaded');
        }
        
        const player = new window.WebRTCPlayer({
            video: videoElement,
            type: 'whep'
        });
        
        this.players.set(streamId, player);
        
        // Handle player events
        player.on('connecting', () => {
            console.log(`Stream ${streamId}: Connecting`);
            this.updateStreamStatus(streamId, 'loading', 'Connecting...');
        });
        
        player.on('connected', () => {
            console.log(`Stream ${streamId}: Connected`);
            this.updateStreamStatus(streamId, 'live', 'Live');
            this.hideStreamLoading(streamId);
            document.getElementById(`tile-${streamId}`).classList.add('active');
        });
        
        player.on('error', (error) => {
            console.error(`Stream ${streamId}: Error:`, error);
            this.updateStreamStatus(streamId, 'error', 'Error');
            this.hideStreamLoading(streamId);
        });
        
        player.on('disconnected', () => {
            console.log(`Stream ${streamId}: Stream disconnected`);
            this.updateStreamStatus(streamId, 'ended', 'Disconnected');
        });
        
        // Also listen to video element events as fallback
        videoElement.addEventListener('loadstart', () => {
            console.log(`Stream ${streamId}: Video load started`);
        });
        
        videoElement.addEventListener('canplay', () => {
            console.log(`Stream ${streamId}: Video can play`);
            this.updateStreamStatus(streamId, 'live', 'Live');
            this.hideStreamLoading(streamId);
            document.getElementById(`tile-${streamId}`).classList.add('active');
        });
        
        videoElement.addEventListener('playing', () => {
            console.log(`Stream ${streamId}: Video playing`);
            this.updateStreamStatus(streamId, 'live', 'Live');
            this.hideStreamLoading(streamId);
            document.getElementById(`tile-${streamId}`).classList.add('active');
        });
        
        videoElement.addEventListener('error', (error) => {
            console.error(`Stream ${streamId}: Video error:`, error);
            this.updateStreamStatus(streamId, 'error', 'Video Error');
            this.hideStreamLoading(streamId);
        });
        
        // Start playback (muted by default)
        try {
            await player.load(new URL(whepPlaybackUrl));
        } catch (error) {
            console.error(`Failed to start playback for ${streamId}:`, error);
            throw error;
        }
    }
    
    removeStream(streamId) {
        const player = this.players.get(streamId);
        if (player) {
            player.destroy();
            this.players.delete(streamId);
        }
        
        const tile = document.getElementById(`tile-${streamId}`);
        if (tile) {
            tile.remove();
        }
        
        this.streams.delete(streamId);
    }
    
    updateStreamInfo(streamId, streamData) {
        const streamIdElement = document.querySelector(`#tile-${streamId} .stream-id`);
        if (streamIdElement) {
            streamIdElement.textContent = streamId;
        }
    }
    
    updateStreamStatus(streamId, type, message) {
        const statusElement = document.getElementById(`status-${streamId}`);
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `stream-status ${type}`;
        }
    }
    
    hideStreamLoading(streamId) {
        const loadingElement = document.getElementById(`loading-${streamId}`);
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
    
    updateConnectionStatus(status) {
        this.connectionStatus.className = `status ${status}`;
        switch (status) {
            case 'connected':
                this.connectionStatus.textContent = 'Connected';
                this.isConnected = true;
                break;
            case 'disconnected':
                this.connectionStatus.textContent = 'Disconnected';
                this.isConnected = false;
                break;
            case 'loading':
                this.connectionStatus.textContent = 'Loading...';
                break;
        }
    }
    
    showNoStreamsMessage() {
        this.mosaicContainer.innerHTML = `
            <div class="no-streams">
                <h2>No Active Streams</h2>
                <p>Waiting for participants to join the broadcast...</p>
                <div class="spinner"></div>
            </div>
        `;
    }
    
    hideNoStreamsMessage() {
        const noStreams = this.mosaicContainer.querySelector('.no-streams');
        if (noStreams) {
            noStreams.remove();
        }
    }
    
    
    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
        
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }
    
    hideError() {
        this.errorMessage.style.display = 'none';
    }
    
    openSource() {
        const sourceUrl = '/source';
        window.open(sourceUrl, '_blank');
    }
    
    openQRCode() {
        const qrUrl = '/qr';
        window.open(qrUrl, '_blank');
    }
    
    toggleCountdown() {
        this.countdownEnabled = !this.countdownEnabled;
        
        if (this.countdownEnabled) {
            this.countdownToggle.classList.add('active');
            this.countdownStatus.textContent = 'Take in 5';
        } else {
            this.countdownToggle.classList.remove('active');
            this.countdownStatus.textContent = 'Take';
            
            // Cancel any pending countdown
            if (this.countdownTimer) {
                clearTimeout(this.countdownTimer);
                this.countdownTimer = null;
            }
            if (this.pendingSelection) {
                this.sendWebSocketMessage({
                    type: 'cancelCountdown'
                });
                this.pendingSelection = null;
            }
        }
        
        console.log(`Countdown mode ${this.countdownEnabled ? 'enabled' : 'disabled'}`);
    }
    
    showSettings() {
        // Update settings values
        document.getElementById('whepGatewayValue').textContent = this.whepGatewayUrl;
        document.getElementById('whepChannelValue').textContent = this.whepChannelEndpoint;
        document.getElementById('authKeyValue').textContent = this.whepAuthKey ? '[SET]' : '[NOT SET]';
        document.getElementById('activeStreamsValue').textContent = this.players.size;
        
        // Update grid inputs
        this.gridColumnsInput.value = this.gridColumns;
        this.gridRowsInput.value = this.gridRows;
        
        // Show modal
        this.settingsModal.style.display = 'block';
    }
    
    hideSettings() {
        this.settingsModal.style.display = 'none';
    }
    
    applyGridSettings() {
        const columns = parseInt(this.gridColumnsInput.value);
        const rows = parseInt(this.gridRowsInput.value);
        
        if (columns < 1 || columns > 12 || rows < 1 || rows > 8) {
            alert('Invalid grid dimensions. Columns must be 1-12, rows must be 1-8.');
            return;
        }
        
        this.gridColumns = columns;
        this.gridRows = rows;
        this.streamsPerPage = this.gridColumns * this.gridRows;
        
        // Update CSS grid
        this.mosaicContainer.style.gridTemplateColumns = `repeat(${this.gridColumns}, 1fr)`;
        this.mosaicContainer.style.gridTemplateRows = `repeat(${this.gridRows}, 1fr)`;
        
        // Reset to first page and refresh display
        this.currentPage = 0;
        this.refreshCurrentPage();
        
        console.log(`Grid updated to ${this.gridColumns}x${this.gridRows} (${this.streamsPerPage} streams per page)`);
    }
    
    startAutoRefresh() {
        // Initial load only
        this.refreshStreams();
    }
    
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
    
    handleKeyboardShortcut(event) {
        // Only handle number keys (1-9, 0)
        const key = event.key;
        if (!/^[0-9]$/.test(key)) {
            return;
        }
        
        // Prevent default browser behavior
        event.preventDefault();
        
        // Find the stream that corresponds to this number
        let targetStreamId = null;
        for (const [streamId, streamNumber] of this.streamToNumberMap) {
            if (streamNumber === key) {
                targetStreamId = streamId;
                break;
            }
        }
        
        if (targetStreamId) {
            console.log(`Keyboard shortcut: Selecting stream ${targetStreamId} with key ${key}`);
            this.selectStream(targetStreamId);
        } else {
            console.log(`No stream found for key ${key}`);
        }
    }
    
    selectStream(streamId) {
        console.log(`Selecting stream: ${streamId}`);
        
        // Check if this stream is already selected
        if (this.selectedChannelId === streamId) {
            // Deselect - take off air
            console.log(`Taking stream ${streamId} OFF AIR`);
            
            const currentSelected = document.querySelector('.stream-tile.selected');
            if (currentSelected) {
                currentSelected.classList.remove('selected');
            }
            
            this.selectedChannelId = null;
            this.sendWebSocketMessage({
                type: 'deselectChannel'
            });
            
            // Cancel any pending countdown
            if (this.countdownTimer) {
                clearTimeout(this.countdownTimer);
                this.countdownTimer = null;
            }
            if (this.pendingSelection) {
                this.sendWebSocketMessage({
                    type: 'cancelCountdown'
                });
                this.pendingSelection = null;
            }
            
            return;
        }
        
        // Cancel any existing countdown
        if (this.countdownTimer) {
            clearTimeout(this.countdownTimer);
            this.countdownTimer = null;
        }
        if (this.pendingSelection) {
            this.sendWebSocketMessage({
                type: 'cancelCountdown'
            });
        }
        
        // Check if countdown is enabled
        if (this.countdownEnabled) {
            // Start countdown
            this.pendingSelection = streamId;
            this.startCountdown(streamId);
        } else {
            // Immediate selection
            this.actuallySelectStream(streamId);
        }
    }
    
    startCountdown(streamId) {
        console.log(`Starting countdown for stream: ${streamId}`);
        
        // Send countdown start message to participants
        this.sendWebSocketMessage({
            type: 'startCountdown',
            channelId: streamId,
            seconds: 5
        });
        
        // Start the countdown timer
        let timeLeft = 5;
        const countdownInterval = setInterval(() => {
            timeLeft--;
            
            if (timeLeft > 0) {
                // Update countdown message
                this.sendWebSocketMessage({
                    type: 'countdownUpdate',
                    channelId: streamId,
                    seconds: timeLeft
                });
            } else {
                // Countdown finished, actually select the stream
                clearInterval(countdownInterval);
                this.countdownTimer = null;
                this.pendingSelection = null;
                this.actuallySelectStream(streamId);
            }
        }, 1000);
        
        this.countdownTimer = countdownInterval;
    }
    
    actuallySelectStream(streamId) {
        console.log(`Actually selecting stream: ${streamId}`);
        
        // Update visual selection
        const previousSelected = document.querySelector('.stream-tile.selected');
        if (previousSelected) {
            previousSelected.classList.remove('selected');
        }
        
        const newSelected = document.getElementById(`tile-${streamId}`);
        if (newSelected) {
            newSelected.classList.add('selected');
        }
        
        // Update state and send WebSocket message
        this.selectedChannelId = streamId;
        this.sendWebSocketMessage({
            type: 'selectChannel',
            channelId: streamId
        });
        
        console.log(`Stream ${streamId} is now ON AIR`);
    }
    
    initializeWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                switch (data.type) {
                    case 'channelSelected':
                        this.selectedChannelId = data.channelId;
                        this.updateStreamTiles();
                        break;
                        
                    case 'channelDeselected':
                        this.selectedChannelId = null;
                        this.updateStreamTiles();
                        break;
                        
                    case 'participantJoined':
                        console.log(`Participant joined: ${data.channelId}`);
                        // Play notification sound
                        this.playNotificationSound();
                        // Delay refresh to allow stream establishment at gateway
                        setTimeout(() => this.refreshStreams(), 2000);
                        break;
                        
                    case 'participantLeft':
                        console.log(`Participant left: ${data.channelId}`);
                        // Delay refresh to allow stream cleanup at gateway
                        setTimeout(() => this.refreshStreams(), 2000);
                        break;
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            // Attempt to reconnect after 3 seconds
            setTimeout(() => {
                this.initializeWebSocket();
            }, 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
    
    sendWebSocketMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket not connected, message not sent:', message);
        }
    }
    
    updateStreamTiles() {
        // Update visual selection of all stream tiles based on selectedChannelId
        const allTiles = document.querySelectorAll('.stream-tile');
        
        allTiles.forEach(tile => {
            const streamId = tile.id.replace('tile-', '');
            if (streamId === this.selectedChannelId) {
                tile.classList.add('selected');
            } else {
                tile.classList.remove('selected');
            }
        });
    }
    
    cleanup() {
        this.stopAutoRefresh();
        
        // Close WebSocket connection
        if (this.ws) {
            this.ws.close();
        }
        
        // Cleanup all players
        for (const [streamId, player] of this.players) {
            player.destroy();
        }
        this.players.clear();
        this.streams.clear();
    }
}

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (window.editor) {
        if (document.hidden) {
            console.log('Page hidden');
        } else {
            console.log('Page visible');
        }
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.editor) {
        window.editor.cleanup();
    }
});

// Export initialization function
export function initializeEditor() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.editor = new LiveBroadcastEditor();
        });
    } else {
        window.editor = new LiveBroadcastEditor();
    }
}

// Auto-initialize if WebRTCPlayer is already available (fallback)
if (typeof window !== 'undefined' && window.WebRTCPlayer) {
    initializeEditor();
}