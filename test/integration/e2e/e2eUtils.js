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
var logger = utils.getLogger('E2E testing');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var path = require('path');
var fs = require('fs');
var util = require('util');

var Client = require('fabric-client');
var testUtil = require('../../unit/util.js');

var e2e = testUtil.END2END;
var ORGS;

var grpc = require('grpc');

var tx_id = null;
var the_user = null;

function init() {
	if (!ORGS) {
		Client.addConfigFile(path.join(__dirname, './config.json'));
		ORGS = Client.getConfigSetting('test-network');
	}
}

function installChaincode(org, chaincode_path, version, t, get_admin) {
	init();
	Client.setConfigSetting('request-timeout', 60000);
	var channel_name = Client.getConfigSetting('E2E_CONFIGTX_CHANNEL_NAME', testUtil.END2END.channel);

	var client = new Client();
	// client.setDevMode(true);
	var channel = client.newChannel(channel_name);

	var orgName = ORGS[org].name;
	var cryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
	client.setCryptoSuite(cryptoSuite);

	var caRootsPath = ORGS.orderer.tls_cacerts;
	let data = fs.readFileSync(path.join(__dirname, caRootsPath));
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

	var targets = [];
	for (let key in ORGS[org]) {
		if (ORGS[org].hasOwnProperty(key)) {
			if (key.indexOf('peer') === 0) {
				let data = fs.readFileSync(path.join(__dirname, ORGS[org][key]['tls_cacerts']));
				let peer = client.newPeer(
					ORGS[org][key].requests,
					{
						pem: Buffer.from(data).toString(),
						'ssl-target-name-override': ORGS[org][key]['server-hostname']
					}
				);

				targets.push(peer);    // a peer can be the target this way
				channel.addPeer(peer); // or a peer can be the target this way
				                       // you do not have to do both, just one, when there are
				                       // 'targets' in the request, those will be used and not
				                       // the peers added to the channel
			}
		}
	}

	return Client.newDefaultKeyValueStore({
		path: testUtil.storePathForOrg(orgName)
	}).then((store) => {
		client.setStateStore(store);

		// get the peer org's admin required to send install chaincode requests
		return testUtil.getSubmitter(client, t, get_admin /* get peer org admin */, org);
	}).then((admin) => {
		t.pass('Successfully enrolled user \'admin\'');
		the_user = admin;

		// send proposal to endorser
		var request = {
			targets: targets,
			chaincodePath: chaincode_path,
			chaincodeId: e2e.chaincodeId,
			chaincodeVersion: version
		};

		return client.installChaincode(request);
	},
	(err) => {
		t.fail('Failed to enroll user \'admin\'. ' + err);
		throw new Error('Failed to enroll user \'admin\'. ' + err);
	}).then((results) => {
		var proposalResponses = results[0];

		var proposal = results[1];
		var all_good = true;
		var errors = [];
		for(var i in proposalResponses) {
			let one_good = false;
			if (proposalResponses && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
				one_good = true;
				logger.info('install proposal was good');
			} else {
				logger.error('install proposal was bad');
				errors.push(proposalResponses[i]);
			}
			all_good = all_good & one_good;
		}
		if (all_good) {
			t.pass(util.format('Successfully sent install Proposal and received ProposalResponse: Status - %s', proposalResponses[0].response.status));
		} else {
			throw new Error(util.format('Failed to send install Proposal or receive valid response: %s', errors));
		}
	},
	(err) => {
		t.fail('Failed to send install proposal due to error: ' + err.stack ? err.stack : err);
		throw new Error('Failed to send install proposal due to error: ' + err.stack ? err.stack : err);
	});
}

module.exports.installChaincode = installChaincode;


