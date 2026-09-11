import { PrismaClient } from "./generated/prisma/client.js";

import { getDatabaseUrl } from "./database-url.js";

import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
	connectionString: getDatabaseUrl(),
});

declare global {
	var _prisma: PrismaClient | undefined;
}

export const prisma = globalThis._prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
	globalThis._prisma = prisma;
}
