import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const requests = [];
page.on('requestfinished', async req => {
  try {
    const res = await req.response();
    const headers = res ? res.headers() : {};
    const size = headers['content-length'] || '';
    const timing = req.timing();
    requests.push({
      url: req.url().split('?')[0].split('/').slice(-2).join('/'),
      status: res ? res.status() : 'no-res',
      sizeKb: size ? (Number(size) / 1024).toFixed(1) : '?',
      durationMs: timing.responseEnd >= 0 ? Math.round(timing.responseEnd) : -1
    });
  } catch (e) {}
});

console.log('Navigating to http://13.140.177.110:2601/login ...');
const t0 = Date.now();
await page.goto('http://13.140.177.110:2601/login', { waitUntil: 'networkidle', timeout: 40000 });
console.log('Total page load time:', Date.now() - t0, 'ms');
console.table(requests.sort((a,b) => b.durationMs - a.durationMs).slice(0, 15));
await browser.close();

