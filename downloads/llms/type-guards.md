# TypeScript Type Guards Patterns

Practical patterns for narrowing types and writing custom type guards.

---

## typeof Type Guards

Use JavaScript's `typeof` operator to narrow primitive types.

```typescript
function padLeft(padding: number | string, input: string): string {
  if (typeof padding === "number") {
    return " ".repeat(padding) + input; // padding: number
  }
  return padding + input; // padding: string
}

// Pattern: Union type handling
function formatValue(value: string | number): string {
  if (typeof value === "string") {
    return value.toUpperCase(); // value: string
  }
  return value.toFixed(2); // value: number
}

// Pattern: Type-safe JSON parsing
function parseJsonSafe(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function processInput(input: unknown): string {
  if (typeof input === "string") {
    return input.trim();
  }
  if (typeof input === "number") {
    return input.toString();
  }
  if (typeof input === "boolean") {
    return input ? "yes" : "no";
  }
  return "unknown";
}
```

**Valid typeof strings:** `"string"`, `"number"`, `"bigint"`, `"boolean"`, `"symbol"`, `"undefined"`, `"object"`, `"function"`

---

## Truthiness Narrowing

Filter out falsy values to narrow types.

```typescript
function multiplyAll(
  values: number[] | undefined,
  factor: number
): number[] | undefined {
  if (!values) {
    return values; // values: undefined
  }
  return values.map((x) => x * factor); // values: number[]
}

// Pattern: Remove null/undefined from array
function compact<T>(arr: (T | null | undefined)[]): T[] {
  return arr.filter((item): item is T => Boolean(item));
}

// Pattern: Guard clause pattern
function getLength(obj: string | undefined): number {
  if (!obj) {
    throw new Error("Object is falsy");
  }
  return obj.length; // obj: string
}

// Pattern: Filter falsy values
const mixed = [0, 1, "", "hello", null, undefined, false, true];
const truthy = mixed.filter(Boolean);
// [1, "hello", true]
```

---

## Equality Narrowing

Use `===`, `!==`, `==`, `!=` for type narrowing.

```typescript
function example(x: string | number, y: string | boolean) {
  if (x === y) {
    // Both narrowed to string (only common type)
    x.toUpperCase();
    y.toLowerCase();
  }
}

// Pattern: Null checks (== null catches both null and undefined)
function process(value: string | null | undefined): string {
  if (value == null) {
    return "default";
  }
  return value; // value: string
}

// Pattern: Enum comparison
enum Status {
  Active = "active",
  Inactive = "inactive",
}

function handleStatus(status: Status | null) {
  if (status === Status.Active) {
    // status: Status.Active
    console.log("Active");
  } else if (status === Status.Inactive) {
    // status: Status.Inactive
    console.log("Inactive");
  } else {
    // status: null
    console.log("No status");
  }
}
```

---

## `instanceof` Narrowing

Check class instances at runtime.

```typescript
class HttpError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
  }
}

class ValidationError extends Error {
  constructor(
    message: string,
    public field: string
  ) {
    super(message);
  }
}

function handleError(err: Error): string {
  if (err instanceof HttpError) {
    return `HTTP ${err.statusCode}: ${err.message}`; // err: HttpError
  }
  if (err instanceof ValidationError) {
    return `Field ${err.field}: ${err.message}`; // err: ValidationError
  }
  return err.message; // err: Error
}

// Pattern: Date vs string
function parseDate(input: Date | string): Date {
  if (input instanceof Date) {
    return input; // input: Date
  }
  return new Date(input); // input: string
}
```

---

## `in` Operator Narrowing

Check for property existence to narrow object types.

```typescript
interface Fish {
  swim: () => void;
}

interface Bird {
  fly: () => void;
}

function move(animal: Fish | Bird): void {
  if ("swim" in animal) {
    animal.swim(); // animal: Fish
  } else {
    animal.fly(); // animal: Bird
  }
}

// Pattern: Feature detection
interface LegacyComponent {
  render: () => string;
  mount: () => void;
}

interface ModernComponent {
  render: () => string;
  attachShadow: () => ShadowRoot;
}

function initComponent(component: LegacyComponent | ModernComponent) {
  if ("attachShadow" in component) {
    // ModernComponent
    const shadow = component.attachShadow();
  } else {
    // LegacyComponent
    component.mount();
  }
  // Both have render
  component.render();
}
```

---

## Custom Type Guards with `is`

Create reusable type guard functions using the `is` keyword.

