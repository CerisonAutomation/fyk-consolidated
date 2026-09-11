# TypeScript 5 Features and Patterns

Comprehensive reference of TypeScript 5.x features, patterns, and best practices.

---

## ECMAScript Decorators (TS 5.0)

The new decorator proposal enables decorating classes, methods, properties, getters, setters, and auto-accessors using `ClassMethodDecoratorContext`.

```typescript
function logged(originalMethod: any, context: ClassMethodDecoratorContext) {
  const methodName = String(context.name);
  return function (this: any, ...args: any[]) {
    console.log(`Entering ${methodName}`);
    const result = originalMethod.call(this, ...args);
    console.log(`Exiting ${methodName}`);
    return result;
  };
}

class Person {
  @logged
  greet() {
    console.log("Hello");
  }
}
```

**Pattern: Decorator with options**

```typescript
function throttle(ms: number) {
  return function <T extends (...args: any[]) => any>(
    originalMethod: T,
    context: ClassMethodDecoratorContext
  ) {
    let lastCall = 0;
    return function (this: any, ...args: Parameters<T>) {
      const now = Date.now();
      if (now - lastCall >= ms) {
        lastCall = now;
        return originalMethod.apply(this, args);
      }
    };
  };
}

class SearchInput {
  @throttle(300)
  onChange(value: string) {
    // only fires at most once every 300ms
  }
}
```

**Pattern: Decorator with metadata**

```typescript
const cache = new WeakMap<object, Map<string, any>>();

function memoize(
  originalMethod: any,
  context: ClassMethodDecoratorContext
) {
  const methodName = String(context.name);
  return function (this: any, ...args: any[]) {
    if (!cache.has(this)) cache.set(this, new Map());
    const map = cache.get(this)!;
    const key = `${methodName}:${JSON.stringify(args)}`;
    if (map.has(key)) return map.get(key);
    const result = originalMethod.call(this, ...args);
    map.set(key, result);
    return result;
  };
}

class ExpensiveService {
  @memoize
  compute(n: number) {
    // expensive computation
    return n * n;
  }
}
```

---

## `const` Type Parameters (TS 5.0)

Enables precise literal type inference without `as const` at call sites.

```typescript
type HasNames = { names: readonly string[] };

function getNamesExactly<const T extends HasNames>(arg: T) {
  return arg.names;
}

// Inferred: readonly ["Alice", "Bob"]
const names = getNamesExactly({ names: ["Alice", "Bob"] });
```

**Pattern: Const generics for tuples**

```typescript
function createRoutes<const T extends readonly string[]>(routes: T) {
  return routes.map((r) => ({ path: r, name: r.replace("/", "") }));
}

// Inferred: { path: "/home"; name: "home" }[]
const routes = createRoutes(["/home", "/about", "/contact"]);
```

**Pattern: Enum-like with const**

```typescript
function getStatus<const T extends readonly string[]>(statuses: T) {
  return statuses.reduce(
    (acc, s) => ({ ...acc, [s]: s }),
    {} as Record<T[number], T[number]>
  );
}

const Status = getStatus(["active", "inactive", "pending"] as const);
// { active: "active"; inactive: "inactive"; pending: "pending" }
```

---

## `satisfies` Operator (TS 4.9 / TS 5.0 JSDoc)

Validates expression types while preserving their original narrowed type.

```typescript
type Colors = "red" | "green" | "blue";
type RGB = [red: number, green: number, blue: number];

const palette = {
  red: [255, 0, 0],
  green: "#00ff00",
  satisfies: Record<Colors, string | RGB>,
};

// palette.green is inferred as string (not string | RGB)
const greenHex = palette.green.toUpperCase(); // Works!
```

**Pattern: Strict config validation**

```typescript
interface ConfigSettings {
  compilerOptions: { strict: boolean };
  extends: string[];
}

const config = {
  compilerOptions: { strict: true },
  extends: ["tsconfig.base.json"],
  satisfies: ConfigSettings,
};
// config.extends is still string[], validated against the interface
```

---

## Multiple `extends` in tsconfig.json (TS 5.0)

Configuration files can now extend multiple bases.

