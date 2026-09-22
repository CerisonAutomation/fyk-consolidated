import fs from 'fs';
import path from 'path';

// Fix omega clients — replace old with omega, with professional naming
const omegaMappings = [
  { omega: 'src/components/board/board-client-omega.tsx', standard: 'src/components/board/board-client.tsx', compOmega: 'BoardClientOmega', compStandard: 'BoardClient' },
  { omega: 'src/components/events/events-client-omega.tsx', standard: 'src/components/events/events-client.tsx', compOmega: 'EventsClientOmega', compStandard: 'EventsClient' },
  { omega: 'src/components/fansites/fansites-client-omega.tsx', standard: 'src/components/fansites/fansites-client.tsx', compOmega: 'FansitesClientOmega', compStandard: 'FansitesClient' },
  { omega: 'src/components/gamechangers/gamechangers-client-omega.tsx', standard: 'src/components/gamechangers/gamechangers-client.tsx', compOmega: 'GamechangersClientOmega', compStandard: 'GamechangersClient' },
  { omega: 'src/components/groups/groups-client-omega.tsx', standard: 'src/components/groups/groups-client.tsx', compOmega: 'GroupsClientOmega', compStandard: 'GroupsClient' },
  { omega: 'src/components/guide/guide-client-omega.tsx', standard: 'src/components/guide/venue-guide-client.tsx', compOmega: 'GuideClientOmega', compStandard: 'VenueGuideClient' },
  { omega: 'src/components/king-pet/king-pet-client-omega.tsx', standard: 'src/components/king-pet/king-pet-client.tsx', compOmega: 'KingPetClientOmega', compStandard: 'KingPetClient' },
  { omega: 'src/components/meetnow/meetnow-client-omega.tsx', standard: 'src/components/meetnow/meetnow-client.tsx', compOmega: 'MeetNowClientOmega', compStandard: 'MeetNowClient' },
  { omega: 'src/components/shouts/shouts-client-omega.tsx', standard: 'src/components/shouts/shouts-client.tsx', compOmega: 'ShoutsClientOmega', compStandard: 'ShoutsClient' },
  { omega: 'src/components/tribes/tribes-client-omega.tsx', standard: 'src/components/tribes/tribes-client.tsx', compOmega: 'TribesClientOmega', compStandard: 'TribesClient' },
  { omega: 'src/components/explore/explore-client-omega.tsx', standard: 'src/components/explore/explore-client.tsx', compOmega: 'ExploreClientOmega', compStandard: 'ExploreClient' },
  { omega: 'src/components/premium/premium-client-omega.tsx', standard: 'src/components/premium/premium-client.tsx', compOmega: 'PremiumClientOmega', compStandard: 'PremiumClient' },
];

for (const mapping of omegaMappings) {
  const omegaPath = path.join('/home/user/fyk-consolidated', mapping.omega);
  const standardPath = path.join('/home/user/fyk-consolidated', mapping.standard);
  
  if (fs.existsSync(omegaPath)) {
    let content = fs.readFileSync(omegaPath, 'utf8');
    // Replace Omega component name with standard
    content = content.replace(new RegExp(mapping.compOmega, 'g'), mapping.compStandard);
    // Fix any remaining hyperbol already done, but ensure professional
    content = content.replace(/\/\/ Community — practical features\n/g, '// Community board — practical features, clean design\n');
    
    // Write to standard file
    fs.writeFileSync(standardPath, content, 'utf8');
    console.log(`Replaced ${mapping.standard} with ${mapping.omega} -> ${mapping.compStandard}`);
    
    // Delete omega file
    fs.unlinkSync(omegaPath);
    console.log(`Deleted ${mapping.omega}`);
  }
}

