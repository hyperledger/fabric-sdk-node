/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export class AsyncNotifier<T> {
	private readonly readCallback: () => T | undefined;
	private readonly notifyCallback: (event: T) => Promise<unknown>;
	private running = false;

	constructor(readCallback: () => T | undefined, notifyCallback: (event: T) => Promise<unknown>) {
		this.readCallback = readCallback;
		this.notifyCallback = notifyCallback;
	}

	public notify():void {
		if (!this.running) {
			this.running = true;
			void this.run();
		}
	}
	private async run():Promise<void> {
		// eslint-disable-next-line no-cond-assign
		for (let event; event = this.readCallback();) {
			await this.notifyCallback(event);
		}
		this.running = false;
	}
}
