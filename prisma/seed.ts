import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding FYK Consolidated database...");

  // Clean existing data
  await prisma.$executeRaw`TRUNCATE TABLE users CASCADE`;

  const passwordHash = await bcrypt.hash("password123", 10);

  // === USERS (13 demo personas) ===
  const users = await Promise.all([
    prisma.user.create({ data: { email: "sol@fyk.app", passwordHash, pseudo: "Sol", age: 28, description: "Product Designer. Building the future of queer dating.", occupation: "Product Designer", tier: "gold", verification: 92, trustScore: 92, role: "admin", photos: ["https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400"], tribes: ["Jock", "Geek"], interests: ["Art", "Coffee", "Travel"], lookingFor: ["Dating", "Friends"], lat: 40.7128, lng: -74.006, city: "New York" } }),
    prisma.user.create({ data: { email: "marco@fyk.app", passwordHash, pseudo: "Marco", age: 29, description: "Architect by day, dancer by night.", occupation: "Architect", tier: "gold", verification: 88, trustScore: 85, photos: ["https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400"], tribes: ["Jock", "Muscle"], interests: ["Gym", "Music", "Travel"], lookingFor: ["Dating", "Relationship"], lat: 40.7589, lng: -73.9851, city: "New York" } }),
    prisma.user.create({ data: { email: "leo@fyk.app", passwordHash, pseudo: "Leo", age: 31, description: "Musician. Guitar, piano, and everything in between.", occupation: "Musician", tier: "free", verification: 75, trustScore: 70, photos: ["https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400"], tribes: ["Bear", "Geek"], interests: ["Music", "Film", "Coffee"], lookingFor: ["Friends", "Dating"], lat: 40.7282, lng: -73.7949, city: "New York" } }),
    prisma.user.create({ data: { email: "adrian@fyk.app", passwordHash, pseudo: "Adrian", age: 27, description: "Tech founder. Building something cool.", occupation: "Founder", tier: "plus", verification: 82, trustScore: 80, photos: ["https://images.unsplash.com/photo-1463453091185-61582044d556?w=400"], tribes: ["Geek", "Otter"], interests: ["Travel", "Food", "Books"], lookingFor: ["Dating", "Networking"], lat: 40.7484, lng: -73.9857, city: "New York" } }),
    prisma.user.create({ data: { email: "felix@fyk.app", passwordHash, pseudo: "Felix", age: 34, description: "Creative Director. Making things beautiful.", occupation: "Creative Director", tier: "platinum", verification: 95, trustScore: 90, photos: ["https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400"], tribes: ["Daddy", "Leather", "Muscle"], interests: ["Art", "Film", "Wine"], lookingFor: ["Relationship", "Right Now"], lat: 40.7614, lng: -73.9776, city: "New York" } }),
    prisma.user.create({ data: { email: "theo@fyk.app", passwordHash, pseudo: "Theo", age: 24, description: "Film student. Always at the cinema.", occupation: "Film Student", tier: "free", verification: 65, trustScore: 60, photos: ["https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400"], tribes: ["Twink", "Geek"], interests: ["Film", "Books", "Coffee"], lookingFor: ["Friends", "Dating"], lat: 40.7282, lng: -73.7949, city: "New York" } }),
    prisma.user.create({ data: { email: "damian@fyk.app", passwordHash, pseudo: "Damian", age: 36, description: "Chef. Food is my love language.", occupation: "Chef", tier: "plus", verification: 80, trustScore: 78, photos: ["https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400"], tribes: ["Bear", "Polar"], interests: ["Food", "Cooking", "Travel"], lookingFor: ["Dating", "Right Now"], lat: 40.7589, lng: -73.9851, city: "New York" } }),
    prisma.user.create({ data: { email: "sebastian@fyk.app", passwordHash, pseudo: "Sebastian", age: 28, description: "Personal Trainer. Let's get fit together.", occupation: "Personal Trainer", tier: "gold", verification: 90, trustScore: 88, photos: ["https://images.unsplash.com/photo-1564564321837-a57b7070ac4f?w=400"], tribes: ["Jock", "Muscle"], interests: ["Gym", "Running", "Hiking"], lookingFor: ["Dating", "Gym buddy"], lat: 40.7484, lng: -73.9857, city: "New York" } }),
    prisma.user.create({ data: { email: "kai@fyk.app", passwordHash, pseudo: "Kai", age: 26, description: "Product Designer. Making tech human.", occupation: "Product Designer", tier: "free", verification: 70, trustScore: 68, photos: ["https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400"], tribes: ["Otter", "Geek"], interests: ["Art", "Travel", "Music"], lookingFor: ["Friends", "Networking"], lat: 40.7128, lng: -74.006, city: "New York" } }),
    prisma.user.create({ data: { email: "raheem@fyk.app", passwordHash, pseudo: "Raheem", age: 30, description: "Physician. Saving lives and looking for love.", occupation: "Physician", tier: "plus", verification: 85, trustScore: 82, photos: ["https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=400"], tribes: ["Jock", "Muscle"], interests: ["Gym", "Travel", "Food"], lookingFor: ["Relationship", "Dating"], lat: 40.7589, lng: -73.9851, city: "New York" } }),
    prisma.user.create({ data: { email: "andre@fyk.app", passwordHash, pseudo: "Andre", age: 33, description: "Bartender. Best drinks in the city.", occupation: "Bartender", tier: "free", verification: 60, trustScore: 55, photos: ["https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400"], tribes: ["Daddy", "Geek"], interests: ["Coffee", "Music", "Film"], lookingFor: ["Right Now", "Friends"], lat: 40.7282, lng: -73.7949, city: "New York" } }),
    prisma.user.create({ data: { email: "julian@fyk.app", passwordHash, pseudo: "Julian", age: 38, description: "Teacher. Wisdom comes with age.", occupation: "Teacher", tier: "free", verification: 55, trustScore: 50, photos: ["https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400"], tribes: ["Chub", "Bear"], interests: ["Books", "Travel", "Food"], lookingFor: ["Dating", "Relationship"], lat: 40.7484, lng: -73.9857, city: "New York" } }),
    prisma.user.create({ data: { email: "noah@fyk.app", passwordHash, pseudo: "Noah", age: 25, description: "Fashion Stylist. Style is a way of life.", occupation: "Fashion Stylist", tier: "plus", verification: 78, trustScore: 75, photos: ["https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400"], tribes: ["Twink"], interests: ["Art", "Drag", "Photography"], lookingFor: ["Dating", "Networking"], lat: 40.7614, lng: -73.9776, city: "New York" } }),
  ]);

  console.log(`✅ Created ${users.length} users`);

  // === TRIBES ===
  const tribeNames = ["Bear", "Twink", "Otter", "Jock", "Geek", "Daddy", "Muscle", "Leather", "Chub", "Polar"];
  for (const name of tribeNames) {
    await prisma.tribe.create({ data: { name, memberCount: Math.floor(Math.random() * 500) + 50 } });
  }
  console.log("✅ Created 10 tribes");

  // === KING PETS ===
  for (let i = 0; i < 7; i++) {
    const level = Math.floor(Math.random() * 12) + 1;
    const stage = level >= 10 ? "adult" : level >= 5 ? "juvenile" : "baby";
    await prisma.kingPet.create({
      data: {
        userId: users[i].id,
        name: ["Rex", "Luna", "Max", "Charlie", "Buddy", "Rocky", "Bear"][i],
        stage: stage as any,
        mood: "happy",
        bones: Math.floor(Math.random() * 200) + 50,
        experience: level * 80,
        level,
        streak: Math.floor(Math.random() * 14),
      },
    });
  }
  console.log("✅ Created 7 king pets");

  // === WALLET (admin) ===
  const wallet = await prisma.wallet.create({ data: { userId: users[0].id, balance: 320, currency: "bones" } });
  await prisma.walletTransaction.createMany({
    data: [
      { walletId: wallet.id, type: "credit", amount: 50, description: "Starting balance" },
      { walletId: wallet.id, type: "credit", amount: 15, description: "Daily reward" },
      { walletId: wallet.id, type: "debit", amount: 50, description: "Tap Boost" },
    ],
  });
  console.log("✅ Created admin wallet (320 bones)");

  // === SUBSCRIPTION (admin) ===
  await prisma.subscription.create({
    data: { userId: users[0].id, tier: "gold", status: "active", currentPeriodEnd: new Date(Date.now() + 30 * 86400000) },
  });

  // === TAPS & MATCHES ===
  const taps = [];
  for (let i = 1; i < users.length; i++) {
    taps.push({ tapperId: users[i].id, tappedId: users[0].id, type: "like" as const });
  }
  taps.push({ tapperId: users[0].id, tappedId: users[1].id, type: "like" as const });
  taps.push({ tapperId: users[0].id, tappedId: users[2].id, type: "like" as const });
  await prisma.tap.createMany({ data: taps });

  await prisma.match.create({ data: { user1Id: users[0].id < users[1].id ? users[0].id : users[1].id, user2Id: users[0].id < users[1].id ? users[1].id : users[0].id } });
  console.log("✅ Created 13 taps + 1 match");

  // === CONVERSATIONS & MESSAGES ===
  for (let i = 0; i < 5; i++) {
    const conv = await prisma.conversation.create({ data: { type: "direct" } });
    await prisma.conversationParticipant.createMany({
      data: [
        { conversationId: conv.id, userId: users[0].id },
        { conversationId: conv.id, userId: users[i + 1].id },
      ],
    });
    const msgs = [`Hey! How's your week going?`, `Pretty good! Just finished a project.`, `Nice! What kind of project?`, `A dating app actually 😄`, `That's awesome! How's it going?`, `Slowly but surely!`];
    for (let j = 0; j < 4; j++) {
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          senderId: j % 2 === 0 ? users[0].id : users[i + 1].id,
          content: msgs[j],
        },
      });
    }
  }
  console.log("✅ Created 5 conversations with messages");

  // === EVENTS ===
  const eventData = [
    { name: "Rooftop Kings Mixer", category: "Party", location: "Sky Lounge, NYC", startTime: new Date(Date.now() + 86400000), createdBy: users[0].id },
    { name: "Harbour Run", category: "Fitness", location: "Hudson River Park", startTime: new Date(Date.now() + 172800000), createdBy: users[1].id },
    { name: "Queer Film Night", category: "Culture", location: "Angelika Film Center", startTime: new Date(Date.now() + 259200000), createdBy: users[2].id },
  ];
  for (const e of eventData) {
    await prisma.event.create({ data: { ...e, status: "published", maxAttendees: 50, tags: ["social"] } });
  }
  console.log("✅ Created 3 events");

  // === SHOUTS ===
  await prisma.shout.createMany({
    data: [
      { userId: users[0].id, content: "Just launched my dating app! Check it out 🚀" },
      { userId: users[1].id, content: "Who's up for rooftop drinks tonight? 🍸" },
      { userId: users[2].id, content: "New song dropped! Link in bio 🎵" },
    ],
  });
  console.log("✅ Created 3 shouts");

  // === NOTIFICATIONS ===
  await prisma.notification.createMany({
    data: [
      { userId: users[0].id, type: "tap", title: "Marco tapped you!", body: "Start a conversation", actorId: users[1].id, href: "/taps" },
      { userId: users[0].id, type: "match", title: "New match!", body: "You and Marco matched", actorId: users[1].id, href: "/chat" },
      { userId: users[0].id, type: "message", title: "New message", body: "Hey! How's your week going?", actorId: users[2].id, href: "/chat" },
    ],
  });
  console.log("✅ Created 3 notifications");

  // === SITE CONFIG ===
  await prisma.siteConfig.createMany({
    data: [
      { key: "trademark", value: "FYK — Find Your King" },
      { key: "wallet_perks", value: { daily_reward: 15, starting_balance: 50 } },
      { key: "moderation", value: { auto_flag_threshold: 0.7, review_queue_enabled: true } },
    ],
  });
  console.log("✅ Created site config");

  console.log("\n🎉 Seeding complete! 13 users, 10 tribes, 7 pets, conversations, events, shouts, notifications.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
