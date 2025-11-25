/**
 * DuckOracle Local Proxy Server
 * 
 * This is the definitive solution to CORS errors.
 * Instead of relying on public proxies, run this locally or deploy to your own server.
 * 
 * INSTRUCTIONS:
 * 1. Create a folder locally.
 * 2. Run: npm init -y
 * 3. Run: npm install express cors
 * 4. Create a file named 'proxy-server.js' and PASTE the code below (UNCOMMENT IT FIRST).
 * 5. Run: node proxy-server.js
 * 6. In the Web App Settings, set Proxy URL to: http://localhost:3001/
 */

/*
// --- UNCOMMENT FROM HERE DOWN TO RUN IN NODE.JS ---

const express = require('express');
const cors = require('cors');

// Note: Node 18+ has built-in fetch. For older Node, install 'node-fetch' and uncomment:
// const fetch = require('node-fetch');

const app = express();
const PORT = 3001;

// 1. Allow all CORS requests from your React App
app.use(cors());

// 2. Increase body limit for large SOAP responses
app.use(express.text({ type: '*/*', limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

// 3. The Proxy Route
// Handles requests like: http://localhost:3001/https://xxxx.oraclecloud.com/...
app.use('/:protocol((http|https))/*', async (req, res) => {
    // Reconstruct the target URL from the path
    const targetUrl = req.url.substring(1); // Removes the leading slash

    console.log(`[Proxy] Forwarding to: ${targetUrl}`);

    try {
        // Forward the request to Oracle
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: {
                // Forward necessary headers
                'Content-Type': req.headers['content-type'] || 'text/xml;charset=UTF-8',
                'SOAPAction': req.headers['soapaction'] || '""',
                'Authorization': req.headers['authorization'], // If basic auth is passed in headers
                // Important: Do not forward the 'Host' header from localhost, let fetch set it for the target
            },
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body
        });

        // Log status
        console.log(`[Proxy] Oracle responded with: ${response.status}`);

        // Forward status code
        res.status(response.status);

        // Forward headers from Oracle to Frontend (excluding CORS headers to avoid conflicts)
        response.headers.forEach((value, key) => {
            if (!key.toLowerCase().startsWith('access-control') && 
                !key.toLowerCase().startsWith('content-encoding')) { 
                res.setHeader(key, value);
            }
        });

        // Return the body
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));

    } catch (error) {
        console.error("[Proxy] Error:", error.message);
        res.status(500).send(`Proxy Error: ${error.message}`);
    }
});

app.get('/', (req, res) => {
    res.send('DuckOracle Proxy is Running. Point your app settings here: http://localhost:3001/');
});

app.listen(PORT, () => {
    console.log(`\n🚀 DuckOracle Proxy running at http://localhost:${PORT}/`);
    console.log(`\n👉 Configure your app Settings > CORS Proxy URL to: http://localhost:3001/`);
});

// --- END UNCOMMENT ---
*/