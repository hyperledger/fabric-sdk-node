/**
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Constants from './constants';
import * as Deprecated from './lib/deprecatedSDK';
import * as AdminUtils from './lib/utility/adminUtils';
import * as BaseUtils from './lib/utility/baseUtils';
import {CommonConnectionProfileHelper} from './lib/utility/commonConnectionProfileHelper';
import {StateStore, FabricState} from './lib/utility/stateStore';

import {Given} from 'cucumber';
import * as path from 'path';
import {EndorsementPolicy} from 'fabric-client';

const stateStore: StateStore = StateStore.getInstance();

Given(/^I use the deprecated sdk to (.+?) a (.+?) smart contract named (.+?) at version (.+?) as (.+?) for all organizations on channel (.+?) with endorsement policy (.+?) and arguments (.+?) with the connection profile named (.+?)$/, {timeout: Constants.STEP_MED}, async (deployType: string, ccType: 'golang' | 'car' | 'java' | 'node', ccName: string, ccVersion: string, ccId: string, channelName: string, policyType: string, initArgs: string, ccpName: string) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE) as FabricState;
	if (!fabricState) {
		throw new Error(`Unable to ${deployType} smart contract: no Fabric network deployed`);
	}

	const tls: boolean = (fabricState.type.localeCompare('tls') === 0);
	// Create and persist the new gateway
	const profilePath: string = path.join(__dirname, '../config', ccpName);
	const ccp: CommonConnectionProfileHelper = new CommonConnectionProfileHelper(profilePath, true);

	const isUpgrade: boolean = (deployType.localeCompare('upgrade') === 0);
	// eslint-disable-next-line max-len
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any
	const policy: EndorsementPolicy = require(path.join(__dirname, Constants.STEPS_TO_POLICIES))[policyType];
	for (const orgName of Object.keys(ccp.getOrganizations())) {
		const isInstalled: boolean = await AdminUtils.isOrgChaincodeInstalled(orgName, ccp, ccName, ccVersion);
		if (isInstalled) {
			BaseUtils.logMsg(`Smart contract ${ccName} at version ${ccVersion} has already been installed on the peers for organization ${orgName}`);
		} else {
			await Deprecated.sdk_chaincode_install_for_org(ccType, ccName, ccVersion, ccId, tls, ccp, orgName, channelName);
		}
	}

	// Instantiate
	const isInstantiated: boolean = await AdminUtils.isChaincodeInstantiatedOnChannel(Object.keys(ccp.getOrganizations())[0],
		ccp, channelName, ccName, ccVersion);
	if (isInstantiated) {
		BaseUtils.logMsg(`Smart contract ${ccName} at version ${ccVersion} has already been instantiated on channel ${channelName} `);
	} else {
		await Deprecated.sdk_chaincode_instantiate(ccName, ccType, ccVersion, ccId, initArgs, isUpgrade, tls,
			ccp, Constants.DEFAULT_ORG, channelName, policy);
	}
});
