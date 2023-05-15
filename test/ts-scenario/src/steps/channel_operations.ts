/**
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import * as BaseUtils from './lib/utility/baseUtils';
import * as util from 'util';

/**
 * Validate two passed items against a match requirement:
 * - includes: each 'expected' object property must exist and be the same key value as 'actual'
 * - matches: 'expected' and 'actual' must be identical
 * - mirrors: 'expected' and 'actual' structures must match
 * @param expected expected item to compare against an actual item
 * @param actual actual item
 * @param {string} compareType the match type being run (include | match | mirror)
 */
function validateObjectKeyMatch(expected: any, actual: any, compareType: 'includes' | 'matches' | 'mirrors'): any {
	// walk down the expected and keep in line with the response
	if (typeof expected === 'object') {
		if (Array.isArray(expected) && (compareType.localeCompare('includes') === 0)) {
			// Have an array that may be an object or a value

			for (let index = 0; index < expected.length; index++) {
				const expectedItem: any = expected[index];
				let detected = false;
				for (let iterate = 0; iterate < actual.length; iterate++) {
					const actualItem: any = actual[iterate];
					const wasFound: boolean = validateObjectKeyMatch(expectedItem, actualItem, compareType);
					if (wasFound) {
						detected = true;
						break;
					}
				}
				if (!detected) {
					BaseUtils.logAndThrow(`--> Missing item ${expectedItem} from ${actual}`);
				}
			}
		} else {
			for (const key of Object.keys(expected as Record<string, unknown>)) {
				if (Object.prototype.hasOwnProperty.call(actual, key)) {
					// recursive call to scan property
					BaseUtils.logMsg(`->Recursively checking response key ${key}`);
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					return validateObjectKeyMatch(expected[key], actual[key], compareType);
				} else {
					BaseUtils.logAndThrow(`-->Missing key in response expected field ${key} to be present in ${util.inspect(actual)}`);
				}
			}
		}
	} else {
		// not an Object so "expected" is a value that should (conditionally) match
		switch (compareType) {
			case 'matches':
				if (expected !== actual) {
					BaseUtils.logAndThrow(`-->Mismatched items expected ${util.inspect(expected)} but found ${util.inspect(actual)}`);
				} else {
					BaseUtils.logMsg(`-->Confirmed match of expected key value ${util.inspect(actual)}`);
				}
				break;
			case 'includes':
				if (expected !== actual) {
					return false;
				} else {
					BaseUtils.logMsg(`-->Confirmed existence of required 'include' key with value ${util.inspect(actual)}`);
					return true;
				}
			case 'mirrors':
				BaseUtils.logMsg('-->Confirmed existence of required \'mirror\' key name and presence of a value');
				break;
			default:
				throw new Error(`Unconditioned switch type ${util.inspect(compareType)} passed to validate match`);
		}
	}
}
