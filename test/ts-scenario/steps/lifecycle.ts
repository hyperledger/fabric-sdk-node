/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from './constants';
import * as Chaincode from './lib/chaincode';
import { CommonConnectionProfileHelper } from './lib/utility/commonConnectionProfileHelper';
import { StateStore } from './lib/utility/stateStore';

import { Given, Then, When } from 'cucumber';
import * as path from 'path';

const stateStore: StateStore = StateStore.getInstance();

const lifecycleCcp: CommonConnectionProfileHelper = new CommonConnectionProfileHelper(path.join(__dirname, '../config', 'ccp-lifecycle.json'), true);
const lifecycleCcpTls: CommonConnectionProfileHelper = new CommonConnectionProfileHelper(path.join(__dirname, '../config', 'ccp-lifecycle-tls.json'), true);

// Given(/^I package a (node|java|golang) contract at version (.+?) named (.+?) as organizations (.+?) with initialization (required|unrequired)$/, { timeout: Constants.STEP_LONG as number }, async (contractType: string, contractVersion: string, contractName: string, orgs: string, initRequired: string) => {

// 	const fabricState: any = stateStore.get(Constants.FABRIC_STATE);
// 	const tls: boolean = (fabricState.type.localeCompare('tls') === 0);
// 	const ccp: CommonConnectionProfileHelper = tls ? lifecycleCcpTls : lifecycleCcp;

// 	const orgNames: string[] = orgs.slice(1, -1).split(',');

// 	for (const orgName of orgNames) {
// 		await Chaincode.packageContractForOrg(orgName, contractName, contractType, contractVersion, initRequired === 'required', ccp);
// 	}

// });

// Given(/^I install a packaged contract named (.+?) as organizations (.+?)$/, { timeout: Constants.HUGE_TIME as number }, async (contractName: string, orgs: string) => {

// 	const fabricState: any = stateStore.get(Constants.FABRIC_STATE);
// 	const tls: boolean = (fabricState.type.localeCompare('tls') === 0);
// 	const ccp: CommonConnectionProfileHelper = tls ? lifecycleCcpTls : lifecycleCcp;

// 	const orgNames: string[] = orgs.slice(1, -1).split(',');

// 	for (const orgName of orgNames) {
// 		await Chaincode.installPackagedContractForOrg(orgName, contractName, ccp);
// 	}

// });

// Given(/^I approve the installed contract named (.+?) as organizations (.+?) on channel (.+?) with endorsement policy (.+?)$/, { timeout: Constants.STEP_LONG as number }, async (contractName: string, orgs: string, channelName: string, policyType: string) => {

// 	const fabricState: any = stateStore.get(Constants.FABRIC_STATE);
// 	const tls: boolean = (fabricState.type.localeCompare('tls') === 0);
// 	const ccp: CommonConnectionProfileHelper = tls ? lifecycleCcpTls : lifecycleCcp;

// 	const orgNames: string[] = orgs.slice(1, -1).split(',');

// 	for (const orgName of orgNames) {
// 		await Chaincode.approveInstalledContractForOrg(orgName, contractName, channelName, ccp, policyType);
// 	}

// });

// Then(/^I can query commit readiness for contract named (.+?) as organizations (.+?) on channel (.+?) with expected approvals status of (.+?)$/, { timeout: Constants.STEP_LONG as number }, async (contractName: string, orgs: string, channelName: string, expectedStatus: string) => {

// 	const fabricState: any = stateStore.get(Constants.FABRIC_STATE);
// 	const tls: boolean = (fabricState.type.localeCompare('tls') === 0);
// 	const ccp: CommonConnectionProfileHelper = tls ? lifecycleCcpTls : lifecycleCcp;

// 	const orgNames: string[] = orgs.slice(1, -1).split(',');
// 	const status: any = JSON.parse(expectedStatus);

// 	for (const orgName of orgNames) {
// 		await Chaincode.queryCommitReadinessAsOrgOnChannel(orgName, contractName, channelName, ccp, status);
// 	}
// });

// Then(/^I can query for defined contract named (.+?) as organizations (.+?) on channel (.+?) with expected result including (.+?)$/, { timeout: Constants.STEP_LONG as number }, async (contractName: string, orgs: string, channelName: string, expectedResult: string) => {

