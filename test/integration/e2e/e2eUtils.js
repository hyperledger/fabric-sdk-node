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
var logger = utils.getLogger('E2E testing');

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

function installChaincode(org, chaincode_path, version, t) {
	var client = new hfc();
	hfc.setConfigSetting('request-timeout', 30000);
	var chain = client.newChain(testUtil.END2END.channel);

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

				targets.push(peer);
				chain.addPeer(peer);
			}
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

		nonce = utils.getNonce();
		tx_id = hfc.buildTransactionID(nonce, the_user);

		// send proposal to endorser
		var request = {
			targets: targets,
			chaincodePath: chaincode_path,
			chaincodeId: e2e.chaincodeId,
			chaincodeVersion: version,
			txId: tx_id,
			nonce: nonce
		};

		return client.installChaincode(request);
	},
	(err) => {
		t.fail('Failed to enroll user \'admin\'. ' + err);
		throw new Error('Failed to enroll user \'admin\'. ' + err);
	}).then((results) => {
		var proposalResponses = results[0];

		var proposal = results[1];
		var header   = results[2];
		var all_good = true;
		for(var i in proposalResponses) {
			let one_good = false;
			if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
				one_good = true;
				logger.info('install proposal was good');
			} else {
				logger.error('install proposal was bad');
			}
			all_good = all_good & one_good;
		}
		if (all_good) {
			t.pass(util.format('Successfully sent install Proposal and received ProposalResponse: Status - %s', proposalResponses[0].response.status));
		} else {
			t.fail('Failed to send install Proposal or receive valid response. Response null or status is not 200. exiting...');
		}
	},
	(err) => {
		t.fail('Failed to send install proposal due to error: ' + err.stack ? err.stack : err);
		throw new Error('Failed to send install proposal due to error: ' + err.stack ? err.stack : err);
	});
}

module.exports.installChaincode = installChaincode;


function instantiateChaincode(org, chaincode_path, version, upgrade, t){
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
					logger.info('Disconnecting the event hub');
					eventhub.disconnect();
				}
			}

			f.apply(context, arguments);
		};
	})(t, eventhubs, t.end);

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

	var targets = [];
	all: for(let org in ORGS) {
		for (let key in ORGS[org]) {
			if (ORGS[org].hasOwnProperty(key)) {
				if (key.indexOf('peer') === 0) {
					let data = fs.readFileSync(path.join(__dirname, ORGS[org][key]['tls_cacerts']));
					logger.info(' create new peer %s', ORGS[org][key].requests);
					let peer = client.newPeer(
						ORGS[org][key].requests,
						{
							pem: Buffer.from(data).toString(),
							'ssl-target-name-override': ORGS[org][key]['server-hostname']
						}
					);

					targets.push(peer);
					chain.addPeer(peer);
					logger.info(' create new eventhub %s', ORGS[org][key].events);
					let eh = new EventHub();
					eh.setPeerAddr(
						ORGS[org][key].events,
						{
							pem: Buffer.from(data).toString(),
							'ssl-target-name-override': ORGS[org][key]['server-hostname']
						}
					);
					eh.connect();
					eventhubs.push(eh);
					break all;
				}
			}
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
			chaincodePath: chaincode_path,
			chaincodeId: e2e.chaincodeId,
			chaincodeVersion: version,
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
		if(!upgrade) {
			return chain.sendInstantiateProposal(request);
		}
		else {
			return chain.sendUpgradeProposal(request);
		}

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
			if (proposalResponses && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
				one_good = true;
				logger.info(type +' proposal was good');
			} else {
				logger.error(type +' proposal was bad');
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
						t.pass('The chaincode ' + type + ' transaction has been committed on peer '+ eh.ep._endpoint.addr);
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
				logger.info('register eventhub %s with tx=%s',eh.ep._endpoint.addr,tx_id);
				eventPromises.push(txPromise);
			});

			var sendPromise = chain.sendTransaction(request);
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

module.exports.instantiateChaincode = instantiateChaincode;


function invokeChaincode(org, version, t){
	var targets = [],
		eventhubs = [];

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
	})(t, eventhubs, t.end);

	// this is a transaction, will just use org's identity to
	// submit the request. intentionally we are using a different org
	// than the one that instantiated the chaincode, although either org
	// should work properly
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

		return chain.initialize();

	}).then((nothing) => {
		nonce = utils.getNonce();
		tx_id = hfc.buildTransactionID(nonce, the_user);
		utils.setConfigSetting('E2E_TX_ID', tx_id);
		logger.info('setConfigSetting("E2E_TX_ID") = %s', tx_id);
		t.comment(util.format('Sending transaction "%s"', tx_id));

		// send proposal to endorser
		var request = {
			chaincodeId : e2e.chaincodeId,
			chaincodeVersion : version,
			fcn: 'invoke',
			args: ['move', 'a', 'b','100'],
			chainId: e2e.channel,
			txId: tx_id,
			nonce: nonce
		};
		return chain.sendTransactionProposal(request);

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
				one_good = chain.verifyProposalResponse(proposal_response);
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
			all_good = chain.compareProposalResponseResults(proposalResponses);
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
						clearTimeout(handle);
						eh.unregisterTxEvent(deployId);

						if (code !== 'VALID') {
							t.fail('The balance transfer transaction was invalid, code = ' + code);
							reject();
						} else {
							t.pass('The balance transfer transaction has been committed on peer '+ eh.ep._endpoint.addr);
							resolve();
						}
					});
				});

				eventPromises.push(txPromise);
			});

			var sendPromise = chain.sendTransaction(request);
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
			t.comment('export E2E_TX_ID='+'\''+tx_id+'\'');
			t.comment('******************************************************************');
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

function queryChaincode(org, version, value, t){
	// this is a transaction, will just use org's identity to
	// submit the request. intentionally we are using a different org
	// than the one that submitted the "move" transaction, although either org
	// should work properly
	var client = new hfc();
	var chain = client.newChain(e2e.channel);

	var orgName = ORGS[org].name;

	var targets = [];
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
				});
			chain.addPeer(peer);
		}
	}

	return hfc.newDefaultKeyValueStore({
		path: testUtil.storePathForOrg(orgName)
	}).then((store) => {

		client.setStateStore(store);
		return testUtil.getSubmitter(client, t, org);

	}).then((admin) => {
		the_user = admin;

		nonce = utils.getNonce();
		tx_id = hfc.buildTransactionID(nonce, the_user);

		// send query
		var request = {
			chaincodeId : e2e.chaincodeId,
			chaincodeVersion : version,
			chainId: e2e.channel,
			txId: tx_id,
			nonce: nonce,
			fcn: 'invoke',
			args: ['query','b']
		};
		return chain.queryByChaincode(request);
	},
	(err) => {
		t.comment('Failed to get submitter \'admin\'');
		t.fail('Failed to get submitter \'admin\'. Error: ' + err.stack ? err.stack : err );
		throw new Error('Failed to get submitter');
	}).then((response_payloads) => {
		if (response_payloads) {
			for(let i = 0; i < response_payloads.length; i++) {
				t.equal(response_payloads[i].toString('utf8'),value,'checking query results are correct that user b has '+ value + ' now after the move');
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
