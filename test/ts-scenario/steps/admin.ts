/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from './constants';
import { cli_channel_create, cli_channel_update, cli_join_org_to_channel } from './lib/channel';
import { CommonConnectionProfile } from './lib/commonConnectionProfile';
import { cli_chaincode_install_for_org, cli_chaincode_instantiate } from './lib/contract';
import * as Deprecated from './lib/deprecatedSDK';
import * as AdminUtils from './lib/utility/adminUtils';
import * as BaseUtils from './lib/utility/baseUtils';
import { StateStore } from './lib/utility/stateStore';

import { Given } from 'cucumber';
import * as path from 'path';

const stateStore = StateStore.getInstance();
const cliOrgNames = ['org1', 'org2'];
const policiesPath = '../config/policies.json';

Given(/^I use the cli to create and join the channel named (.+?) on the deployed network/, { timeout: Constants.STEP_MED as number }, async (channelName) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE);
	if (!fabricState) {
		throw new Error('Unable to create/join channel: no Fabric network deployed');
	}

	try {
		// Create channel
		await cli_channel_create(channelName, fabricState.type);

		// Create and join orgs to channel
		for (const orgName of cliOrgNames) {
			await cli_join_org_to_channel(orgName, channelName, (fabricState.type.localeCompare('tls') === 0));
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
		await cli_channel_update(channelName, configTxFile, (fabricState.type.localeCompare('tls') === 0));
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
			await cli_chaincode_install_for_org(ccType, ccName, ccVersion, orgName);
		}

		// Instantiate
		await cli_chaincode_instantiate(ccType, ccName, ccVersion, initArgs, channelName, policy, (fabricState.type.localeCompare('tls') === 0));
		return Promise.resolve();
	} catch (err) {
		return Promise.reject(err);
	}
});

Given(/^I use the deprecated sdk to (.+?) a (.+?) smart contract named (.+?) at version (.+?) as (.+?) for all organizations on channel (.+?) with endorsement policy (.+?) and arguments (.+?) with the connection profile named (.+?)$/, { timeout: Constants.STEP_MED as number }, async (deployType, ccType, ccName, ccVersion, ccId, channelName, policyType, initArgs, ccpName) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE);
	if (!fabricState) {
		throw new Error(`Unable to ${deployType} smart contract: no Fabric network deployed`);
	}

	const tls = (fabricState.type.localeCompare('tls') === 0);
	// Create and persist the new gateway
	const profilePath = path.join(__dirname, '../config', ccpName);
	const ccp = new CommonConnectionProfile(profilePath, true);

	const isUpgrade = (deployType.localeCompare('upgrade') === 0);
	const policy = require(path.join(__dirname, policiesPath))[policyType];
	try {
		// Install on each org if not already installed
		const persistName = `${ccName}@${ccVersion}`;
		if (AdminUtils.isContractInstalled(persistName)) {
			// Do not reinstall
			BaseUtils.logMsg(`Smart contract ${persistName} has already been installed `, undefined);
		} else {
			for (const orgName of Object.keys(ccp.getOrganizations())) {
				await Deprecated.sdk_chaincode_install_for_org(ccType, ccName, ccVersion, ccId, tls, ccp, orgName, channelName);
			}
			// Update known installed in state store
			AdminUtils.addToInstalledContracts(persistName);
		}

		// Instantiate
		if (AdminUtils.isInstantiatedOnChannel(persistName, channelName)) {
			BaseUtils.logMsg(`Smart contract ${persistName} has already been instantiated `, undefined);
		} else {
			await Deprecated.sdk_chaincode_instantiate(ccName, ccType, ccVersion, ccId, initArgs, isUpgrade, tls, ccp, Constants.DEFAULT_ORG, channelName, policy);
			// Update known instantiated in state store
			AdminUtils.addToInstantiatedContractsOnChannel(persistName, channelName);
		}

		return Promise.resolve();
	} catch (err) {
		return Promise.reject(err);
	}
});
