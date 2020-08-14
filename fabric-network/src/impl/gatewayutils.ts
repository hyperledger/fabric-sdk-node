/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Knuth shuffle of array elements. The supplied array is directly modified.
 * @private
 * @param {array} array An array to shuffle.
 */
export function shuffle(array: Array<unknown>): void {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
}

export interface FulfilledPromiseResult<T> {
	status: 'fulfilled';
	value: T;
}
export interface RejectedPromiseResult {
	status: 'rejected';
	reason: Error;
}
export type SettledPromiseResult<T> = FulfilledPromiseResult<T> | RejectedPromiseResult;

/**
 * Implementation of {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled|Promise.allSettled()}
 * for use in Node versions prior to 12.9.0, where this was introduced.
 * @private
 * @param {Iterable<Promise>} promises Iterable promises.
 * @returns An array of promises.
 */
export function allSettled<T>(promises: Iterable<Promise<T>>): Promise<SettledPromiseResult<T>[]> {
	const promiseArray = Array.isArray(promises) ? (promises as Promise<T>[]) : Array.from(promises);
	return Promise.all(promiseArray.map(settle));
}

function settle<T>(promise: Promise<T>): Promise<SettledPromiseResult<T>> {
	return promise.then(
		(value: T) => {
			return { status: 'fulfilled', value };
		},
		(reason: Error) => {
			return { status: 'rejected', reason };
		}
	);
}

/**
 * Wrap a function call with a cache. On first call the wrapped function is invoked to obtain a result. Subsequent
 * calls return the cached result.
 * @private
 * @param f A function whose result should be cached.
 */
export function cachedResult<T>(f: () => T): () => T {
	let value: T | undefined;
	return () => {
		if (typeof value === 'undefined') {
			value = f();
		}
		return value;
	};
}

/**
 * Typesafe check that a value is not nullish.
 * @private
 * @param value Any value, including null and undefined.
 */
export function notNullish<T>(value?: T): value is T {
	return value !== null && value !== undefined;
}
