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

require('dotenv').config();

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const port = process.env.PORT || 3000;

const WHIP_GATEWAY_BASE = process.env.WHIP_GATEWAY_URL || 'https://eyevinnlab-livevibe.eyevinn-smb-whip-bridge.auto.prod.osaas.io';
const WHEP_GATEWAY_BASE = process.env.WHEP_GATEWAY_URL || WHIP_GATEWAY_BASE; // Default to same as WHIP if not specified
const WHIP_ENDPOINT_PATH = '/api/v2/whip/sfu-broadcaster';
const WHIP_GATEWAY_URL = WHIP_GATEWAY_BASE + WHIP_ENDPOINT_PATH;
const WHIP_AUTH_KEY = process.env.WHIP_AUTH_KEY;
const WHEP_AUTH_KEY = process.env.WHEP_AUTH_KEY || WHIP_AUTH_KEY; // Default to same as WHIP if not specified

app.use(express.static('.'));

app.get('/config.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    const config = [
        `window.WHIP_GATEWAY_URL = '${WHIP_GATEWAY_URL}';`,
        `window.WHIP_AUTH_KEY = ${WHIP_AUTH_KEY ? `'${WHIP_AUTH_KEY}'` : 'null'};`,
        `window.WHEP_GATEWAY_URL = '${WHEP_GATEWAY_BASE}';`,
        `window.WHEP_AUTH_KEY = ${WHEP_AUTH_KEY ? `'${WHEP_AUTH_KEY}'` : 'null'};`
    ];
    res.send(config.join('\n'));
});

app.get('/', (req, res) => {
    res.redirect('/join');
});

app.get('/join', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/editor', (req, res) => {
    res.sendFile(path.join(__dirname, 'editor.html'));
});

app.get('/source', (req, res) => {
    res.sendFile(path.join(__dirname, 'source.html'));
});

app.get('/qr', (req, res) => {
    res.sendFile(path.join(__dirname, 'qr.html'));
});

app.get('/feed', (req, res) => {
    res.sendFile(path.join(__dirname, 'feed.html'));
});


// WebSocket state management
let selectedChannelId = null;
let selectedChannelIds = []; // Track multiple selected channels for side-by-side
const connectedClients = new Set();
const participantChannels = new Set(); // Track active participant channels

