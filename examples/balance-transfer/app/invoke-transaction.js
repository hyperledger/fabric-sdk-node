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
'use strict';
var path = require('path');
var fs = require('fs');
var util = require('util');
var hfc = require('fabric-client');
var Peer = require('fabric-client/lib/Peer.js');
var config = require('../config.json');
var helper = require('./helper.js');
var logger = helper.getLogger('invoke-chaincode');
var EventHub = require('fabric-client/lib/EventHub.js');
hfc.addConfigFile(path.join(__dirname, 'network-config.json'));
var ORGS = hfc.getConfigSetting('network-config');
var tx_id = null;
var nonce = null;
var member = null;
var eventhubs = {};

function getHostnameByPeerAddress(org, peers) {
	var orgDetails = ORGS[org];
	var result = [];
	for (let index in peers) {
		for (let key in orgDetails) {
			if (orgDetails.hasOwnProperty(key) && key.indexOf('peer') == 0 && orgDetails[
					key].requests.indexOf(peers[index]) >= 0) {
				result.push(key);
			}
		}
	}
	return result;
};
var registerEventHub = function(org, peers) {
	var peerHosts = getHostnameByPeerAddress(org, peers);
	for (var index in peerHosts) {
		let eh = new EventHub();
		let data = fs.readFileSync(path.join(__dirname, ORGS[org][peerHosts[index]][
			'tls_cacerts'
		]));
		eh.setPeerAddr(ORGS[org][peerHosts[index]]['events'], {
			pem: Buffer.from(data).toString(),
			'ssl-target-name-override': ORGS[org][peerHosts[index]]['server-hostname']
		});
		eh.connect();
		eventhubs[org + peerHosts[index]] = eh;
	}
};
var invokeChaincode = function(peers, channelName, chaincodeName,
	chaincodeVersion, args, username, org) {
	logger.debug('\n============ invoke transaction on organization ' + org +
		' ============\n');
	var chain = helper.getChainForOrg(org);
	helper.setupOrderer();
	var targets = helper.getTargets(peers, org);
	helper.setupPeers(chain, peers, targets);
	var peerHosts = getHostnameByPeerAddress(org, peers);
	peers.forEach(function(peer) {
		let peerEh = eventhubs[org + peer];
		if (!peerEh) {
			registerEventHub(org, peers);
		}
	});
	return helper.getRegisteredUsers(username, org).then((user) => {
		member = user;
		nonce = helper.getNonce();
		tx_id = chain.buildTransactionID(nonce, member);
		hfc.setConfigSetting('E2E_TX_ID', tx_id);
		logger.info('setConfigSetting("E2E_TX_ID") = %s', tx_id);
		logger.debug(util.format('Sending transaction "%s"', tx_id));
		// send proposal to endorser
		var request = {
			targets: targets,
			chaincodeId: chaincodeName,
			fcn: config.invokeQueryFcnName,
			args: helper.getArgs(args),
			chainId: channelName,
			txId: tx_id,
			nonce: nonce
		};
		return chain.sendTransactionProposal(request);
	}, (err) => {
		logger.error('Failed to enroll user \'' + username + '\'. ' + err);
		throw new Error('Failed to enroll user \'' + username + '\'. ' + err);
	}).then((results) => {
		var proposalResponses = results[0];
		var proposal = results[1];
		var header = results[2];
		var all_good = true;
		for (var i in proposalResponses) {
			let one_good = false;
			if (proposalResponses && proposalResponses[0].response &&
				proposalResponses[0].response.status === 200) {
				one_good = true;
				logger.info('transaction proposal was good');
			} else {
				logger.error('transaction proposal was bad');
			}
			all_good = all_good & one_good;
		}
		if (all_good) {
			logger.debug(util.format(
				'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s',
				proposalResponses[0].response.status, proposalResponses[0].response.message,
				proposalResponses[0].response.payload, proposalResponses[0].endorsement
				.signature));
			var request = {
				proposalResponses: proposalResponses,
				proposal: proposal,
				header: header
			};
			// set the transaction listener and set a timeout of 30sec
			// if the transaction did not get committed within the timeout period,
			// fail the test
			var transactionID = tx_id.toString();
			var eventPromises = [];
			for (let key in eventhubs) {
				let eh = eventhubs[key];
				let txPromise = new Promise((resolve, reject) => {
					let handle = setTimeout(reject, 30000);
					eh.registerTxEvent(transactionID.toString(), (tx, code) => {
						clearTimeout(handle);
						eh.unregisterTxEvent(transactionID);
						if (code !== 'VALID') {
							logger.error(
								'The balance transfer transaction was invalid, code = ' + code);
							reject();
						} else {
							logger.info(
								'The balance transfer transaction has been committed on peer ' +
								eh.ep._endpoint.addr);
							resolve();
						}
					});
				});
				eventPromises.push(txPromise);
			};
			var sendPromise = chain.sendTransaction(request);
			return Promise.all([sendPromise].concat(eventPromises)).then((results) => {
				logger.debug(' event promise all complete and testing complete');
				return results[0]; // the first returned value is from the 'sendPromise' which is from the 'sendTransaction()' call
			}).catch((err) => {
				logger.error(
					'Failed to send transaction and get notifications within the timeout period.'
				);
				return 'Failed to send transaction and get notifications within the timeout period.';
			});
		} else {
			logger.error(
				'Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...'
			);
			return 'Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...';
		}
	}, (err) => {
		logger.error('Failed to send proposal due to error: ' + err.stack ? err.stack :
			err);
		return 'Failed to send proposal due to error: ' + err.stack ? err.stack :
			err;
	}).then((response) => {
		if (response.status === 'SUCCESS') {
			logger.info('Successfully sent transaction to the orderer.');
			logger.debug(
				'******************************************************************');
			logger.debug('E2E_TX_ID=' + '\'' + tx_id + '\'');
			logger.debug(
				'******************************************************************');
			return tx_id;
		} else {
			logger.error('Failed to order the transaction. Error code: ' + response.status);
			return 'Failed to order the transaction. Error code: ' + response.status;
		}
	}, (err) => {
		logger.error('Failed to send transaction due to error: ' + err.stack ? err
			.stack : err);
		return 'Failed to send transaction due to error: ' + err.stack ? err.stack :
			err;
	});
};
exports.invokeChaincode = invokeChaincode;
