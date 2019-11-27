/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from './constants';
import * as Deprecated from './lib/deprecatedSDK';
import * as AdminUtils from './lib/utility/adminUtils';
import * as BaseUtils from './lib/utility/baseUtils';
import { CommonConnectionProfileHelper } from './lib/utility/commonConnectionProfileHelper';
import { StateStore } from './lib/utility/stateStore';

import { Given } from 'cucumber';
import * as path from 'path';

const stateStore: StateStore = StateStore.getInstance();

Given(/^I use the deprecated sdk to (.+?) a (.+?) smart contract named (.+?) at version (.+?) as (.+?) for all organizations on channel (.+?) with endorsement policy (.+?) and arguments (.+?) with the connection profile named (.+?)$/, { timeout: Constants.STEP_MED as number }, async (deployType: string, ccType: 'golang' | 'car' | 'java' | 'node', ccName: string, ccVersion: string, ccId: string, channelName: string, policyType: string, initArgs: string, ccpName: string) => {

	const fabricState: any = stateStore.get(Constants.FABRIC_STATE);
	if (!fabricState) {
		throw new Error(`Unable to ${deployType} smart contract: no Fabric network deployed`);
	}

	const tls: boolean = (fabricState.type.localeCompare('tls') === 0);
	// Create and persist the new gateway
	const profilePath: string = path.join(__dirname, '../config', ccpName);
	const ccp: CommonConnectionProfileHelper = new CommonConnectionProfileHelper(profilePath, true);

	const isUpgrade: boolean = (deployType.localeCompare('upgrade') === 0);
	const policy: any = require(path.join(__dirname, Constants.STEPS_TO_POLICIES))[policyType];
	try {
		for (const orgName of Object.keys(ccp.getOrganizations())) {
			const isInstalled: boolean = await AdminUtils.isOrgChaincodeInstalled(orgName, ccp, ccName, ccVersion);
			if (isInstalled) {
				BaseUtils.logMsg(`Smart contract ${ccName} at version ${ccVersion} has already been installed on the peers for organization ${orgName}`);
			} else {
				await Deprecated.sdk_chaincode_install_for_org(ccType, ccName, ccVersion, ccId, tls, ccp, orgName, channelName);
			}
		}

		// Instantiate
		const isInstantiated: boolean = await AdminUtils.isChaincodeInstantiatedOnChannel(Object.keys(ccp.getOrganizations())[0], ccp, channelName, ccName, ccVersion);
		if (isInstantiated) {
			BaseUtils.logMsg(`Smart contract ${ccName} at version ${ccVersion} has already been instantiated on channel ${channelName} `);
		} else {
			await Deprecated.sdk_chaincode_instantiate(ccName, ccType, ccVersion, ccId, initArgs, isUpgrade, tls, ccp, Constants.DEFAULT_ORG, channelName, policy);
		}

		return Promise.resolve();
	} catch (err) {
		return Promise.reject(err);
	}
});
