/**
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Constants from './constants';
import * as BaseUtils from './lib/utility/baseUtils';
import {CommandRunner} from './lib/utility/commandRunner';
import {StateStore} from './lib/utility/stateStore';
import {Given} from 'cucumber';
import * as path from 'path';

const commandRunner: CommandRunner = CommandRunner.getInstance();
const stateStore: StateStore = StateStore.getInstance();

const nonTlsNetwork = '../../ts-fixtures/docker-compose/docker-compose.yaml';
const tlsNetwork = '../../ts-fixtures/docker-compose/docker-compose-tls.yaml';

Given(/^I deploy a (.+?) Fabric network at (.+?) version/, {timeout: Constants.STEP_LONG}, async (type: string, version: string) => {

	BaseUtils.logMsg(` **** checking for a deployed fabric network of type ${type} version ${version}`);

	const fabricState = stateStore.get(Constants.FABRIC_STATE) as {deployed:boolean, type:string, version:string};

	if (fabricState) {
		if (fabricState.deployed) {
			BaseUtils.logMsg(` **** found a deployed fabric network of type ${fabricState.type} version ${fabricState.version}`);
		} else {
			BaseUtils.logMsg(` **** found a non deployed fabric network of type ${fabricState.type} version ${fabricState.version}`);
		}
	} else {
		BaseUtils.logMsg(' **** no deployed fabric network found');
	}

	// If not deployed, deploy the requested type of network
	if (!fabricState || !fabricState.deployed) {
		BaseUtils.logMsg(` **** deploying a new fabric network of type ${type} version ${version}`);
		if (type.localeCompare('non-tls') === 0) {
			await commandRunner.runShellCommand(true, 'docker-compose -f ' + path.join(__dirname, nonTlsNetwork) + ' -p node up -d');
		} else {
			await commandRunner.runShellCommand(true, 'docker-compose -f ' + path.join(__dirname, tlsNetwork) + ' -p node up -d');
		}
		stateStore.set(Constants.FABRIC_STATE, {deployed: true, type, version});
		await BaseUtils.sleep(Constants.INC_SHORT);
		BaseUtils.logMsg(` **** deployed a fabric network of type ${type} version ${version}`);
		return;
	}

	// If deployed, but the wrong type or wrong version, pull down and stand up new network
	if (fabricState && (fabricState.type.localeCompare(type) !== 0 || fabricState.version.localeCompare(version) !== 0)) {
		BaseUtils.logMsg(` **** shutting down existing fabric network of type ${fabricState.type} version ${fabricState.version}`);

		await commandRunner.runShellCommand(undefined, 'rm -rf ~/.hlf-checkpoint');
		await commandRunner.runShellCommand(undefined, 'docker kill $(docker ps -aq); docker rm $(docker ps -aq)');
		await BaseUtils.sleep(Constants.INC_MED);

		if (type.localeCompare('non-tls') === 0) {
			await commandRunner.runShellCommand(true, 'docker-compose -f ' + path.join(__dirname, nonTlsNetwork) + ' -p node up -d');
		} else {
			await commandRunner.runShellCommand(true, 'docker-compose -f ' + path.join(__dirname, tlsNetwork) + ' -p node up -d');
		}
		stateStore.set(Constants.FABRIC_STATE, {deployed: true, type, version});
		await BaseUtils.sleep(Constants.INC_SHORT);
		BaseUtils.logMsg(` **** re-deployed a fabric network of type ${type} version ${version} `);
		return;
	}

	BaseUtils.logMsg(` **** Using the deployed fabric network of type ${type} version ${version}`);
});

Given(/^I forcibly take down all docker containers/, {timeout: Constants.STEP_LONG}, async () => {
	await commandRunner.runShellCommand(undefined, 'rm -rf ~/.hlf-checkpoint');
	await commandRunner.runShellCommand(undefined, 'docker kill $(docker ps -aq); docker rm $(docker ps -aq)');
	stateStore.set(Constants.FABRIC_STATE, {deployed: false, type: null});
	return await BaseUtils.sleep(Constants.INC_MED);
});

Given(/^I delete all dev images/, {timeout: Constants.STEP_LONG}, async () => {
	await commandRunner.runShellCommand(undefined, 'docker rmi $(docker images dev-* -q)');
	return await BaseUtils.sleep(Constants.INC_SHORT);
});
