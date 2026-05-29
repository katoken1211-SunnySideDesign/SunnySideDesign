import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('https://sunnyside-d.com/', { waitUntil: 'networkidle0' });
  
  const rootHtml = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML : 'NO ROOT ELEMENT!';
  });
  console.log('Root HTML length:', rootHtml.length);
  if (rootHtml.length > 0) {
    console.log('Preview:', rootHtml.substring(0, 200));
  }
  
  await browser.close();
})();
