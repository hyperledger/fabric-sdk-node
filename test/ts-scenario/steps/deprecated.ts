/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from './constants';
import { CommonConnectionProfile } from './lib/commonConnectionProfile';
import * as Deprecated from './lib/deprecatedSDK';
import * as AdminUtils from './lib/utility/adminUtils';
import * as BaseUtils from './lib/utility/baseUtils';
import { StateStore } from './lib/utility/stateStore';

import { Given } from 'cucumber';
import * as path from 'path';

const stateStore = StateStore.getInstance();

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
	const policy = require(path.join(__dirname, Constants.STEPS_TO_POLICIES))[policyType];
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
