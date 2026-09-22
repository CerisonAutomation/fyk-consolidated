import fs from 'fs';
import path from 'path';

const dir = '/home/user/fyk-consolidated/src/routes';
function walk(d) {
  for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.tsx')) {
      let content = fs.readFileSync(full, 'utf8');
      // Only fix files that have the production template with many lucide imports
      if (content.includes('MAX DEPTH PRODUCTION') && content.includes('from "lucide-react"')) {
        // Replace large import with minimal needed
        content = content.replace(
          /import \{ Shield, Users, Calendar, MapPin, Search, Heart, MessageSquare, Image as ImageIcon, Video, Gift, Crown, Zap, Eye, Lock \} from "lucide-react";/g,
          'import { Users, Calendar, MapPin, Search } from "lucide-react";'
        );
        content = content.replace(/import \{ Button, Skeleton \} from "@\/components\/ui\/primitives";/g, 'import { Skeleton } from "@/components/ui/primitives";');
        fs.writeFileSync(full, content, 'utf8');
      }
    }
  }
}
walk(dir);
console.log('Fixed unused imports');
