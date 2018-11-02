/**
 * Copyright 2016-2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const Client = require('fabric-client');
const TestUtil = require('./util.js');

test('\n\n ** BasicCommitHandler - test **\n\n', async (t) => {

	const temp = Client.getConfigSetting('commit-handler');
	Client.setConfigSetting('endorsement-handler', 'fabric-client/lib/impl/BasicCommitHandler.js');

	const client = new Client();
	const store = await Client.newDefaultKeyValueStore({path: TestUtil.storePathForOrg('org1')});
	client.setStateStore(store);
	await TestUtil.setAdmin(client, 'org1');
	const channel = client.newChannel('handlertest');
	try {
		await channel.initialize();
	} catch (error) {
		// going to get an error
	}

	const handler = channel._commit_handler;
	if (handler && handler.commit) {
		t.pass('Able to have the channel create the handler');
	} else {
		t.fail('Channel was not able to create the handler');
		t.end();
		return;
	}

	try {
		await channel.initialize({commitHandler:'bad.js'});
		t.fail('Should not be here - commiHandler name is bad ');
	} catch (error) {
		if (error.toString().includes('find module')) {
			t.pass('Successfully failed to initialize using the commitHandler file name ::' + error);
		} else {
			t.fail('Received an unknown error ::' + error);
		}
	}

	let parameters = null;
	await errorChecker(t, handler, parameters, 'Missing all');
	parameters = {};
	await errorChecker(t, handler, parameters, 'Missing "request"');
	parameters.request = {};
	await errorChecker(t, handler, parameters, 'Missing "signed_envolope"');

	const orderer = client.newOrderer('grpc://somehost.com:7777');
	try {
		await handler.commit({request: {orderer}, signed_envelope: {}}, 1000);
		t.fail('Should not be here - looking for orderers in request');
	} catch (error) {
		if (error instanceof Error) {
			if (error.toString().indexOf('Failed to connect before the deadline') > -1) {
				t.pass('This should fail with ' + error.toString());
			} else {
				t.fail('Did not get Failed to connect before the deadline - got ' + error.toString());
			}
		} else {
			t.fail('Unknown commit results returned');
		}
	}

	const request = {};
	const envelope = {};

	try {
		await handler._commit(request, envelope, 5000);
		t.fail('Should not be here - looking for no orderers assigned');
	} catch (error) {
		if (error instanceof Error) {
			if (error.toString().indexOf('No orderers assigned to the channel') > -1) {
				t.pass('This should fail with ' + error.toString());
			} else {
				t.fail('Did not get No orderers assigned to the channel - got ' + error.toString());
			}
		} else {
			t.fail('Unknown commit results returned');
		}
	}

	channel.addOrderer(client.newOrderer('grpc://somehost.com:1111'));
	channel.addOrderer(client.newOrderer('grpc://somehost.com:2222'));
	channel.addOrderer(client.newOrderer('grpc://somehost.com:3333'));
	channel.addOrderer(client.newOrderer('grpc://somehost.com:4444'));
	channel.addOrderer(client.newOrderer('grpc://somehost.com:5555'));
	channel.addOrderer(client.newOrderer('grpc://somehost.com:6666'));

	try {
		await handler._commit(request, envelope, 5000);
		t.fail('Should not be here - looking for connect deadline');
	} catch (error) {
		if (error instanceof Error) {
			if (error.toString().indexOf('Failed to connect before the deadline') > -1) {
				t.pass('This should fail with ' + error.toString());
			} else {
				t.fail('Did not get deadline error - got ' + error.toString());
			}
		} else {
			t.fail('Unknown commit results returned');
		}
	}

	t.pass('Completed the testing');

	if (temp) {
		Client.setConfigSetting('endorsement-handler-path', temp);
	}
	t.end();
});

async function errorChecker(t, handler, parameters, error_text) {
	try {
		await handler.commit(parameters);
		t.fail('Should not be here - error checker has failed');
	} catch (error) {
		if (error.toString().indexOf(error_text)) {
			t.pass('Check for :' + error_text);
		} else {
			t.fail('Check for :' + error_text);
		}
	}
}
