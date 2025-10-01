const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
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
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/editor', (req, res) => {
    res.sendFile(path.join(__dirname, 'editor.html'));
});

app.listen(port, () => {
    console.log(`Join Live app listening at http://localhost:${port}`);
    console.log(`Participant view: http://localhost:${port}/`);
    console.log(`Editor view: http://localhost:${port}/editor`);
    console.log('');
    console.log(`WHIP Gateway Base: ${WHIP_GATEWAY_BASE}`);
    console.log(`WHIP Full URL: ${WHIP_GATEWAY_URL}`);
    console.log(`WHIP Auth Key: ${WHIP_AUTH_KEY ? '[SET]' : '[NOT SET]'}`);
    console.log(`WHEP Gateway Base: ${WHEP_GATEWAY_BASE}`);
    console.log(`WHEP Auth Key: ${WHEP_AUTH_KEY ? '[SET]' : '[NOT SET]'}`);
    console.log('');
    console.log(`To configure WHIP gateway: set WHIP_GATEWAY_URL environment variable (base URL only)`);
    console.log(`To configure WHEP gateway: set WHEP_GATEWAY_URL environment variable (base URL only)`);
    console.log(`To configure auth: set WHIP_AUTH_KEY and/or WHEP_AUTH_KEY environment variables`);
});