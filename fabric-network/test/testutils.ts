/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

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
			// Some random delay to similate async work in the listener and catch timing bugs
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
