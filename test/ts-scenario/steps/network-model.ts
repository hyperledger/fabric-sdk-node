/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from './constants';
import { CommonConnectionProfile } from './lib/commonConnectionProfile';
import { CreateGateway, GetLastTransactionResult, LastTransactionResponseCompare, LastTransactionTypeCompare, PerformGatewayTransaction } from './lib/gateway';
import * as BaseUtils from './lib/utility/baseUtils';
import { StateStore } from './lib/utility/stateStore';

import { Given, Then, When } from 'cucumber';
import * as path from 'path';

const stateStore = StateStore.getInstance();

Given(/^I have a gateway named (.+?) with discovery set to (.+?) for user (.+?) using the connection profile named (.+?)$/, { timeout: Constants.STEP_MED as number }, async (gatewayName, useDiscovery, userName, ccpName) => {

	const gateways = stateStore.get(Constants.GATEWAYS);
	const fabricState = stateStore.get(Constants.FABRIC_STATE);
	const tls = (fabricState.type.localeCompare('tls') === 0);

	if (gateways && Object.keys(gateways).includes(gatewayName)) {
		BaseUtils.logMsg(`Gateway named ${gatewayName} already exists`, undefined);
		return;
	} else {
		try {
			// Create and persist the new gateway
			const profilePath = path.join(__dirname, '../config', ccpName);
			const ccp = new CommonConnectionProfile(profilePath, true);
			return await CreateGateway(ccp, tls, userName, Constants.DEFAULT_ORG, gatewayName, JSON.parse(useDiscovery));
		} catch (err) {
			BaseUtils.logError(`Failed to create gateway named ${gatewayName}`, err);
			return Promise.reject(err);
		}
	}
});

When(/^I use the gateway named (.+?) to (.+?) a transaction with args (.+?) for contract (.+?) instantiated on channel (.+?)$/, { timeout: Constants.STEP_MED as number }, async (gatewayName, txnType, txnArgs, ccName, channelName) => {
	return await PerformGatewayTransaction(gatewayName, ccName, channelName, txnArgs, txnType);
});

Then(/^The gateway named (.+?) has a (.+?) type response$/, { timeout: Constants.STEP_LONG as number }, async (gatewayName, type) => {
	if (LastTransactionTypeCompare(gatewayName, type)) {
		return Promise.resolve();
	} else {
		throw new Error('Expected and actual result type from previous transaction did not match. Expected [' + type + '] but had [' + GetLastTransactionResult(gatewayName).type + ']');
	}
});

Then(/^The gateway named (.+?) has a (.+?) type response matching (.+?)$/, { timeout: Constants.STEP_LONG as number }, async (gatewayName, type, expected) => {
	const sameType = LastTransactionTypeCompare(gatewayName, type);
	const sameResponse = LastTransactionResponseCompare(gatewayName, expected);
	if (sameType && sameResponse) {
		return Promise.resolve();
	} else {
		throw new Error('Expected and actual results from previous transaction did not match. Expected [' + expected + '] but had [' + GetLastTransactionResult(gatewayName).response + ']');
	}
});
