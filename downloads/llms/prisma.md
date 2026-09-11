# Prisma ORM v7 - Documentation

**Package:** `@prisma/client` v7.4.2, `prisma` v7.4.2
**Docs:** https://www.prisma.io/docs/orm/v7

## Overview

Prisma ORM is a next-generation Node.js and TypeScript ORM that provides type-safe database access, migrations, and a visual data editor.

## Installation

```bash
npm install prisma @prisma/client
npx prisma init
```

## Schema Definition

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

model Post {
  id        String   @id @default(uuid())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  tags      Tag[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([authorId])
  @@map("posts")
}

model Tag {
  id    String @id @default(uuid())
  name  String @unique
  posts Post[]

  @@map("tags")
}

// Many-to-many with explicit join table
model PostTag {
  postId String
  tagId  String
  post   Post @relation(fields: [postId], references: [id])
  tag    Tag  @relation(fields: [tagId], references: [id])

  @@id([postId, tagId])
  @@map("post_tags")
}
```

## Client Initialization

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
})

// With connection pool
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})
```

## CRUD Operations

### Create

```typescript
// Create single record
const user = await prisma.user.create({
  data: {
    email: 'alice@example.com',
    name: 'Alice',
  },
})

// Create with relations
const post = await prisma.post.create({
  data: {
    title: 'Hello World',
    content: 'This is my first post',
    author: {
      connect: { id: userId },
    },
  },
})

// Create with nested create
const post = await prisma.post.create({
  data: {
    title: 'Hello World',
    author: {
      create: {
        email: 'newuser@example.com',
        name: 'New User',
      },
    },
  },
})

// Create many
const users = await prisma.user.createMany({
  data: [
    { email: 'user1@example.com', name: 'User 1' },
    { email: 'user2@example.com', name: 'User 2' },
  ],
  skipDuplicates: true,
})
```

### Read

```typescript
// Find unique
const user = await prisma.user.findUnique({
  where: { email: 'alice@example.com' },
})

// Find first
const firstPost = await prisma.post.findFirst({
  where: { published: true },
  orderBy: { createdAt: 'desc' },
})

// Find many
const users = await prisma.user.findMany({
  where: {
    posts: {
      some: {
        published: true,
      },
    },
  },
  include: {
    posts: {
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    },
  },
})

// With pagination
const posts = await prisma.post.findMany({
  skip: 0,
  take: 10,
  orderBy: { createdAt: 'desc' },
})

// With filtering
const filteredPosts = await prisma.post.findMany({
  where: {
    OR: [
      { title: { contains: 'hello', mode: 'insensitive' } },
      { content: { contains: 'hello', mode: 'insensitive' } },
    ],
    AND: [
      { published: true },
      { author: { name: { not: null } } },
    ],
  },
})
```

### Update

```typescript
// Update single
const user = await prisma.user.update({
  where: { id: userId },
  data: { name: 'Updated Name' },
})

// Update many
const updatedCount = await prisma.post.updateMany({
  where: { published: false },
  data: { published: true },
})

// Update with upsert
const user = await prisma.user.upsert({
  where: { email: 'alice@example.com' },
  update: { name: 'Alice Updated' },
  create: {
    email: 'alice@example.com',
    name: 'Alice',
  },
})
```

### Delete

```typescript
// Delete single
const user = await prisma.user.delete({
  where: { id: userId },
})

// Delete many
const deletedCount = await prisma.post.deleteMany({
  where: { published: false },
})
```

## Relations

```typescript
// Include relations
const postsWithAuthor = await prisma.post.findMany({
  include: {
    author: true,
    tags: true,
  },
})

// Select specific fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    posts: {
      select: { id: true, title: true },
      where: { published: true },
    },
  },
})

// Nested includes
const posts = await prisma.post.findMany({
  include: {
    author: {
      include: {
        posts: {
          where: { published: true },
          take: 3,
        },
      },
    },
  },
})
```

## Transactions

```typescript
// Interactive transaction
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({
    data: { email: 'new@example.com', name: 'New User' },
  })

  const post = await tx.post.create({
    data: {
      title: 'My Post',
      authorId: user.id,
    },
  })

  return { user, post }
})

// Batch transaction (all queries execute in parallel)
const [users, posts] = await prisma.$transaction([
  prisma.user.findMany(),
  prisma.post.findMany(),
])
```

## Raw Queries

```typescript
// Raw query
const result = await prisma.$queryRaw`
  SELECT * FROM "User"
  WHERE email = ${email}
`

// Raw query with tag template
const users = await prisma.$queryRaw`
  SELECT * FROM "User"
  WHERE "createdAt" > ${new Date('2024-01-01')}
`

// Raw execute
await prisma.$executeRaw`
  UPDATE "User" SET name = ${name} WHERE id = ${id}
`
```

## Error Handling

```typescript
import { Prisma } from '@prisma/client'

try {
  const user = await prisma.user.create({
    data: { email: 'duplicate@example.com' },
  })
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    // Error code: P2002 = unique constraint
    if (e.code === 'P2002') {
      console.log('Unique constraint violation')
    }
    // Error code: P2025 = record not found
    if (e.code === 'P2025') {
      console.log('Record not found')
    }
  }
}
```

## Middleware

```typescript
// Logging middleware
prisma.$use(async (params, next) => {
  const before = Date.now()
  const result = await next(params)
  const after = Date.now()
  console.log(`Query ${params.model}.${params.action} took ${after - before}ms`)
  return result
})
```

## Key Patterns

1. Use `@@map` for custom table names
2. Use `@unique` for unique constraints
3. Use `@default(uuid())` for UUID generation
4. Use `include` for eager loading, `select` for specific fields
5. Use `$transaction` for multi-step operations
6. Use `$queryRaw` for complex queries that can't be expressed with the Prisma API
7. Always handle `PrismaClientKnownRequestError` for known error codes
8. Use `upsert` for create-or-update patterns
