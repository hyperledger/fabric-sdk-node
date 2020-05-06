/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export class AsyncNotifier<T> {
	private readonly readCallback: () => T | undefined;
	private readonly notifyCallback: (event: T) => Promise<unknown>;
	private running: boolean = false;

	constructor(readCallback: () => T | undefined, notifyCallback: (event: T) => Promise<unknown>) {
		this.readCallback = readCallback;
		this.notifyCallback = notifyCallback;
	}

	public notify() {
		if (!this.running) {
			this.running = true;
			this.run(); // tslint:disable-line: no-floating-promises
		}
	}
	private async run() {
		for (let event; event = this.readCallback(); ) { // tslint:disable-line: no-conditional-assignment
			await this.notifyCallback(event);
		}
		this.running = false;
	}
}
