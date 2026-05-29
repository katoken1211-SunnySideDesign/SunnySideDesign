import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  // Go to dev app URL
  await page.goto('https://ais-dev-6skjwbot7ygq5q5zpoggeu-248288923567.asia-northeast1.run.app', { waitUntil: 'networkidle0' });
  
  // Wait to see if body is populated
  const html = await page.content();
  console.log('HTML length:', html.length);
  
  await browser.close();
})();
