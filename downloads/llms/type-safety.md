# TypeScript Type Safety Best Practices

Practical patterns and configuration for writing bulletproof TypeScript code.

---

## Strict Configuration

Enable comprehensive strictness in tsconfig.json:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "verbatimModuleSyntax": true
  }
}
```

### What Each Flag Does

| Flag | Purpose |
|------|---------|
| `strict` | Enables all strict sub-flags (nullChecks, noImplicitAny, etc.) |
| `noUncheckedIndexedAccess` | Adds `undefined` to index signature access |
| `exactOptionalPropertyTypes` | Prevents assigning `undefined` to optional props |
| `noFallthroughCasesInSwitch` | Errors on switch fallthrough |
| `noImplicitReturns` | Ensures all code paths return values |
| `noUnusedLocals` | Flags unused variables |
| `noImplicitOverride` | Requires `override` keyword |
| `verbatimModuleSyntax` | Enforces explicit import/export syntax |

---

## Structural Typing (Duck Typing)

Types are checked by shape, not declaration. This is TypeScript's core principle.

```typescript
interface Point {
  x: number;
  y: number;
}

function logPoint(p: Point) {
  console.log(`${p.x}, ${p.y}`);
}

// Works because shapes match - no explicit type needed
const point = { x: 12, y: 26 };
logPoint(point);

// Also works with class instances
class VirtualPoint {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

logPoint(new VirtualPoint(3, 7));
```

---

## Union Types for Flexibility

Handle multiple possible types safely.

```typescript
type WindowStates = "open" | "closed" | "minimized";
type MyBool = true | false;

function wrapInArray(obj: string | string[]) {
  if (typeof obj === "string") {
    return [obj]; // TypeScript knows obj is string
  }
  return obj;
}

function setState(state: WindowStates) {
  // state is narrowed to one of the literal types
  switch (state) {
    case "open":
      break;
    case "closed":
      break;
    case "minimized":
      break;
  }
}
```

---

## `unknown` Over `any`

Always prefer `unknown` for catch variables and external data.

```typescript
// BAD: any disables all type checking
try {
  riskyOperation();
} catch (err: any) {
  console.log(err.message); // no compile-time safety
}

// GOOD: unknown forces you to narrow the type
try {
  riskyOperation();
} catch (err: unknown) {
  if (err instanceof Error) {
    console.log(err.message); // safe
  } else {
    console.log(String(err));
  }
}
```

**Pattern: Typed catch with custom error type**

```typescript
type AppError =
  | { code: "NOT_FOUND"; resource: string }
  | { code: "VALIDATION"; field: string; message: string }
  | { code: "NETWORK"; url: string; status: number };

function handleError(err: unknown): AppError {
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as any).code === "string"
  ) {
    return err as AppError;
  }
  return { code: "NETWORK", url: "", status: 500 };
}
```

---

## Non-null Assertions and Nullish Checks

```typescript
// Pattern: Guard clauses over non-null assertion
function getLength(x: string | undefined): number {
  if (x === undefined) {
    throw new Error("x is required");
  }
  return x.length; // x is narrowed to string
}

// Pattern: Nullish coalescing
function getConfig(key: string): string {
  return process.env[key] ?? "default";
}

// Pattern: Optional chaining
function getUserCity(user: User | null): string | undefined {
  return user?.address?.city;
}
```

---

## NoUncheckedIndexedAccess Patterns

With `noUncheckedIndexedAccess`, index access returns `T | undefined`.

```typescript
interface Data {
  [key: string]: string;
}

// With noUncheckedIndexedAccess enabled:
function getValue(data: Data, key: string): string {
  const value = data[key]; // type: string | undefined

  if (value === undefined) {
    throw new Error(`Key "${key}" not found`);
  }

  return value; // narrowed to string
}

// Pattern: Safe array access
function first<T>(arr: T[]): T {
  if (arr.length === 0) {
    throw new Error("Array is empty");
  }
  return arr[0]; // type: T (safe)
}
```

---

## ExactOptionalPropertyTypes Patterns

```typescript
interface Config {
  theme?: "light" | "dark";
  timeout?: number;
}

const c: Config = { theme: "light" };

// With exactOptionalPropertyTypes:
c.theme = "dark"; // OK
c.theme = undefined; // ERROR - can't assign undefined to optional

