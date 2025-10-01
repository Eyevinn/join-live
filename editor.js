// WebRTCPlayer is loaded via script tag

class LiveBroadcastEditor {
    constructor() {
        this.streams = new Map();
        this.players = new Map();
        this.refreshInterval = null;
        this.isConnected = false;
        
        this.mosaicContainer = document.getElementById('mosaicContainer');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.errorMessage = document.getElementById('errorMessage');
        
        this.loadConfiguration();
        this.initializeEventListeners();
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
    
    initializeEventListeners() {
        this.refreshBtn.addEventListener('click', () => this.refreshStreams());
        this.settingsBtn.addEventListener('click', () => this.showSettings());
        
        // Handle window resize for responsive grid
        window.addEventListener('resize', () => this.adjustMosaicLayout());
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
        // Remove streams that are no longer available
        const activeStreamIds = new Set(streams.map(stream => stream.channelId || stream.id || stream.streamId || stream.channel || stream.resource || 'unknown_stream'));
        
        for (const [streamId, player] of this.players) {
            if (!activeStreamIds.has(streamId)) {
                this.removeStream(streamId);
            }
        }
        
        // Clear mosaic if no streams
        if (streams.length === 0) {
            this.showNoStreamsMessage();
            return;
        }
        
        this.hideNoStreamsMessage();
        
        // Add or update streams
        for (const stream of streams) {
            const streamId = stream.channelId || stream.id || stream.streamId || stream.channel || stream.resource || 'unknown_stream';
            await this.addOrUpdateStream(streamId, stream);
        }
        
        this.adjustMosaicLayout();
    }
    
    async addOrUpdateStream(streamId, streamData) {
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
        const streamTile = this.createStreamTile(streamId, streamData);
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
    
    createStreamTile(streamId, streamData) {
        const tile = document.createElement('div');
        tile.className = 'stream-tile';
        tile.id = `tile-${streamId}`;
        
        tile.innerHTML = `
            <video id="video-${streamId}" class="stream-video" autoplay playsinline muted></video>
            <div class="stream-overlay">
                <div class="stream-info">
                    <div class="stream-id">${streamId}</div>
                    <div id="status-${streamId}" class="stream-status">Connecting...</div>
                </div>
            </div>
            <div id="loading-${streamId}" class="stream-loading">
                <div class="spinner"></div>
                <div>Loading stream...</div>
            </div>
        `;
        
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
    
    adjustMosaicLayout() {
        const streamCount = this.players.size;
        const container = this.mosaicContainer;
        
        if (streamCount === 0) return;
        
        // Adjust grid based on number of streams
        let columns;
        if (streamCount === 1) columns = 1;
        else if (streamCount <= 4) columns = 2;
        else if (streamCount <= 9) columns = 3;
        else columns = 4;
        
        container.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
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
    
    showSettings() {
        const settings = {
            'WHEP Gateway': this.whepGatewayUrl,
            'WHEP Channel Endpoint': this.whepChannelEndpoint,
            'Auth Key': this.whepAuthKey ? '[SET]' : '[NOT SET]',
            'Active Streams': this.players.size
        };
        
        let message = 'Editor Configuration:\n\n';
        for (const [key, value] of Object.entries(settings)) {
            message += `${key}: ${value}\n`;
        }
        
        alert(message);
    }
    
    startAutoRefresh() {
        // Initial load
        this.refreshStreams();
        
        // Auto-refresh every 10 seconds
        this.refreshInterval = setInterval(() => {
            if (!document.hidden) { // Only refresh when tab is visible
                this.refreshStreams();
            }
        }, 10000);
    }
    
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
    
    cleanup() {
        this.stopAutoRefresh();
        
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
            console.log('Page hidden, pausing auto-refresh');
        } else {
            console.log('Page visible, resuming auto-refresh');
            window.editor.refreshStreams();
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