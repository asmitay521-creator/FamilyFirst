const fs = require('fs');
const lines = fs.readFileSync('ts_error_leads.log', 'utf16le').split('\n');
lines.forEach(l => {
  if (l.trim()) console.log(l.trim());
});