function instantiateChaincode(userOrg, chaincode_path, version, upgrade, t){
	init();

	var channel_name = Client.getConfigSetting('E2E_CONFIGTX_CHANNEL_NAME', testUtil.END2END.channel);

	var targets = [],
		eventhubs = [];
	var type = 'instantiate';
	if(upgrade) type = 'upgrade';
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

	var client = new Client();
	var channel = client.newChannel(channel_name);

	var orgName = ORGS[userOrg].name;
	var cryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
	client.setCryptoSuite(cryptoSuite);

	var caRootsPath = ORGS.orderer.tls_cacerts;
	let data = fs.readFileSync(path.join(__dirname, caRootsPath));
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

	var targets = [];
	var badTransientMap = { 'test1': 'transientValue' }; // have a different key than what the chaincode example_cc1.go expects in Init()
	var transientMap = { 'test': 'transientValue' };

	return Client.newDefaultKeyValueStore({
		path: testUtil.storePathForOrg(orgName)
	}).then((store) => {

		client.setStateStore(store);
		return testUtil.getSubmitter(client, t, true /* use peer org admin*/, userOrg);

	}).then((admin) => {

		t.pass('Successfully enrolled user \'admin\'');
		the_user = admin;

		for(let org in ORGS) {
			if (ORGS[org].hasOwnProperty('peer1')) {
				let key = 'peer1';
				let data = fs.readFileSync(path.join(__dirname, ORGS[org][key]['tls_cacerts']));
				logger.debug(' create new peer %s', ORGS[org][key].requests);
				let peer = client.newPeer(
					ORGS[org][key].requests,
					{
						pem: Buffer.from(data).toString(),
						'ssl-target-name-override': ORGS[org][key]['server-hostname']
					}
				);

				targets.push(peer);
				channel.addPeer(peer);
			}
		}

		// an event listener can only register with a peer in its own org
		logger.debug(' create new eventhub %s', ORGS[userOrg]['peer1'].events);
		let data = fs.readFileSync(path.join(__dirname, ORGS[userOrg]['peer1']['tls_cacerts']));
		let eh = client.newEventHub();
		eh.setPeerAddr(
			ORGS[userOrg]['peer1'].events,
			{
				pem: Buffer.from(data).toString(),
				'ssl-target-name-override': ORGS[userOrg]['peer1']['server-hostname']
			}
		);
		eh.connect();
		eventhubs.push(eh);

		// read the config block from the orderer for the channel
		// and initialize the verify MSPs based on the participating
		// organizations
		return channel.initialize();
	}, (err) => {

		t.fail('Failed to enroll user \'admin\'. ' + err);
		throw new Error('Failed to enroll user \'admin\'. ' + err);

	}).then(() => {
		logger.debug(' orglist:: ', channel.getOrganizations());
		// the v1 chaincode has Init() method that expects a transient map
		if (upgrade) {
			// first test that a bad transient map would get the chaincode to return an error
			let request = buildChaincodeProposal(client, the_user, chaincode_path, version, upgrade, badTransientMap);
			tx_id = request.txId;

			logger.debug(util.format(
				'Upgrading chaincode "%s" at path "%s" to version "%s" by passing args "%s" to method "%s" in transaction "%s"',
				request.chaincodeId,
				request.chaincodePath,
				request.chaincodeVersion,
				request.args,
				request.fcn,
				request.txId.getTransactionID()
			));

			// this is the longest response delay in the test, sometimes
			// x86 CI times out. set the per-request timeout to a super-long value
			return channel.sendUpgradeProposal(request, 120000)
			.then((results) => {
				let proposalResponses = results[0];

				if (version === 'v1') {
					// expecting both peers to return an Error due to the bad transient map
					let success = false;
					if (proposalResponses && proposalResponses.length > 0) {
						proposalResponses.forEach((response) => {
							if (response instanceof Error &&
								response.message.indexOf('Did not find expected key "test" in the transient map of the proposal')) {
								success = true;
							} else {
								success = false;
							}
						});
					}

					if (success) {
						// successfully tested the negative conditions caused by
						// the bad transient map, now send the good transient map
						request = buildChaincodeProposal(client, the_user, chaincode_path, version, upgrade, transientMap);
						tx_id = request.txId;

						return channel.sendUpgradeProposal(request, 120000);
					} else {
						throw new Error('Failed to test for bad transient map. The chaincode should have rejected the upgrade proposal.');
					}
				} else if (version === 'v3') {
					return Promise.resolve(results);
				}
			});
		} else {
			let request = buildChaincodeProposal(client, the_user, chaincode_path, version, upgrade, transientMap);
			tx_id = request.txId;

			// this is the longest response delay in the test, sometimes
			// x86 CI times out. set the per-request timeout to a super-long value
			return channel.sendInstantiateProposal(request, 120000);
		}

	}, (err) => {

		t.fail(util.format('Failed to initialize the channel. %s', err.stack ? err.stack : err));
		throw new Error('Failed to initialize the channel');

	}).then((results) => {

		var proposalResponses = results[0];

		var proposal = results[1];
		var all_good = true;
		for(var i in proposalResponses) {
			let one_good = false;
			if (proposalResponses && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
				// special check only to test transient map support during chaincode upgrade
				one_good = true;
				logger.info(type +' proposal was good');
			} else {
				logger.error(type +' proposal was bad');
			}
			all_good = all_good & one_good;
		}
		if (all_good) {
			t.pass('Successfully sent Proposal and received ProposalResponse');
			logger.debug(util.format('Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s', proposalResponses[0].response.status, proposalResponses[0].response.message, proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));
			var request = {
				proposalResponses: proposalResponses,
				proposal: proposal
			};

			// set the transaction listener and set a timeout of 30sec
			// if the transaction did not get committed within the timeout period,
			// fail the test
			var deployId = tx_id.getTransactionID();

			var eventPromises = [];
			eventhubs.forEach((eh) => {
				let txPromise = new Promise((resolve, reject) => {
					let handle = setTimeout(reject, 120000);

					eh.registerTxEvent(deployId.toString(), (tx, code) => {
						t.pass('The chaincode ' + type + ' transaction has been committed on peer '+ eh.getPeerAddr());
						clearTimeout(handle);
						eh.unregisterTxEvent(deployId);

						if (code !== 'VALID') {
							t.fail('The chaincode ' + type + ' transaction was invalid, code = ' + code);
							reject();
						} else {
							t.pass('The chaincode ' + type + ' transaction was valid.');
							resolve();
						}
					});
				});
				logger.debug('register eventhub %s with tx=%s',eh.getPeerAddr(),deployId);
				eventPromises.push(txPromise);
			});

			var sendPromise = channel.sendTransaction(request);
			return Promise.all([sendPromise].concat(eventPromises))
			.then((results) => {

				logger.debug('Event promise all complete and testing complete');
				return results[0]; // just first results are from orderer, the rest are from the peer events

			}).catch((err) => {

				t.fail('Failed to send ' + type + ' transaction and get notifications within the timeout period.');
				throw new Error('Failed to send ' + type + ' transaction and get notifications within the timeout period.');

			});

		} else {
			t.fail('Failed to send ' + type + ' Proposal or receive valid response. Response null or status is not 200. exiting...');
			throw new Error('Failed to send ' + type + ' Proposal or receive valid response. Response null or status is not 200. exiting...');
		}
	}, (err) => {

		t.fail('Failed to send ' + type + ' proposal due to error: ' + err.stack ? err.stack : err);
		throw new Error('Failed to send ' + type + ' proposal due to error: ' + err.stack ? err.stack : err);

	}).then((response) => {
		//TODO should look into the event responses
		if (!(response instanceof Error) && response.status === 'SUCCESS') {
			t.pass('Successfully sent ' + type + 'transaction to the orderer.');
			return true;
		} else {
			t.fail('Failed to order the ' + type + 'transaction. Error code: ' + response.status);
			Promise.reject(new Error('Failed to order the ' + type + 'transaction. Error code: ' + response.status));
		}
	}, (err) => {

		t.fail('Failed to send ' + type + ' due to error: ' + err.stack ? err.stack : err);
		Promise.reject(new Error('Failed to send instantiate due to error: ' + err.stack ? err.stack : err));
	});
};

