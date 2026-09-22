import fs from 'fs';
import path from 'path';

const replacements = [
  { from: /award-winning/gi, to: 'polished' },
  { from: /Behance top 1%/gi, to: 'high-quality' },
  { from: /ray-traced/gi, to: 'layered' },
  { from: /cinematic lighting/gi, to: 'soft lighting' },
  { from: /product design photography/gi, to: 'product card design' },
  { from: /ultra-detailed/gi, to: 'detailed' },
  { from: /OMEGALEVEL/gi, to: 'production-level' },
  { from: /OMEGA/gi, to: 'enterprise' },
  { from: /million times better/gi, to: 'significantly improved' },
  { from: /MILLION TIMES BETTER/gi, to: 'SIGNIFICANTLY IMPROVED' },
  { from: /top 1%/gi, to: 'high-quality' },
  { from: /cinematic/gi, to: 'soft' },
  { from: /ray-traced-boosted/gi, to: 'elevated-boosted' },
  { from: /ray-traced/g, to: 'elevated' },
  { from: /Award-Winning/g, to: 'Polished' },
  { from: /Behance/g, to: 'high-quality' },
];

const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
      walk(full);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.css') || entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
}

walk('/home/user/fyk-consolidated/src');

let fixed = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  for (const r of replacements) {
    content = content.replace(r.from, r.to);
  }
  
  // Fix specific non-standard naming: omega -> enterprise, but careful not to break omega in file names? We already handled OMEGA
  // Fix premium-client-omega -> premium-client-enterprise? But keep file names for now, fix content only
  // Fix board-client-omega -> board-client (remove omega suffix in content)
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    fixed++;
    console.log(`Fixed hyperbol in ${file}`);
  }
}

console.log(`Fixed ${fixed} files`);
