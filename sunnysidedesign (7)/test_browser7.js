import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  const fileUrl = 'file://' + path.resolve('./公開用/index.html');
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  
  const rootHtml = await page.evaluate(() => document.getElementById('root').innerHTML);
  fs.writeFileSync('root_dump.html', rootHtml);
  
  await browser.close();
})();
