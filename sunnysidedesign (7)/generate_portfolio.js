import fs from 'fs';
import path from 'path';

const portfolioDir = './公開用/portfolio';
let portfolioItems = [];

if (fs.existsSync(portfolioDir)) {
    const files = fs.readdirSync(portfolioDir);
    files.forEach(file => {
        if (/\.(png|jpe?g|webp|gif)$/i.test(file)) {
            const title = path.parse(file).name;
            portfolioItems.push({
                filename: file,
                title: title,
                url: `./portfolio/${file}`
            });
        }
    });
}

fs.writeFileSync('./src/portfolioData.json', JSON.stringify(portfolioItems, null, 2), 'utf8');
console.log('Successfully generated src/portfolioData.json');
