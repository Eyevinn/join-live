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

// WebSocket state management
let selectedChannelId = null;
const connectedClients = new Set();

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