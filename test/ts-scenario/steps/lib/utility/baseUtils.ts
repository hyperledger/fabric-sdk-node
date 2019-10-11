/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

/**
 * Perform a sleep
 * @param ms the time in milliseconds to sleep for
 */
export function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function logMsg(msg: string, obj: any) {
	if (obj) {
		// tslint:disable-next-line:no-console
		console.log(msg, obj);
	} else {
		// tslint:disable-next-line:no-console
		console.log(msg);
	}
}

export function logError(msg: string, obj: any) {
	if (obj) {
		// tslint:disable-next-line:no-console
		console.error(msg, obj);
	} else {
		// tslint:disable-next-line:no-console
		console.error(msg);
	}
}

export function logAndThrow(msg: any) {
	logError(msg, undefined);
	if (msg instanceof Error) {
		throw msg;
	} else {
		throw new Error(msg);
	}
}
