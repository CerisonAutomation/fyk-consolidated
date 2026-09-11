# IndexedDB Best Practices and Patterns

IndexedDB is a low-level, transactional database built into browsers for storing large amounts of structured data client-side. It is the foundation of offline-first web applications.

---

## Core Concepts

- **Database:** Contains object stores (like tables).
- **Object Store:** Where data lives (like a table). Each has a key path.
- **Transaction:** Required for all read/write operations. Scoped to specific stores.
- **Index:** Allows querying by a property other than the primary key.
- **Cursor:** Iterates over records in a store.
- **Version:** Integer that triggers `onupgradeneeded` when changed.

---

## Basic Pattern

```javascript
// 1. Open database (creates if new, upgrades if version increases)
const request = indexedDB.open('MyDatabase', 1);

request.onerror = () => console.error('DB error:', request.error);

request.onsuccess = (event) => {
  const db = event.target.result;
  // Database is ready to use
};

// 2. Create object stores and indexes (on upgrade only)
request.onupgradeneeded = (event) => {
  const db = event.target.result;

  // Create object store with key path
  const store = db.createObjectStore('customers', { keyPath: 'ssn' });

  // Create indexes
  store.createIndex('name', 'name', { unique: false });
  store.createIndex('email', 'email', { unique: true });
};
```

---

## Object Store Configuration

| `keyPath` | `autoIncrement` | Behavior |
|---|---|---|
| No | No | Store any value. Key supplied via `add()`/`put()` |
| Yes | No | Store objects only. Key = value of `keyPath` |
| No | Yes | Store any value. Key auto-generated |
| Yes | Yes | Store objects only. Key auto-generated unless `keyPath` exists |

---

## CRUD Operations

### Add (insert only, fails if key exists)

```javascript
function addCustomer(db, customer) {
  const tx = db.transaction(['customers'], 'readwrite');
  const store = tx.objectStore('customers');
  const request = store.add(customer);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

await addCustomer(db, { ssn: '123-45-6789', name: 'Alice', email: 'alice@example.com' });
```

### Get (read by key)

```javascript
function getCustomer(db, ssn) {
  const tx = db.transaction(['customers'], 'readonly');
  const store = tx.objectStore('customers');
  const request = store.get(ssn);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const customer = await getCustomer(db, '123-45-6789');
```

### Put (insert or update)

```javascript
function putCustomer(db, customer) {
  const tx = db.transaction(['customers'], 'readwrite');
  const store = tx.objectStore('customers');
  const request = store.put(customer);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

await putCustomer(db, { ssn: '123-45-6789', name: 'Alice Updated' });
```

### Delete

```javascript
function deleteCustomer(db, ssn) {
  const tx = db.transaction(['customers'], 'readwrite');
  const store = tx.objectStore('customers');
  const request = store.delete(ssn);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

await deleteCustomer(db, '123-45-6789');
```

### Get All

```javascript
function getAllCustomers(db) {
  const tx = db.transaction(['customers'], 'readonly');
  const store = tx.objectStore('customers');
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

### Cursor Iteration

```javascript
function forEachCustomer(db, callback) {
  const tx = db.transaction(['customers'], 'readonly');
  const store = tx.objectStore('customers');
  const request = store.openCursor();

  request.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      callback(cursor.value);
      cursor.continue();
    }
  };
}
```

---

## Index Queries

### Query by Index

```javascript
function getByName(db, name) {
  const tx = db.transaction(['customers'], 'readonly');
  const store = tx.objectStore('customers');
  const index = store.index('name');
  const request = index.get(name);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

### Range Query via Index

```javascript
function getByAgeRange(db, minAge, maxAge) {
  const tx = db.transaction(['customers'], 'readonly');
  const store = tx.objectStore('customers');
  const index = store.index('age');
  const range = IDBKeyRange.bound(minAge, maxAge);
  const request = index.getAll(range);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

### Cursor with Index

```javascript
function iterateByIndex(db, indexName) {
  const tx = db.transaction(['customers'], 'readonly');
  const store = tx.objectStore('customers');
  const index = store.index(indexName);
  const request = index.openCursor();

  request.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      console.log(cursor.key, cursor.value);
      cursor.continue();
    }
  };
}
```

---

## Transaction Patterns

### Multiple Stores in One Transaction

```javascript
function transferFunds(db, fromAccount, toAccount, amount) {
  const tx = db.transaction(['accounts'], 'readwrite');
  const store = tx.objectStore('accounts');

  const getFrom = store.get(fromAccount.id);
  const getTo = store.get(toAccount.id);

  getFrom.onsuccess = () => {
    const from = getFrom.result;
    from.balance -= amount;
    store.put(from);
  };

  getTo.onsuccess = () => {
    const to = getTo.result;
    to.balance += amount;
    store.put(to);
  };
}
```

### Read-Then-Write Pattern

```javascript
function updateCustomerName(db, ssn, newName) {
  const tx = db.transaction(['customers'], 'readwrite');
  const store = tx.objectStore('customers');
  const request = store.get(ssn);

  request.onsuccess = () => {
    const data = request.result;
    data.name = newName;
    store.put(data); // Overwrites the record
  };
}
```

---

## Error Handling

### Database-Level Error Handler (Recommended)

```javascript
db.onerror = (event) => {
  console.error(`Database error: ${event.target.error?.message}`);
};
```

### Transaction Error Handling

```javascript
const tx = db.transaction(['customers'], 'readwrite');
tx.onerror = (event) => {
  console.error('Transaction error:', event.target.error);
};
tx.onabort = (event) => {
  console.warn('Transaction aborted:', event.target.error);
};
```

---

## Schema Migrations

Handle version upgrades gracefully:

```javascript
request.onupgradeneeded = (event) => {
  const db = event.target.result;
  const oldVersion = event.oldVersion;

  if (oldVersion < 1) {
    // v0 -> v1: Create initial stores
    const store = db.createObjectStore('customers', { keyPath: 'ssn' });
    store.createIndex('email', 'email', { unique: true });
  }

  if (oldVersion < 2) {
    // v1 -> v2: Add new index
    const tx = event.target.transaction;
    const store = tx.objectStore('customers');
    store.createIndex('age', 'age', { unique: false });
  }

  if (oldVersion < 3) {
    // v2 -> v3: Create new store
    db.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
  }
};
```

---

## Multi-Tab Handling

```javascript
db.onversionchange = () => {
  db.close(); // Close to allow upgrade
  alert('A new version is available. Please reload.');
};

