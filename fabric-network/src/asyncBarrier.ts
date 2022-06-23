/*
 * Copyright 2022 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {EventEmitter} from 'events';
import {v4 as uuid} from 'uuid';

const eventName: string = uuid();

export class AsyncBarrier {
	readonly #emitter = new EventEmitter();
	#result: Error | null | undefined; // undefined before completion, then null for success and Error for failure

	wait(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.#emitter.on(eventName, (value: Error | null) => {
				if (value instanceof Error) {
					reject(value);
				} else {
					resolve();
				}
			});

			if (this.#result === null) {
				return resolve();
			}
			if (this.#result !== undefined) {
				return reject(this.#result);
			}
		});
	}

	signal(): void {
		if (this.#result !== undefined) {
			return;
		}
		this.#result = null;
		this.#emitter.emit(eventName, this.#result);
	}

	error(error: Error): void {
		if (this.#result !== undefined) {
			return;
		}
		this.#result = error;
		this.#emitter.emit(eventName, this.#result);
	}

}