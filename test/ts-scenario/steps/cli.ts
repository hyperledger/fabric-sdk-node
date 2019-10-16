/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from './constants';
import * as Channel from './lib/channel';
import * as Contract from './lib/contract';
import { StateStore } from './lib/utility/stateStore';

import { Given } from 'cucumber';

const stateStore = StateStore.getInstance();
const cliOrgNames = ['org1', 'org2'];

Given(/^I use the cli to create and join the channel named (.+?) on the deployed network/, { timeout: Constants.STEP_MED as number }, async (channelName) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE);
	if (!fabricState) {
		throw new Error('Unable to create/join channel: no Fabric network deployed');
	}

	try {
		// Create channel
		await Channel.cli_channel_create(channelName, fabricState.type);

		// Create and join orgs to channel
		for (const orgName of cliOrgNames) {
			await Channel.cli_join_org_to_channel(orgName, channelName, (fabricState.type.localeCompare('tls') === 0));
		}

		return Promise.resolve();
	} catch (err) {
		return Promise.reject(err);
	}
});

Given(/^I use the cli to update the channel with name (.+?) with config file (.+?) on the deployed network/, { timeout: Constants.STEP_MED as number }, async (channelName, configTxFile) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE);
	if (!fabricState) {
		throw new Error('Unable to update channel: no Fabric network deployed');
	}

	try {
		// Update channel
		await Channel.cli_channel_update(channelName, configTxFile, (fabricState.type.localeCompare('tls') === 0));
		return Promise.resolve();
	} catch (err) {
		return Promise.reject(err);
	}
});

Given(/^I use the cli to deploy a (.+?) smart contract named (.+?) at version (.+?) for all organizations on channel (.+?) with endorsement policy (.+?) and arguments (.+?)$/, { timeout: Constants.STEP_MED as number }, async (ccType, ccName, ccVersion, channelName, policy, initArgs) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE);
	if (!fabricState) {
		throw new Error('Unable to deploy smart contract: no Fabric network deployed');
	}

	try {
		// Install on each org
		for (const orgName of cliOrgNames) {
			await Contract.cli_chaincode_install_for_org(ccType, ccName, ccVersion, orgName);
		}

		// Instantiate
		await Contract.cli_chaincode_instantiate(ccType, ccName, ccVersion, initArgs, channelName, policy, (fabricState.type.localeCompare('tls') === 0));
		return Promise.resolve();
	} catch (err) {
		return Promise.reject(err);
	}
});
