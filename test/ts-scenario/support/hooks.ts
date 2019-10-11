/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from '../steps/constants';
import { DisconnectAllGateways } from '../steps/lib/gateway';
import * as BaseUtils from '../steps/lib/utility/baseUtils';
import { CommandRunner } from '../steps/lib/utility/commandRunner';
import { StateStore } from '../steps/lib/utility/stateStore';

import { After, AfterAll } from 'cucumber';

// const networkUtils = require('../lib/network');

const commandRunner = CommandRunner.getInstance();
const stateStore = StateStore.getInstance();

AfterAll({}, async () => {
	// Clean off Docker step
	BaseUtils.logMsg('Tearing down network ...', null);
	await commandRunner.runShellCommand(undefined, 'docker kill $(docker ps -aq); docker rm $(docker ps -aq)');
	stateStore.set(Constants.FABRIC_STATE, {deployed: false, type: null});
	// Instantiation will result in docker images being generated, clean them up with this After hook by using the referenced tag
	BaseUtils.logMsg('Removing dev images ...', null);
	await commandRunner.runShellCommand(undefined, 'docker rmi $(docker images dev-* -q)');
});

After({tags: '@clean-gateway'}, async () => {
	// If a test fails without disconnecting gateways, then the tests will hang
	BaseUtils.logMsg('Disconnecting from all gateways ...',  null);
	await DisconnectAllGateways();
});
