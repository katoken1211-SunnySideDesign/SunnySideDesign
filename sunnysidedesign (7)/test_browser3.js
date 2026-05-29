import puppeteer from 'puppeteer';
import path from 'path';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  // Go to local file URL
  const fileUrl = 'file://' + path.resolve('./公開用/index.html');
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  
  // Wait to see if body is populated
  const html = await page.content();
  console.log('HTML length:', html.length);
  
  await browser.close();
})();
