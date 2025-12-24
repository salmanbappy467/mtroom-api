const { verifyLoginDetails } = require('./login_check');
const { postMeterData } = require('./meter_post');
const axios = require('axios');
const cheerio = require('cheerio');

// Helper to fetch tokens ONLY ONCE
async function fetchPageTokens(cookies) {
    const url = 'http://www.rebpbs.com/UI/Setup/meterinfo_setup.aspx';
    try {
        const session = axios.create({ headers: { 'Cookie': cookies.join('; ') }, timeout: 30000 });
        const response = await session.get(url);
        const $ = cheerio.load(response.data);
        return {
            viewState: $('#__VIEWSTATE').val(),
            eventValidation: $('#__EVENTVALIDATION').val(),
            viewStateGen: $('#__VIEWSTATEGENERATOR').val(),
            pbs: $('#ctl00_ContentPlaceHolder1_txtPBSName').val(),
            zonal: $('#ctl00_ContentPlaceHolder1_txtZonalName').val(),
            success: true
        };
    } catch (e) {
        return { success: false };
    }
}

async function processConcurrentBatch(userid, password, meters) {
    // 1. Verify Login
    let auth = await verifyLoginDetails(userid, password);
    if (!auth.success) return { status: "error", message: auth.message };

    console.log(`Pre-fetching tokens for ${meters.length} meters...`);

    // 2. Fetch Tokens ONCE
    const tokens = await fetchPageTokens(auth.cookies);
    if (!tokens.success || !tokens.viewState) {
        return { status: "error", message: "Failed to fetch initial page tokens" };
    }

    console.log("Tokens fetched. Starting Smart Chunked Upload...");

    let results = [];
    // 🔥 CONFIGURATION: Number of parallel requests at a time
    // 5 is safe. Increase/Decrease based on server capacity.
    const CHUNK_SIZE = 5; 

    // 3. Process in Chunks (Batch by Batch)
    for (let i = 0; i < meters.length; i += CHUNK_SIZE) {
        const chunk = meters.slice(i, i + CHUNK_SIZE);
        console.log(`Processing chunk ${Math.floor(i/CHUNK_SIZE) + 1}... (${chunk.length} items)`);

        // Create promises for the current chunk
        // ERROR FIXED HERE: removed 'HZ'
        const chunkPromises = chunk.map(async (m) => {
            try {
                // Pass tokens to skip GET requests
                let result = await postMeterData(auth.cookies, m, tokens);
                
                return {
                    meterNo: m.meterNo,
                    sealNo: m.sealNo,
                    postStatus: result.success ? "SUCCESS" : "FAILED",
                    reason: result.reason,
                    isDuplicate: result.isDuplicate || false
                };
            } catch (error) {
                return {
                    meterNo: m.meterNo,
                    sealNo: m.sealNo,
                    postStatus: "FAILED",
                    reason: "Network Error",
                    isDuplicate: false
                };
            }
        });

        // Wait for this chunk to finish before starting next
        const chunkResults = await Promise.all(chunkPromises);
        results = results.concat(chunkResults);
    }

    // 4. Calculate Stats
    const failedCount = results.filter(r => r.postStatus === "FAILED" && !r.isDuplicate).length;

    return { 
        status: "completed_chunked", 
        mode: "Smart Parallel (Chunked)",
        count: meters.length, 
        failed: failedCount, 
        data: results 
    };
}

module.exports = { processConcurrentBatch };