```typescript
interface Circle {
  kind: "circle";
  radius: number;
}

interface Square {
  kind: "square";
  sideLength: number;
}

interface Triangle {
  kind: "triangle";
  base: number;
  height: number;
}

type Shape = Circle | Square | Triangle;

// Custom type guard
function isCircle(shape: Shape): shape is Circle {
  return shape.kind === "circle";
}

function isSquare(shape: Shape): shape is Square {
  return shape.kind === "square";
}

function isTriangle(shape: Shape): shape is Triangle {
  return shape.kind === "triangle";
}

// Usage with type narrowing
function getArea(shape: Shape): number {
  if (isCircle(shape)) {
    return Math.PI * shape.radius ** 2; // shape: Circle
  }
  if (isSquare(shape)) {
    return shape.sideLength ** 2; // shape: Square
  }
  if (isTriangle(shape)) {
    return (shape.base * shape.height) / 2; // shape: Triangle
  }
  const _exhaustive: never = shape;
  return _exhaustive;
}
```

**Pattern: Type guard with validation logic**

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
}

function isUser(obj: unknown): obj is User {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "name" in obj &&
    "email" in obj &&
    "role" in obj &&
    typeof (obj as User).id === "string" &&
    typeof (obj as User).name === "string" &&
    typeof (obj as User).email === "string" &&
    ["admin", "user", "guest"].includes((obj as User).role)
  );
}

// Pattern: Type guard for API responses
interface ApiResponse {
  data: unknown;
  status: number;
}

function isSuccessResponse(
  response: ApiResponse
): response is ApiResponse & { status: 200 } {
  return response.status === 200;
}
```

**Pattern: Type guard for arrays**

```typescript
function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

// Usage with filter
const mixedArray: unknown[] = ["hello", 42, "world", null, "typescript"];
const strings = mixedArray.filter(isStringArray);
// Note: filter works differently - use this pattern:
const strings = mixedArray.filter(
  (item): item is string => typeof item === "string"
);
// strings: string[]
```

---

## Discriminated Unions (Tagged Unions)

Use a common discriminant property for exhaustive type checking.

```typescript
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; sideLength: number }
  | { kind: "triangle"; base: number; height: number };

function getArea(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2; // shape: Circle
    case "square":
      return shape.sideLength ** 2; // shape: Square
    case "triangle":
      return (shape.base * shape.height) / 2; // shape: Triangle
  }
}

// Pattern: API response discrimination
type ApiResponse<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string; code: number };

function renderResponse<T>(response: ApiResponse<T>): string {
  switch (response.status) {
    case "loading":
      return "Loading...";
    case "success":
      return `Got ${JSON.stringify(response.data)}`;
    case "error":
      return `Error ${response.code}: ${response.message}`;
  }
}

// Pattern: State machine
type OrderState =
  | { status: "created"; orderId: string }
  | { status: "paid"; orderId: string; paymentId: string }
  | { status: "shipped"; orderId: string; trackingNumber: string }
  | { status: "delivered"; orderId: string; deliveredAt: Date };

function getOrderInfo(state: OrderState): string {
  switch (state.status) {
    case "created":
      return `Order ${state.orderId} created`;
    case "paid":
      return `Order ${state.orderId} paid via ${state.paymentId}`;
    case "shipped":
      return `Tracking: ${state.trackingNumber}`;
    case "delivered":
      return `Delivered at ${state.deliveredAt.toISOString()}`;
  }
}
```

---

## Exhaustive Type Checking with `never`

Ensure all union members are handled.

```typescript
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; sideLength: number };

function getArea(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "square":
      return shape.sideLength ** 2;
    default:
      const _exhaustive: never = shape;
      return _exhaustive;
  }
}
```

**Pattern: Exhaustive check helper**

```typescript
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}

function handleShape(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "square":
      return shape.sideLength ** 2;
    default:
      return assertNever(shape);
  }
}
```

**Pattern: Exhaustive enum handling**

```typescript
enum Direction {
  Up = "UP",
  Down = "DOWN",
  Left = "LEFT",
  Right = "RIGHT",
}

function move(direction: Direction): { x: number; y: number } {
  switch (direction) {
    case Direction.Up:
      return { x: 0, y: 1 };
    case Direction.Down:
      return { x: 0, y: -1 };
    case Direction.Left:
      return { x: -1, y: 0 };
    case Direction.Right:
      return { x: 1, y: 0 };
    default:
      return assertNever(direction);
  }
}
```

---

## Assertion Functions

Similar to type predicates but throw errors instead of returning booleans.

```typescript
function assertIsString(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new Error(`Expected string, got ${typeof value}`);
  }
}