// 	const fabricState: any = stateStore.get(Constants.FABRIC_STATE);
// 	const tls: boolean = (fabricState.type.localeCompare('tls') === 0);
// 	const ccp: CommonConnectionProfileHelper = tls ? lifecycleCcpTls : lifecycleCcp;

// 	const orgNames: string[] = orgs.slice(1, -1).split(',');
// 	const expected: any = JSON.parse(expectedResult);

// 	for (const orgName of orgNames) {
// 		await Chaincode.queryForDefinedContractAsOrgOnChannel(orgName, contractName, channelName, ccp, expected);
// 	}
// });

// Then(/^I can retrieve an installed contract package named (.+?) as organizations (.+?) on channel (.+?)$/, { timeout: Constants.STEP_LONG as number }, async (contractName: string, orgs: string, channelName: string) => {

// 	const fabricState: any = stateStore.get(Constants.FABRIC_STATE);
// 	const tls: boolean = (fabricState.type.localeCompare('tls') === 0);
// 	const ccp: CommonConnectionProfileHelper = tls ? lifecycleCcpTls : lifecycleCcp;

// 	const orgNames: string[] = orgs.slice(1, -1).split(',');

// 	for (const orgName of orgNames) {
// 		await Chaincode.retrieveContractPackageAsOrgOnChannel(orgName, contractName, channelName, ccp);
// 	}
// });

// When(/^I call commit on contract named (.+?) as organization (.+?) on channel (.+?)$/, {timeout: Constants.STEP_LONG as number }, async (contractName: string, orgName: string, channelName: string) => {

// 	const fabricState: any = stateStore.get(Constants.FABRIC_STATE);
// 	const tls: boolean = (fabricState.type.localeCompare('tls') === 0);
// 	const ccp: CommonConnectionProfileHelper = tls ? lifecycleCcpTls : lifecycleCcp;

// 	await Chaincode.performContractCommitWithOrgOnChannel(contractName, orgName, channelName, ccp);
// });

Then(/^I can (submit|query) invalid function (.+?) on contract named (.+?) as organization (.+?) on channel (.+?) with args (.+?) I receive an error with status (.+?) and message containing (.+?)$/, {timeout: Constants.STEP_LONG as number }, async (submit: string, contractFunction: string, contractName: string, orgName: string, channelName: string, contractAgs: string, status: string, message: string) => {

	const fabricState: any = stateStore.get(Constants.FABRIC_STATE);
	const tls: boolean = (fabricState.type.localeCompare('tls') === 0);
	const ccp: CommonConnectionProfileHelper = tls ? lifecycleCcpTls : lifecycleCcp;

	const expectedError: any = {
		message,
		status: Number(status),
	};

	await Chaincode.performContractTransactionForOrg(contractName, contractFunction, contractAgs, orgName, channelName, ccp, submit === 'submit', undefined, expectedError);
});

Then(/^I can submit function (.+?) on contract named (.+?) as organization (.+?) on channel (.+?) with args (\[.+?\])$/, {timeout: Constants.STEP_LONG as number }, async (contractFunction: string, contractName: string, orgName: string, channelName: string, contractAgs: string) => {

	const fabricState: any = stateStore.get(Constants.FABRIC_STATE);
	const tls: boolean = (fabricState.type.localeCompare('tls') === 0);
	const ccp: CommonConnectionProfileHelper = tls ? lifecycleCcpTls : lifecycleCcp;

	await Chaincode.performContractTransactionForOrg(contractName, contractFunction, contractAgs, orgName, channelName, ccp, true, undefined, undefined);
});

Then(/^I can (submit|query) function (.+?) on contract named (.+?) as organization (.+?) on channel (.+?) with args (\[.+?\]) returning expected result (.+?)$/, {timeout: Constants.STEP_LONG as number }, async (submit: string, contractFunction: string, contractName: string, orgName: string, channelName: string, contractAgs: string, expectedResult: string) => {

	const fabricState: any = stateStore.get(Constants.FABRIC_STATE);
	const tls: boolean = (fabricState.type.localeCompare('tls') === 0);
	const ccp: CommonConnectionProfileHelper = tls ? lifecycleCcpTls : lifecycleCcp;

	const expected: any = JSON.parse(expectedResult);
	await Chaincode.performContractTransactionForOrg(contractName, contractFunction, contractAgs, orgName, channelName, ccp, submit === 'submit', expected, undefined);
});