// Pattern: Use union with undefined explicitly when needed
interface StrictConfig {
  theme?: "light" | "dark" | undefined;
}
```

---

## Type Inference Best Practices

```typescript
// PATTERN: Let TypeScript infer when obvious
const numbers = [1, 2, 3]; // inferred as number[]
const obj = { x: 1, y: "hello" }; // inferred as { x: number; y: string }

// PATTERN: Use explicit types for function signatures
function processData(input: string): number {
  // return type is explicit
  return input.length;
}

// PATTERN: Use inferred return type for complex functions
function buildUser(name: string, age: number) {
  return { name, age, createdAt: new Date() };
}
// ReturnType<typeof buildUser> = { name: string; age: number; createdAt: Date }

// PATTERN: as const for readonly literal types
const ROUTES = ["/home", "/about", "/contact"] as const;
// readonly ["/home", "/about", "/contact"]
```

---

## Type Compatibility Patterns

```typescript
// Interface compatibility - shapes match, extra properties allowed
interface Point { x: number; y: number }
interface Point3D extends Point { z: number }

function logPoint(p: Point) {
  console.log(`${p.x}, ${p.y}`);
}

const point3D: Point3D = { x: 12, y: 26, z: 89 };
logPoint(point3D); // OK - has x and y

// Pattern: Assignability between interfaces
interface User {
  name: string;
  id: number;
}

class UserAccount {
  name: string;
  id: number;
  constructor(name: string, id: number) {
    this.name = name;
    this.id = id;
  }
}

const user: User = new UserAccount("Murphy", 1); // OK
```

---

## Exhaustive Switch Patterns

```typescript
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; sideLength: number }
  | { kind: "triangle"; base: number; height: number };

function getArea(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "square":
      return shape.sideLength ** 2;
    case "triangle":
      return (shape.base * shape.height) / 2;
    default:
      const _exhaustive: never = shape;
      return _exhaustive;
  }
}
// If a new variant is added to Shape, this function errors until handled
```

---

## Type Assertions: When and How

```typescript
// Pattern: Type assertion for DOM elements
const canvas = document.getElementById("myCanvas") as HTMLCanvasElement;

// Pattern: Type assertion for JSON parsing
const data = JSON.parse(rawJson) as UserData;

// Pattern: Const assertions for readonly tuples
const ROUTES = ["/home", "/about"] as const;

// Pattern: Satisfies for validation without widening
type Status = "active" | "inactive";
const config = {
  status: "active" as const,
  // TypeScript verifies config satisfies some type
};

// BEST PRACTICE: Avoid assertions when possible, prefer narrowing
// BAD: const user = data as User;
// GOOD: if (isValidUser(data)) { use(data); }
```

---

## Discriminated Unions for Type Safety

```typescript
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function handleResult(result: Result<User>) {
  if (result.success) {
    // result.data is User
    console.log(result.data.name);
  } else {
    // result.error is string
    console.error(result.error);
  }
}

// Pattern: API response typing
type ApiResponse =
  | { status: "loading" }
  | { status: "success"; data: User[] }
  | { status: "error"; message: string };

function renderResponse(response: ApiResponse) {
  switch (response.status) {
    case "loading":
      return "Loading...";
    case "success":
      return response.data.map((u) => u.name).join(", ");
    case "error":
      return `Error: ${response.message}`;
  }
}
```

---

## Preventing Runtime Errors at Compile Time

```typescript
// Pattern: Exhaustive enum handling
enum LogLevel {
  Debug = "debug",
  Info = "info",
  Warn = "warn",
  Error = "error",
}

function logLevelToString(level: LogLevel): string {
  switch (level) {
    case LogLevel.Debug:
      return "[DEBUG]";
    case LogLevel.Info:
      return "[INFO]";
    case LogLevel.Warn:
      return "[WARN]";
    case LogLevel.Error:
      return "[ERROR]";
    default:
      const _never: never = level;
      return _never;
  }
}

// Pattern: Never type for unreachable code
function throwError(message: string): never {
  throw new Error(message);
}

function infiniteLoop(): never {
  while (true) {}
}

// Pattern: Type-safe event emitter
type EventMap = {
  click: { x: number; y: number };
  keypress: { key: string };
  submit: { formData: FormData };
};

function emit<K extends keyof EventMap>(
  event: K,
  data: EventMap[K]
) {
  // type-safe: data type matches event key
}

emit("click", { x: 1, y: 2 }); // OK
emit("click", { key: "a" }); // ERROR
```
