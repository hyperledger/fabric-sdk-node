/**
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Constants from './constants';
import * as Channel from './lib/channel';
import * as Contract from './lib/contract';
import * as BaseUtils from './lib/utility/baseUtils';
import {StateStore, FabricState} from './lib/utility/stateStore';
import {Given} from 'cucumber';

const stateStore: StateStore = StateStore.getInstance();
const orgNames: string[] = ['Org1', 'Org2'];

Given(/^I use the cli to create and join the channel named (.+?) on the deployed network/, {timeout: Constants.STEP_MED}, async (channelName: string) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE) as FabricState;
	if (!fabricState) {
		throw new Error('Unable to create/join channel: no Fabric network deployed');
	}
	const tls: boolean = (fabricState.type.localeCompare('tls') === 0);

	let channelCreated = false;

	// Create and join organizations to channel
	for (const orgName of orgNames) {
		const channelNames = await Channel.cli_get_channels(orgName.toLowerCase(), tls);
		if (channelNames && channelNames.includes(channelName)) {
			BaseUtils.logMsg(`Organization ${orgName} has already joined channels ==>${channelNames}<==`);
		} else {
			if (!channelCreated) {
				// Create channel just once
				await Channel.cli_channel_create(channelName, tls);
				channelCreated = true;
			}
			await Channel.cli_join_org_to_channel(orgName.toLowerCase(), channelName, tls);
		}
	}

});

Given(/^I use the cli to update the channel with name (.+?) with config file (.+?) on the deployed network/, {timeout: Constants.STEP_MED}, async (channelName: string, configTxFile: string) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE) as FabricState;
	if (!fabricState) {
		throw new Error('Unable to update channel: no Fabric network deployed');
	}

	// Update channel
	await Channel.cli_channel_update(channelName, configTxFile, (fabricState.type.localeCompare('tls') === 0));

});

Given(/^I use the cli to deploy a (.+?) smart contract named (.+?) at version (.+?) for all organizations on channel (.+?) with endorsement policy (.+?) and arguments (.+?)$/, {timeout: Constants.STEP_MED}, async (ccType: string, ccName: string, ccVersion: string, channelName: string, policy: string, initArgs: string) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE) as FabricState;
	if (!fabricState) {
		throw new Error('Unable to create/join channel: no Fabric network deployed');
	}

	let isInstantiated = false;
	// Install on each org
	for (const orgName of orgNames) {
		const isInstalled: boolean = await Contract.cli_is_chaincode_install_for_org(ccName, ccVersion, orgName.toLowerCase());
		if (isInstalled) {
			BaseUtils.logMsg(`Smart contract ${ccName} at version ${ccVersion} has already been installed on the peers for organization ${orgName}`);
		} else {
			await Contract.cli_chaincode_install_for_org(ccType, ccName, ccVersion, orgName.toLowerCase());
		}

		isInstantiated = await Contract.cli_is_chaincode_instantiated_for_org(channelName, ccName, ccVersion, orgName.toLowerCase());
	}

	// Instantiate
	if (isInstantiated) {
		BaseUtils.logMsg(`Smart contract ${ccName} at version ${ccVersion} has already been instantiated on channel ${channelName} `);
	} else {
		await Contract.cli_chaincode_instantiate(ccType, ccName, ccVersion, initArgs, channelName, policy, (fabricState.type.localeCompare('tls') === 0));
	}

});

Given(/^I use the cli to lifecycle deploy a (.+?) smart contract named (.+?) at version (.+?) as (.+?) for all organizations on channel (.+?) with default endorsement policy and init-required (.+?)$/, {timeout: Constants.STEP_LONG}, async (ccType: string, ccName: string, ccVersion: string, ccReference: string, channelName: string, init: string) => {
	BaseUtils.logMsg(`\n -- Lifecycle deploy start for Smart contract ${ccName}`);

	const fabricState = stateStore.get(Constants.FABRIC_STATE) as FabricState;
	if (!fabricState) {
		throw new Error('Unable to lifecycle deploy: no Fabric network deployed');
	}

	const tls: boolean = (fabricState.type.localeCompare('tls') === 0);
	const initRequired: boolean = init.localeCompare('true') === 0;

	BaseUtils.logMsg(`\n -- Lifecycle deploy step one - check if already committed for Smart contract ${ccName}`);

	// Skip if already committed on channel
	if (await Contract.cli_lifecycle_chaincode_query_commit(ccName, orgNames[0].toLowerCase(), channelName, tls)) {
		BaseUtils.logMsg(`Smart contract ${ccName} at version ${ccVersion} has already been committed on channel ${channelName} as ${ccReference} `);
		return;
	} else {
		BaseUtils.logMsg(`Smart contract ${ccName} at version ${ccVersion} is not committed on channel ${channelName} as ${ccReference} `);
	}

	BaseUtils.logMsg(`\n -- Lifecycle deploy step two - package Smart contract ${ccName}`);

	const label = `${ccName}-${channelName}`;

	// Package on each org
	for (const orgName of orgNames) {
		await Contract.cli_lifecycle_chaincode_package(ccType, ccName, orgName.toLowerCase(), label);
	}

	BaseUtils.logMsg(`\n -- Lifecycle deploy step three - install Smart contract ${ccName}`);

	// Install on each org
	for (const orgName of orgNames) {
		await Contract.cli_lifecycle_chaincode_install(ccName, orgName.toLowerCase());
		BaseUtils.logMsg(`Smart contract ${ccName} at version ${ccVersion} has been installed on organization ${orgName} `);
	}

	BaseUtils.logMsg(`\n -- Lifecycle deploy step four - approve Smart contract ${ccName}`);

	// Approve on each org
	for (const orgName of orgNames) {
		const packageId = await Contract.retrievePackageIdForLabelOnOrg(label, orgName.toLowerCase());
		await Contract.cli_lifecycle_chaincode_approve(ccReference, ccVersion, orgName.toLowerCase(), channelName, packageId, '1', tls, ccType, ccName, initRequired);
		BaseUtils.logMsg(`Smart contract ${ccName} at version ${ccVersion} has been approved on organization ${orgName} `);
	}

	// sleep for bit to let the collections catch up
	await BaseUtils.sleep(5000);

	BaseUtils.logMsg(`\n -- Lifecycle deploy step five (final) - commit Smart contract ${ccName}`);

	// Commit on single org
	await Contract.cli_lifecycle_chaincode_commit(ccReference, ccVersion, orgNames[0].toLowerCase(), channelName, '1', tls, ccType, ccName, initRequired);
	// }

});
