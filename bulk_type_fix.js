const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('src/pages');
files.forEach(f => {
  let code = fs.readFileSync(f, 'utf8');
  const org = code;
  
  code = code.replace(/\.catch\(\s*err\s*=>/g, '.catch((err: any) =>');
  code = code.replace(/\.catch\(\s*\(\s*err\s*\)\s*=>/g, '.catch((err: any) =>');
  code = code.replace(/\.catch\(\s*e\s*=>/g, '.catch((e: any) =>');
  code = code.replace(/\.then\(\s*e\s*=>/g, '.then((e: any) =>');
  code = code.replace(/catch\s*\(\s*err\s*\)\s*\{/g, 'catch(err: any) {');
  code = code.replace(/onSuccess:\s*\(\s*res\s*\)\s*=>/g, 'onSuccess: (res: any) =>');
  
  if (code !== org) {
    fs.writeFileSync(f, code);
    console.log('Fixed types in:', f);
  }
});
