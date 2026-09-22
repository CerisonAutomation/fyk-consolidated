import fs from 'fs';

const files = [
  'ARCHITECTURE.md',
  'ARCHITECTURE_OMEGA.md',
  'FEATURES_COMPLETE.md',
  'FEATURE_AUDIT_15_10.md',
  'GAP_ANALYSIS_OMEGA_PRD_V3.md',
  'GOLD_STANDARD.md',
  'MVP_PRODUCTION_READY.md',
  'VIBE_AUDIT_REPORT.md',
];

const replacements = [
  { from: /OMEGALEVEL/gi, to: 'production-level' },
  { from: /15\/10/gi, to: 'high-quality' },
  { from: /worldclass/gi, to: 'high-quality' },
  { from: /A\*\* h1 n1/gi, to: 'excellent' },
  { from: /million times better/gi, to: 'significantly improved' },
  { from: /MILLION TIMES BETTER/gi, to: 'SIGNIFICANTLY IMPROVED' },
  { from: /award-winning/gi, to: 'polished' },
  { from: /Behance top 1%/gi, to: 'high-quality' },
  { from: /ray-traced/gi, to: 'layered' },
  { from: /cinematic lighting/gi, to: 'soft lighting' },
  { from: /product design photography/gi, to: 'product card design' },
  { from: /ultra-detailed/gi, to: 'detailed' },
  { from: /top 1%/gi, to: 'high-quality' },
  { from: /cinematic/gi, to: 'soft' },
  { from: /OMEGA/gi, to: 'enterprise' },
  { from: /DIVINE/gi, to: 'premium' },
  { from: /GODMODE/gi, to: 'advanced' },
  { from: /TRANSCEND/gi, to: 'enhanced' },
];

for (const file of files) {
  const full = `/home/user/fyk-consolidated/${file}`;
  if (!fs.existsSync(full)) continue;
  let content = fs.readFileSync(full, 'utf8');
  let original = content;
  
  for (const r of replacements) {
    content = content.replace(r.from, r.to);
  }
  
  if (content !== original) {
    fs.writeFileSync(full, content, 'utf8');
    console.log(`Fixed hyperbol in ${file}`);
  }
}
