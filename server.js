const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

const WHIP_GATEWAY_URL = process.env.WHIP_GATEWAY_URL || 'https://livevibe.osaas.io/api/v2/whip/sfu-broadcaster';
const WHIP_AUTH_KEY = process.env.WHIP_AUTH_KEY;

app.use(express.static('.'));

app.get('/config.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    const config = [
        `window.WHIP_GATEWAY_URL = '${WHIP_GATEWAY_URL}';`,
        `window.WHIP_AUTH_KEY = ${WHIP_AUTH_KEY ? `'${WHIP_AUTH_KEY}'` : 'null'};`
    ];
    res.send(config.join('\n'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Join Live app listening at http://localhost:${port}`);
    console.log(`WHIP Gateway URL: ${WHIP_GATEWAY_URL}`);
    console.log(`WHIP Auth Key: ${WHIP_AUTH_KEY ? '[SET]' : '[NOT SET]'}`);
    console.log(`To configure WHIP gateway: set WHIP_GATEWAY_URL environment variable`);
    console.log(`To configure WHIP auth: set WHIP_AUTH_KEY environment variable`);
});