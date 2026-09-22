import fs from 'fs';
import path from 'path';

const dir = '/home/user/fyk-consolidated/src/routes';
const files = [];

function walk(d) {
  for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.tsx') && full.includes('who-viewed-me') || full.includes('vouches') || full.includes('filters') || full.includes('paywall') || full.includes('discover/map') || full.includes('event') || full.includes('blocked-users') || full.includes('emergency-contact') || full.includes('ai-toggles') || full.includes('data') || full.includes('account-settings') || full.includes('subscription') || full.includes('video-dates') || full.includes('group') || full.includes('shout') || full.includes('interested') || full.includes('verify') || full.includes('image-viewer') || full.includes('agenda') || full.includes('legal') || full.includes('faq') || full.includes('dump-rify') || full.includes('blind-date') || full.includes('story') || full.includes('profile/insights') || full.includes('photo-ranker')) {
      files.push(full);
    }
  }
}

// Actually walk all and filter by recently generated (contain PRD v3.0)
function walkAll(d) {
  for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, entry.name);
    if (entry.isDirectory()) walkAll(full);
    else if (entry.name.endsWith('.tsx')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('PRD v3.0') && content.includes('100% grounded')) {
        files.push(full);
      }
    }
  }
}

files.length = 0;
walkAll(dir);

console.log(`Found ${files.length} screens to fix`);

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix filter unused — remove useState filter if not used, or add void
  if (content.includes('const [filter, setFilter] = useState("All");') && !content.includes('setFilter(')) {
    content = content.replace(/const \[filter, setFilter\] = useState\("All"\);\n\n/, '');
    content = content.replace(/import \{ useState \} from "react";/g, 'import { useState } from "react";\n');
    // Add void if needed
  }
  
  // Fix imports unused — keep only needed
  content = content.replace(/import \{ Shield, Users, Calendar, MapPin, Search, Filter, Heart, MessageSquare, Image as ImageIcon, Video, Gift, Crown, Zap, Eye, Lock, Globe, BarChart3 \} from "lucide-react";/g, '');
  content = content.replace(/import \{ Button, Skeleton, EmptyState \} from "@\/components\/ui\/primitives";/g, 'import { Skeleton } from "@/components/ui/primitives";');
  content = content.replace(/import \{ cn \} from "@\/lib\/utils";/g, '');
  
  // Fix route path — ensure trailing slash for file routes
  const routeMatch = content.match(/createFileRoute\("([^"]+)"\)/);
  if (routeMatch) {
    let routePath = routeMatch[1];
    // If routePath doesn't end with / and is not $param, add /
    if (!routePath.endsWith('/') && !routePath.includes('$')) {
      routePath = routePath + '/';
      content = content.replace(/createFileRoute\("[^"]+"\)/, `createFileRoute("${routePath}")`);
    }
  }
  
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Fixed ${file}`);
}
