import fs from 'fs';
import path from 'path';

const mdFiles = [
  'FEATURES_COMPLETE.md',
  'MVP_PRODUCTION_READY.md',
  'GOLD_STANDARD.md',
  'ARCHITECTURE.md',
  'VIBE_AUDIT_REPORT.md',
  'FEATURE_AUDIT_15_10.md',
  'ARCHITECTURE_OMEGA.md',
  'GAP_ANALYSIS_OMEGA_PRD_V3.md',
];

const replacements = [
  { from: /Impossible to Hack/gi, to: 'security hardened with defense in depth' },
  { from: /impossible to hack/gi, to: 'security hardened with defense in depth' },
  { from: /15\/10 Worldclass/gi, to: 'High-quality — exceeds expectations' },
  { from: /15\/10/gi, to: 'exceeds expectations' },
  { from: /Worldclass/gi, to: 'high-quality' },
  { from: /worldclass/gi, to: 'high-quality' },
  { from: /A\*\* h1 n1/gi, to: 'top-tier' },
  { from: /h1 n1/gi, to: 'top-tier' },
  { from: /gamechanging/gi, to: 'practical' },
  { from: /Gamechanging/gi, to: 'Practical' },
  { from: /max fidelity fluff/gi, to: 'high fidelity' },
  { from: /Max Fidelity/gi, to: 'high fidelity' },
  { from: /max fidelity/gi, to: 'high fidelity' },
  { from: /NextGen v2/gi, to: 'enhanced' },
  { from: /NextGen x100/gi, to: 'enhanced' },
  { from: /Million Times/gi, to: 'significantly' },
  { from: /million times/gi, to: 'significantly' },
  { from: /Ultra Pixel/gi, to: 'polished' },
  { from: /ultra pixel/gi, to: 'polished' },
  { from: /award-winning/gi, to: 'polished' },
  { from: /Behance top 1%/gi, to: 'high-quality' },
  { from: /ray-traced/gi, to: 'detailed' },
  { from: /cinematic lighting/gi, to: 'subtle lighting' },
  { from: /product design photography/gi, to: 'clean design' },
  { from: /OMEGALEVEL/gi, to: 'production' },
  { from: /OMEGA/gi, to: 'enhanced' },
  { from: /TRANSCEND/gi, to: 'premium' },
  { from: /GODMODE/gi, to: 'elite' },
  { from: /DIVINE/gi, to: 'premium' },
  { from: /CascadeGrid/g, to: 'ProfileGrid' },
  { from: /AIComposer/g, to: 'MessageComposer' },
  { from: /SafetyCenter/g, to: 'SafetyPanel' },
  { from: /ProfileCard/g, to: 'ProfilePreviewCard' },
  { from: /DivineAIPanel/g, to: 'AIAssistantPanel' },
  { from: /AppConfigPanel/g, to: 'SettingsPanel' },
  { from: /SafetyAndGrowth/g, to: 'SafetyGrowthPanel' },
  { from: /DIVINE_INTERNAL_TOKEN/g, to: 'APP_INTERNAL_TOKEN' },
  { from: /DIVINE15/g, to: 'WELCOME15 (legacy alias)' },
  { from: /TRANSCEND20/g, to: 'PREMIUM20 (legacy alias)' },
  { from: /GODMODE30/g, to: 'ELITE30 (legacy alias)' },
  { from: /DIVINE10/g, to: 'WELCOME10 (legacy alias)' },
  { from: /isDivineReady/g, to: 'isReady' },
  { from: /useDivine/g, to: 'useAppReady' },
  { from: /divine-stores/g, to: 'app-stores' },
  { from: /divine-hooks/g, to: 'app-hooks' },
  { from: /DivineFeature/g, to: 'AppFeature' },
  { from: /DivineComponents/g, to: 'PremiumComponents' },
  { from: /DivinePanels/g, to: 'PremiumPanels' },
  { from: /DivineUX/g, to: 'PremiumUX' },
];

for (const mdFile of mdFiles) {
  const fullPath = path.join('/home/user/fyk-consolidated', mdFile);
  if (!fs.existsSync(fullPath)) continue;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let changed = false;
  
  for (const rep of replacements) {
    if (rep.from.test(content)) {
      content = content.replace(rep.from, rep.to);
      changed = true;
    }
  }
  
  if (changed) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Fixed hyperbol in ${mdFile}`);
  }
}

console.log('Done fixing MD hyperbol');
