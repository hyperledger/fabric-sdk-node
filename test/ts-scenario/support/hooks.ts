/**
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Constants from '../steps/constants';
import * as Gateway from '../steps/lib/gateway';
import * as BaseUtils from '../steps/lib/utility/baseUtils';
import {CommandRunner} from '../steps/lib/utility/commandRunner';
import {StateStore} from '../steps/lib/utility/stateStore';

import {AfterAll} from 'cucumber';

const commandRunner: CommandRunner = CommandRunner.getInstance();
const stateStore: StateStore = StateStore.getInstance();

// eslint-disable-next-line @typescript-eslint/no-misused-promises
AfterAll({timeout: Constants.HUGE_TIME}, async () => {
	// Clean off Docker step
	BaseUtils.logMsg('Tearing down network ...', null);
	await commandRunner.runShellCommand(undefined, 'docker kill $(docker ps -aq); docker rm $(docker ps -aq)');
	stateStore.set(Constants.FABRIC_STATE, {deployed: false, type: null});
	// Instantiation will result in docker images being generated, clean them up with this After hook by using the referenced tag
	BaseUtils.logMsg('Removing dev images ...', null);
	await commandRunner.runShellCommand(undefined, 'docker rmi $(docker images dev-* -q)');
});


AfterAll({timeout: Constants.HUGE_TIME}, () => {
	// If a test fails without disconnecting gateways, then the tests will hang
	BaseUtils.logMsg('Disconnecting from all gateways ...',  null);
	Gateway.disconnectAllGateways();
});