function buildChaincodeProposal(client, the_user, chaincode_path, version, upgrade, transientMap) {
	var tx_id = client.newTransactionID();

	// send proposal to endorser
	var request = {
		chaincodePath: chaincode_path,
		chaincodeId: e2e.chaincodeId,
		chaincodeVersion: version,
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: tx_id,
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

	if (version === 'v3')
		request.args = ['b', '1000'];

	if(upgrade) {
		// use this call to test the transient map support during chaincode instantiation
		request.transientMap = transientMap;
	}

	return request;
}

module.exports.instantiateChaincode = instantiateChaincode;


function invokeChaincode(userOrg, version, t, useStore){
	init();

	logger.debug('invokeChaincode begin');
	Client.setConfigSetting('request-timeout', 60000);
	var channel_name = Client.getConfigSetting('E2E_CONFIGTX_CHANNEL_NAME', testUtil.END2END.channel);

	var targets = [],
		eventhubs = [];
	var pass_results = null;

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
	if (useStore) {
		cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
		client.setCryptoSuite(cryptoSuite);
	}

	var caRootsPath = ORGS.orderer.tls_cacerts;
	let data = fs.readFileSync(path.join(__dirname, caRootsPath));
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

	var orgName = ORGS[userOrg].name;

	var promise;
	if (useStore) {
		promise = Client.newDefaultKeyValueStore({
			path: testUtil.storePathForOrg(orgName)});
	} else {
		promise = Promise.resolve(useStore);
	}
	return promise.then((store) => {
		if (store) {
			client.setStateStore(store);
		}
		return testUtil.getSubmitter(client, t, userOrg);
	}).then((admin) => {

		t.pass('Successfully enrolled user \'admin\'');
		the_user = admin;

		// set up the channel to use each org's 'peer1' for
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
				channel.addPeer(peer);
			}
		}

		// an event listener can only register with a peer in its own org
		let data = fs.readFileSync(path.join(__dirname, ORGS[userOrg].peer1['tls_cacerts']));
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
		logger.debug(' orglist:: ', channel.getOrganizations());

		tx_id = client.newTransactionID();
		utils.setConfigSetting('E2E_TX_ID', tx_id.getTransactionID());
		logger.debug('setConfigSetting("E2E_TX_ID") = %s', tx_id.getTransactionID());

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
	}).then((results) =>{
		pass_results = results;
		var sleep_time = 0;
		// can use "sleep=30000" to give some time to manually stop and start
		// the peer so the event hub will also stop and start
		if (process.argv.length > 2) {
			if (process.argv[2].indexOf('sleep=') === 0) {
				sleep_time = process.argv[2].split('=')[1];
			}
		}
		t.comment('*****************************************************************************');
		t.comment('stop and start the peer event hub ---- N  O  W ----- you have ' + sleep_time + ' millis');
		t.comment('*****************************************************************************');
		return sleep(sleep_time);
	}).then((nothing) => {

		var proposalResponses = pass_results[0];

		var proposal = pass_results[1];
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
				proposal: proposal
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
								t.fail('The balance transfer transaction was invalid, code = ' + code);
								reject();
							} else {
								t.pass('The balance transfer transaction has been committed on peer '+ eh.getPeerAddr());
								resolve();
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

				logger.debug(' event promise all complete and testing complete');
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

	}).then((response) => {

		if (response.status === 'SUCCESS') {
			t.pass('Successfully sent transaction to the orderer.');
			t.comment('******************************************************************');
			t.comment('To manually run /test/integration/query.js, set the following environment variables:');
			t.comment('export E2E_TX_ID='+'\''+tx_id.getTransactionID()+'\'');
			t.comment('******************************************************************');
			logger.debug('invokeChaincode end');
			return true;
		} else {
			t.fail('Failed to order the transaction. Error code: ' + response.status);
			throw new Error('Failed to order the transaction. Error code: ' + response.status);
		}
	}, (err) => {

		t.fail('Failed to send transaction due to error: ' + err.stack ? err.stack : err);
		throw new Error('Failed to send transaction due to error: ' + err.stack ? err.stack : err);

	});
};

