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
        this.countdownNotification = document.getElementById('countdownNotification');
        this.countdownNumber = document.getElementById('countdownNumber');
        
        this.initializeEventListeners();
        this.initializeInstructionsToggle();
        this.initializeMessaging();
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
    
    initializeInstructionsToggle() {
        const toggleBtn = document.getElementById('toggleInstructions');
        const instructionsContent = document.getElementById('instructionsContent');

        if (toggleBtn && instructionsContent) {
            toggleBtn.addEventListener('click', () => {
                instructionsContent.classList.toggle('collapsed');
                toggleBtn.textContent = instructionsContent.classList.contains('collapsed') ? '+' : '−';
            });
        }
    }

    initializeMessaging() {
        this.messageForm = document.getElementById('messageForm');
        this.submitMessageBtn = document.getElementById('submitMessageBtn');
        this.editorMessages = document.getElementById('editorMessages');
        this.editorMessageList = document.getElementById('editorMessageList');

        if (this.messageForm) {
            this.messageForm.addEventListener('submit', (e) => this.handleMessageSubmit(e));
        }
    }

    async handleMessageSubmit(e) {
        e.preventDefault();

        const nameInput = document.getElementById('participantName');
        const messageInput = document.getElementById('participantMessage');

        const name = nameInput.value.trim();
        const message = messageInput.value.trim();

        if (!name || !message) {
            this.showStatus('Please enter both name and message', 'error');
            return;
        }

        this.submitMessageBtn.disabled = true;
        this.submitMessageBtn.textContent = 'Sending...';

        this.sendWebSocketMessage({
            type: 'submitMessage',
            name: name,
            message: message
        });
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
                        
                        // Notify server that participant joined via WebSocket
                        this.sendWebSocketMessage({
                            type: 'participantJoin',
                            channelId: this.channelId
                        });
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
            
            // Notify server that participant is leaving via WebSocket
            if (this.channelId) {
                this.sendWebSocketMessage({
                    type: 'participantLeave',
                    channelId: this.channelId
                });
            }
            
            if (this.whipClient) {
                const resourceUrl = await this.whipClient.getResourceUrl();
                // Due to bug in SDK destroy() does not work if getResourceUrl() is not including base url
                if (resourceUrl && !resourceUrl.startsWith('http')) {
                    console.warn('Resource URL does not include base URL, will need manual DELETE call due to known SDK issue.');
                    const deleteUrl = new URL(resourceUrl, this.whipGatewayUrl).toString();
                    await fetch(deleteUrl, { method: 'DELETE' });
                } else {
                    await this.whipClient.destroy();
                }
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
                        
                    case 'countdownStart':
                        this.showCountdown(data.channelId, data.seconds);
                        break;
                        
                    case 'countdownUpdate':
                        this.updateCountdown(data.seconds);
                        break;
                        
                    case 'countdownCancelled':
                        this.hideCountdown();
                        break;

                    case 'messageSubmitted':
                        this.handleMessageSubmitted(data);
                        break;

                    case 'editorMessageReceived':
                        this.displayEditorMessage(data.message);
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
            // Hide countdown when participant goes on air
            this.hideCountdown();
        } else {
            this.onAirIndicator.style.display = 'none';
        }
    }
    
    showCountdown(channelId, seconds) {
        // Only show countdown if this participant will be going on air
        if (this.channelId && channelId === this.channelId) {
            console.log(`Showing countdown: ${seconds} seconds`);
            this.countdownNumber.textContent = seconds;
            this.countdownNotification.classList.remove('hidden');
        }
    }
    
    updateCountdown(seconds) {
        console.log(`Countdown update: ${seconds} seconds`);
        this.countdownNumber.textContent = seconds;
        // Trigger animation by removing and re-adding the class
        this.countdownNumber.classList.remove('countdown-number');
        setTimeout(() => {
            this.countdownNumber.classList.add('countdown-number');
        }, 10);
    }
    
    hideCountdown() {
        console.log('Hiding countdown');
        this.countdownNotification.classList.add('hidden');
    }
    
    sendWebSocketMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket not connected, message not sent:', message);
        }
    }

    handleMessageSubmitted(data) {
        this.submitMessageBtn.disabled = false;
        this.submitMessageBtn.textContent = 'Send Message';

        if (data.success) {
            this.showStatus('Message submitted! It will be reviewed by the moderator.', 'success');

            // Clear only the message, keep the name
            document.getElementById('participantMessage').value = '';
        } else {
            this.showStatus(`Error: ${data.error || 'Failed to submit message'}`, 'error');
        }
    }

    displayEditorMessage(message) {
        if (!this.editorMessageList) return;

        const messageEl = document.createElement('div');
        messageEl.className = 'editor-message';

        const metaEl = document.createElement('div');
        metaEl.className = 'message-meta';
        metaEl.textContent = `${message.name} • ${new Date(message.timestamp).toLocaleTimeString()}`;

        const textEl = document.createElement('div');
        textEl.className = 'message-text';
        textEl.textContent = message.message;

        messageEl.appendChild(metaEl);
        messageEl.appendChild(textEl);

        // Insert at the beginning
        this.editorMessageList.insertBefore(messageEl, this.editorMessageList.firstChild);

        // Show the editor messages section
        this.editorMessages.style.display = 'block';

        // Limit to 10 messages
        const messages = this.editorMessageList.querySelectorAll('.editor-message');
        if (messages.length > 10) {
            messages[messages.length - 1].remove();
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
        // Notify server that participant is leaving via WebSocket
        if (this.channelId) {
            this.sendWebSocketMessage({
                type: 'participantLeave',
                channelId: this.channelId
            });
        }
        
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