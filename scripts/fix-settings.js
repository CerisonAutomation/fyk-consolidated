import fs from 'fs';
import path from 'path';

const dir = '/home/user/fyk-consolidated/src/routes/settings';
function walk(d) {
  for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === 'index.tsx') {
      let content = fs.readFileSync(full, 'utf8');
      content = content.replace(/import \{ Shield, Lock, Bell, Eye, Globe, Smartphone, Key, Download, Trash2, Languages, Accessibility, Settings \} from "lucide-react";/g, 'import { Settings } from "lucide-react";');
      content = content.replace(/import \{ cn \} from "@\/lib\/utils";\n/g, '');
      content = content.replace(/variant="outline"/g, 'variant="secondary"');
      // Fix cn usage if removed but still used
      if (content.includes('cn(') && !content.includes('from "@/lib/utils"')) {
        content = content.replace('import { Settings } from "lucide-react";', 'import { Settings } from "lucide-react";\nimport { cn } from "@/lib/utils";');
      }
      fs.writeFileSync(full, content, 'utf8');
      console.log(`Fixed ${full}`);
    }
  }
}
walk(dir);
