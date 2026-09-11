# TypeScript Generics Patterns

Practical patterns for writing reusable, type-safe code with generics.

---

## Basic Generic Functions

```typescript
// Identity function - the "hello world" of generics
function identity<Type>(arg: Type): Type {
  return arg;
}

// Explicit type
let output = identity<string>("myString");

// Type inference (preferred)
let output = identity("myString"); // inferred as string
```

**Pattern: Generic array operations**

```typescript
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

function last<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1];
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

const nums = first([1, 2, 3]); // type: number | undefined
const str = first(["a", "b"]); // type: string | undefined
```

---

## Generic Constraints

Constrain generic types to those that have specific properties.

```typescript
interface HasLength {
  length: number;
}

function logLength<T extends HasLength>(arg: T): T {
  console.log(arg.length);
  return arg;
}

logLength("hello"); // OK - string has length
logLength([1, 2, 3]); // OK - array has length
logLength({ length: 10, value: 3 }); // OK
// logLength(3); // ERROR - number doesn't have length
```

**Pattern: Type-safe property access with keyof**

```typescript
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const person = { name: "Alice", age: 30, email: "alice@example.com" };

getProperty(person, "name"); // OK - returns string
getProperty(person, "age"); // OK - returns number
// getProperty(person, "phone"); // ERROR - "phone" not in keyof person
```

**Pattern: Generic class with constraint**

```typescript
class DataStore<T extends { id: number }> {
  private items: T[] = [];

  add(item: T): void {
    this.items.push(item);
  }

  findById(id: number): T | undefined {
    return this.items.find((item) => item.id === id);
  }

  update(id: number, updates: Partial<T>): T | undefined {
    const item = this.findById(id);
    if (item) {
      Object.assign(item, updates);
    }
    return item;
  }
}

interface User {
  id: number;
  name: string;
  email: string;
}

const store = new DataStore<User>();
store.add({ id: 1, name: "Alice", email: "alice@test.com" });
store.findById(1); // OK
// store.add({ name: "Bob" }); // ERROR - missing id
```

---

## Generic Defaults

Provide default types for generics to simplify usage.

```typescript
interface Container<T = string, U = T[]> {
  value: T;
  items: U;
}

// Uses defaults: Container<string, string[]>
const a: Container = { value: "hello", items: ["a", "b"] };

// Override first default: Container<number, string[]>
const b: Container<number> = { value: 42, items: ["a"] };

// Override both: Container<boolean, number[]>
const c: Container<boolean, number[]> = { value: true, items: [1, 2] };
```

**Pattern: Generic with DOM element default**

```typescript
declare function create<
  T extends HTMLElement = HTMLDivElement,
  U extends HTMLElement[] = T[]
>(element?: T, children?: U): Container<T, U>;

// Uses HTMLDivElement default
const div = create();

// Overrides to HTMLParagraphElement
const p = create(new HTMLParagraphElement());
```

---

## Generic Interfaces and Types

```typescript
// Generic interface
interface ApiResponse<T> {
  data: T;
  status: number;
  timestamp: Date;
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}

// Usage
const users: PaginatedResponse<User> = {
  data: [{ id: 1, name: "Alice", email: "a@test.com" }],
  status: 200,
  timestamp: new Date(),
  total: 100,
  page: 1,
  pageSize: 10,
};
```

**Pattern: Generic type with conditional default**

```typescript
type Store<T = Record<string, unknown>> = {
  get<K extends keyof T>(key: K): T[K];
  set<K extends keyof T>(key: K, value: T[K]): void;
};
```

---

## Generic Classes

```typescript
class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  size(): number {
    return this.items.length;
  }
}

const numberStack = new Stack<number>();
numberStack.push(1);
numberStack.push(2);
const top = numberStack.pop(); // type: number | undefined
// numberStack.push("three"); // ERROR
```

**Pattern: Generic factory pattern**

```typescript
function create<T>(c: { new (): T }): T {
  return new c();
}

class Animal {
  name = "Animal";
}

class Lion extends Animal {
  roar() {
    return "ROAR!";
  }
}

const lion = create(Lion);
lion.name; // OK
lion.roar(); // OK
```

---

## Conditional Types

Use conditional types to create types based on type relationships.

```typescript
// Basic conditional type
type IsString<T> = T extends string ? true : false;

type A = IsString<string>; // true
type B = IsString<number>; // false

// Conditional type with infer
type Flatten<T> = T extends Array<infer Item> ? Item : T;

type Num = Flatten<number[]>; // number
type Str = Flatten<string[]>; // string
type Raw = Flatten<boolean>; // boolean

// Extract function return type
type GetReturnType<T> = T extends (...args: never[]) => infer Return
  ? Return
  : never;

type Fn = () => string;
type Result = GetReturnType<Fn>; // string
```

**Pattern: Distributive conditional types**

```typescript
// Distributes over union members
type ToArray<T> = T extends any ? T[] : never;

type StrOrNum = ToArray<string | number>; // string[] | number[]

// Non-distributive version
type ToArrayNonDist<T> = [T] extends [any] ? T[] : never;

type Union = ToArrayNonDist<string | number>; // (string | number)[]
```

**Pattern: Extract specific function overload return types**

