// No install-time browser downloads — they broke `npm ci` fleet-wide (2026-06-03).
// Browsers resolve from puppeteer's cache or PUPPETEER_EXECUTABLE_PATH.
module.exports = {skipDownload: true};
