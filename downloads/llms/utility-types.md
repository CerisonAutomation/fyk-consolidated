# TypeScript Utility Types Patterns

Practical patterns for built-in and custom utility types.

---

## Built-in Utility Types

### `Partial<T>` - All Properties Optional

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

// For update operations - partial data
function updateUser(id: string, updates: Partial<User>) {
  // Only pass fields you want to update
}

updateUser("1", { name: "New Name" }); // OK
updateUser("1", { name: "New", avatar: "url", email: "a@b.com" }); // OK
```

**Pattern: Partial with required fields**

```typescript
type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

// id is required, everything else optional
type CreateUserInput = PartialExcept<User, "id">;
// { id: string; name?: string; email?: string; avatar?: string }
```

---

### `Required<T>` - All Properties Required

```typescript
interface Config {
  host?: string;
  port?: number;
  debug?: boolean;
  ssl?: boolean;
}

// After validation, everything is guaranteed
type ValidatedConfig = Required<Config>;
// { host: string; port: number; debug: boolean; ssl: boolean }

function initializeServer(config: ValidatedConfig) {
  // No need to check for undefined
  console.log(`Server at ${config.host}:${config.port}`);
}
```

---

### `Pick<T, K>` - Extract Subset of Properties

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: Date;
}

// Only expose safe fields for API responses
type UserPreview = Pick<User, "id" | "name" | "email">;
// { id: string; name: string; email: string }

// For list views - minimal data
type UserListItem = Pick<User, "id" | "name">;
```

**Pattern: Progressive data loading**

```typescript
type UserBasic = Pick<User, "id" | "name">;
type UserWithContact = Pick<User, "id" | "name" | "email">;
type UserFull = Pick<User, "id" | "name" | "email" | "createdAt">;

function renderUser(user: UserBasic) {
  return `<div>${user.name}</div>`;
}
```

---

### `Omit<T, K>` - Remove Properties

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  salt: string;
}

// Remove sensitive fields for API responses
type SafeUser = Omit<User, "password" | "salt">;
// { id: string; name: string; email: string }

// For form input - no id or createdAt
type UserFormInput = Omit<User, "id" | "createdAt">;
```

**Pattern: Omit with type assertion**

```typescript
function toSafeUser(user: User): Omit<User, "password" | "salt"> {
  const { password, salt, ...safeUser } = user;
  return safeUser;
}
```

---

### `Record<K, T>` - Key-Value Mapping

```typescript
type Fruit = "apple" | "banana" | "orange";
type FruitCount = Record<Fruit, number>;
// { apple: number; banana: number; orange: number }

const counts: FruitCount = { apple: 10, banana: 5, orange: 3 };

// Pattern: Translation mapping
type TranslationKey = "greeting" | "farewell" | "error";
type Translations = Record<TranslationKey, Record<string, string>>;

const en: Translations = {
  greeting: { en: "Hello", es: "Hola" },
  farewell: { en: "Goodbye", es: "Adios" },
  error: { en: "Error", es: "Error" },
};

// Pattern: Status mapping
type Status = "pending" | "active" | "completed";
type StatusColors = Record<Status, string>;

const statusColors: StatusColors = {
  pending: "#ffa500",
  active: "#00ff00",
  completed: "#0000ff",
};
```

---

### `Exclude<T, U>` - Remove Types from Union

```typescript
type AllTypes = "one" | "two" | "three" | 1 | 2 | 3;

type StringOnly = Exclude<AllTypes, number>;
// "one" | "two" | "three"

type WithoutOne = Exclude<AllTypes, "one" | 1>;
// "two" | "three" | 2 | 3

// Pattern: Remove null and undefined
type MaybeString = string | null | undefined;
type CleanString = Exclude<MaybeString, null | undefined>;
// string
```

---

### `Extract<T, U>` - Extract Types from Union

```typescript
type AllTypes = "one" | "two" | "three" | 1 | 2 | 3;

type OnlyNumbers = Extract<AllTypes, number>;
// 1 | 2 | 3

type OnlyStrings = Extract<AllTypes, string>;
// "one" | "two" | "three"

// Pattern: Extract specific shape from union
type Response =
  | { status: "ok"; data: string }
  | { status: "error"; message: string };

