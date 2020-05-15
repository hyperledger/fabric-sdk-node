/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import os = require('os');
import fs = require('fs');
import path = require('path');
import util = require('util');
import _rimraf = require('rimraf');
const rimraf = util.promisify(_rimraf);

/**
 * Returns a new async function that taken one argument of the generic type. The returned function also has a
 * 'completePromise' property of type Promise<T[]>, which resolves when the expected number of calls have been made
 * to the listener function, and returns an array of the arguments passed to the listener function.
 * @param expectedCallCount Number of calls after which to resolve the completePromise.
 * @param maxSleep Maximum number of milliseconds to randomly sleep when invoked.
 */
export function newAsyncListener<T>(expectedCallCount = 1, maxSleep = 0) {
	let resolve;
	const completePromise = new Promise<T[]>((_resolve, _) => resolve = _resolve);

	const events: T[] = [];
	const listener = async (event: T) => {
		if (maxSleep > 0) {
			// Some random delay to simulate async work in the listener and catch timing bugs
			await sleep(getRandomInt(maxSleep));
		}
		events.push(event);
		expectedCallCount--;
		if (expectedCallCount === 0) {
			resolve(events);
		}
	};
	listener.completePromise = completePromise;

	return listener;
}

export function sleep(ms: number) {
	if (ms > 0) {
		return new Promise((resolve, _) => setTimeout(resolve, ms));
	} else {
		return Promise.resolve();
	}
}

export function getRandomInt(max: number) {
	return Math.floor(Math.random() * Math.floor(max));
}

export async function createTempDir(): Promise<string> {
	const prefix = os.tmpdir + path.sep;
	return await fs.promises.mkdtemp(prefix);
}

export async function rmdir(directory: string): Promise<void> {
	await rimraf(directory);
}
