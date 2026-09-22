import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("#/domains/presence/reconciler", () => ({
	reconciler: {
		subscribe: vi.fn(() => vi.fn()),
	},
}));

vi.mock("#/core/lib/error-toast", () => ({
	showErrorToast: vi.fn(),
}));

import { ReconcilingListState } from "./reconciling-list";
import { reconciler } from "@/domains/presence/reconciler";
import { showErrorToast } from "@/core/lib/error-toast";

interface TestItem {
	id: number;
	name: string;
}

class TestReconcilingList extends ReconcilingListState<
	TestItem,
	TestItem[],
	number
> {
	private _items: TestItem[] = [];
	private _fetchResult: TestItem[] = [];

	constructor(opts: { pageSize: number }) {
		super({
			pageSize: opts.pageSize,
			refreshErrorLabel: "test refresh failed",
		});
	}

	setFetchResult(items: TestItem[]): void {
		this._fetchResult = items;
	}

	setItems(items: TestItem[]): void {
		this._items = items;
	}

	protected get length(): number {
		return this._items.length;
	}

	protected async fetch(): Promise<TestItem[]> {
		return this._fetchResult;
	}

	protected applySnapshotReturningCoveredKeys(
		snapshot: TestItem[],
	): Set<number> {
		this._items = [...snapshot];
		return new Set(snapshot.map((item) => item.id));
	}

	protected applyUpsert(item: TestItem): void {
		const idx = this._items.findIndex((i) => i.id === item.id);
		if (idx >= 0) {
			this._items[idx] = item;
		} else {
			this._items.push(item);
		}
	}

	protected keyOf(item: TestItem): number {
		return item.id;
	}

	getItems(): TestItem[] {
		return [...this._items];
	}
}

class FailingList extends ReconcilingListState<TestItem, TestItem[], number> {
	private _items: TestItem[] = [];

	constructor() {
		super({ pageSize: 10, refreshErrorLabel: "test refresh failed" });
	}

	protected get length(): number {
		return this._items.length;
	}

	protected async fetch(): Promise<TestItem[]> {
		throw new Error("Network error");
	}

	protected applySnapshotReturningCoveredKeys(): Set<number> {
		return new Set();
	}

	protected applyUpsert(): void {}

	protected keyOf(item: TestItem): number {
		return item.id;
	}
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("ReconcilingListState", () => {
	it("initializes with correct default state", () => {
		const list = new TestReconcilingList({ pageSize: 10 });
		expect(list.loading).toBe(true);
		expect(list.refreshing).toBe(false);
		expect(list.error).toBeNull();
		expect(list.visibleCount).toBe(10);
	});

	it("hasMore returns false when items are fewer than visibleCount", () => {
		const list = new TestReconcilingList({ pageSize: 10 });
		list.setItems([{ id: 1, name: "One" }]);
		expect(list.hasMore).toBe(false);
	});

	it("hasMore returns true when items exceed visibleCount", () => {
		const list = new TestReconcilingList({ pageSize: 5 });
		list.setItems(
			Array.from({ length: 10 }, (_, i) => ({ id: i, name: `Item ${i}` })),
		);
		expect(list.hasMore).toBe(true);
	});

	it("hasMore returns false when items equal visibleCount", () => {
		const list = new TestReconcilingList({ pageSize: 5 });
		list.setItems(
			Array.from({ length: 5 }, (_, i) => ({ id: i, name: `Item ${i}` })),
		);
		expect(list.hasMore).toBe(false);
	});

	it("loadMore increases visibleCount by pageSize when hasMore is true", () => {
		const list = new TestReconcilingList({ pageSize: 5 });
		list.setItems(
			Array.from({ length: 15 }, (_, i) => ({ id: i, name: `Item ${i}` })),
		);
		expect(list.visibleCount).toBe(5);
		expect(list.hasMore).toBe(true);

		list.loadMore();
		expect(list.visibleCount).toBe(10);

		list.loadMore();
		expect(list.visibleCount).toBe(15);

		expect(list.hasMore).toBe(false);
	});

	it("loadMore is a no-op when hasMore is false", () => {
		const list = new TestReconcilingList({ pageSize: 10 });
		list.setItems([{ id: 1, name: "Only" }]);
		expect(list.hasMore).toBe(false);

		list.loadMore();
		expect(list.visibleCount).toBe(10);
	});

	it("subscribe is called when start is invoked", () => {
		const list = new TestReconcilingList({ pageSize: 10 });
		list.setFetchResult([]);
		(list as unknown as { start: () => void }).start();
		expect(reconciler.subscribe).toHaveBeenCalled();
	});

	it("destroy stops the list", () => {
		const list = new TestReconcilingList({ pageSize: 10 });
		list.destroy();
		const p = list.refresh();
		expect(p).toBeInstanceOf(Promise);
	});

	it("refresh sets refreshing to true during execution", async () => {
		const list = new TestReconcilingList({ pageSize: 10 });
		list.setFetchResult([{ id: 1, name: "Fetched" }]);
		(list as unknown as { loading: boolean }).loading = false;

		const refreshPromise = list.refresh();
		expect(list.refreshing).toBe(true);

		await refreshPromise;
		expect(list.refreshing).toBe(false);
	});

	it("refresh calls showErrorToast on failure", async () => {
		const failingList = new FailingList();
		(failingList as unknown as { loading: boolean }).loading = false;

		await failingList.refresh();
		expect(showErrorToast).toHaveBeenCalledWith({
			label: "test refresh failed",
			error: expect.any(Error),
		});
	});

	it("applySnapshotReplacing works correctly via fetch integration", async () => {
		const list = new TestReconcilingList({ pageSize: 10 });
		const initial = [
			{ id: 1, name: "Old" },
			{ id: 2, name: "Old 2" },
		];
		const updated = [
			{ id: 2, name: "Updated" },
			{ id: 3, name: "New" },
		];

		list.setFetchResult(updated);
		(list as unknown as { loading: boolean }).loading = false;
		list.setItems(initial);

		await list.refresh();

		expect(list.getItems()).toEqual(updated);
	});
});
