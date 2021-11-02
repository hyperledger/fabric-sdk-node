/**
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Constants from './constants';
import * as Chaincode from './lib/chaincode';
import {CommonConnectionProfileHelper} from './lib/utility/commonConnectionProfileHelper';
import {StateStore, FabricState} from './lib/utility/stateStore';

import {Then} from 'cucumber';
import * as path from 'path';

const stateStore: StateStore = StateStore.getInstance();

const lifecycleCcp: CommonConnectionProfileHelper = new CommonConnectionProfileHelper(path.join(__dirname, '../config', 'ccp-lifecycle.json'), true);
const lifecycleCcpTls: CommonConnectionProfileHelper = new CommonConnectionProfileHelper(path.join(__dirname, '../config', 'ccp-lifecycle-tls.json'), true);


Then(/^I can (submit|query) invalid function (.+?) on contract named (.+?) as organization (.+?) on channel (.+?) with args (.+?) I receive an error with status (.+?) and message containing (.+?)$/, {timeout: Constants.STEP_LONG}, async (submit: string, contractFunction: string, contractName: string, orgName: string, channelName: string, contractAgs: string, status: string, message: string) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE) as FabricState ;
	const tls: boolean = (fabricState.type.localeCompare('tls') === 0);
	const ccp: CommonConnectionProfileHelper = tls ? lifecycleCcpTls : lifecycleCcp;

	const expectedError = {
		message,
		status: Number(status),
	};

	await Chaincode.performContractTransactionForOrg(contractName, contractFunction, contractAgs, orgName, channelName, ccp, submit === 'submit', undefined, expectedError);
});

Then(/^I can submit function (.+?) on contract named (.+?) as organization (.+?) on channel (.+?) with args (\[.+?\])$/, {timeout: Constants.STEP_LONG}, async (contractFunction: string, contractName: string, orgName: string, channelName: string, contractAgs: string) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE) as  FabricState;
	const tls: boolean = (fabricState.type.localeCompare('tls') === 0);
	const ccp: CommonConnectionProfileHelper = tls ? lifecycleCcpTls : lifecycleCcp;

	await Chaincode.performContractTransactionForOrg(contractName, contractFunction, contractAgs, orgName,
		channelName, ccp, true, undefined, undefined);
});

Then(/^I can (submit|query) function (.+?) on contract named (.+?) as organization (.+?) on channel (.+?) with args (\[.+?\]) returning expected result (.+?)$/, {timeout: Constants.STEP_LONG}, async (submit: string, contractFunction: string, contractName: string, orgName: string, channelName: string, contractAgs: string, expectedResult: string) => {

	const fabricState = stateStore.get(Constants.FABRIC_STATE) as  FabricState;
	const tls: boolean = (fabricState.type.localeCompare('tls') === 0);
	const ccp: CommonConnectionProfileHelper = tls ? lifecycleCcpTls : lifecycleCcp;

	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-explicit-any
	const expected: any = JSON.parse(expectedResult);
	await Chaincode.performContractTransactionForOrg(contractName, contractFunction, contractAgs, orgName, channelName, ccp, submit === 'submit', expected, undefined);
});
