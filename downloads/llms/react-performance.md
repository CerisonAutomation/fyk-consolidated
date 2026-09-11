# React Performance Optimization Patterns

> Compiled from community resources and official documentation (2024+)

---

## Table of Contents

1. [Measurement First](#measurement-first)
2. [Component Memoization](#component-memoization)
3. [useMemo and useCallback](#usememo-and-usecallback)
4. [Code Splitting & Lazy Loading](#code-splitting--lazy-loading)
5. [Virtual Lists](#virtual-lists)
6. [State Management Optimization](#state-management-optimization)
7. [Debouncing & Throttling](#debouncing--throttling)
8. [Web Workers](#web-workers)
9. [React Compiler (React 19)](#react-compiler-react-19)
10. [useTransition & useDeferredValue](#usetransition--usedeferredvalue)
11. [Bundle Optimization](#bundle-optimization)
12. [Profiling Tools](#profiling-tools)

---

## Measurement First

**Never optimize without measuring.** Use Chrome DevTools React Profiler to identify actual bottlenecks.

### React DevTools Profiler

```tsx
// Enable in development
// 1. Open React DevTools
// 2. Go to Profiler tab
// 3. Click Record, interact, then Stop
// 4. Analyze flamegraph and ranked chart
```

### Programmatic Profiling

```tsx
import { Profiler } from "react";

function onRenderCallback(
  id,        // the "id" prop of the Profiler tree
  phase,     // "mount" or "update"
  actualDuration, // time spent rendering the committed update
  baseDuration,   // estimated time to render the entire subtree
  startTime,      // when React began rendering this update
  commitTime,     // when React committed this update
) {
  console.log(`${id} ${phase}: ${actualDuration}ms`);
}

function App() {
  return (
    <Profiler id="App" onRender={onRenderCallback}>
      <Dashboard />
    </Profiler>
  );
}
```

---

## Component Memoization

### React.memo

Prevents re-renders when props haven't changed.

```tsx
// Basic usage
const UserCard = React.memo(({ user, onSelect }) => (
  <div onClick={() => onSelect(user)}>
    <h3>{user.name}</h3>
    <p>{user.email}</p>
  </div>
));

// With custom comparison function
const UserCard = React.memo(
  ({ user, onSelect }) => (
    <div onClick={() => onSelect(user)}>
      <h3>{user.name}</h3>
    </div>
  ),
  (prevProps, nextProps) => {
    // Only re-render if user.id or user.name changed
    return (
      prevProps.user.id === nextProps.user.id &&
      prevProps.user.name === nextProps.user.name
    );
  },
);
```

**When to use:**
- Component receives the same props frequently
- Render is expensive (large DOM, complex calculations)
- Child receives a callback from a parent that re-renders often

**When NOT to use:**
- Component is cheap to render
- Props change frequently anyway
- Adds complexity without measurable benefit

---

## useMemo and useCallback

### useMemo

Caches expensive computations.

```tsx
function ProductList({ products, filter }) {
  // Only recalculates when products or filter changes
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (filter.category && p.category !== filter.category) return false;
      if (filter.minPrice && p.price < filter.minPrice) return false;
      if (filter.maxPrice && p.price > filter.maxPrice) return false;
      return true;
    });
  }, [products, filter]);

  // Only recalculates when filteredProducts changes
  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => a.price - b.price);
  }, [filteredProducts]);

  return sortedProducts.map((p) => <ProductCard key={p.id} product={p} />);
}
```

### useCallback

Caches function references -- essential for passing callbacks to memoized children.

```tsx
function Parent() {
  const [count, setCount] = useState(0);

  // Without useCallback: new function reference every render
  // const handleClick = () => setCount(c => c + 1);

  // With useCallback: stable reference across renders
  const handleClick = useCallback(() => {
    setCount((c) => c + 1);
  }, []);

  return (
    <div>
      <p>Count: {count}</p>
      <MemoizedChild onClick={handleClick} />
    </div>
  );
}

const MemoizedChild = React.memo(({ onClick }) => {
  console.log("Child rendered");
  return <button onClick={onClick}>Increment</button>;
});
```

### Pattern: Stable Object References

```tsx
// Problem: new object reference every render
function Bad() {
  return <Child style={{ color: "red" }} />;
}

// Solution: memoize the object
function Good() {
  const style = useMemo(() => ({ color: "red" }), []);
  return <Child style={style} />;
}

// Or extract to module scope for static values
const STYLE = { color: "red" };
function AlsoGood() {
  return <Child style={STYLE} />;
}
```

---

## Code Splitting & Lazy Loading

### Route-Based Splitting

```tsx
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Settings = lazy(() => import("./pages/Settings"));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

### Component-Based Splitting

```tsx
const HeavyChart = lazy(() => import("./HeavyChart"));

function Dashboard() {
  const [showChart, setShowChart] = useState(false);

  return (
    <div>
      <button onClick={() => setShowChart(true)}>Show Chart</button>
      {showChart && (
        <Suspense fallback={<ChartSkeleton />}>
          <HeavyChart />
        </Suspense>
      )}
    </div>
  );
}
```

### Preloading Strategies

```tsx
// Preload on hover (for links)
function NavLink({ to, children }) {
  const preloadRoute = () => {
    // Trigger the dynamic import to cache it
    const route = routes[to];
    if (route?.preload) route.preload();
  };

  return (
    <Link to={to} onMouseEnter={preloadRoute}>
      {children}
    </Link>
  );
}

// In route definition
const Dashboard = lazy(() => import("./pages/Dashboard"));
// Attach preload to the lazy component
Dashboard.preload = () => import("./pages/Dashboard");
```

---

## Virtual Lists

For rendering thousands of items -- only visible items are rendered in the DOM.

### Using react-window

```tsx
import { FixedSizeList } from "react-window";

const Row = ({ index, style }) => (
  <div style={style}>
    <p>Item {index}</p>
  </div>
);

function VirtualList() {
  return (
    <FixedSizeList
      height={600}
      width="100%"
      itemCount={10000}
      itemSize={50}
    >
      {Row}
    </FixedSizeList>
  );
}
```

### Using @tanstack/react-virtual

```tsx
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

function VirtualList({ items }) {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  });

  return (
    <div ref={parentRef} style={{ height: "600px", overflow: "auto" }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {items[virtualRow.index].name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Virtualized Table

```tsx
import { useVirtualizer } from "@tanstack/react-virtual";

function VirtualTable({ data, columns }) {
  const parentRef = useRef(null);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45,
    overscan: 10,
  });

  return (
    <div ref={parentRef} style={{ height: "500px", overflow: "auto" }}>
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
      </table>
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <table>
              <tbody>
                <tr>
                  {columns.map((col) => (
                    <td key={col.key}>{data[virtualRow.index][col.key]}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## State Management Optimization

### Colocate State

```tsx
// Bad: State in parent re-renders all children
function App() {
  const [filter, setFilter] = useState("");
  const [items, setItems] = useState([]);

  return (
    <div>
      <SearchBar filter={filter} setFilter={setFilter} />
      <ItemList items={items} /> {/* Re-renders on every keystroke */}
    </div>
  );
}

// Good: State colocated where it's used
function App() {
  return (
    <div>
      <SearchBar />
      <ItemList />
    </div>
  );
}

function SearchBar() {
  const [filter, setFilter] = useState("");
  // SearchBar manages its own state
}
```

### Split State by Frequency

```tsx
// Bad: One state causes all re-renders
function UserDashboard() {
  const [state, setState] = useState({
    user: null,
    notifications: [],
    theme: "light",
    isMenuOpen: false,
  });
  // Changing isMenuOpen re-renders everything
}

// Good: Split by update frequency
function UserDashboard() {
  const [user] = useState(null);          // Rarely changes
  const [notifications] = useState([]);   // Updates on new data
  const [theme] = useState("light");      // Changes on user toggle
  const [isMenuOpen, setMenuOpen] = useState(false); // Changes on every click
}
```

### Context Optimization

```tsx
// Bad: Single context causes all consumers to re-render
const AppContext = createContext();

function App() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState("light");
  const [locale, setLocale] = useState("en");

  return (
    <AppContext.Provider value={{ user, theme, locale }}>
      <Router />
    </AppContext.Provider>
  );
}

// Good: Split contexts by update frequency
const UserContext = createContext();
const ThemeContext = createContext();
const LocaleContext = createContext();

function App() {
  return (
    <UserContext.Provider value={user}>
      <ThemeContext.Provider value={theme}>
        <LocaleContext.Provider value={locale}>
          <Router />
        </LocaleContext.Provider>
      </ThemeContext.Provider>
    </UserContext.Provider>
  );
}
```

---

## Debouncing & Throttling

### Debounce Hook

```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Usage
function SearchInput() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery) {
      fetchSearchResults(debouncedQuery);
    }
  }, [debouncedQuery]);

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

### Throttle Hook

```tsx
function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastUpdated = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdated.current >= limit) {
      lastUpdated.current = now;
      setThrottledValue(value);
    } else {
      const timeoutId = setTimeout(() => {
        lastUpdated.current = Date.now();
        setThrottledValue(value);
      }, limit - (now - lastUpdated.current));

      return () => clearTimeout(timeoutId);
    }
  }, [value, limit]);

  return throttledValue;
}
```

### Built-in React Debouncing

```tsx
// React 18+: useDeferredValue for automatic debouncing
function SearchResults({ query }) {
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  return (
    <div style={{ opacity: isStale ? 0.7 : 1 }}>
      <Results query={deferredQuery} />
    </div>
  );
}
```

---

## Web Workers

Offload heavy computation off the main thread.

### Worker Hook

```tsx
function useWorker(workerFunction: Function) {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const blob = new Blob([`(${workerFunction.toString()})()`], {
      type: "application/javascript",
    });
    workerRef.current = new Worker(URL.createObjectURL(blob));

    return () => workerRef.current?.terminate();
  }, []);

  const run = (data: unknown): Promise<unknown> => {
    return new Promise((resolve) => {
      workerRef.current!.onmessage = (e) => resolve(e.data);
      workerRef.current!.postMessage(data);
    });
  };

  return run;
}

// Usage
function HeavyComputation() {
  const [result, setResult] = useState(null);
  const compute = useWorker(() => {
    self.onmessage = (e) => {
      // Heavy computation here
      const result = expensiveCalculation(e.data);
      self.postMessage(result);
    };
  });

  const handleClick = async () => {
    const result = await compute(inputData);
    setResult(result);
  };
}
```

---

## React Compiler (React 19)

The React Compiler automatically memoizes -- no more manual `useMemo`/`useCallback`.

```bash
npm install babel-plugin-react-compiler
```

```js
// babel.config.js
module.exports = {
  plugins: ["babel-plugin-react-compiler"],
};
```

**What it handles automatically:**
- Component memoization
- Hook dependency tracking
- Expensive computation memoization
- Callback stability

**Requirements:**
- Code must follow Rules of React
- Pure render functions (no side effects in render)
- No mutating props, state, or context values

---

## useTransition & useDeferredValue

### useTransition

Mark state updates as non-urgent transitions.

```tsx
function TabContainer() {
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState("home");

  const selectTab = (nextTab) => {
    startTransition(() => {
      setTab(nextTab);
    });
  };

  return (
    <div>
      <TabButtons onSelect={selectTab} />
      <div style={{ opacity: isPending ? 0.6 : 1 }}>
        <TabContent tab={tab} />
      </div>
    </div>
  );
}
```

### useDeferredValue

Defer updates that don't need to be urgent.

```tsx
function SearchPage({ query }) {
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  return (
    <div>
      <input value={query} />
      <div style={{ opacity: isStale ? 0.5 : 1 }}>
        <SearchResults query={deferredQuery} />
      </div>
    </div>
  );
}
```

---

## Bundle Optimization

### Analyze Bundle Size

```bash
# With Vite
npx vite-bundle-visualizer

# With webpack
npx webpack-bundle-analyzer stats.json
```

### Tree Shaking

```tsx
// Bad: Imports entire library
import _ from "lodash";
const result = _.debounce(fn, 300);

// Good: Import only what you need
import debounce from "lodash/debounce";
const result = debounce(fn, 300);

// Even better: Use native or small alternatives
const debounce = (fn, ms) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
};
```

### Dynamic Imports for Large Dependencies

```tsx
// Instead of importing at top level
// import { Chart } from "chart.js";

// Use dynamic import
const Chart = lazy(() =>
  import("chart.js").then((mod) => ({
    default: mod.Chart,
  }))
);
```

---

## Profiling Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| React DevTools Profiler | Visualize renders | Finding which components re-render |
| Chrome Performance Tab | Browser performance | Identifying main thread bottlenecks |
| Lighthouse | Overall web vitals | SEO, accessibility, performance scores |
| Bundle Analyzer | Bundle size | Identifying large dependencies |
| `console.time` | Quick timing | Ad-hoc performance measurement |

### Quick Performance Audit Checklist

- [ ] Enable React DevTools Profiler
- [ ] Check for unnecessary re-renders
- [ ] Verify code splitting at route boundaries
- [ ] Virtualize long lists (>100 items)
- [ ] Debounce search/filter inputs
- [ ] Lazy load images and heavy components
- [ ] Analyze bundle size
- [ ] Test on slow devices/connections

---

*Sources: freecodecamp.org, speclabs.dev, person98.com, sheetly.org*
