interface CacheEntry<V> {
	value: V;
	expiresAt: number;
}

export class TtlCache<K, V> {
	#map = new Map<K, CacheEntry<V>>();
	#ttlMs: number;

	constructor({ ttlMs }: { ttlMs: number }) {
		this.#ttlMs = ttlMs;
	}

	get(key: K): V | null {
		const entry = this.#map.get(key);
		if (!entry) return null;
		if (Date.now() > entry.expiresAt) {
			this.#map.delete(key);
			return null;
		}
		return entry.value;
	}

	set(key: K, value: V): void {
		this.#map.set(key, {
			value,
			expiresAt: Date.now() + this.#ttlMs,
		});
	}

	update(key: K, updater: (current: V) => V): void {
		const entry = this.#map.get(key);
		if (!entry) return;
		if (Date.now() > entry.expiresAt) {
			this.#map.delete(key);
			return;
		}
		entry.value = updater(entry.value);
		entry.expiresAt = Date.now() + this.#ttlMs;
	}

	delete(key: K): void {
		this.#map.delete(key);
	}

	clear(): void {
		this.#map.clear();
	}
}
