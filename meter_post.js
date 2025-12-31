const axios = require('axios');
const cheerio = require('cheerio');
const qs = require('querystring');

const DEFAULTS = {
    payMode: '1', manfId: '581', phase: '1', type: 'j-39',
    volt: '240', mult: '1', zero: '0', sealTxt: 'LS'
};

async function postMeterData(cookies, m) {
    const url = 'http://www.rebpbs.com/UI/Setup/meterinfo_setup.aspx';
    const session = axios.create({
        headers: { 
            'User-Agent': 'Mozilla/5.0',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookies.join('; '),
            'Referer': url
        }
    });

    try {
        // Step 1: Initial Context
        const page = await session.get(url);
        const $ = cheerio.load(page.data);
        const pbs = $('#ctl00_ContentPlaceHolder1_txtPBSName').val();
        if (!pbs) return { success: false, sessionExpired: true, reason: "Session Expired" };

        const zonal = $('#ctl00_ContentPlaceHolder1_txtZonalName').val();

        // Step 2: Trigger Validation (AJAX)
        const triggerPayload = qs.stringify({
            'ctl00$ScriptManager1': 'ctl00$ContentPlaceHolder1$UpdatePanel3|ctl00$ContentPlaceHolder1$txtMETER_NO',
            '__EVENTTARGET': 'ctl00$ContentPlaceHolder1$txtMETER_NO',
            '__VIEWSTATE': $('#__VIEWSTATE').val(),
            '__VIEWSTATEGENERATOR': $('#__VIEWSTATEGENERATOR').val(),
            '__EVENTVALIDATION': $('#__EVENTVALIDATION').val(),
            '__VIEWSTATEENCRYPTED': '',
            'ctl00$ContentPlaceHolder1$txtMETER_NO': String(m.meterNo),
            '__ASYNCPOST': 'true'
        });

        const triggerRes = await session.post(url, triggerPayload, {
            headers: { 'X-MicrosoftAjax': 'Delta=true', 'X-Requested-With': 'XMLHttpRequest' }
        });

        const parts = triggerRes.data.split('|');
        const getToken = (id) => parts.indexOf(id) !== -1 ? parts[parts.indexOf(id) + 1] : null;
        
        const newVS = getToken('__VIEWSTATE') || $('#__VIEWSTATE').val();
        const newEV = getToken('__EVENTVALIDATION') || $('#__EVENTVALIDATION').val();

        // Step 3: Final Submission (Standard Post)
        const savePayload = qs.stringify({
            '__EVENTTARGET': '', '__EVENTARGUMENT': '', '__VIEWSTATEENCRYPTED': '',
            '__VIEWSTATE': newVS, '__VIEWSTATEGENERATOR': $('#__VIEWSTATEGENERATOR').val(), '__EVENTVALIDATION': newEV,
            'ctl00$ContentPlaceHolder1$txtPBSName': pbs,
            'ctl00$ContentPlaceHolder1$txtZonalName': zonal,
            'ctl00$ContentPlaceHolder1$ddlMeterPaymentMode': String(m.paymentMode || DEFAULTS.payMode),
            'ctl00$ContentPlaceHolder1$ddlMANUFACTUREname': String(m.manufacturerId || DEFAULTS.manfId),
            'ctl00$ContentPlaceHolder1$ddlPhase': String(m.phase || DEFAULTS.phase),
            'ctl00$ContentPlaceHolder1$txtMETER_NO': String(m.meterNo),
            'ctl00$ContentPlaceHolder1$txtSEAL_NO': String(m.sealNo),
            'ctl00$ContentPlaceHolder1$txtBULK_METER_NO': DEFAULTS.zero,
            'ctl00$ContentPlaceHolder1$txtMETER_TYPE': m.meterType || DEFAULTS.type,
            'ctl00$ContentPlaceHolder1$txtVOLT': String(m.volt || DEFAULTS.volt),
            'ctl00$ContentPlaceHolder1$txtMULTIPLIER': DEFAULTS.mult,
            'ctl00$ContentPlaceHolder1$txtINITIAL_READING': DEFAULTS.zero,
            'ctl00$ContentPlaceHolder1$txtDEMAND_READING': DEFAULTS.zero,
            'ctl00$ContentPlaceHolder1$txtKWH_READING': DEFAULTS.zero,
            'ctl00$ContentPlaceHolder1$txtCT_DATA_MANUFACTURER': DEFAULTS.zero,
            'ctl00$ContentPlaceHolder1$txtCT_SERIAL_NO': DEFAULTS.zero,
            'ctl00$ContentPlaceHolder1$txtCT_RATIO': DEFAULTS.mult,
            'ctl00$ContentPlaceHolder1$txtCT_SEAL_NO': DEFAULTS.zero,
            'ctl00$ContentPlaceHolder1$txtPT_DATA_MANUFACTURER': DEFAULTS.zero,
            'ctl00$ContentPlaceHolder1$txtPT_SERIAL_NO': DEFAULTS.zero,
            'ctl00$ContentPlaceHolder1$txtPT_RATIO': DEFAULTS.mult,
            'ctl00$ContentPlaceHolder1$txtPT_SEAL_NO': DEFAULTS.zero,
            'ctl00$ContentPlaceHolder1$txtPT_MULTIPLYING_FACTOR': DEFAULTS.zero,
            'ctl00$ContentPlaceHolder1$txtBODY_SEAL': DEFAULTS.zero,
            'ctl00$ContentPlaceHolder1$txtTERMINAL': DEFAULTS.zero,
            'ctl00$ContentPlaceHolder1$txtBODY_SEAL1': DEFAULTS.sealTxt,
            'ctl00$ContentPlaceHolder1$txtTERMINAL2': DEFAULTS.zero,
            'ctl00$ContentPlaceHolder1$txtBODY_SEAL2': DEFAULTS.sealTxt,
            'ctl00$ContentPlaceHolder1$txtBODY_SEAL3': DEFAULTS.zero,
            'ctl00$ContentPlaceHolder1$ddlQMeterPaymentMode': '1',
            'ctl00$ContentPlaceHolder1$txtSearch': '',
            'ctl00$ContentPlaceHolder1$btSave': decodeURIComponent('%E0%A6%B8%E0%A6%82%E0%A6%B0%E0%A6%95%E0%A7%8D%E0%A6%B7%E0%A6%A3%20%E0%A6%95%E0%A6%B0%E0%A7%81%E0%A6%A8')
        });

        const finalRes = await session.post(url, savePayload);
        const $res = cheerio.load(finalRes.data);
        const lblMsg = $res('#ctl00_ContentPlaceHolder1_lblMsg').text().trim();

        const isSuccess = finalRes.data.includes('Successful') || finalRes.data.includes('Action was Successful');
        const isDuplicate = finalRes.data.includes('Already Exists') || 
                            finalRes.data.includes('Duplicate') || 
                            lblMsg.includes('Already Exists') || 
                            lblMsg.includes('exists');

        let reason = isSuccess ? "Saved Successfully" : (isDuplicate ? "Duplicate Meter" : (lblMsg || "Server Rejected"));

        return { success: isSuccess, reason: reason, isDuplicate };
    } catch (e) { return { success: false, reason: e.message }; }
}

module.exports = { postMeterData };