// Message queue for participant questions/comments
const messageQueue = [];
const publishedMessages = [];
let messageIdCounter = 1;

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    connectedClients.add(ws);
    
    // Send current selection state to new client
    if (selectedChannelId) {
        ws.send(JSON.stringify({
            type: 'channelSelected',
            channelId: selectedChannelId
        }));
    } else if (selectedChannelIds.length > 0) {
        ws.send(JSON.stringify({
            type: 'multipleChannelsSelected',
            channelIds: selectedChannelIds
        }));
    }
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'selectChannel':
                    selectedChannelId = data.channelId;
                    console.log(`Channel selected: ${selectedChannelId}`);
                    
                    // Broadcast to all connected clients
                    const selectMessage = JSON.stringify({
                        type: 'channelSelected',
                        channelId: selectedChannelId
                    });
                    
                    connectedClients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(selectMessage);
                        }
                    });
                    break;
                    
                case 'deselectChannel':
                    selectedChannelId = null;
                    selectedChannelIds = []; // Clear multi-selection too
                    console.log('Channel deselected');
                    
                    // Broadcast to all connected clients
                    const deselectMessage = JSON.stringify({
                        type: 'channelDeselected'
                    });
                    
                    connectedClients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(deselectMessage);
                        }
                    });
                    break;
                    
                case 'selectMultipleChannels':
                    selectedChannelIds = data.channelIds || [];
                    selectedChannelId = null; // Clear single selection
                    console.log(`Multiple channels selected: ${selectedChannelIds.join(', ')}`);
                    
                    // Broadcast to all connected clients
                    const multiSelectMessage = JSON.stringify({
                        type: 'multipleChannelsSelected',
                        channelIds: selectedChannelIds
                    });
                    
                    connectedClients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(multiSelectMessage);
                        }
                    });
                    break;
                    
                case 'participantJoin':
                    if (data.channelId) {
                        console.log(`Participant joined: ${data.channelId}`);
                        participantChannels.add(data.channelId);
                        
                        // Broadcast to all connected clients that a new participant has joined
                        const joinMessage = JSON.stringify({
                            type: 'participantJoined',
                            channelId: data.channelId
                        });
                        
                        connectedClients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN) {
                                client.send(joinMessage);
                            }
                        });
                    }
                    break;
                    
                case 'participantLeave':
                    if (data.channelId) {
                        console.log(`Participant left: ${data.channelId}`);
                        participantChannels.delete(data.channelId);
                        
                        // Broadcast to all connected clients that a participant has left
                        const leaveMessage = JSON.stringify({
                            type: 'participantLeft',
                            channelId: data.channelId
                        });
                        
                        connectedClients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN) {
                                client.send(leaveMessage);
                            }
                        });
                        
                        // If the leaving participant was selected, deselect them
                        if (selectedChannelId === data.channelId) {
                            selectedChannelId = null;
                            const deselectMessage = JSON.stringify({
                                type: 'channelDeselected'
                            });
                            
                            connectedClients.forEach(client => {
                                if (client.readyState === WebSocket.OPEN) {
                                    client.send(deselectMessage);
                                }
                            });
                        }
                    }
                    break;
                    
                case 'startCountdown':
                    console.log(`Starting countdown for channel: ${data.channelId}`);
                    
                    // Broadcast countdown start to all connected clients
                    const countdownStartMessage = JSON.stringify({
                        type: 'countdownStart',
                        channelId: data.channelId,
                        seconds: data.seconds
                    });
                    
                    connectedClients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(countdownStartMessage);
                        }
                    });
                    break;
                    
                case 'startMultiCountdown':
                    console.log(`Starting multi-countdown for channels: ${data.channelIds.join(', ')}`);
                    
                    // Broadcast multi-countdown start to all connected clients
                    const multiCountdownStartMessage = JSON.stringify({
                        type: 'multiCountdownStart',
                        channelIds: data.channelIds,
                        seconds: data.seconds
                    });
                    
                    connectedClients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(multiCountdownStartMessage);
                        }
                    });
                    break;
                    
                case 'countdownUpdate':
                    // Handle both single and multi countdown updates
                    let updateMessage;
                    if (data.channelIds) {
                        updateMessage = JSON.stringify({
                            type: 'multiCountdownUpdate',
                            channelIds: data.channelIds,
                            seconds: data.seconds
                        });
                    } else {
                        updateMessage = JSON.stringify({
                            type: 'countdownUpdate',
                            channelId: data.channelId,
                            seconds: data.seconds
                        });
                    }
                    
                    connectedClients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(updateMessage);
                        }
                    });
                    break;
                    
                case 'cancelCountdown':
                    console.log('Countdown cancelled');

                    // Broadcast countdown cancellation to all connected clients
                    const cancelCountdownMessage = JSON.stringify({
                        type: 'countdownCancelled'
                    });

                    connectedClients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(cancelCountdownMessage);
                        }
                    });
                    break;

                case 'submitMessage':
                    if (data.name && data.message) {
                        const newMessage = {
                            id: messageIdCounter++,
                            name: data.name.trim(),
                            message: data.message.trim(),
                            timestamp: new Date().toISOString(),
                            status: 'pending' // pending, approved, rejected
                        };

                        messageQueue.push(newMessage);
                        console.log(`New message from ${newMessage.name}: ${newMessage.message}`);

                        // Notify editors about new message in queue
                        const newMessageNotification = JSON.stringify({
                            type: 'newMessageInQueue',
                            message: newMessage
                        });

                        connectedClients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN) {
                                client.send(newMessageNotification);
                            }
                        });

                        // Confirm to sender
                        ws.send(JSON.stringify({
                            type: 'messageSubmitted',
                            success: true
                        }));
                    } else {
                        ws.send(JSON.stringify({
                            type: 'messageSubmitted',
                            success: false,
                            error: 'Name and message are required'
                        }));
                    }
                    break;

                case 'approveMessage':
                    if (data.messageId) {
                        const messageIndex = messageQueue.findIndex(msg => msg.id === data.messageId);
                        if (messageIndex !== -1) {
                            const approvedMessage = messageQueue[messageIndex];
                            approvedMessage.status = 'approved';
                            approvedMessage.approvedAt = new Date().toISOString();

                            // Move to published messages
                            publishedMessages.unshift(approvedMessage);
                            messageQueue.splice(messageIndex, 1);

                            console.log(`Message approved: ${approvedMessage.message}`);

                            // Broadcast to all clients
                            const messageApprovedNotification = JSON.stringify({
                                type: 'messageApproved',
                                message: approvedMessage
                            });

                            connectedClients.forEach(client => {
                                if (client.readyState === WebSocket.OPEN) {
                                    client.send(messageApprovedNotification);
                                }
                            });
                        }
                    }
                    break;

                case 'rejectMessage':
                    if (data.messageId) {
                        const messageIndex = messageQueue.findIndex(msg => msg.id === data.messageId);
                        if (messageIndex !== -1) {
                            const rejectedMessage = messageQueue[messageIndex];
                            rejectedMessage.status = 'rejected';
                            messageQueue.splice(messageIndex, 1);

                            console.log(`Message rejected: ${rejectedMessage.message}`);

                            // Notify editors
                            const messageRejectedNotification = JSON.stringify({
                                type: 'messageRejected',
                                messageId: data.messageId
                            });

                            connectedClients.forEach(client => {
                                if (client.readyState === WebSocket.OPEN) {
                                    client.send(messageRejectedNotification);
                                }
                            });
                        }
                    }
                    break;

                case 'getMessages':
                    // Send current queue and published messages to requesting client
                    ws.send(JSON.stringify({
                        type: 'messagesData',
                        queue: messageQueue,
                        published: publishedMessages
                    }));
                    break;

                case 'editorMessage':
                    if (data.message) {
                        const editorMessage = {
                            id: messageIdCounter++,
                            name: 'Moderator',
                            message: data.message.trim(),
                            timestamp: new Date().toISOString(),
                            isFromEditor: true
                        };

                        // Broadcast to all participants
                        const editorMessageNotification = JSON.stringify({
                            type: 'editorMessageReceived',
                            message: editorMessage
                        });

                        connectedClients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN) {
                                client.send(editorMessageNotification);
                            }
                        });

                        console.log(`Editor message sent: ${editorMessage.message}`);
                    }
                    break;
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('WebSocket connection closed');
        connectedClients.delete(ws);
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        connectedClients.delete(ws);
    });
});

