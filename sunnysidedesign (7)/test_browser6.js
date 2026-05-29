import puppeteer from 'puppeteer';
import path from 'path';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  const fileUrl = 'file://' + path.resolve('./公開用/index.html');
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  
  const rootHtml = await page.evaluate(() => document.getElementById('root').innerHTML);
  console.log('Contains Sunny Life simulator:', rootHtml.includes('Sunny Life simulator'));
  
  await browser.close();
})();