// Fix routes to use standard clients (not omega)
const routeUpdates = [
  { route: 'src/routes/board/index.tsx', comp: 'BoardClient', path: '../../components/board/board-client', routePath: '/board/' },
  { route: 'src/routes/events/index.tsx', comp: 'EventsClient', path: '../../components/events/events-client', routePath: '/events/' },
  { route: 'src/routes/fansites/index.tsx', comp: 'FansitesClient', path: '../../components/fansites/fansites-client', routePath: '/fansites/' },
  { route: 'src/routes/gamechangers/index.tsx', comp: 'GamechangersClient', path: '../../components/gamechangers/gamechangers-client', routePath: '/gamechangers/' },
  { route: 'src/routes/groups/index.tsx', comp: 'GroupsClient', path: '../../components/groups/groups-client', routePath: '/groups/' },
  { route: 'src/routes/guide/index.tsx', comp: 'VenueGuideClient', path: '../../components/guide/venue-guide-client', routePath: '/guide/' },
  { route: 'src/routes/king-pet/index.tsx', comp: 'KingPetClient', path: '../../components/king-pet/king-pet-client', routePath: '/king-pet/' },
  { route: 'src/routes/meetnow/index.tsx', comp: 'MeetNowClient', path: '../../components/meetnow/meetnow-client', routePath: '/meetnow/' },
  { route: 'src/routes/shouts/index.tsx', comp: 'ShoutsClient', path: '../../components/shouts/shouts-client', routePath: '/shouts/' },
  { route: 'src/routes/tribes/index.tsx', comp: 'TribesClient', path: '../../components/tribes/tribes-client', routePath: '/tribes/' },
  { route: 'src/routes/discover.tsx', comp: 'ExploreClient', path: '../components/explore/explore-client', routePath: '/discover' },
  { route: 'src/routes/premium/index.tsx', comp: 'PremiumClient', path: '../../components/premium/premium-client', routePath: '/premium/' },
];

for (const u of routeUpdates) {
  const fullPath = path.join('/home/user/fyk-consolidated', u.route);
  const content = `import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute('${u.routePath}')({
  component: lazyRouteComponent(() => import("${u.path}").then((m) => ({ default: m.${u.comp} }))),
});
`;
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Updated route ${u.route} -> ${u.comp}`);
}

// Fix Divine naming — rename files and fix function names to professional PascalCase
const divineFixes = [
  { old: 'src/components/ui/pixel-perfect/DivineComponents.tsx', new: 'src/components/ui/pixel-perfect/PremiumComponents.tsx' },
  { old: 'src/components/divine/SafetyAndGrowth.tsx', new: 'src/components/divine/PremiumPanels.tsx' },
  { old: 'src/components/ai/DivineAIPanel.tsx', new: 'src/components/ai/PremiumAIPanel.tsx' },
  { old: 'src/hooks/divine-hooks.ts', new: 'src/hooks/premium-hooks.ts' },
];

for (const fix of divineFixes) {
  const oldPath = path.join('/home/user/fyk-consolidated', fix.old);
  const newPath = path.join('/home/user/fyk-consolidated', fix.new);
  if (fs.existsSync(oldPath)) {
    let content = fs.readFileSync(oldPath, 'utf8');
    // Fix function names to PascalCase
    content = content.replace(/export function premiumPanels\(\)/g, 'export function PremiumPanels()');
    content = content.replace(/export function premiumUX\(\)/g, 'export function PremiumUX()');
    content = content.replace(/export \{ AIAssistantPanel as premiumAIPanel \}/g, 'export { AIAssistantPanel as PremiumAIPanel }');
    content = content.replace(/export \{ useAppReady as usepremium \}/g, 'export { useAppReady as usePremium }');
    content = content.replace(/export function premiumPanels/g, 'export function PremiumPanels');
    content = content.replace(/premiumPanels/g, 'PremiumPanels');
    content = content.replace(/premiumUX/g, 'PremiumUX');
    content = content.replace(/premiumAIPanel/g, 'PremiumAIPanel');
    content = content.replace(/usepremium/g, 'usePremium');
    
    fs.writeFileSync(newPath, content, 'utf8');
    fs.unlinkSync(oldPath);
    console.log(`Renamed ${fix.old} -> ${fix.new} with professional PascalCase`);
  }
}

// Fix any remaining lowercase function names in divine folder
const divineFolder = '/home/user/fyk-consolidated/src/components/divine';
if (fs.existsSync(divineFolder)) {
  const files = fs.readdirSync(divineFolder);
  for (const file of files) {
    const full = path.join(divineFolder, file);
    if (fs.statSync(full).isFile()) {
      let content = fs.readFileSync(full, 'utf8');
      let changed = false;
      if (content.includes('export function premium') || content.includes('export function Premium') === false) {
        // Check for lowercase after export function
        const matches = content.match(/export function ([a-z][a-zA-Z]*)\(/g);
        if (matches) {
          for (const m of matches) {
            const funcName = m.replace('export function ', '').replace('(', '');
            const pascal = funcName.charAt(0).toUpperCase() + funcName.slice(1);
            if (funcName !== pascal) {
              content = content.replace(new RegExp(`export function ${funcName}\\(`), `export function ${pascal}(`);
              changed = true;
            }
          }
        }
      }
      if (changed) {
        fs.writeFileSync(full, content, 'utf8');
        console.log(`Fixed PascalCase in ${full}`);
      }
    }
  }
}

console.log('Done fixing non-standard naming');