module.exports.invokeChaincode = invokeChaincode;

function queryChaincode(org, version, value, t, transientMap) {
	init();

	Client.setConfigSetting('request-timeout', 60000);
	var channel_name = Client.getConfigSetting('E2E_CONFIGTX_CHANNEL_NAME', testUtil.END2END.channel);

	// this is a transaction, will just use org's identity to
	// submit the request. intentionally we are using a different org
	// than the one that submitted the "move" transaction, although either org
	// should work properly
	var client = new Client();
	var channel = client.newChannel(channel_name);

	var orgName = ORGS[org].name;
	var cryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
	client.setCryptoSuite(cryptoSuite);

	var targets = [];
	// set up the channel to use each org's 'peer1' for
	// both requests and events
	for (let key in ORGS) {
		if (ORGS.hasOwnProperty(key) && typeof ORGS[key].peer1 !== 'undefined') {
			let data = fs.readFileSync(path.join(__dirname, ORGS[key].peer1['tls_cacerts']));
			let peer = client.newPeer(
				ORGS[key].peer1.requests,
				{
					pem: Buffer.from(data).toString(),
					'ssl-target-name-override': ORGS[key].peer1['server-hostname']
				});
			channel.addPeer(peer);
		}
	}

	return Client.newDefaultKeyValueStore({
		path: testUtil.storePathForOrg(orgName)
	}).then((store) => {

		client.setStateStore(store);
		return testUtil.getSubmitter(client, t, org);

	}).then((admin) => {
		the_user = admin;

		// send query
		var request = {
			chaincodeId : e2e.chaincodeId,
			txId: tx_id,
			fcn: 'query',
			args: ['b']
		};

		if (transientMap) {
			request.transientMap = transientMap;
			request.fcn = 'testTransient';
		}

		return channel.queryByChaincode(request);
	},
	(err) => {
		t.fail('Failed to get submitter \'admin\'. Error: ' + err.stack ? err.stack : err );
		throw new Error('Failed to get submitter');
	}).then((response_payloads) => {
		if (response_payloads) {
			for(let i = 0; i < response_payloads.length; i++) {
				if (transientMap) {
					t.equal(
						response_payloads[i].toString(),
						transientMap[Object.keys(transientMap)[0]].toString(),
						'Checking the result has the transientMap value returned by the chaincode');
				} else {
					t.equal(
						response_payloads[i].toString('utf8'),
						value,
						'checking query results are correct that user b has '+ value + ' now after the move');
				}
			}
			return true;
		} else {
			t.fail('response_payloads is null');
			throw new Error('Failed to get response on query');
		}
	},
	(err) => {
		t.fail('Failed to send query due to error: ' + err.stack ? err.stack : err);
		throw new Error('Failed, got error on query');
	});
};

module.exports.queryChaincode = queryChaincode;

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
module.exports.sleep = sleep;

function loadMSPConfig(name, mspdir) {
	var msp = {};
	msp.id = name;
	msp.rootCerts = readAllFiles(path.join(__dirname, mspdir, 'cacerts'));
	msp.admins = readAllFiles(path.join(__dirname, mspdir, 'admincerts'));
	return msp;
}
module.exports.loadMSPConfig = loadMSPConfig;

function readAllFiles(dir) {
	var files = fs.readdirSync(dir);
	var certs = [];
	files.forEach((file_name) => {
		let file_path = path.join(dir,file_name);
		console.debug(' looking at file ::'+file_path);
		let data = fs.readFileSync(file_path);
		certs.push(data);
	});
	return certs;
}
module.exports.readAllFiles = readAllFiles;
