import fs from 'fs';
const stats = fs.statSync('bible.sqlite');
console.log(stats);
