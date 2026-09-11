const fs = require('fs');
const lines = fs.readFileSync('src/pages/Leads/index.tsx', 'utf8').split('\n');
const out = [];
for(let i=5270; i<=5290; i++) { out.push(i + ': ' + lines[i-1]); }
fs.writeFileSync('leads_lines_temp.log', out.join('\n'));
