/**
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-implied-eval */
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as Constants from '../../constants';
import {StateStore} from './stateStore';

import * as fs from 'fs';

const stateStore: StateStore = StateStore.getInstance();

export function getVerboseCLI(): boolean {
	return String(Constants.CLI_VERBOSITY).toLowerCase() === 'true';
}

/**
 * Perform a sleep
 * @param ms the time in milliseconds to sleep for
 */
export function sleep(ms: number): Promise<void> {
	return new Promise<void>((resolve): any => setTimeout(resolve, ms));
}

export function logMsg(msg: string, obj?: any): void {
	if (typeof obj === 'undefined') {
		console.log(msg);
	} else {
		console.log(msg, obj);
	}
}

export function logError(msg: string, obj?: any): void {
	if (typeof obj === 'undefined') {
		console.error('\n' + msg + '\n');
	} else {
		console.error('\n' + msg + '\n', obj);
	}
}

export function logAndThrow(o: Error | string): never {
	if (o instanceof Error) {
		logError(o.message, o);
		throw o;
	} else {
		logError(o);
		throw new Error(o);
	}
}

export function checkString(actual: string, expected: string, enableThrow: boolean): Error | void {
	if (actual.localeCompare(expected) !== 0) {
		const msg = `Expected ${actual} to be ${expected}`;
		if (enableThrow) {
			logAndThrow(msg);
		} else {
			logError(msg);
		}
	}
}

export function checkProperty(object: any, expectedProperty: string, enableThrow: boolean): Error | void {
	if (!Object.prototype.hasOwnProperty.call(object, expectedProperty)) {
		const msg = `Property ${expectedProperty} missing from object ${JSON.stringify(object)}`;
		if (enableThrow) {
			logAndThrow(msg);
		} else {
			logError(msg);
		}
	}
}

export function checkSizeEquality(item0: number, item1: number, greaterThan: boolean, enableThrow: boolean): Error | void {
	if (greaterThan && item0 < item1) {
		const msg = `Property ${item0} to be larger than ${item1}`;
		if (enableThrow) {
			logAndThrow(msg);
		} else {
			logError(msg);
		}
	}

	if (!greaterThan && item0 > item1) {
		const msg = `Property ${item0} to be less than ${item1}`;
		if (enableThrow) {
			logAndThrow(msg);
		} else {
			logError(msg);
		}
	}
}

export function logScenarioStart(featureType: string): void {
	const features: Map<string, number> = stateStore.get(Constants.FEATURES);

	let counter = 0;

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
		for (let i = 0; i < files.length; i++) {
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
