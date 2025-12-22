const axios = require('axios');
const cheerio = require('cheerio');
const { login } = require('./auth');

async function verifyLoginDetails(userid, password) {
    try {
        const cookies = await login(userid, password);
        if (!cookies || cookies.length === 0) return { success: false, message: "Invalid Credentials" };

        const dashUrl = 'http://www.rebpbs.com/UI/OnM/frm_OCMeterTesterDashboard.aspx';
        const response = await axios.get(dashUrl, { headers: { 'Cookie': cookies.join('; ') } });
        const $ = cheerio.load(response.data);

        const pbsName = $('#ctl00_lblPBSname').text().trim();
        const userInfo = $('#ctl00_lblLoggedUser').text().trim();
        let zonalName = "Unknown Office";
        
        if (userInfo.includes(',')) {
            zonalName = userInfo.split(',').pop().replace(']', '').trim();
        }

        return { 
            success: true, 
            cookies: cookies,
            userInfo: userInfo,
            pbs: pbsName || "N/A", 
            zonal: zonalName 
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = { verifyLoginDetails };