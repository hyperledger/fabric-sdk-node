/*
 * Copyright 2022 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {EventEmitter} from 'events';
import {v4 as uuid} from 'uuid';
import * as Logger from './logger';
const logger = Logger.getLogger('Async Barrier');
const eventName: string = uuid();

export class AsyncBarrier {
	readonly #emitter = new EventEmitter();
	#result: Error | null | undefined; // undefined before completion, then null for success and Error for failure

	wait(): Promise<void> {
		logger.debug('wait called ************');
		return new Promise<void>((resolve, reject) => {
			this.#emitter.once(eventName, (value: Error | null) => {
				logger.debug('event received-----------');
				if (value instanceof Error) {
					reject(value);
				} else {
					logger.debug('resolved promise from listener************');
					resolve();
				}
			});

			if (this.#result === null) {
				logger.debug('resolved promise ************');
				// this.#emitter.removeAllListeners()
				return resolve();
			}
			if (this.#result !== undefined) {
				// this.#emitter.removeAllListeners()
				return reject(this.#result);
			}
		});
	}

	signal(): void {
		logger.debug('signal called **************');
		if (this.#result !== undefined) {
			return;
		}
		this.#result = null;
		logger.debug('To emit **************');

		this.#emitter.emit(eventName, this.#result);
	}

	error(error: Error): void {
		logger.debug('error called **************');
		if (this.#result !== undefined) {
			return;
		}
		this.#result = error;
		logger.debug('To emit error **************');

		this.#emitter.emit(eventName, this.#result);
	}

}