type SuccessResponse = Extract<Response, { status: "ok" }>;
// { status: "ok"; data: string }
```

---

### `NonNullable<T>` - Remove null/undefined

```typescript
type MaybeString = string | null | undefined;
type DefiniteString = NonNullable<MaybeString>;
// string

// Pattern: Filter nullable from array
type Input = (string | null | undefined)[];
type CleanInput = NonNullable<Input[number]>[];
// string[]

const items: Input = ["hello", null, "world", undefined];
const clean = items.filter((item): item is string => item != null);
// clean is string[]
```

---

### `ReturnType<T>` - Extract Function Return Type

```typescript
function getUser() {
  return { name: "Alice", age: 30, active: true };
}

type User = ReturnType<typeof getUser>;
// { name: string; age: number; active: boolean }

// Pattern: Type-safe function composition
function createHandler() {
  return {
    handle: (input: string) => input.toUpperCase(),
  };
}

type Handler = ReturnType<typeof createHandler>;
// { handle: (input: string) => string }
```

---

### `InstanceType<T>` - Extract Class Instance Type

```typescript
class Person {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

type PersonInstance = InstanceType<typeof Person>;
// Person

// Pattern: Factory return type
function createPerson(name: string): InstanceType<typeof Person> {
  return new Person(name);
}
```

---

### `Parameters<T>` - Extract Function Parameters

```typescript
function greet(name: string, age: number): void {}

type GreetParams = Parameters<typeof greet>;
// [name: string, age: number]

// Pattern: Spread parameters
function logFirst<T extends (...args: any[]) => any>(
  fn: T,
  ...args: Parameters<T>
): ReturnType<T> {
  console.log("First arg:", args[0]);
  return fn(...args);
}

logFirst(greet, "Alice", 30); // OK
// logFirst(greet, "Alice"); // ERROR - missing age parameter
```

---

### `ConstructorParameters<T>` - Extract Constructor Parameters

```typescript
class Database {
  constructor(
    private host: string,
    private port: number,
    private options?: { ssl: boolean }
  ) {}
}

type DbParams = ConstructorParameters<typeof Database>;
// [host: string, port: number, options?: { ssl: boolean }]

// Pattern: Dependency injection
function createDatabase(...args: ConstructorParameters<typeof Database>) {
  return new Database(...args);
}
```

---

### `Awaited<T>` - Unwrap Promise Types

```typescript
type A = Awaited<Promise<string>>; // string
type B = Awaited<Promise<Promise<number>>>; // number
type C = Awaited<string | Promise<number>>; // string | number

// Pattern: Type-safe async function return
async function fetchData() {
  const response = await fetch("/api/data");
  return response.json();
}

type Data = Awaited<ReturnType<typeof fetchData>>;
// any (but you can cast)
```

---

### `Readonly<T>` and `ReadonlyArray<T>`

```typescript
interface User {
  name: string;
  age: number;
}

type ImmutableUser = Readonly<User>;
// { readonly name: string; readonly age: number }

const user: ImmutableUser = { name: "Alice", age: 30 };
// user.name = "Bob"; // ERROR

// Pattern: Frozen API responses
const users: ReadonlyArray<User> = [
  { name: "Alice", age: 30 },
  { name: "Bob", age: 25 },
];
// users.push({ name: "Eve", age: 20 }); // ERROR
```

---

## Custom Utility Types

### `DeepPartial<T>` - Recursively Partial

```typescript
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

interface Config {
  server: {
    host: string;
    port: number;
    ssl: {
      cert: string;
      key: string;
    };
  };
  database: {
    url: string;
    pool: number;
  };
}

// All nested properties optional
const overrides: DeepPartial<Config> = {
  server: {
    port: 8080,
    ssl: {
      cert: "/path/to/cert",
    },
  },
};
```

---

### `DeepReadonly<T>` - Recursively Readonly

```typescript
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

type ImmutableConfig = DeepReadonly<Config>;
// Everything deeply readonly
```

---

### `PickByType<T, U>` - Pick Properties by Value Type

```typescript
type PickByType<T, U> = {
  [P in keyof T as T[P] extends U ? P : never]: T[P];
};

interface Mixed {
  name: string;
  age: number;
  email: string;
  active: boolean;
  count: number;
}

type StringProps = PickByType<Mixed, string>;
// { name: string; email: string }

type NumberProps = PickByType<Mixed, number>;
// { age: number; count: number }
```

---

### `OmitByType<T, U>` - Omit Properties by Value Type

```typescript
type OmitByType<T, U> = {
  [P in keyof T as T[P] extends U ? never : P]: T[P];
};

type NotString = OmitByType<Mixed, string>;
// { age: number; active: boolean; count: number }
```

---

### `Mutable<T>` - Remove readonly

```typescript
type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

interface Config {
  readonly apiUrl: string;
  readonly timeout: number;
}

type MutableConfig = Mutable<Config>;
// { apiUrl: string; timeout: number }
```

---

### `Optional<T, K>` - Make Specific Properties Optional

```typescript
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

// id is now optional, everything else stays the same
type UpdateUser = Optional<User, "id">;
// { id?: string; name: string; email: string; avatar?: string }
```

---

### `RequireAtLeastOne<T, Keys>` - Require At Least One

```typescript
type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> &
      Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

interface SearchOptions {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}

// At least one of query, category, minPrice, maxPrice must be provided
type ValidSearch = RequireAtLeastOne<
  SearchOptions,
  "query" | "category"
>;
```

---

### `PromiseAll` Return Type

```typescript
type AwaitAll<T extends readonly Promise<any>[]> = {
  [K in keyof T]: Awaited<T[K]>;
};

async function loadAll() {
  const results = await Promise.all([
    fetchUser(1),
    fetchPosts(1),
    fetchComments(1),
  ]);
  // results type: [User, Post[], Comment[]]
}
```

---

### `WithTimestamps<T>` - Add Timestamp Fields

```typescript
type WithTimestamps<T> = T & {
  createdAt: Date;
  updatedAt: Date;
};

interface Post {
  title: string;
  content: string;
}

type PostWithTimestamps = WithTimestamps<Post>;
// { title: string; content: string; createdAt: Date; updatedAt: Date }
```

---

### `Flatten<T>` - Flatten Nested Arrays

```typescript
type Flatten<T extends any[]> = T extends (infer U)[] ? U : T;

type A = Flatten<number[]>; // number
type B = Flatten<string[][]>; // string[]
type C = Flatten<[number, string]>; // number | string
```

---

### `UnionToIntersection<T>` - Convert Union to Intersection

```typescript
type UnionToIntersection<T> = (
  T extends any ? (x: T) => void : never
) extends (x: infer R) => void
  ? R
  : never;

type A = UnionToIntersection<{ a: string } | { b: number }>;
// { a: string } & { b: number }
```

---

### `TupleToUnion<T>` - Convert Tuple to Union

```typescript
type TupleToUnion<T extends any[]> = T[number];

type A = TupleToUnion<[1, 2, 3]>; // 1 | 2 | 3
type B = TupleToUnion<["a", "b", "c"]>; // "a" | "b" | "c"
```

---

## Utility Type Composition Patterns

### Pattern: API Response Types

```typescript
interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// For create operations - no id or timestamps
type CreateInput<T> = Omit<T, keyof BaseEntity>;

// For update operations - partial data, no id
type UpdateInput<T> = Partial<Omit<T, "id" | "createdAt">>;

// For API responses - full entity
type ApiEntity<T> = T & BaseEntity;

// Usage
interface Product {
  name: string;
  price: number;
  description: string;
}

type CreateProduct = CreateInput<Product>;
// { name: string; price: number; description: string }

type UpdateProduct = UpdateInput<Product>;
// { name?: string; price?: number; description?: string; updatedAt?: Date }

type ProductResponse = ApiEntity<Product>;
// { id: string; createdAt: Date; updatedAt: Date; name: string; price: number; description: string }
```

### Pattern: Form Field Types

```typescript
type FormField<T> = {
  value: T;
  error?: string;
  touched?: boolean;
  dirty?: boolean;
};

type FormState<T> = {
  [K in keyof T]: FormField<T[K]>;
};

interface LoginForm {
  email: string;
  password: string;
  rememberMe: boolean;
}

type LoginFormState = FormState<LoginForm>;
// {
//   email: { value: string; error?: string; touched?: boolean; dirty?: boolean };
//   password: { value: string; error?: string; touched?: boolean; dirty?: boolean };
//   rememberMe: { value: boolean; error?: string; touched?: boolean; dirty?: boolean };
// }
```

### Pattern: Type-safe Builder

```typescript
type Builder<T> = {
  [K in keyof T]?: (value: T[K]) => Builder<T>;
} & {
  build: () => T;
};
```
