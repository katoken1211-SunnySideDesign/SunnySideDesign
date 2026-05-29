import fs from 'fs';

// Read the generated single file from dist/index.html
let html = fs.readFileSync('./dist/index.html', 'utf8');

// Fix for file:// protocol: remove crossorigin attributes to prevent CORS issues
html = html.replace(/<script type="module" crossorigin>/g, '<script type="module">');
html = html.replace(/<style([^>]*) crossorigin([^>]*)>/g, '<style$1$2>');

// Add UTF-8 BOM for Windows compatibility if needed
const htmlWithBom = '\uFEFF' + html;

// Write to index.html
fs.writeFileSync('./公開用/index.html', htmlWithBom, 'utf8');
console.log('Successfully copied dist/index.html to 公開用/index.html');
