import { showErrorToast } from '#/core/lib/error-toast';
import { reconciler } from '#/domains/presence/reconciler';

export abstract class ReconcilingListState<TItem, TSnapshot, TKey = number> {
	loading = true;
	refreshing = false;
	error: Error | null = null;
	visibleCount: number;
	scrollY = 0;

	readonly #pageSize: number;
	readonly #refreshErrorLabel: string;
	#loaded = false;
	#destroyed = false;
	#unsubscribeReconcile: (() => void) | null = null;
	#buffer: TItem[] | null = null;
	#fetchToken = 0;
	#refreshRequestedSinceFetchStart = false;

	constructor({
		pageSize,
		refreshErrorLabel,
	}: {
		pageSize: number;
		refreshErrorLabel: string;
	}) {
		this.#pageSize = pageSize;
		this.#refreshErrorLabel = refreshErrorLabel;
		this.visibleCount = pageSize;
	}

	protected start(): void {
		void this.#hardLoad();
		this.#unsubscribeReconcile = reconciler.subscribe(() => this.refresh());
	}

	get hasMore(): boolean {
		return this.visibleCount < this.length;
	}

	loadMore(): void {
		if (!this.hasMore) return;
		this.visibleCount += this.#pageSize;
	}

	load(): void {
		if (this.#loaded || this.loading || this.refreshing) return;
		this.retry();
	}

	retry(): void {
		void this.#hardLoad();
	}

	async refresh(): Promise<void> {
		if (this.#destroyed) return;
		if (this.refreshing || this.loading) {
			this.#refreshRequestedSinceFetchStart = true;
			return;
		}
		this.refreshing = true;
		try {
			await this.#replaceFromServer();
		} catch (error) {
			console.error(error);
			showErrorToast({ label: this.#refreshErrorLabel, error });
		} finally {
			this.refreshing = false;
			this.#runRequestedRefresh();
		}
	}

	destroy(): void {
		if (this.#destroyed) return;
		this.#destroyed = true;
		this.#unsubscribeReconcile?.();
	}

	protected upsert(item: TItem): void {
		if (this.#destroyed) return;
		this.#buffer?.push(item);
		this.applyUpsert(item);
	}

	async #hardLoad(): Promise<void> {
		this.loading = true;
		this.error = null;
		try {
			await this.#replaceFromServer();
		} catch (error) {
			this.error =
				error instanceof Error ? error : new Error(String(error));
		} finally {
			this.loading = false;
			this.#runRequestedRefresh();
		}
	}

	#runRequestedRefresh(): void {
		if (!this.#refreshRequestedSinceFetchStart) return;
		this.#refreshRequestedSinceFetchStart = false;
		void this.refresh();
	}

	async #replaceFromServer(): Promise<void> {
		if (this.#destroyed) return;
		const token = ++this.#fetchToken;
		this.#refreshRequestedSinceFetchStart = false;
		const buffer: TItem[] = [];
		this.#buffer = buffer;
		try {
			const snapshot = await this.fetch();
			if (this.#superseded(token)) return;
			const covered = this.applySnapshotReturningCoveredKeys(snapshot);
			for (const item of buffer) {
				if (!covered.has(this.keyOf(item))) this.applyUpsert(item);
			}
			this.#loaded = true;
			this.error = null;
		} catch (error) {
			if (this.#superseded(token)) return;
			throw error;
		} finally {
			if (this.#buffer === buffer) this.#buffer = null;
		}
	}

	#superseded(token: number): boolean {
		return this.#destroyed || token !== this.#fetchToken;
	}

	protected abstract get length(): number;
	protected abstract fetch(): Promise<TSnapshot>;
	protected abstract applySnapshotReturningCoveredKeys(
		snapshot: TSnapshot,
	): Set<TKey>;
	protected abstract applyUpsert(item: TItem): void;
	protected abstract keyOf(item: TItem): TKey;
}
