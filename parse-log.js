const fs = require('fs');
const lines = fs.readFileSync('functions/firebase-debug.log', 'utf8').split('\n');
lines.forEach(l => {
  if (l.includes('error') || l.includes('Error') || l.includes('Exception') || l.includes('fail')) {
    console.log(l);
  }
});
