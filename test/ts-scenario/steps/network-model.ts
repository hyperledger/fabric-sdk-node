/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from './constants';
import * as Gateway from './lib/gateway';
import * as BaseUtils from './lib/utility/baseUtils';
import { CommonConnectionProfileHelper } from './lib/utility/commonConnectionProfileHelper';
import { StateStore } from './lib/utility/stateStore';

import { Given, Then, When } from 'cucumber';
import * as path from 'path';

const stateStore: StateStore = StateStore.getInstance();

Given(/^I have a (.+?) backed gateway named (.+?) with discovery set to (.+?) for user (.+?) (?:in organization (.+?) )?using the connection profile named (.+?)$/, { timeout: Constants.STEP_MED as number }, async (walletType: string, gatewayName: string, useDiscovery: string, userName: string, orgName: string, ccpName: string) => {

	const gateways: Map<string, any> = stateStore.get(Constants.GATEWAYS);
	const fabricState: any = stateStore.get(Constants.FABRIC_STATE);
	const tls: boolean = (fabricState.type.localeCompare('tls') === 0);

	if (gateways && gateways.has(gatewayName)) {
		BaseUtils.logMsg(`Gateway named ${gatewayName} already exists`);
		return;
	} else {
		try {
			// Create and persist the new gateway
			BaseUtils.logMsg(`Creating new Gateway named ${gatewayName}`);
			const profilePath: string = path.join(__dirname, '../config', ccpName);
			const ccp: CommonConnectionProfileHelper = new CommonConnectionProfileHelper(profilePath, true);
			return await Gateway.createGateway(ccp, tls, userName, orgName || Constants.DEFAULT_ORG, gatewayName, JSON.parse(useDiscovery), walletType);
		} catch (err) {
			BaseUtils.logError(`Failed to create gateway named ${gatewayName}`, err);
			return Promise.reject(err);
		}
	}
});

When(/^I use the discovery gateway named (.+?) to (.+?) a transaction with args (.+?) for contract (.+?) instantiated on channel (.+?) using requiredOrgs (.+?)$/, { timeout: Constants.STEP_MED as number }, async (gatewayName: string, txnType: string, txnArgs: string, ccName: string, channelName: string, requiredOrgs: string) => {
	return await Gateway.performGatewayTransaction(gatewayName, ccName, channelName, '', txnArgs, txnType, '', JSON.parse(requiredOrgs));
});

When(/^I use the discovery gateway named (.+?) to (.+?) a transaction with args (.+?) for contract (.+?) instantiated on channel (.+?) using collection (.+?)$/, { timeout: Constants.STEP_MED as number }, async (gatewayName: string, txnType: string, txnArgs: string, ccName: string, channelName: string, collectionName: string) => {
	return await Gateway.performGatewayTransaction(gatewayName, ccName, channelName, collectionName, txnArgs, txnType);
});

When(/^I use the discovery gateway named (.+?) to (.+?) a transaction a (.+?) times with args (.+?) for contract (.+?) instantiated on channel (.+?)$/, { timeout: Constants.STEP_MED as number }, async (gatewayName: string, txnType: string, txnCount: number, txnArgs: string, ccName: string, channelName: string) => {
	return await Gateway.performGatewayTransaction(gatewayName, ccName, channelName, '', txnArgs, txnType, undefined, undefined, txnCount);
});

When(/^I use the gateway named (.+?) to (.+?) a transaction with args (.+?) for contract (.+?) instantiated on channel (.+?)$/, { timeout: Constants.STEP_MED as number }, async (gatewayName: string, txnType: string, txnArgs: string, ccName: string, channelName: string) => {
	return await Gateway.performGatewayTransaction(gatewayName, ccName, channelName, '', txnArgs, txnType);
});

When(/^I use the gateway named (.+?) to (.+?) a total of (.+?) transactions with args (.+?) for contract (.+?) instantiated on channel (.+?)$/, {timeout: Constants.STEP_MED as number }, async (gatewayName: string, txnType: string, numTransactions: number, txnArgs: string, ccName: string, channelName: string) => {
	for (let i: number = 0; i < numTransactions; i++) {
		await Gateway.performGatewayTransaction(gatewayName, ccName, channelName, '', txnArgs, txnType);
	}
});

When(/^I modify (.+?) to (.+?) a transaction with args (.+?) for contract (.+?) instantiated on channel (.+?) using handler option (.+?)$/, { timeout: Constants.STEP_MED as number }, async (gatewayName: string, txnType: string, txnArgs: string, ccName: string, channelName: string, handlerOption: string) => {
	return await Gateway.performGatewayTransaction(gatewayName, ccName, channelName, '', txnArgs, txnType, handlerOption);
});

When(/^I modify (.+?) to (.+?) a transaction with transient data using args (.+?) for contract (.+?) instantiated on channel (.+?)$/, { timeout: Constants.STEP_MED as number }, async (gatewayName: string, txnType: string, txnArgs: string, ccName: string, channelName: string) => {
	return await Gateway.performTransientGatewayTransaction(gatewayName, ccName, channelName, txnArgs, txnType);
});

Then(/^The gateway named (.+?) has a (.+?) type response$/, { timeout: Constants.STEP_LONG as number }, async (gatewayName: string, type: string) => {
	if (Gateway.lastTransactionTypeCompare(gatewayName, type)) {
		return Promise.resolve();
	} else {
		throw new Error('Expected and actual result type from previous transaction did not match. Expected [' + type + '] but had [' + Gateway.getLastTransactionResult(gatewayName).type + ']');
	}
});

Then(/^The gateway named (.+?) has a (.+?) type response (matching|containing) (.+?)$/, { timeout: Constants.STEP_LONG as number }, async (gatewayName: string, type: string, matchType: string, expected: string) => {
	const sameType: boolean = Gateway.lastTransactionTypeCompare(gatewayName, type);
	const sameResponse: boolean = Gateway.lastTransactionResponseCompare(gatewayName, expected, matchType === 'matching');
	if (sameType && sameResponse) {
		return Promise.resolve();
	} else {
		throw new Error('Expected and actual results from previous transaction did not match. Expected [' + expected + '] but had [' + Gateway.getLastTransactionResult(gatewayName).response + ']');
	}
});
