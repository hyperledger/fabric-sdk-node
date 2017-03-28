/**
 * Copyright 2017 IBM All Rights Reserved.
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

// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';

var utils = require('fabric-client/lib/utils.js');
utils.setConfigSetting('hfc-logging', '{"debug":"console"}');
var logger = utils.getLogger('E2E instantiate-chaincode');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var path = require('path');
var fs = require('fs');
var util = require('util');

var hfc = require('fabric-client');
var EventHub = require('fabric-client/lib/EventHub.js');
var testUtil = require('../../unit/util.js');

var e2e = testUtil.END2END;
hfc.addConfigFile(path.join(__dirname, './config.json'));
var ORGS = hfc.getConfigSetting('test-network');

var tx_id = null;
var nonce = null;
var the_user = null;
var allEventhubs = [];

test('\n\n***** End-to-end flow: instantiate chaincode *****', (t) => {
	// override t.end function so it'll always disconnect the event hub
	t.end = ((context, ehs, f) => {
		return function() {
			for(var key in ehs) {
				var eventhub = ehs[key];
				if (eventhub && eventhub.isconnected()) {
					logger.info('Disconnecting the event hub');
					eventhub.disconnect();
				}
			}

			f.apply(context, arguments);
		};
	})(t, allEventhubs, t.end);

	// this is a transaction, will just use org1's identity to
	// submit the request
	var org = 'org1';
	var client = new hfc();
	var chain = client.newChain(e2e.channel);

	var caRootsPath = ORGS.orderer.tls_cacerts;
	let data = fs.readFileSync(path.join(__dirname, caRootsPath));
	let caroots = Buffer.from(data).toString();

	chain.addOrderer(
		client.newOrderer(
			ORGS.orderer.url,
			{
				'pem': caroots,
				'ssl-target-name-override': ORGS.orderer['server-hostname']
			}
		)
	);

	var orgName = ORGS[org].name;

	var targets = [],
		eventhubs = [];
	// set up the chain to use each org's 'peer1' for
	// both requests and events
	for (let key in ORGS) {
		if (ORGS.hasOwnProperty(key) && typeof ORGS[key].peer1 !== 'undefined') {
			let data = fs.readFileSync(path.join(__dirname, ORGS[key].peer1['tls_cacerts']));
			let peer = client.newPeer(
				ORGS[key].peer1.requests,
				{
					pem: Buffer.from(data).toString(),
					'ssl-target-name-override': ORGS[key].peer1['server-hostname']
				}
			);
			chain.addPeer(peer);

			let eh = new EventHub();
			eh.setPeerAddr(
				ORGS[key].peer1.events,
				{
					pem: Buffer.from(data).toString(),
					'ssl-target-name-override': ORGS[key].peer1['server-hostname']
				}
			);
			eh.connect();
			eventhubs.push(eh);
			allEventhubs.push(eh);
		}
	}

	return hfc.newDefaultKeyValueStore({
		path: testUtil.storePathForOrg(orgName)
	}).then((store) => {

		client.setStateStore(store);
		return testUtil.getSubmitter(client, t, org);

	}).then((admin) => {

		t.pass('Successfully enrolled user \'admin\'');
		the_user = admin;

		// read the config block from the orderer for the chain
		// and initialize the verify MSPs based on the participating
		// organizations
		return chain.initialize();
	}, (err) => {

		t.fail('Failed to enroll user \'admin\'. ' + err);
		throw new Error('Failed to enroll user \'admin\'. ' + err);

	}).then((success) => {

		nonce = utils.getNonce();
		tx_id = hfc.buildTransactionID(nonce, the_user);

		// send proposal to endorser
		var request = {
			chaincodePath: testUtil.CHAINCODE_PATH,
			chaincodeId: e2e.chaincodeId,
			chaincodeVersion: e2e.chaincodeVersion,
			fcn: 'init',
			args: ['a', '100', 'b', '200'],
			chainId: e2e.channel,
			txId: tx_id,
			nonce: nonce,
			// use this to demonstrate the following policy:
			// 'if signed by org1 admin, then that's the only signature required,
			// but if that signature is missing, then the policy can also be fulfilled
			// when members (non-admin) from both orgs signed'
			'endorsement-policy': {
				identities: [
					{ role: { name: 'member', mspId: ORGS['org1'].mspid }},
					{ role: { name: 'member', mspId: ORGS['org2'].mspid }},
					{ role: { name: 'admin', mspId: ORGS['org1'].mspid }}
				],
				policy: {
					'1-of': [
						{ 'signed-by': 2},
						{ '2-of': [{ 'signed-by': 0}, { 'signed-by': 1 }]}
					]
				}
			}
		};

		return chain.sendInstantiateProposal(request);

	}, (err) => {

		t.fail('Failed to initialize the chain');
		throw new Error('Failed to initialize the chain');

	}).then((results) => {

		var proposalResponses = results[0];

		var proposal = results[1];
		var header   = results[2];
		var all_good = true;
		for(var i in proposalResponses) {
			let one_good = false;
			if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
				one_good = true;
				logger.info('instantiate proposal was good');
			} else {
				logger.error('instantiate proposal was bad');
			}
			all_good = all_good & one_good;
		}
		if (all_good) {
			t.pass(util.format('Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s', proposalResponses[0].response.status, proposalResponses[0].response.message, proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));
			var request = {
				proposalResponses: proposalResponses,
				proposal: proposal,
				header: header
			};

			// set the transaction listener and set a timeout of 30sec
			// if the transaction did not get committed within the timeout period,
			// fail the test
			var deployId = tx_id.toString();

			var eventPromises = [];
			eventhubs.forEach((eh) => {
				let txPromise = new Promise((resolve, reject) => {
					let handle = setTimeout(reject, 30000);

					eh.registerTxEvent(deployId.toString(), (tx, code) => {
						t.pass('The chaincode instantiate transaction has been committed on peer '+ eh.ep._endpoint.addr);
						clearTimeout(handle);
						eh.unregisterTxEvent(deployId);

						if (code !== 'VALID') {
							t.fail('The chaincode instantiate transaction was invalid, code = ' + code);
							reject();
						} else {
							t.pass('The chaincode instantiate transaction was valid.');
							resolve();
						}
					});
				});

				eventPromises.push(txPromise);
			});

			var sendPromise = chain.sendTransaction(request);
			return Promise.all([sendPromise].concat(eventPromises))
			.then((results) => {

				logger.debug('Event promise all complete and testing complete');
				return results[0]; // the first returned value is from the 'sendPromise' which is from the 'sendTransaction()' call

			}).catch((err) => {

				t.fail('Failed to send instantiate transaction and get notifications within the timeout period.');
				throw new Error('Failed to send instantiate transaction and get notifications within the timeout period.');

			});

		} else {
			t.fail('Failed to send instantiate Proposal or receive valid response. Response null or status is not 200. exiting...');
			throw new Error('Failed to send instantiate Proposal or receive valid response. Response null or status is not 200. exiting...');
		}
	}, (err) => {

		t.fail('Failed to send instantiate proposal due to error: ' + err.stack ? err.stack : err);
		throw new Error('Failed to send instantiate proposal due to error: ' + err.stack ? err.stack : err);

	}).then((response) => {

		if (response.status === 'SUCCESS') {
			t.pass('Successfully sent transaction to the orderer.');
		} else {
			t.fail('Failed to order the transaction. Error code: ' + response.status);
			throw new Error('Failed to order the transaction. Error code: ' + response.status);
		}
	}, (err) => {

		t.fail('Failed to send instantiate due to error: ' + err.stack ? err.stack : err);
		throw new Error('Failed to send instantiate due to error: ' + err.stack ? err.stack : err);

	});
});
