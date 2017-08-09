/**
 * Copyright 2017 Hitachi America, Ltd. All Rights Reserved.
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

// Error and supplement test cases for invoking transactions.
// (1) This test case tries to invoke a transaction with insufficient endorsements,
//     and confirms that this fails.
// (2) This also tries to invoke a transaction with inverted order of endrosements,
//     and checks that it succeeds.
'use strict';

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var Client = require('fabric-client');
var utils = require('fabric-client/lib/utils.js');
var testUtil = require('../unit/util.js');
var e2e = testUtil.END2END;

var path = require('path');
var fs = require('fs');
var util = require('util');

var logger = utils.getLogger('E2E testing');

var ORGS;

var tx_id = null;
var the_user = null;

var peers = [];

init();

test('\n\n***** E R R O R  T E S T I N G: invoke transaction with one endorsement *****\n\n', (t) => {
	invokeChaincode('org2', 'v0', t, 'ENDORSEMENT_POLICY_FAILURE', [peers[0]])
	.then((result) => {
		if(result){
			t.pass('Successfully tested failure to invoke transaction chaincode due to insufficient endorsement');

			return invokeChaincode('org2', 'v0', t, 'ENDORSEMENT_POLICY_FAILURE', [peers[1]]);
		}
		else {
			t.fail('Failed to invoke transaction chaincode');
			t.end();
		}
	}, (err) => {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
		t.end();
	}).then((result) => {
		if(result){
			t.pass('Successfully tested failure to invoke transaction chaincode due to insufficient endorsement');
			t.end();
		}
		else {
			t.fail('Failed to invoke transaction chaincode');
			t.end();
		}
	}, (err) => {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
		t.end();
	});
});

test('\n\n***** invoke transaction with inverted order of endorsements *****\n\n', (t) => {
	invokeChaincode('org2', 'v0', t, false, [peers[1], peers[0]])
	.then((result) => {
		t.pass('Successfully invoke transaction chaincode on channel');
		t.end();
	}, (err) => {
		t.fail('Failed to invoke transaction chaincode on channel. ' + err.stack ? err.stack : err);
		t.end();
	});
});

function init() {
	if (!ORGS) {
		Client.addConfigFile(path.join(__dirname, 'e2e', './config.json'));
		ORGS = Client.getConfigSetting('test-network');
	}

	for (let key in ORGS) {
		if (ORGS.hasOwnProperty(key) && typeof ORGS[key].peer1 !== 'undefined') {
			let data = fs.readFileSync(path.join(__dirname, 'e2e', ORGS[key].peer1['tls_cacerts']));
			var org = ORGS[key].peer1;
			org.pem = Buffer.from(data).toString();
			peers.push(org);
		}
	}
}

function invokeChaincode(userOrg, version, t, shouldFail, peers){
	logger.debug('invokeChaincode begin');
	Client.setConfigSetting('request-timeout', 60000);
	var channel_name = Client.getConfigSetting('E2E_CONFIGTX_CHANNEL_NAME', testUtil.END2END.channel);

	var targets = [], eventhubs = [];

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

	// this is a transaction, will just use org's identity to
	// submit the request. intentionally we are using a different org
	// than the one that instantiated the chaincode, although either org
	// should work properly
	var client = new Client();
	var channel = client.newChannel(channel_name);

	var orgName = ORGS[userOrg].name;
	var cryptoSuite = Client.newCryptoSuite();

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

	return testUtil.getSubmitter(client, t, userOrg)
	.then((admin) => {
		t.pass('Successfully enrolled user \'admin\'');
		the_user = admin;

		for (let key in peers) {
			let peer = client.newPeer(
				peers[key].requests,
				{
					pem: peers[key].pem,
					'ssl-target-name-override': peers[key]['server-hostname'],
				});
			channel.addPeer(peer);
		}

		// an event listener can only register with a peer in its own org
		let data = fs.readFileSync(path.join(__dirname, 'e2e', ORGS[userOrg].peer1['tls_cacerts']));
		let eh = client.newEventHub();
		eh.setPeerAddr(
			ORGS[userOrg].peer1.events,
			{
				pem: Buffer.from(data).toString(),
				'ssl-target-name-override': ORGS[userOrg].peer1['server-hostname'],
				'grpc.http2.keepalive_time' : 15
			}
		);
		eh.connect();
		eventhubs.push(eh);

		return channel.initialize();

	}).then((nothing) => {
		tx_id = client.newTransactionID(the_user);

		// send proposal to endorser
		var request = {
			chaincodeId : e2e.chaincodeId,
			fcn: 'move',
			args: ['a', 'b','100'],
			txId: tx_id,
		};
		return channel.sendTransactionProposal(request);

	}, (err) => {
		t.fail('Failed to enroll user \'admin\'. ' + err);
		throw new Error('Failed to enroll user \'admin\'. ' + err);

	}).then((results) => {
		var proposalResponses = results[0];

		var proposal = results[1];
		var header   = results[2];
		var all_good = true;

		for(var i in proposalResponses) {
			let one_good = false;
			let proposal_response = proposalResponses[i];
			if( proposal_response.response && proposal_response.response.status === 200) {
				t.pass('transaction proposal has response status of good');
				one_good = channel.verifyProposalResponse(proposal_response);
				if(one_good) {
					t.pass(' transaction proposal signature and endorser are valid');
				}
			} else {
				t.fail('transaction proposal was bad');
			}
			all_good = all_good & one_good;
		}
		if (all_good) {
			// check all the read/write sets to see if the same, verify that each peer
			// got the same results on the proposal
			all_good = channel.compareProposalResponseResults(proposalResponses);
			t.pass('compareProposalResponseResults exection did not throw an error');
			if(all_good){
				t.pass(' All proposals have a matching read/writes sets');
			}
			else {
				t.fail(' All proposals do not have matching read/write sets');
			}
		}
		if (all_good) {
			// check to see if all the results match
			t.pass('Successfully sent Proposal and received ProposalResponse');
			logger.debug(util.format('Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s', proposalResponses[0].response.status, proposalResponses[0].response.message, proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));

			var request = {
				proposalResponses: proposalResponses,
				proposal: proposal,
				header: header
			};

			// set the transaction listener and set a timeout of 30sec
			// if the transaction did not get committed within the timeout period,
			// fail the test
			var deployId = tx_id.getTransactionID();

			var eventPromises = [];
			eventhubs.forEach((eh) => {
				let txPromise = new Promise((resolve, reject) => {
					let handle = setTimeout(reject, 120000);

					eh.registerTxEvent(deployId.toString(),
						(tx, code) => {
							clearTimeout(handle);
							eh.unregisterTxEvent(deployId);

							if (code !== 'VALID') {
								if (shouldFail !== false && code === shouldFail) {
									t.pass('The balance transaction failed with ' + shouldFail + ' as expected');
									resolve();
								} else {
									t.fail('The balance transaction failed with ' + code);
									reject();
								}
							} else {
								if (shouldFail === false) {
									t.pass('The balance transfer transaction has been committed on peer '+ eh.getPeerAddr());
									resolve();
								} else {
									t.fail('The balance transfer transaction should have failed with ' + shouldFail);
									reject();
								}
							}
						},
						(err) => {
							clearTimeout(handle);
							t.pass('Successfully received notification of the event call back being cancelled for '+ deployId);
							resolve();
						}
					);
				});

				eventPromises.push(txPromise);
			});

			var sendPromise = channel.sendTransaction(request);
			return Promise.all([sendPromise].concat(eventPromises))
			.then((results) => {
				logger.debug('event promise all complete and testing complete');
				return results[0]; // the first returned value is from the 'sendPromise' which is from the 'sendTransaction()' call
			}).catch((err) => {
				t.fail('Failed to send transaction and get notifications within the timeout period.');
				throw new Error('Failed to send transaction and get notifications within the timeout period.');
			});
		} else {
			t.fail('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
			throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
		}
	}, (err) => {
		t.fail('Failed to send proposal due to error: ' + err.stack ? err.stack : err);
		throw new Error('Failed to send proposal due to error: ' + err.stack ? err.stack : err);
	});
};