```json
{
  "extends": [
    "@tsconfig/strictest/tsconfig.json",
    "./base.json",
    "./react.json"
  ],
  "compilerOptions": {
    "outDir": "./dist"
  }
}
```

Later entries override earlier ones for conflicting options.

---

## `--moduleResolution bundler` (TS 5.0)

Optimized for modern bundlers (Vite, esbuild, Webpack).

```json
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler"
  }
}
```

- Use `node16`/`nodenext` for npm libraries
- Use `bundler` for application code

---

## `--verbatimModuleSyntax` (TS 5.0)

Replaces deprecated `--importsNotUsedAsValues` and `--preserveValueImports`.

```typescript
// Type-only import - entirely erased at runtime
import type { Car } from "./car";

// Value import - preserved at runtime
import { Car } from "./car";
```

```json
{
  "compilerOptions": {
    "verbatimModuleSyntax": true
  }
}
```

---

## `export type *` (TS 5.0)

Type-only re-exports of entire modules.

```typescript
export type * as Models from "./models";
// Only type information is re-exported, no runtime code
```

---

## All Enums are Union Enums (TS 5.0)

Every enum member now has its own literal type, improving narrowing.

```typescript
enum Status {
  Active,
  Inactive,
}

function check(s: Status) {
  if (s === Status.Active) {
    // s is narrowed to Status.Active
  }
}
```

---

## Preserved Narrowing in Closures (TS 5.4)

TypeScript now correctly narrows variables in callbacks when the last assignment is before the callback.

```typescript
function getUrls(url: string | URL, names: string[]) {
  if (typeof url === "string") {
    url = new URL(url);
  }
  // url is correctly narrowed to URL here
  return names.map((name) => {
    url.searchParams.set("name", name);
    return url.toString();
  });
}
```

---

## `NoInfer` Utility Type (TS 5.4)

Prevents specific type parameters from being used as inference candidates.

```typescript
function createStreetLight<C extends string>(
  colors: C[],
  defaultColor?: NoInfer<C>
) {
  // ...
}

// Error: '"blue"' is not assignable to type '"red" | "yellow" | "green" | undefined'
createStreetLight(["red", "yellow", "green"], "blue");

// Works
createStreetLight(["red", "yellow", "green"], "red");
```

---

## `Object.groupBy` and `Map.groupBy` (TS 5.4)

Support for new JavaScript static methods.

```typescript
const array = [0, 1, 2, 3, 4, 5];
const myObj = Object.groupBy(array, (num) =>
  num % 2 === 0 ? "even" : "odd"
);
// { even: [0, 2, 4], odd: [1, 3, 5] }
```

---

## `module: preserve` (TS 5.4)

Models bundler behavior more accurately while allowing `require()` syntax.

```json
{
  "compilerOptions": {
    "module": "preserve"
  }
}
```

```typescript
import * as foo from "some-package/foo";
import bar = require("some-package/bar"); // Now works with preserve
```

---

## JSDoc Enhancements (TS 5.0)

```typescript
// @overload for function overloads in JSDoc
/**
 * @overload
 * @param {string} input
 * @returns {string}
 */
/**
 * @overload
 * @param {number} input
 * @returns {number}
 */
function process(input) {
  return input;
}

// @satisfies for type validation
/** @satisfies {ConfigSettings} */
const config = { compilerOptions: { strict: true }, extends: [] };
```

---

## Performance Improvements (TS 5.0)

- 10-20% faster builds
- 41% smaller npm package size
- Case-insensitive import sorting (configurable)
- Exhaustive `switch`/`case` completions in editor

---

## Migration and Breaking Changes

**Key upgrades from TS 4.x:**
- Minimum Node.js 12.20 required
- `--target` defaults to ES2018
- `--forceConsistentCasingInFileNames` defaults to `true`
- Deprecated options (`--out`, `--charset`, etc.) will be removed in 5.5

**Pattern: Gradual migration**

```json
{
  "compilerOptions": {
    "ignoreDeprecations": "5.0"
  }
}
```

Use temporarily to suppress warnings during upgrade.

---

## Recommended TS 5.x tsconfig

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```
