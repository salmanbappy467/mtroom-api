const { verifyLoginDetails } = require('./login_check');
const { postMeterData } = require('./meter_post');

async function processConcurrentBatch(userid, password, meters) {
    // 1. Verify login credentials and get session cookies
    let auth = await verifyLoginDetails(userid, password);
    if (!auth.success) return { status: "error", message: auth.message };

    console.log(`Starting Concurrent Upload for ${meters.length} meters...`);

    // 2. Prepare all requests in parallel (No await inside map)
    const uploadPromises = meters.map(async (m) => {
        try {
            // Send request for each meter
            let result = await postMeterData(auth.cookies, m);
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
                reason: "Network/Server Error",
                isDuplicate: false
            };
        }
    });

    // 3. Wait for all requests to finish concurrently
    const results = await Promise.all(uploadPromises);

    // 4. Calculate statistics
    const failedCount = results.filter(r => r.postStatus === "FAILED" && !r.isDuplicate).length;

    return { 
        status: "completed_concurrent", 
        mode: "Ultra-Fast (Parallel)",
        count: meters.length, 
        failed: failedCount, 
        data: results 
    };
}

module.exports = { processConcurrentBatch };