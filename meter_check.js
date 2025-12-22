const axios = require('axios');
const cheerio = require('cheerio');
const qs = require('querystring');

async function verifyMeter(cookies, meterNo) {
    const url = 'http://www.rebpbs.com/UI/OfficeAutomation/Monitoring/EngineeringAndMaintenance/frmMeterInventoryMonitoring.aspx';
    try {
        const session = axios.create({ headers: { 'Cookie': cookies.join('; ') } });
        const page = await session.get(url);
        const $ = cheerio.load(page.data);

        const payload = {
            '__VIEWSTATE': $('#__VIEWSTATE').val(), '__VIEWSTATEGENERATOR': $('#__VIEWSTATEGENERATOR').val(),
            '__EVENTVALIDATION': $('#__EVENTVALIDATION').val(),
            'ctl00$ContentPlaceHolder1$txtMeterNo': meterNo,
            'ctl00$ContentPlaceHolder1$Button1': 'Search', 'ctl00$ContentPlaceHolder1$rbApprove': '1'
        };

        const searchRes = await session.post(url, qs.stringify(payload));
        const $s = cheerio.load(searchRes.data);
        const row = $s('#ctl00_ContentPlaceHolder1_gvMeterLOG tr').eq(1);
        
        if (row.length > 0) {
            const cols = row.find('td');
            return {
                found: true,
                data: {
                    brand: $(cols[0]).text().trim(), meterNo: $(cols[1]).text().trim(),
                    status: $(cols[2]).text().trim(), cmo: $(cols[5]).text().trim().replace(/&nbsp;/g, '') || "N/A",
                    date: $(cols[8]).text().trim()
                }
            };
        }
        return { found: false };
    } catch (e) { return { found: false }; }
}

module.exports = { verifyMeter };