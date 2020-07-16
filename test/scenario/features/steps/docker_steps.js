/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const testUtil = require('../lib/utils');
const path = require('path');

module.exports = function () {

	this.Given(/^I have deployed a (.+?) Fabric network/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (type) => {
		const options = {
			cwd: path.resolve(__dirname, '..', '..', '..', 'fixtures', 'docker-compose')
		};

		await testUtil.runShellCommand(undefined, 'rm -r ~/.hlf-checkpoint');
		await testUtil.runShellCommand(undefined, 'docker kill $(docker ps -aq); docker rm $(docker ps -aq)');
		if (type.localeCompare('non-tls') === 0) {
			await testUtil.runShellCommand(true, 'docker-compose -f docker-compose.yaml -p node up -d', options);
		} else {
			await testUtil.runShellCommand(true, 'docker-compose -f docker-compose-tls.yaml -p node up -d', options);
		}
		return await testUtil.sleep(testUtil.TIMEOUTS.SHORT_INC);
	});

	this.Given(/^I have forcibly taken down all docker containers/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async () => {
		await testUtil.runShellCommand(undefined, 'rm -rf ~/.hlf-checkpoint');
		await testUtil.runShellCommand(undefined, 'docker kill $(docker ps -aq); docker rm $(docker ps -aq)');
		return await testUtil.sleep(testUtil.TIMEOUTS.SHORT_INC);
	});


	this.Given(/^I have deleted all dev images/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async () => {
		await testUtil.runShellCommand(undefined, 'docker rmi $(docker images dev-* -q)');
		return await testUtil.sleep(testUtil.TIMEOUTS.SHORT_INC);
	});

};
