/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from '../../constants';
import { StateStore } from './stateStore';

import * as fs from 'fs';

const stateStore: StateStore = StateStore.getInstance();

/**
 * Perform a sleep
 * @param ms the time in milliseconds to sleep for
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve: any): any => setTimeout(resolve, ms));
}

export function logMsg(msg: string, obj?: any): void {
	if (typeof obj === 'undefined') {
		// tslint:disable-next-line:no-console
		console.log(msg);
	} else {
		// tslint:disable-next-line:no-console
		console.log(msg, obj);
	}
}

export function logError(msg: string, obj?: any): void {
	if (typeof obj === 'undefined') {
		// tslint:disable-next-line:no-console
		console.error('\n' + msg + '\n');
	} else {
		// tslint:disable-next-line:no-console
		console.error('\n' + msg + '\n', obj);
	}
}

export function logAndThrow(msg: any): never {
	logError(msg);
	if (msg instanceof Error) {
		throw msg;
	} else {
		throw new Error(msg);
	}
}

export function checkString(actual: string, expected: string, enableThrow: boolean): Error | void {
	if (actual.localeCompare(expected) !== 0) {
		const msg: string = `Expected ${actual} to be ${expected}`;
		if (enableThrow) {
			logAndThrow(msg);
		} else {
			logError(msg);
		}
	}
}

export function checkProperty(object: any, expectedProperty: string, enableThrow: boolean): Error | void {
	if (!Object.prototype.hasOwnProperty.call(object, expectedProperty)) {
		const msg: string = `Property ${expectedProperty} missing from object ${JSON.stringify(object)}`;
		if (enableThrow) {
			logAndThrow(msg);
		} else {
			logError(msg);
		}
	}
}

export function checkSizeEquality(item0: number, item1: number, greaterThan: boolean, enableThrow: boolean): Error | void {
	if (greaterThan && item0 < item1) {
		const msg: string = `Property ${item0} to be larger than ${item1}`;
		if (enableThrow) {
			logAndThrow(msg);
		} else {
			logError(msg);
		}
	}

	if (!greaterThan && item0 > item1) {
		const msg: string = `Property ${item0} to be less than ${item1}`;
		if (enableThrow) {
			logAndThrow(msg);
		} else {
			logError(msg);
		}
	}
}

export function logScenarioStart(featureType: string): void {
	const features: Map<string, number> = stateStore.get(Constants.FEATURES);

	let counter: number = 0;

	if (!features) {
		// does not exist
		const featureMap: Map<string, number> = new Map<string, number>();
		featureMap.set(featureType, 0);
		stateStore.set(Constants.FEATURES, featureMap);
	} else {
		// do we have any feature scenarios run?
		const previousCount: number | undefined = features.get(featureType);
		if (previousCount !== undefined) {
			counter = previousCount + 1;
			features.set(featureType, counter);
		} else {
			features.set(featureType, 0);
		}
		stateStore.set(Constants.FEATURES, features);
	}

	logMsg('\n\n\n**********************************************************************************');
	logMsg('**********************************************************************************');
	logMsg(`****** ${featureType} Scenario ${counter} ******`);
	logMsg('**********************************************************************************');
	logMsg('**********************************************************************************\n\n\n');
}

export function recursiveDirDelete(dirPath: string): void {
	let files: string[];
	try {
		files = fs.readdirSync(dirPath);
	} catch (error) {
		return;
	}
	if (files.length > 0) {
		for (let i: number = 0; i < files.length; i++) {
			const filePath: string = dirPath + '/' + files[i];
			if (fs.statSync(filePath).isFile()) {
				fs.unlinkSync(filePath);
			} else {
				recursiveDirDelete(filePath);
			}
		}
	}
	fs.rmdirSync(dirPath);
  }
