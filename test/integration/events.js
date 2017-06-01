/**
 * Copyright 2017 London Stock Exchange All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

'use strict';

var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('events');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var path = require('path');
var util = require('util');
var fs = require('fs');

var Client = require('fabric-client');
var testUtil = require('../unit/util.js');
var eputil = require('./eventutil.js');

var client = new Client();
var channel = client.newChannel(testUtil.END2END.channel);
var ORGS;

var chaincode_id = testUtil.getUniqueVersion('events_unit_test');
var chaincode_version = testUtil.getUniqueVersion();
var request = null;
var the_user = null;

test('Test chaincode instantiate with event, transaction invocation with chaincode event, and query number of chaincode events', (t) => {
	testUtil.resetDefaults();
	testUtil.setupChaincodeDeploy();
	Client.addConfigFile(path.join(__dirname, 'e2e', 'config.json'));
	var ORGS = Client.getConfigSetting('test-network');
	Client.setConfigSetting('request-timeout', 30000);

	var caRootsPath = ORGS.orderer.tls_cacerts;
	let data = fs.readFileSync(path.join(__dirname, 'e2e', caRootsPath));
	let caroots = Buffer.from(data).toString();

	channel.addOrderer(
		client.newOrderer(
			ORGS.orderer.url,
			{
				'pem': caroots,
				'ssl-target-name-override': ORGS.orderer['server-hostname']
			}
		)
	);

	var org = 'org1';
	var orgName = ORGS[org].name;
	var targets = [];
	for (let key in ORGS[org]) {
		if (ORGS[org].hasOwnProperty(key)) {
			if (key.indexOf('peer') === 0) {
				let data = fs.readFileSync(path.join(__dirname, 'e2e', ORGS[org][key]['tls_cacerts']));
				let peer = client.newPeer(
					ORGS[org][key].requests,
					{
						pem: Buffer.from(data).toString(),
						'ssl-target-name-override': ORGS[org][key]['server-hostname']
					});
				channel.addPeer(peer);
				targets.push(peer);
				break; //just add one
			}
		}
	}

	// must use an array to track the event hub instances so that when this gets
	// passed into the overriden t.end() closure below it will get properly updated
	// later when the eventhub instances are created
	var eventhubs = [];
	var eh;
	var req1 = null;
	var req2 = null;
	var tls_data = null;

	// override t.end function so it'll always disconnect the event hub
	t.end = ((context, ehs, f) => {
		return function() {
			for(var key in ehs) {
				var eventhub = ehs[key];
				if (eventhub && eventhub.isconnected()) {
					logger.debug('Disconnecting the event hub');
					eventhub.disconnect();
				}
			}

			f.apply(context, arguments);
		};
	})(t, eventhubs, t.end);

	Client.newDefaultKeyValueStore({
		path: testUtil.storePathForOrg(orgName)
	}).then((store) => {
		client.setStateStore(store);

		// get the peer org's admin required to send install chaincode requests
		return testUtil.getSubmitter(client, t, true /* get peer org admin */, org);
	}).then((admin) => {
		t.pass('Successfully enrolled user \'admin\'');

		// setup event hub to get notified when transactions are committed
		tls_data = fs.readFileSync(path.join(__dirname, 'e2e', ORGS[org].peer1['tls_cacerts']));

		the_user = admin;

		eh = client.newEventHub();

		// first do one that fails
		eh.setPeerAddr(
			'grpcs://localhost:9999',
			{
				pem: Buffer.from(tls_data).toString(),
				'ssl-target-name-override': ORGS[org].peer1['server-hostname']
			});
		try {
			eh.connect();
			eh.registerBlockEvent(
				(block) => {
					t.fail('this success function should not be called');
				},
				(err) => {
					if(err.toString().indexOf('Connect Failed') >= 0) {
						t.pass('this error function should be called ' + err);
					}
					else {
						t.fail('Error function was called but found an unknown error '+err);
					}
				}
			);
		}
		catch(err) {
			t.fail('this catch should not have been called');
		}
		return sleep(5000);
	},
	(err) => {
		t.fail('Failed to enroll user \'admin\'. ' + err);
		t.end();
	}).then(() =>{

		// now one that fails but not wait for it fail
		eh.setPeerAddr(
			'grpcs://localhost:9999',
			{
				pem: Buffer.from(tls_data).toString(),
				'ssl-target-name-override': ORGS[org].peer1['server-hostname']
			});
		try {
			eh.connect();
			eh.registerBlockEvent(
				(block) => {
					t.fail('this success function should not be called');
				},
				(err) => {
					if(err.toString().indexOf('Peer address') >= 0) {
						t.pass('this error function should be called ' + err);
					}
					else {
						t.fail('Error function was called but found an unknown error '+err);
					}
				}
			);
		}
		catch(err) {
			t.fail('this catch should not have been called');
		}

		// now do one that works
		eh.setPeerAddr(
			ORGS[org].peer1.events,
			{
				pem: Buffer.from(tls_data).toString(),
				'ssl-target-name-override': ORGS[org].peer1['server-hostname']
			});
		eh.connect();
		eventhubs.push(eh);

		request = eputil.createRequest(client, channel, the_user, chaincode_id, targets, '', '');
		request.chaincodePath = 'github.com/events_cc';
		request.chaincodeVersion = chaincode_version;

		return client.installChaincode(request);
	}).then((results) => {
		if ( eputil.checkProposal(results)) {
			// read the config block from the orderer for the channel
			// and initialize the verify MSPs based on the participating
			// organizations
			return channel.initialize();
		} else {
			return Promise.reject('bad install proposal:' + results);
		}
	}, (err) => {
		t.comment(err);
		t.fail(err);//Failed to initialize the channel or bad install proposal
		t.end();
	}).then((success) => {
		t.pass('Successfully initialized the channel');
		request = eputil.createRequest(client, channel, the_user, chaincode_id, targets, 'init', []);
		request.chaincodePath = 'github.com/events_cc';
		request.chaincodeVersion = chaincode_version;
		return channel.sendInstantiateProposal(request);
	}, (err) => {
		t.fail('Failed to send instantiate proposal due to error: ' + err.stack ? err.stack : err);
		t.end();
	}).then((results) => {
		var tmo = 50000;
		return Promise.all([eputil.registerTxEvent(eh, request.txId.getTransactionID().toString(), tmo),
			eputil.sendTransaction(channel, results)]);
	},
	(err) => {
		t.fail('Failed sending instantiate proposal: ' + err);
		t.end();
	}).then((results) => {
		t.pass('Successfully instantiated chaincode.');

		request = eputil.createRequest(client, channel, the_user, chaincode_id, targets, 'invoke', ['invoke', 'SEVERE']);
		return channel.sendTransactionProposal(request);
	},
	(err) => {
		t.fail('Failed instantiate due to error: ' + err.stack ? err.stack : err);
		t.end();
	}).then((results) => {
		var tmo = 20000;
		return Promise.all([eputil.registerCCEvent(eh, chaincode_id.toString(), '^evtsender*', tmo),
			eputil.sendTransaction(channel, results)
		]);
	},
	(err) => {
		t.fail('Failed to send transaction proposal due to error: ' + err.stack ? err.stack : err);
		t.end();
	}).then((results) => {
		t.pass('Successfully received chaincode event.');

		request = eputil.createRequest(client, channel, the_user, chaincode_id, targets, 'invoke', ['query']);
		return channel.queryByChaincode(request);
	},
	(err) => {
		t.fail('Failed to receive chaincode event: ' + err);
		t.end();
	}).then((response_payloads) => {
		for (let i = 0; i < response_payloads.length; i++) {
			t.equal(response_payloads[i].toString('utf8'), '1', 'checking query results are number of events generated');
		}

		// Test invalid transaction
		// create 2 invoke requests in quick succession that modify
		// the same state variable which should cause one invoke to
		// be invalid
		req1 = eputil.createRequest(client, channel, the_user, chaincode_id, targets, 'invoke', ['invoke', 'SEVERE']);
		req2 = eputil.createRequest(client, channel, the_user, chaincode_id, targets, 'invoke', ['invoke', 'SEVERE']);
		return Promise.all([channel.sendTransactionProposal(req1),
			channel.sendTransactionProposal(req2)]);
	},
	(err) => {
		t.fail('Failed to send query due to error: ' + err.stack ? err.stack : err);
		t.end();
	}).then(([results1, results2]) => {
		var tmo = 20000;
		return Promise.all([eputil.registerTxEvent(eh, req1.txId.getTransactionID().toString(), tmo),
			eputil.registerTxEvent(eh, req2.txId.getTransactionID().toString(), tmo),
			eputil.sendTransaction(channel, results1),
			eputil.sendTransaction(channel, results2)
		]);
	}).then(([regResult1, regResult2, sendResult1, sendResult2]) => {
		t.fail('Failed to generate an invalid transaction');
		t.end();
	},
	(err) => {
		t.equal(err, 'invalid', 'Expecting a rejected promise from the 2nd transaction should be invalid');
		t.end();
	}).catch((err) => {
		t.fail('Unexpected error. ' + err.stack ? err.stack : err);
		t.end();
	});
});

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}