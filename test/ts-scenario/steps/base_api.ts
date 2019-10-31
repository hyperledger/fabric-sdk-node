/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import * as BaseUtils from './lib/utility/baseUtils';
import * as ClientHelper from './lib/utility/clientUtils';
import { Constants } from './constants';
import { CommonConnectionProfileHelper } from './lib/utility/commonConnectionProfileHelper';

import * as path from 'path';
import { Given, When, Then } from 'cucumber';

Given(/^I have created a client named (.+?) based on information in profile (.+?) under organization (.+?)$/, { timeout: Constants.HUGE_TIME as number }, async (clientName: string, ccpName: string, userOrg: string) => {

	// Get a CCP Helper
	const profilePath: string = path.join(__dirname, '../config', ccpName);
	const ccp: CommonConnectionProfileHelper = new CommonConnectionProfileHelper(profilePath, true);

	// Create the user
	await ClientHelper.createAdminClient(clientName, ccp, userOrg);
});

Given(/^I have used the client named (.+?) to create a channel object for the channel named (.+?)$/, { timeout: Constants.HUGE_TIME as number }, async (clientName: string, channelName: string) => {
	await ClientHelper.createChannelWithClient(clientName, channelName);
});

When(/^I build a new endorsement request named (.+?) for smart contract named (.+?) with arguments (.+?) as client (.+?) on channel (.+?)$/, { timeout: Constants.HUGE_TIME as number }, async (requestName: string, contractName: string, requestArgs: string, clientName: string, channelName: string) => {
	await ClientHelper.buildChannelRequest(requestName, contractName, requestArgs, clientName, channelName);
});

When(/^I commit the endorsement request named (.+?) as client (.+?) on channel (.+?)$/, { timeout: Constants.HUGE_TIME as number }, async (requestName: string, clientName: string, channelName: string) => {
	await ClientHelper.commitChannelRequest(requestName, clientName, channelName);
});

When(/^I submit a query named (.+?) with args (.+?) for contract (.+?) as client (.+?) on channel (.+?)$/, { timeout: Constants.HUGE_TIME as number }, async (queryName: string, queryArgs: string, contractName: string, clientName: string, channelName: string) => {
	await ClientHelper.submitChannelRequest(clientName, channelName, contractName, queryArgs, queryName);
});

Then(/^the (request|query) named (.+?) for client (.+?) has a (.+?) result matching (.+?)$/, { timeout: Constants.HUGE_TIME as number }, (responseType: string, requestName: string, clientName: string, fieldName: string, expectedResult: string) => {
	ClientHelper.validateChannelRequestResponse(clientName, responseType === 'request', requestName, fieldName, expectedResult);
});
