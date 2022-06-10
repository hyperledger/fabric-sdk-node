/*
 * Copyright 2022 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {EventEmitter} from 'events';

const eventName = 'event';

export class AsyncBarrier {
	readonly #emitter = new EventEmitter();
	#result: Error | null | undefined; // undefined before completion, then null for success and Error for failure

	async wait(): Promise<void> {
		if (this.#result === null) {
			return;
		}
		if (this.#result !== undefined) {
			throw this.#result;
		}

		await new Promise<void>((resolve, reject) => this.#emitter.on(eventName, () => {
			if (this.#result instanceof Error) {
				reject(this.#result);
			} else {
				resolve();
			}
		}));
	}

	signal(): void {
		if (this.#result !== undefined) {
			return;
		}
		this.#result = null;
		this.#emitter.emit(eventName);
	}

	error(error: Error): void {
		if (this.#result !== undefined) {
			return;
		}
		this.#result = error;
		this.#emitter.emit(eventName);
	}

}