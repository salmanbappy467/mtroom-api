const { verifyLoginDetails } = require('./login_check');
const { postMeterData } = require('./meter_post');
const { getInventoryList } = require('./fetch_inventory');

async function processBatch(userid, password, meters) {
    let auth = await verifyLoginDetails(userid, password);
    if (!auth.success) return { status: "error", message: auth.message };

    const postResults = [];
    let failedCount = 0;

    // 1. Fast Posting Loop
    for (const m of meters) {
        let postRes = await postMeterData(auth.cookies, m);
        if (!postRes.success && !postRes.isDuplicate) failedCount++;
        postResults.push({ original: m, result: postRes });
        await new Promise(r => setTimeout(r, 100)); // Minimal delay
    }

    // 2. Wait for server update
    await new Promise(r => setTimeout(r, 1500));

    // 3. Bulk Fetch Inventory
    const fetchLimit = meters.length + 20; 
    const inventoryList = await getInventoryList(auth.cookies, fetchLimit);

    // 4. Merge Results
    const finalOutput = postResults.map(item => {
        const liveData = inventoryList.find(inv => 
            inv.meterNo.toLowerCase() === item.original.meterNo.toLowerCase()
        );

        return {
            manufacturer: liveData ? liveData.brand : "N/A",
            meterNo: item.original.meterNo,
            sealNo: item.original.sealNo,
            postStatus: item.result.success ? "SUCCESS" : "FAILED",
            isDuplicate: item.result.isDuplicate || false,
            serverError: item.result.reason,
            liveStatus: liveData ? liveData.status : "Not Verified",
            cmo: liveData ? liveData.cmo : "N/A",
            date: liveData ? liveData.date : "N/A"
        };
    });

    return { 
        status: "completed", 
        count: meters.length, 
        failed: failedCount, 
        data: finalOutput 
    };
}

module.exports = { processBatch };