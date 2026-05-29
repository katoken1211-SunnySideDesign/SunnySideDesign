import puppeteer from 'puppeteer';
import path from 'path';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  // Go to local file URL
  const fileUrl = 'file://' + path.resolve('./公開用/index.html');
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  
  const rootHtml = await page.evaluate(() => document.getElementById('root').innerHTML);
  console.log('Root HTML length:', rootHtml.length);
  if (rootHtml.length > 0) {
    console.log('Preview:', rootHtml.substring(0, 200));
  } else {
    console.log('Root is EMPTY!');
  }
  
  await browser.close();
})();
