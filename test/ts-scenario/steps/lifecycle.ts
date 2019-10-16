/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from './constants';
import * as Chaincode from './lib/chaincode';
import { CommonConnectionProfile } from './lib/commonConnectionProfile';
import { StateStore } from './lib/utility/stateStore';

import { Given, Then, When } from 'cucumber';
import * as path from 'path';

const stateStore = StateStore.getInstance();

const lifecycleCcp = new CommonConnectionProfile(path.join(__dirname, '../config', 'ccp-lifecycle.json'), true);
const lifecycleCcpTls = new CommonConnectionProfile(path.join(__dirname, '../config', 'ccp-lifecycle-tls.json'), true);

Given(/^I package a (node|java|golang) contract at version (.+?) named (.+?) as organizations (.+?) with initialization (required|unrequired)$/, { timeout: Constants.STEP_LONG as number }, async (contractType, contractVersion, contractName, orgs, initRequired) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE);
	const tls = (fabricState.type.localeCompare('tls') === 0);
	const ccp = tls ? lifecycleCcpTls : lifecycleCcp;

	const orgNames = orgs.slice(1, -1).split(',');

	for (const orgName of orgNames) {
		await Chaincode.packageContractForOrg(orgName, contractName, contractType, contractVersion, tls, initRequired === 'required', ccp);
	}

});

Given(/^I install a packaged contract named (.+?) as organizations (.+?)$/, { timeout: Constants.HUGE_TIME as number }, async (contractName, orgs) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE);
	const tls = (fabricState.type.localeCompare('tls') === 0);
	const ccp = tls ? lifecycleCcpTls : lifecycleCcp;

	const orgNames = orgs.slice(1, -1).split(',');

	for (const orgName of orgNames) {
		await Chaincode.installPackagedContractForOrg(orgName, contractName, ccp);
	}

});

Given(/^I approve the installed contract named (.+?) as organizations (.+?) on channel (.+?) with endorsement policy (.+?)$/, { timeout: Constants.STEP_LONG as number }, async (contractName, orgs, channelName, policyType) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE);
	const tls = (fabricState.type.localeCompare('tls') === 0);
	const ccp = tls ? lifecycleCcpTls : lifecycleCcp;

	const orgNames = orgs.slice(1, -1).split(',');

	for (const orgName of orgNames) {
		await Chaincode.approveInstalledContractForOrg(orgName, contractName, channelName, ccp, policyType);
	}

});

Then(/^I can query commit readiness for contract named (.+?) as organizations (.+?) on channel (.+?) with expected approvals status of (.+?)$/, { timeout: Constants.STEP_LONG as number }, async (contractName: string, orgs: string, channelName: string, expectedStatus: string) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE);
	const tls = (fabricState.type.localeCompare('tls') === 0);
	const ccp = tls ? lifecycleCcpTls : lifecycleCcp;

	const orgNames = orgs.slice(1, -1).split(',');
	const status = JSON.parse(expectedStatus);

	for (const orgName of orgNames) {
		await Chaincode.queryCommitReadinessAsOrgOnChannel(orgName, contractName, channelName, ccp, status);
	}
});

Then(/^I can query for defined contract named (.+?) as organizations (.+?) on channel (.+?) with expected result including (.+?)$/, { timeout: Constants.STEP_LONG as number }, async (contractName: string, orgs: string, channelName: string, expectedResult: string) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE);
	const tls = (fabricState.type.localeCompare('tls') === 0);
	const ccp = tls ? lifecycleCcpTls : lifecycleCcp;

	const orgNames = orgs.slice(1, -1).split(',');
	const expected = JSON.parse(expectedResult);

	for (const orgName of orgNames) {
		await Chaincode.queryForDefinedContractAsOrgOnChannel(orgName, contractName, channelName, ccp, expected);
	}
});

Then(/^I can retrieve an installed contract package named (.+?) as organizations (.+?) on channel (.+?)$/, { timeout: Constants.STEP_LONG as number }, async (contractName: string, orgs: string, channelName: string) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE);
	const tls = (fabricState.type.localeCompare('tls') === 0);
	const ccp = tls ? lifecycleCcpTls : lifecycleCcp;

	const orgNames = orgs.slice(1, -1).split(',');

	for (const orgName of orgNames) {
		await Chaincode.retrieveContractPackageAsOrgOnChannel(orgName, contractName, channelName, ccp);
	}
});

When(/^I call commit on contract named (.+?) as organization (.+?) on channel (.+?)$/, {timeout: Constants.STEP_LONG as number }, async (contractName, orgName, channelName) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE);
	const tls = (fabricState.type.localeCompare('tls') === 0);
	const ccp = tls ? lifecycleCcpTls : lifecycleCcp;

	await Chaincode.performContractCommitWithOrgOnChannel(contractName, orgName, channelName, ccp);
});

Then(/^I can (submit|query) invalid function (.+?) on contract named (.+?) as organization (.+?) on channel (.+?) with args (.+?) I receive an error with status (.+?) and message containing (.+?)$/, {timeout: Constants.STEP_LONG as number }, async (submit, contractFunction, contractName, orgName, channelName, contractAgs, status, message) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE);
	const tls = (fabricState.type.localeCompare('tls') === 0);
	const ccp = tls ? lifecycleCcpTls : lifecycleCcp;

	const expectedError = {
		message,
		status: Number(status),
	};

	await Chaincode.performContractTransactionForOrg(contractName, contractFunction, contractAgs, orgName, channelName, ccp, submit === 'submit', undefined, expectedError);
});

Then(/^I can submit function (.+?) on contract named (.+?) as organization (.+?) on channel (.+?) with args (\[.+?\])$/, {timeout: Constants.STEP_LONG as number }, async (contractFunction, contractName, orgName, channelName, contractAgs) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE);
	const tls = (fabricState.type.localeCompare('tls') === 0);
	const ccp = tls ? lifecycleCcpTls : lifecycleCcp;

	await Chaincode.performContractTransactionForOrg(contractName, contractFunction, contractAgs, orgName, channelName, ccp, true, undefined, undefined);
});

Then(/^I can (submit|query) function (.+?) on contract named (.+?) as organization (.+?) on channel (.+?) with args (\[.+?\]) returning expected result (.+?)$/, {timeout: Constants.STEP_LONG as number }, async (submit, contractFunction, contractName, orgName, channelName, contractAgs, expectedResult) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE);
	const tls = (fabricState.type.localeCompare('tls') === 0);
	const ccp = tls ? lifecycleCcpTls : lifecycleCcp;

	const expected = JSON.parse(expectedResult);
	await Chaincode.performContractTransactionForOrg(contractName, contractFunction, contractAgs, orgName, channelName, ccp, submit === 'submit', expected, undefined);
});
