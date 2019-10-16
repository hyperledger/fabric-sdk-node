/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from '../../constants';
import { StateStore } from './stateStore';

const stateStore = StateStore.getInstance();

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

export function checkString(actual: string, expected: string, enableThrow: boolean) {
	if (actual.localeCompare(expected) !== 0) {
		const msg = `Expected ${actual} to be ${expected}`;
		if (enableThrow) {
			logAndThrow(msg);
		} else {
			logError(msg, undefined);
		}
	}
}

export function checkProperty(object: any, expectedProperty: string, enableThrow: boolean) {
	if (!object.hasOwnProperty(expectedProperty)) {
		const msg = `Property ${expectedProperty} missing from object ${JSON.stringify(object)}`;
		if (enableThrow) {
			logAndThrow(msg);
		} else {
			logError(msg, undefined);
		}
	}
}

export function checkSizeEquality(item0: number, item1: number, greaterThan: boolean, enableThrow: boolean) {
	if (greaterThan && item0 < item1) {
		const msg = `Property ${item0} to be larger than ${item1}`;
		if (enableThrow) {
			logAndThrow(msg);
		} else {
			logError(msg, undefined);
		}
	}

	if (!greaterThan && item0 > item1) {
		const msg = `Property ${item0} to be less than ${item1}`;
		if (enableThrow) {
			logAndThrow(msg);
		} else {
			logError(msg, undefined);
		}
	}
}

export function logScenarioStart(featureType: string) {
	const features = stateStore.get(Constants.FEATURES);

	let counter = 0;

	if (!features) {
		// does not exist
		const featureMap = new Map<string, number>();
		featureMap.set(featureType, 0);
		stateStore.set(Constants.FEATURES, featureMap);
	} else {
		// do we have any feature scenarios run?
		if (features.has(featureType)) {
			counter = features.get(featureType) + 1;
			features.set(featureType, counter);
		} else {
			features.set(featureType, 0);
		}
		stateStore.set(Constants.FEATURES, features);
	}

	logMsg('\n\n\n**********************************************************************************', undefined);
	logMsg('**********************************************************************************', undefined);
	logMsg(`****** ${featureType} Scenario ${counter} ******`, undefined);
	logMsg('**********************************************************************************', undefined);
	logMsg('**********************************************************************************\n\n\n', undefined);
}
