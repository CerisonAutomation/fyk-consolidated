import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding FYK database via raw SQL...");

  const passwordHash = await bcrypt.hash("password123", 10);

  // Insert 13 demo users
  const users = [
    { email: "sol@fyk.app", pseudo: "Sol", age: 28, tier: "gold", role: "admin", city: "New York", occupation: "Product Designer" },
    { email: "marco@fyk.app", pseudo: "Marco", age: 29, tier: "gold", city: "New York", occupation: "Architect" },
    { email: "leo@fyk.app", pseudo: "Leo", age: 31, tier: "free", city: "New York", occupation: "Musician" },
    { email: "adrian@fyk.app", pseudo: "Adrian", age: 27, tier: "plus", city: "New York", occupation: "Founder" },
    { email: "felix@fyk.app", pseudo: "Felix", age: 34, tier: "platinum", city: "New York", occupation: "Creative Director" },
    { email: "theo@fyk.app", pseudo: "Theo", age: 24, tier: "free", city: "New York", occupation: "Film Student" },
    { email: "damian@fyk.app", pseudo: "Damian", age: 36, tier: "plus", city: "New York", occupation: "Chef" },
    { email: "sebastian@fyk.app", pseudo: "Sebastian", age: 28, tier: "gold", city: "New York", occupation: "Personal Trainer" },
    { email: "kai@fyk.app", pseudo: "Kai", age: 26, tier: "free", city: "New York", occupation: "Product Designer" },
    { email: "raheem@fyk.app", pseudo: "Raheem", age: 30, tier: "plus", city: "New York", occupation: "Physician" },
    { email: "andre@fyk.app", pseudo: "Andre", age: 33, tier: "free", city: "New York", occupation: "Bartender" },
    { email: "julian@fyk.app", pseudo: "Julian", age: 38, tier: "free", city: "New York", occupation: "Teacher" },
    { email: "noah@fyk.app", pseudo: "Noah", age: 25, tier: "plus", city: "New York", occupation: "Fashion Stylist" },
  ];

  for (const u of users) {
    await prisma.$executeRaw`
      INSERT INTO public.users (email, password_hash, pseudo, age, tier, city, occupation, online, photos, tribes, interests, looking_for, lat, lng)
      VALUES (${u.email}, ${passwordHash}, ${u.pseudo}, ${u.age}, ${u.tier}, ${u.city}, ${u.occupation}, true, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 40.7128, -74.006)
      ON CONFLICT (email) DO NOTHING
    `;
  }
  console.log(`✅ Created ${users.length} users`);

  // Create tribes
  const tribes = ["Bear", "Twink", "Otter", "Jock", "Geek", "Daddy", "Muscle", "Leather", "Chub", "Polar"];
  for (const name of tribes) {
    await prisma.$executeRaw`INSERT INTO public.tribes (name, member_count) VALUES (${name}, ${Math.floor(Math.random() * 500) + 50}) ON CONFLICT (name) DO NOTHING`;
  }
  console.log("✅ Created 10 tribes");

  // Create king pets for first 7 users
  const petNames = ["Rex", "Luna", "Max", "Charlie", "Buddy", "Rocky", "Bear"];
  for (let i = 0; i < 7; i++) {
    const level = Math.floor(Math.random() * 12) + 1;
    const stage = level >= 10 ? "adult" : level >= 5 ? "juvenile" : "baby";
    const userEmail = users[i].email;
    await prisma.$executeRaw`
      INSERT INTO public.king_pet (user_id, name, stage, mood, bones, experience, level, streak)
      SELECT id, ${petNames[i]}, ${stage}, 'happy', ${Math.floor(Math.random() * 200) + 50}, ${level * 80}, ${level}, ${Math.floor(Math.random() * 14)}
      FROM public.users WHERE email = ${userEmail}
      ON CONFLICT (user_id) DO NOTHING
    `;
  }
  console.log("✅ Created 7 king pets");

  // Create wallets
  await prisma.$executeRaw`
    INSERT INTO public.wallet (user_id, balance, currency)
    SELECT id, 320, 'bones' FROM public.users WHERE email = 'sol@fyk.app'
    ON CONFLICT (user_id) DO NOTHING
  `;
  console.log("✅ Created admin wallet");

  // Create subscriptions
  await prisma.$executeRaw`
    INSERT INTO public.subscriptions (user_id, tier, status, current_period_end)
    SELECT id, 'gold', 'active', now() + interval '30 days' FROM public.users WHERE email = 'sol@fyk.app'
    ON CONFLICT DO NOTHING
  `;
  console.log("✅ Created subscription");

  // Create shouts
  await prisma.$executeRaw`
    INSERT INTO public.shouts (user_id, content, likes_count)
    SELECT id, 'Just launched my dating app! Check it out 🚀', 5 FROM public.users WHERE email = 'sol@fyk.app'
  `;
  console.log("✅ Created shouts");

  // Create notifications
  await prisma.$executeRaw`
    INSERT INTO public.notifications (user_id, type, title, body, read)
    SELECT id, 'system', 'Welcome to FYK!', 'Find your king. Start exploring.', false FROM public.users WHERE email = 'sol@fyk.app'
  `;
  console.log("✅ Created notifications");

  // Create site config
  await prisma.$executeRaw`INSERT INTO public.site_config (key, value) VALUES ('trademark', '"FYK — Find Your King"') ON CONFLICT (key) DO NOTHING`;
  console.log("✅ Created site config");

  console.log("\n🎉 Seeding complete! 13 users, 10 tribes, 7 pets, wallet, subscriptions, shouts, notifications.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