server.listen(port, () => {
    console.log(`Join Live app listening at http://localhost:${port}`);
    console.log(`Participant view: http://localhost:${port}/join`);
    console.log(`Editor view: http://localhost:${port}/editor`);
    console.log(`OBS Browser Source: http://localhost:${port}/source`);
    console.log(`Messages Feed (OBS): http://localhost:${port}/feed`);
    console.log(`QR Code Display: http://localhost:${port}/qr`);
    console.log('');
    console.log(`WHIP Gateway Base: ${WHIP_GATEWAY_BASE}`);
    console.log(`WHIP Full URL: ${WHIP_GATEWAY_URL}`);
    console.log(`WHIP Auth Key: ${WHIP_AUTH_KEY ? '[SET]' : '[NOT SET]'}`);
    console.log(`WHEP Gateway Base: ${WHEP_GATEWAY_BASE}`);
    console.log(`WHEP Auth Key: ${WHEP_AUTH_KEY ? '[SET]' : '[NOT SET]'}`);
    console.log('');
    console.log(`WebSocket server running on same port for real-time communication`);
    console.log(`To configure WHIP gateway: set WHIP_GATEWAY_URL environment variable (base URL only)`);
    console.log(`To configure WHEP gateway: set WHEP_GATEWAY_URL environment variable (base URL only)`);
    console.log(`To configure auth: set WHIP_AUTH_KEY and/or WHEP_AUTH_KEY environment variables`);
});