function processName(input: unknown): string {
  assertIsString(input); // throws if not string
  return input.toUpperCase(); // input: string (narrowed)
}

// Pattern: Assertion for DOM elements
function assertElement(
  element: HTMLElement | null,
  selector: string
): asserts element is HTMLElement {
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
}

function initUI() {
  const button = document.getElementById("submit");
  assertElement(button, "#submit");
  button.addEventListener("click", handleSubmit); // button: HTMLElement
}
```

---

## Control Flow Analysis

TypeScript follows code execution to determine types at each point.

```typescript
function example(x: string | number, y: string | boolean) {
  // x: string | number, y: string | boolean

  if (typeof x === "string") {
    // x: string
    x.toUpperCase(); // OK
  } else {
    // x: number
    x.toFixed(2); // OK
  }

  // After if/else, x is back to string | number
  // (TypeScript doesn't merge branches after they end)
}

// Pattern: Early return narrowing
function getLength(input: string | null): number {
  if (input === null) {
    return 0; // early return
  }
  // input is narrowed to string here
  return input.length;
}

// Pattern: Assertion function narrowing
function assertDefined<T>(
  value: T | null | undefined,
  message: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

function processUser(user: User | null) {
  assertDefined(user, "User is required");
  // user is now User (not null)
  console.log(user.name);
}
```

---

## Type Guards for Complex Types

### Pattern: Guard for unknown data

```typescript
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function processUnknown(data: unknown) {
  if (isRecord(data)) {
    // data is Record<string, unknown>
    if ("name" in data && typeof data.name === "string") {
      console.log(data.name.toUpperCase());
    }
  }
}
```

### Pattern: Guard for nested types

```typescript
interface Config {
  server: {
    host: string;
    port: number;
  };
  database: {
    url: string;
  };
}

function isConfig(obj: unknown): obj is Config {
  return (
    isRecord(obj) &&
    isRecord(obj.server) &&
    typeof obj.server.host === "string" &&
    typeof obj.server.port === "number" &&
    isRecord(obj.database) &&
    typeof obj.database.url === "string"
  );
}

function loadConfig(data: unknown): Config {
  if (!isConfig(data)) {
    throw new Error("Invalid config");
  }
  return data; // data: Config
}
```

### Pattern: Guard for function types

```typescript
type Handler = (input: string) => void;

function isHandler(value: unknown): value is Handler {
  return typeof value === "function";
}

function registerHandler(name: string, handler: unknown) {
  if (isHandler(handler)) {
    // handler: Handler
    handlers.set(name, handler);
  }
}
```

---

## Combining Type Guards with Utility Types

```typescript
// Pattern: Filter with type guard
function filterByType<T, U extends T>(
  arr: T[],
  guard: (item: T) => item is U
): U[] {
  return arr.filter(guard);
}

// Pattern: Pick specific types from union
type OnlyStrings<T> = T extends string ? T : never;

function getStringValues<T>(arr: T[]): OnlyStrings<T>[] {
  return arr.filter((item): item is OnlyStrings<T> =>
    typeof item === "string"
  ) as OnlyStrings<T>[];
}

// Pattern: Type-safe reduce
function groupBy<T, K extends string>(
  arr: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return arr.reduce(
    (acc, item) => {
      const key = keyFn(item);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    },
    {} as Record<K, T[]>
  );
}
```

---

## Type Guard Performance Tips

```typescript
// Pattern: Cache type guard results
const typeCache = new WeakMap<object, string>();

function getType(value: unknown): string {
  if (typeof value === "object" && value !== null) {
    let type = typeCache.get(value);
    if (type === undefined) {
      type = value.constructor.name;
      typeCache.set(value, type);
    }
    return type;
  }
  return typeof value;
}

// Pattern: Use simple checks first
function isUser(obj: unknown): obj is User {
  // Fast path: check simple types first
  if (typeof obj !== "object" || obj === null) return false;

  // Then check specific properties
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.email === "string"
  );
}

// Pattern: Narrow before deep checks
function processComplex(value: unknown) {
  // Narrow first
  if (typeof value !== "object" || value === null) {
    return;
  }

  // Now safe to access properties
  if ("type" in value) {
    const type = (value as { type: unknown }).type;
    if (type === "specific") {
      // Further narrowing
    }
  }
}
```