// When opening a DB, handle blocked state
request.onblocked = () => {
  alert('Please close other tabs using this app to upgrade.');
};
```

---

## Best Practices

### Performance

1. **Avoid large writes.** Storing entire state trees in a single record blocks the main thread during structured cloning.
2. **Fragment state writes.** Split into smaller individual records; only update changed subtrees.
3. **Use `readonly` transactions** when possible. They allow parallel operations.
4. **Measure impact.** Always check for "long tasks" that degrade UX.

### Consistency

5. **Scope transactions narrowly.** Only include the object stores you need for concurrent access.
6. **Use single transactions** for related operations (e.g., clear + write) to avoid partial updates.
7. **Never create transactions** in `unload` or `beforeunload` handlers -- they will be aborted.

### Error Handling

8. **Handle write failures.** Private browsing mode and low disk space can cause writes to fail. Keep state in memory as fallback.
9. **Handle user data changes.** Users can clear client-side data. Apps must handle this gracefully.

### Data Evolution

10. **Use schema versions** and test upgrade paths thoroughly.
11. **Handle data from older app versions** gracefully.

### Security

12. IndexedDB is **same-origin**. Cannot be accessed by other origins or third-party content (when cookies are blocked).

---

## IndexedDB Wrappers

### idb (Promise-based wrapper)

```javascript
import { openDB } from 'idb';

const db = await openDB('my-db', 1, {
  upgrade(db) {
    const store = db.createObjectStore('customers', { keyPath: 'ssn' });
    store.createIndex('name', 'name');
  },
});

// Add
await db.add('customers', { ssn: '123', name: 'Alice' });

// Get
const customer = await db.get('customers', '123');

// Put (upsert)
await db.put('customers', { ssn: '123', name: 'Alice Updated' });

// Delete
await db.delete('customers', '123');

// getAll
const all = await db.getAll('customers');

// Iterate with cursor
await db.transaction('customers').store.openCursor().then(function process(cursor) {
  if (!cursor) return;
  console.log(cursor.value);
  return cursor.continue().then(process);
});
```

### Dexie.js

```javascript
import Dexie from 'dexie';

const db = new Dexie('MyDatabase');
db.version(1).stores({
  customers: '++id, name, email', // auto-increment key, indexes
  orders: '++id, customerId, date',
});

// Add
const id = await db.customers.add({ name: 'Alice', email: 'alice@example.com' });

// Get
const customer = await db.customers.get(id);

// Query by index
const alice = await db.customers.where('name').equals('Alice').first();

// Update
await db.customers.update(id, { name: 'Alice Updated' });

// Delete
await db.customers.delete(id);

// Bulk operations
await db.customers.bulkAdd([{ name: 'Bob' }, { name: 'Charlie' }]);

// Transaction
await db.transaction('rw', db.customers, db.orders, async () => {
  await db.customers.add({ name: 'Dave' });
  await db.orders.add({ customerId: 4, date: new Date() });
});
```

---

## Key API Reference

| API | Purpose |
|---|---|
| `indexedDB.open(name, version)` | Open/create a database |
| `IDBDatabase.createObjectStore(name, options)` | Create object store (in `onupgradeneeded`) |
| `IDBObjectStore.createIndex(name, keyPath, options)` | Create an index |
| `IDBDatabase.transaction(storeNames, mode)` | Create a transaction (`readonly` or `readwrite`) |
| `IDBObjectStore.add(value)` | Insert (fails if key exists) |
| `IDBObjectStore.put(value)` | Insert or update |
| `IDBObjectStore.get(key)` | Retrieve by key |
| `IDBObjectStore.getAll(range?)` | Retrieve all (optionally by range) |
| `IDBObjectStore.delete(key)` | Delete by key |
| `IDBObjectStore.openCursor(range, direction)` | Iterate with cursor |
| `IDBObjectStore.index(name)` | Get an index for querying |
| `IDBKeyRange.bound(lower, upper)` | Create a range for queries |

---

**Sources:** MDN Web Docs, web.dev, Chrome Developers
