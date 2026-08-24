import { useWsStore } from './ws-store';

const THROTTLE_MS = 2000;

export type ReconcileHandler = () => void | Promise<void>;

class Reconciler {
	#handlers = new Set<ReconcileHandler>();
	#lastReconcileAt = 0;
	#resyncTimer: ReturnType<typeof setTimeout> | null = null;
	#wasHidden = false;
	#firstConnect = true;

	constructor() {
		// Listen for WebSocket connection events
		useWsStore.subscribe((state, prevState) => {
			if (state.status === 'connected' && prevState.status !== 'connected') {
				if (this.#firstConnect) {
					this.#firstConnect = false;
					return;
				}
				void this.#trigger();
			}
		});

		if (typeof document !== 'undefined') {
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'hidden') {
					this.#wasHidden = true;
					return;
				}
				if (!this.#wasHidden) return;
				this.#wasHidden = false;
				void this.#trigger();
			});
		}
	}

	subscribe(handler: ReconcileHandler): () => void {
		this.#handlers.add(handler);
		return () => {
			this.#handlers.delete(handler);
		};
	}

	#scheduleResync(): void {
		if (this.#resyncTimer !== null) return;
		const elapsed = Date.now() - this.#lastReconcileAt;
		const wait = Math.max(THROTTLE_MS - elapsed, 0);
		this.#resyncTimer = setTimeout(() => {
			this.#resyncTimer = null;
			void this.#trigger();
		}, wait);
	}

	async #trigger(): Promise<void> {
		const now = Date.now();
		if (now - this.#lastReconcileAt < THROTTLE_MS) return;
		this.#lastReconcileAt = now;

		await Promise.all(
			[...this.#handlers].map(async (handler) => {
				try {
					await handler();
				} catch (error) {
					console.error('Reconcile handler failed', error);
				}
			}),
		);
	}
}

export const reconciler = new Reconciler();
