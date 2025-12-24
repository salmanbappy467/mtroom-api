const express = require('express');
const path = require('path');
const { verifyLoginDetails } = require('./login_check');
const { processBatch } = require('./batch_processor'); 
const { verifyMeter } = require('./meter_check');
const { getInventoryList } = require('./fetch_inventory');

// Import the new concurrent processor
const { processConcurrentBatch } = require('./concurrent_processor');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. Login Check Endpoint
app.post('/api/login-check', async (req, res) => {
    try {
        const result = await verifyLoginDetails(req.body.userid, req.body.password);
        if (result.success) {
            res.json({ status: "success", user: result.userInfo, pbs: result.pbs, zonal: result.zonal });
        } else {
            res.status(401).json({ status: "failed", message: result.message });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. Normal Bulk Meter Post (With Verification)
app.post('/api/meter-post', async (req, res) => {
    try {
        const result = await processBatch(req.body.userid, req.body.password, req.body.meters);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. Single Meter Check Endpoint
app.post('/api/single-check', async (req, res) => {
    try {
        const auth = await verifyLoginDetails(req.body.userid, req.body.password);
        if (!auth.success) return res.status(401).json({ error: "Login Failed" });
        const result = await verifyMeter(auth.cookies, req.body.meterNo);
        res.json(result.found ? { status: "found", data: result.data } : { status: "not_found" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. Inventory List Endpoint
app.post('/api/all-meter-list', async (req, res) => {
    try {
        const auth = await verifyLoginDetails(req.body.userid, req.body.password);
        if (!auth.success) return res.status(401).json({ error: "Login Failed" });
        const data = await getInventoryList(auth.cookies, req.body.limit || 50);
        res.json({ status: "success", count: data.length, data: data });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 5. Ultra Fast Endpoint (New) - No Verification, Parallel Upload

app.post('/api/fast-post', async (req, res) => {
    try {
        const result = await processConcurrentBatch(req.body.userid, req.body.password, req.body.meters);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log("mtroom API v2.0 (Ultra Fast) Running on Port 3000"));