```typescript
function process(input: string): string;
function process(input: number): number;
function process(input: string | number): string | number {
  return input;
}

type StringResult = Extract<
  ReturnType<typeof process>,
  string
>;
// string
```

---

## Mapped Types with Generics

```typescript
// Basic mapped type
type ReadOnly<T> = {
  readonly [K in keyof T]: T[K];
};

// Optional mapped type
type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};

// Getters pattern
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface User {
  name: string;
  age: number;
}

type UserGetters = Getters<User>;
// { getName: () => string; getAge: () => number }

// Pattern: Make specific properties optional
type PartialBy<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

type CreateUserInput = PartialBy<User, "id" | "avatar">;
// { id?: string; name: string; email: string; avatar?: string }
```

---

## Template Literal Types with Generics

```typescript
// HTTP method + path type
type Route = `/${string}`;
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

type ApiEndpoint = `${HttpMethod} ${Route}`;
// "GET /" | "GET /users" | ... (all combinations)

// Event name pattern
type EventName<T extends string> = `on${Capitalize<T>}`;

function on<T extends string>(
  event: EventName<T>,
  handler: () => void
) {
  // ...
}

on("click", () => {}); // OK
on("Click", () => {}); // OK - Capitalize handles it
// on("mousedown", () => {}); // ERROR - doesn't match on* pattern
```

**Pattern: Type-safe route parameters**

```typescript
type ExtractParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractParams<Rest>]: string }
    : T extends `${string}:${infer Param}`
      ? { [K in Param]: string }
      : {};

type Params = ExtractParams<"/users/:userId/posts/:postId">;
// { userId: string; postId: string }
```

---

## Generic Utility Functions

```typescript
// Pattern: Type-safe Object.entries
function objectEntries<T extends Record<string, unknown>>(
  obj: T
): [keyof T, T[keyof T]][] {
  return Object.entries(obj) as [keyof T, T[keyof T]][];
}

// Pattern: Type-safe Object.fromEntries
function objectFromEntries<T extends [string, unknown][]>(
  entries: T
): { [K in T[number][0]]: Extract<T[number], [K, unknown]>[1] } {
  return Object.fromEntries(entries) as any;
}

// Pattern: Type-safe fetch wrapper
async function fetchJson<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

interface User {
  id: number;
  name: string;
}

const user = await fetchJson<User>("/api/user/1");
// user is typed as User
```

---

## Generic Constraints with Multiple Bounds

```typescript
// Multiple constraints using intersection
interface HasId {
  id: number;
}

interface HasName {
  name: string;
}

function logEntity<T extends HasId & HasName>(entity: T): void {
  console.log(`${entity.name} (${entity.id})`);
}

logEntity({ id: 1, name: "Alice", extra: true }); // OK
// logEntity({ name: "Bob" }); // ERROR - missing id
```

---

## Generic Type Inference Helpers

```typescript
// Extract element type from array
type ElementOf<T> = T extends (infer E)[] ? E : never;

type Num = ElementOf<number[]>; // number

// Unwrap Promise
type Unwrap<T> = T extends Promise<infer U> ? Unwrap<U> : T;

type Deep = Unwrap<Promise<Promise<string>>>; // string

// Get all methods of a class
type MethodNames<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

class UserService {
  getUser(id: number) {}
  createUser(data: User) {}
  name = "service"; // property, not method
}

type Methods = MethodNames<UserService>; // "getUser" | "createUser"
```

---

## Variance Annotations (TS 5+)

```typescript
// Contravariant (in) - consumer
interface Consumer<in T> {
  consume(arg: T): void;
}

// Covariant (out) - producer
interface Producer<out T> {
  make(): T;
}

// Invariant (in out) - both
interface ProducerConsumer<in out T> {
  consume(arg: T): void;
  make(): T;
}
```

---

## Practical Generic Patterns

### Builder Pattern

```typescript
class QueryBuilder<T extends Record<string, unknown>> {
  private filters: Partial<T> = {};
  private limitValue = 10;

  where<K extends keyof T>(key: K, value: T[K]): this {
    this.filters[key] = value;
    return this;
  }

  take(n: number): this {
    this.limitValue = n;
    return this;
  }

  build(): { filters: Partial<T>; limit: number } {
    return { filters: this.filters, limit: this.limitValue };
  }
}

const query = new QueryBuilder<User>()
  .where("name", "Alice") // type-safe
  .take(5)
  .build();
```

### Type-safe Event Emitter

```typescript
type EventMap = {
  userCreated: { userId: string; name: string };
  userDeleted: { userId: string };
  error: { message: string; code: number };
};

class TypedEmitter<Events extends Record<string, unknown>> {
  private listeners = new Map<string, Set<Function>>();

  on<K extends keyof Events>(
    event: K,
    handler: (data: Events[K]) => void
  ): void {
    if (!this.listeners.has(event as string)) {
      this.listeners.set(event as string, new Set());
    }
    this.listeners.get(event as string)!.add(handler);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    this.listeners.get(event as string)?.forEach((fn) => fn(data));
  }
}

const emitter = new TypedEmitter<EventMap>();
emitter.on("userCreated", (data) => {
  // data is typed as { userId: string; name: string }
  console.log(data.name);
});
emitter.emit("userCreated", { userId: "1", name: "Alice" }); // OK
// emitter.emit("userCreated", { userId: "1" }); // ERROR - missing name
```
