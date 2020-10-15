/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import * as ClientHelper from './lib/utility/clientUtils';
import * as BaseUtils from './lib/utility/baseUtils';
import { Constants } from './constants';
import { CommonConnectionProfileHelper } from './lib/utility/commonConnectionProfileHelper';

import * as path from 'path';
import { Given, When, Then } from 'cucumber';

Given(/^I have created a client named (.+?) based on information in profile (.+?) under organization (.+?)$/, { timeout: Constants.HUGE_TIME as number },
	async (clientName: string, ccpName: string, userOrg: string) => {

	// Get a CCP Helper
	const profilePath: string = path.join(__dirname, '../config', ccpName);
	BaseUtils.logMsg(`loading profile ${profilePath}`);

	const ccp: CommonConnectionProfileHelper = new CommonConnectionProfileHelper(profilePath, true);
	BaseUtils.logMsg(`     ${JSON.stringify(ccp.getProfile())}`);

	// Create the user
	await ClientHelper.createAdminClient(clientName, ccp, userOrg);
});

Given(/^I have used the client named (.+?) to create a channel object for the channel named (.+?)$/, { timeout: Constants.HUGE_TIME as number },
	async (clientName: string, channelName: string) => {
	await ClientHelper.createChannelWithClient(clientName, channelName);
});

When(/^I build a new endorsement request named (.+?) for smart contract named (.+?) with arguments (.+?) as client (.+?) on channel (.+?)$/, { timeout: Constants.HUGE_TIME as number },
	async (requestName: string, contractName: string, requestArgs: string, clientName: string, channelName: string) => {
	await ClientHelper.buildChannelRequest(requestName, contractName, requestArgs, clientName, channelName, false);
});

When(/^I build a new endorsement request named (.+?) for smart contract named (.+?) with arguments (.+?) as client (.+?) on discovery channel (.+?)$/, { timeout: Constants.HUGE_TIME as number },
	async (requestName: string, contractName: string, requestArgs: string, clientName: string, channelName: string) => {
	await ClientHelper.buildChannelRequest(requestName, contractName, requestArgs, clientName, channelName, true);
});

When(/^I commit the endorsement request named (.+?) as client (.+?) on channel (.+?)$/, { timeout: Constants.HUGE_TIME as number },
	async (requestName: string, clientName: string, channelName: string) => {
	await ClientHelper.commitChannelRequest(requestName, clientName, channelName);
});

When(/^I submit a query named (.+?) with args (.+?) for contract (.+?) as client (.+?) on channel (.+?)$/, { timeout: Constants.HUGE_TIME as number },
	async (queryName: string, queryArgs: string, contractName: string, clientName: string, channelName: string) => {
	await ClientHelper.queryChannelRequest(clientName, channelName, contractName, queryArgs, queryName, false);
});

When(/^I submit a chaincode query named (.+?) with args (.+?) for contract (.+?) as client (.+?) on channel (.+?)$/, { timeout: Constants.HUGE_TIME as number },
	async (queryName: string, queryArgs: string, contractName: string, clientName: string, channelName: string) => {
	await ClientHelper.queryChannelRequest(clientName, channelName, contractName, queryArgs, queryName, true);
});

Then(/^the (request|query) named (.+?) for client (.+?) has a (.+?) result matching (.+?)$/, { timeout: Constants.INC_SHORT as number },
	async (responseType: string, requestName: string, clientName: string, fieldName: string, expectedResult: string) => {
	await ClientHelper.validateChannelRequestResponse(clientName, responseType === 'request', requestName, fieldName, expectedResult);
});

Then(/^the request named (.+?) for client (.+?) has discovery results$/, { timeout: Constants.HUGE_TIME as number },
	async (requestName: string, clientName: string) => {
	await ClientHelper.validateDiscoveryResponse(clientName, requestName);
});

When(/^I create an event service (.+?) as client (.+?) on channel (.+?)$/, { timeout: Constants.HUGE_TIME as number },
	async (eventServiceName: string, clientName: string, channelName: string) => {
	await ClientHelper.createEventService(eventServiceName, clientName, channelName);
});

Then(/^I (.+?) the event service (.+?) as (.+?) blocks to start at block (.+?) and end at block (.+?) as client (.+?)$/, { timeout: Constants.INC_SHORT as number },
	async (start: 'start' | 'restart', eventServiceName: string, blockType: 'filtered' | 'full' | 'private' | undefined, startBlock: string, endBlock: string, clientName: string) => {
		await ClientHelper.startEventService(blockType, eventServiceName, clientName, startBlock, endBlock, start);
});

Then(/^I regisister a block listener named (.+?) with (.+?) for startBlock (.+?) and endBlock (.+?) as client (.+?)$/, { timeout: Constants.INC_SHORT as number },
	async (listenerName: string, eventServiceName: string, startBlock: string, endBlock: string, clientName: string) => {
	await ClientHelper.registerEventListener(eventServiceName, clientName, listenerName, 'block', startBlock, endBlock, '', '');
});

Then(/^I regisister a chaincode listener named (.+?) with (.+?) for (.+?) event on contract (.+?) as client (.+?)$/, { timeout: Constants.INC_SHORT as number },
	async (listenerName: string, eventServiceName: string, eventName: string, contractName: string, clientName: string) => {
	await ClientHelper.registerEventListener(eventServiceName, clientName, listenerName, 'chaincode', '', '', eventName, contractName);
});

Then(/^I regisister a transaction listener named (.+?) with (.+?) for all transactions as client (.+?)$/, { timeout: Constants.INC_SHORT as number },
	async (listenerName: string, eventServiceName: string, clientName: string) => {
	await ClientHelper.registerEventListener(eventServiceName, clientName, listenerName, 'transaction', '', '', '', '');
});

Then(/^the event listener (.+?) of (.+?) has results matching (.+?) as client (.+?)$/, { timeout: Constants.INC_SHORT as number },
	async (listenerName: string, eventServiceName: string, check: string, clientName: string) => {
	await ClientHelper.checkEventListenerResults(eventServiceName, clientName, listenerName, check);
});

When(/^I disconnect Event Service (.+?) as client (.+?)$/, {timeout: Constants.HUGE_TIME as number }, async (eventServiceName: string, clientName: string) => {
	await ClientHelper.disconnectEventService(eventServiceName, clientName);
});
