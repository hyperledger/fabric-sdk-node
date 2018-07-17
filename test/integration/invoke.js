/**
 * Copyright 2017 Hitachi America, Ltd. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// Error and supplement test cases for invoking transactions.
// (1) This test case tries to invoke a transaction with insufficient endorsements,
//     and confirms that this fails.
// (2) This also tries to invoke a transaction with inverted order of endrosements,
//     and checks that it succeeds.
'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const Client = require('fabric-client');
const utils = require('fabric-client/lib/utils.js');
const testUtil = require('../unit/util.js');
const e2e = testUtil.END2END;
const e2eUtils = require('./e2e/e2eUtils.js');

const path = require('path');
const fs = require('fs');
const util = require('util');

const logger = utils.getLogger('E2E testing');

let ORGS;
let tx_id = null;
const peers = [];

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
	.then(() => {
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
			const data = fs.readFileSync(path.join(__dirname, 'e2e', ORGS[key].peer1['tls_cacerts']));
			const org = ORGS[key].peer1;
			org.pem = Buffer.from(data).toString();
			peers.push(org);
		}
	}
}

function invokeChaincode(userOrg, version, t, shouldFail, peers){
	logger.debug('invokeChaincode begin');
	Client.setConfigSetting('request-timeout', 60000);
	const channel_name = Client.getConfigSetting('E2E_CONFIGTX_CHANNEL_NAME', testUtil.END2END.channel);

	const eventhubs = [];

	// override t.end function so it'll always disconnect the event hub
	t.end = ((context, ehs, f) => {
		return function() {
			for(let key in ehs) {
				const eventhub = ehs[key];
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
	const client = new Client();
	const channel = client.newChannel(channel_name);

	const caRootsPath = ORGS.orderer.tls_cacerts;
	const data = fs.readFileSync(path.join(__dirname, 'e2e', caRootsPath));
	const caroots = Buffer.from(data).toString();
	let tlsInfo = null;

	return e2eUtils.tlsEnroll(userOrg)
	.then((enrollment) => {
		t.pass('Successfully retrieved TLS certificate');
		tlsInfo = enrollment;
		client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
		return testUtil.getSubmitter(client, t, userOrg);
	}).then(() => {
		t.pass('Successfully enrolled user \'admin\'');

		channel.addOrderer(
			client.newOrderer(
				ORGS.orderer.url,
				{
					'pem': caroots,
					'ssl-target-name-override': ORGS.orderer['server-hostname']
				}
			)
		);

		for (let key in peers) {
			const peer = client.newPeer(
				peers[key].requests,
				{
					pem: peers[key].pem,
					'ssl-target-name-override': peers[key]['server-hostname'],
				});
			channel.addPeer(peer);
			eventhubs.push(channel.newChannelEventHub(peer));
		}

		return channel.initialize();

	}).then(() => {
		tx_id = client.newTransactionID();

		// send proposal to endorser
		const request = {
			chaincodeId : e2e.chaincodeId,
			fcn: 'move',
			args: ['a', 'b', '100'],
			txId: tx_id,
		};
		return channel.sendTransactionProposal(request);

	}, (err) => {
		t.fail('Failed to enroll user \'admin\'. ' + err);
		throw new Error('Failed to enroll user \'admin\'. ' + err);

	}).then((results) => {
		const proposalResponses = results[0];
		const proposal = results[1];
		let all_good = true;

		for(let i in proposalResponses) {
			let one_good = false;
			const proposal_response = proposalResponses[i];
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

			const request = {
				proposalResponses: proposalResponses,
				proposal: proposal
			};

			// set the transaction listener and set a timeout of 30sec
			// if the transaction did not get committed within the timeout period,
			// fail the test
			const deployId = tx_id.getTransactionID();

			const eventPromises = [];
			eventhubs.forEach((eh) => {
				const txPromise = new Promise((resolve, reject) => {
					const handle = setTimeout(reject, 120000);

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
						() => {
							clearTimeout(handle);
							t.fail('Failed -- received notification of the event call back being cancelled for '+ deployId);
							resolve();
						}
					);
				});
				eh.connect();

				eventPromises.push(txPromise);
			});

			const sendPromise = channel.sendTransaction(request);
			return Promise.all([sendPromise].concat(eventPromises))
			.then((results) => {
				logger.debug('event promise all complete and testing complete');
				return results[0]; // the first returned value is from the 'sendPromise' which is from the 'sendTransaction()' call
			}).catch((err) => {
				t.fail('Failed transaction ::'+ err);
				throw new Error('Failed transaction ::'+ err);
			});
		} else {
			t.fail('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
			throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
		}
	}, (err) => {
		t.fail('Failed to send proposal due to error: ' + err.stack ? err.stack : err);
		throw new Error('Failed to send proposal due to error: ' + err.stack ? err.stack : err);
	});
}
