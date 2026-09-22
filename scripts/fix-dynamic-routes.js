import fs from 'fs';

const files = [
  'src/routes/events/$eventId.tsx',
  'src/routes/groups/$groupId.tsx',
  'src/routes/shouts/$shoutId.tsx',
  'src/routes/stories/$storyId.tsx',
];

for (const file of files) {
  const full = `/home/user/fyk-consolidated/${file}`;
  let content = fs.readFileSync(full, 'utf8');
  content = content.replace(/createFileRoute\("\/events\/\$eventId\/"\)/g, 'createFileRoute("/events/$eventId")');
  content = content.replace(/createFileRoute\("\/groups\/\$groupId\/"\)/g, 'createFileRoute("/groups/$groupId")');
  content = content.replace(/createFileRoute\("\/shouts\/\$shoutId\/"\)/g, 'createFileRoute("/shouts/$shoutId")');
  content = content.replace(/createFileRoute\("\/stories\/\$storyId\/"\)/g, 'createFileRoute("/stories/$storyId")');
  content = content.replace(/createFileRoute\("\/discover\/map\/"\)/g, 'createFileRoute("/discover/map/")'); // this one should have trailing slash? Actually map is static, should have /
  fs.writeFileSync(full, content, 'utf8');
  console.log(`Fixed ${file}`);
}
