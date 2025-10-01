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

import { WHIPClient } from './node_modules/@eyevinn/whip-web-client/dist/whip-client.modern.js';

class JoinLiveApp {
    constructor() {
        this.localStream = null;
        this.whipClient = null;
        this.isStreaming = false;
        this.channelId = null;
        
        this.localVideo = document.getElementById('localVideo');
        this.startCameraBtn = document.getElementById('startCameraBtn');
        this.joinLiveBtn = document.getElementById('joinLiveBtn');
        this.stopStreamBtn = document.getElementById('stopStreamBtn');
        this.statusDiv = document.getElementById('status');
        this.onAirIndicator = document.getElementById('onAirIndicator');
        
        this.initializeEventListeners();
        this.loadConfiguration();
        this.initializeWebSocket();
    }
    
    loadConfiguration() {
        this.whipGatewayUrl = window.WHIP_GATEWAY_URL || 'https://livevibe.osaas.io/whip';
        this.whipAuthKey = window.WHIP_AUTH_KEY || null;
    }
    
    initializeEventListeners() {
        this.startCameraBtn.addEventListener('click', () => this.startCamera());
        this.joinLiveBtn.addEventListener('click', () => this.joinLive());
        this.stopStreamBtn.addEventListener('click', () => this.stopStreaming());
    }
    
    async startCamera() {
        try {
            this.showStatus('Requesting camera access...', 'info');
            
            const constraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: true
            };
            
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.localVideo.srcObject = this.localStream;
            
            this.startCameraBtn.classList.add('hidden');
            this.joinLiveBtn.classList.remove('hidden');
            this.joinLiveBtn.disabled = false;
            
            this.showStatus('Camera ready! You can now join the live broadcast.', 'success');
            
        } catch (error) {
            console.error('Error accessing camera:', error);
            this.showStatus(`Failed to access camera: ${error.message}`, 'error');
        }
    }
    
    async joinLive() {
        if (!this.localStream) {
            this.showStatus('Please start your camera first.', 'error');
            return;
        }
        
        try {
            this.showStatus('Connecting to live broadcast...', 'info');
            this.joinLiveBtn.disabled = true;
            
            this.whipClient = new WHIPClient({
                endpoint: this.whipGatewayUrl,
                opts: {
                    authkey: this.whipAuthKey,
                    debug: true
                }
            });
            
            const response = await this.whipClient.ingest(this.localStream);
            
            // Extract channel ID using getResourceUrl() method
            try {
                const resourceUrl = await this.whipClient.getResourceUrl();
                
                if (resourceUrl) {
                    // Extract channel ID from the end of the URL path
                    const match = resourceUrl.match(/\/([^\/]+)$/);
                    if (match) {
                        this.channelId = match[1];
                        console.log('Channel ID:', this.channelId);
                    }
                }
            } catch (error) {
                console.error('Error extracting channel ID:', error);
            }
            
            this.isStreaming = true;
            this.joinLiveBtn.classList.add('hidden');
            this.stopStreamBtn.classList.remove('hidden');
            
            this.showStatus('🔴 Live! You are now broadcasting.', 'success');
            
        } catch (error) {
            console.error('Error joining live broadcast:', error);
            this.showStatus(`Failed to join live broadcast: ${error.message}`, 'error');
            this.joinLiveBtn.disabled = false;
        }
    }
    
    async stopStreaming() {
        try {
            this.showStatus('Stopping broadcast...', 'info');
            
            if (this.whipClient) {
                await this.whipClient.destroy();
                this.whipClient = null;
            }
            
            this.isStreaming = false;
            this.channelId = null;
            this.stopStreamBtn.classList.add('hidden');
            this.joinLiveBtn.classList.remove('hidden');
            this.joinLiveBtn.disabled = false;
            
            this.showStatus('Broadcast stopped. You can rejoin at any time.', 'info');
            
        } catch (error) {
            console.error('Error stopping stream:', error);
            this.showStatus(`Error stopping stream: ${error.message}`, 'error');
        }
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
                        this.updateOnAirStatus(data.channelId);
                        break;
                        
                    case 'channelDeselected':
                        this.updateOnAirStatus(null);
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
    
    updateOnAirStatus(selectedChannelId) {
        const isOnAir = this.channelId && selectedChannelId === this.channelId;
        
        if (isOnAir) {
            this.onAirIndicator.style.display = 'flex';
        } else {
            this.onAirIndicator.style.display = 'none';
        }
    }
    
    showStatus(message, type = 'info') {
        this.statusDiv.textContent = message;
        this.statusDiv.className = `status ${type}`;
        this.statusDiv.classList.remove('hidden');
        
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                if (this.statusDiv.textContent === message) {
                    this.statusDiv.classList.add('hidden');
                }
            }, 5000);
        }
    }
    
    cleanup() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        if (this.whipClient) {
            this.whipClient.destroy();
        }
        if (this.ws) {
            this.ws.close();
        }
    }
}

window.addEventListener('beforeunload', () => {
    if (window.app) {
        window.app.cleanup();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    window.app = new JoinLiveApp();
});