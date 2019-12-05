/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from './constants';
import * as AdminUtils from './lib/utility/adminUtils';
import * as BaseUtils from './lib/utility/baseUtils';
import { CommonConnectionProfileHelper } from './lib/utility/commonConnectionProfileHelper';
import { StateStore } from './lib/utility/stateStore';

import { When } from 'cucumber';
import * as path from 'path';

const stateStore: StateStore = StateStore.getInstance();
const ccpNonTls: CommonConnectionProfileHelper = new CommonConnectionProfileHelper(path.join(__dirname, '../config', 'ccp.json'), true);
const ccpTls: CommonConnectionProfileHelper = new CommonConnectionProfileHelper(path.join(__dirname, '../config', 'ccp-tls.json'), true);

When(/^I perform a (.+?) operation on channel (.+?) with (.+?) the response (includes|matches|mirrors) fields (.+?)$/, { timeout: Constants.HUGE_TIME as number }, async (queryOperation: string, channelName: string, orgName: string, compareType: 'includes' | 'matches' | 'mirrors', expectedResponse: string) => {

	const fabricState: any = stateStore.get(Constants.FABRIC_STATE);
	if (!fabricState) {
		throw new Error('Unable to create/join channel: no Fabric network deployed');
	}
	const tls: boolean = (fabricState.type.localeCompare('tls') === 0);
	const ccp: CommonConnectionProfileHelper = tls ? ccpTls : ccpNonTls;

	// Perform query
	const response: any = await AdminUtils.performChannelQueryOperation(queryOperation, channelName, orgName, ccp, undefined);

	// check response
	BaseUtils.logMsg(`Recursively checking response object from ${queryOperation}`);
	validateObjectKeyMatch(JSON.parse(expectedResponse), response, compareType);

});

When(/^I perform a (.+?) operation with arguments (.+?) on channel (.+?) with (.+?) the response (includes|matches|mirrors) fields (.+?)$/, { timeout: Constants.HUGE_TIME as number }, async (queryOperation: string, args: string, channelName: string, orgName: string, compareType: 'includes' | 'matches' | 'mirrors' , expectedResponse: string) => {

	const fabricState: any = stateStore.get(Constants.FABRIC_STATE);
	if (!fabricState) {
		throw new Error('Unable to create/join channel: no Fabric network deployed');
	}
	const tls: boolean = (fabricState.type.localeCompare('tls') === 0);
	const ccp: CommonConnectionProfileHelper = tls ? ccpTls : ccpNonTls;

	const response: any = await AdminUtils.performChannelQueryOperation(queryOperation, channelName, orgName, ccp, JSON.parse(args));

	// check response
	BaseUtils.logMsg(`Recursively checking response object from ${queryOperation}`);
	validateObjectKeyMatch(JSON.parse(expectedResponse), response, compareType);
});

/**
 * Validate two passed items against a match requirement:
 * - includes: each 'expected' object property must exist and be the same key value as 'actual'
 * - matches: 'expected' and 'actual' must be identical
 * - mirrors: 'expected' and 'actual' structures must match
 * @param expected expected item to compare against an actual item
 * @param actual actual item
 * @param {string} compareType the match type being run (include | match | mirror)
 */
function validateObjectKeyMatch(expected: any, actual: any, compareType: 'includes' | 'matches' | 'mirrors' ): any {
	// walk down the expected and keep in line with the response
	if (expected instanceof Object) {
		if (Array.isArray(expected) && (compareType.localeCompare('includes') === 0)) {
			// Have an array that may be an object or a value

			for (let index: number = 0; index < expected.length; index++) {
				const expectedItem: any = expected[index];
				let detected: boolean = false;
				for (let iterate: number = 0; iterate < actual.length; iterate++) {
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
			for (const key of Object.keys(expected)) {
				if (Object.prototype.hasOwnProperty.call(actual, key)) {
					// recursive call to scan property
					BaseUtils.logMsg(`->Recursively checking response key ${key}`);
					return validateObjectKeyMatch(expected[key], actual[key], compareType);
				} else {
					BaseUtils.logAndThrow(`-->Missing key in response expected field ${key} to be present in ${{actual}}`);
				}
			}
		}
	} else {
		// not an Object so "expected" is a value that should (conditionally) match
		switch (compareType) {
			case 'matches':
				if (expected !== actual) {
					BaseUtils.logAndThrow(`-->Mismatched items expected ${expected} but found ${actual}`);
				} else {
					BaseUtils.logMsg(`-->Confirmed match of expected key value ${actual}`);
				}
				break;
			case 'includes':
				if (expected !== actual) {
					return false;
				} else {
					BaseUtils.logMsg(`-->Confirmed existence of required 'include' key with value ${actual}`);
					return true;
				}
			case 'mirrors':
				BaseUtils.logMsg(`-->Confirmed existence of required 'mirror' key name and presence of a value`);
				break;
			default:
				throw new Error(`Unconditioned switch type ${compareType} passed to validate match`);
		}
	}
}
