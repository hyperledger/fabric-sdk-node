/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const testUtil = require('../lib/utils');
const path = require('path');
const StateStore = require('../lib/state_store').StateStore;

module.exports = function () {

	this.Given(/^I have deployed a (.+?) Fabric network/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (type) => {

		const fabricState = StateStore.get('fabricState');

		if (!fabricState || !fabricState.deployed || fabricState.type.localeCompare(type) !== 0) {
			await testUtil.runShellCommand(undefined, 'rm -f ~/.hlf-checkpoint');
			await testUtil.runShellCommand(undefined, 'docker kill $(docker ps -aq); docker rm $(docker ps -aq)');
			if (type.localeCompare('non-tls') === 0) {
				await testUtil.runShellCommand(true, 'docker-compose -f ' + path.join(__dirname, '../../../fixtures/docker-compose/docker-compose.yaml') + ' -p node up -d');
			} else {
				await testUtil.runShellCommand(true, 'docker-compose -f ' + path.join(__dirname, '../../../fixtures/docker-compose/docker-compose-tls.yaml') + ' -p node up -d');
			}

			StateStore.set('fabricState', {deployed: true, type: type});
			return await testUtil.sleep(testUtil.TIMEOUTS.SHORT_INC);
		}
	});

	this.Given(/^I have forcibly taken down all docker containers/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async () => {
		await testUtil.runShellCommand(undefined, 'rm -f ~/.hlf-checkpoint');
		await testUtil.runShellCommand(undefined, 'docker kill $(docker ps -aq); docker rm $(docker ps -aq)');
		StateStore.set('fabricState', {deployed: false, type: null});
		return await testUtil.sleep(testUtil.TIMEOUTS.SHORT_INC);
	});


	this.Given(/^I have deleted all dev images/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async () => {
		await testUtil.runShellCommand(undefined, 'docker rmi $(docker images dev-* -q)');
		return await testUtil.sleep(testUtil.TIMEOUTS.SHORT_INC);
	});

};
