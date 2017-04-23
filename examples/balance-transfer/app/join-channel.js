/**
 * Copyright 2017 IBM All Rights Reserved.
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
var util = require('util');
var path = require('path');
var fs = require('fs');
var grpc = require('grpc');
var utils = require('fabric-client/lib/utils.js');
var Peer = require('fabric-client/lib/Peer.js');
var EventHub = require('fabric-client/lib/EventHub.js');
var user = null;
var tx_id = null;
var nonce = null;
var config = require('../config.json');
var helper = require('./helper.js');
var logger = helper.getLogger('Join-Channel');
//helper.hfc.addConfigFile(path.join(__dirname, 'network-config.json'));
var ORGS = helper.ORGS;
var allEventhubs = [];
var _commonProto = grpc.load(path.join(__dirname,
	'../node_modules/fabric-client/lib/protos/common/common.proto')).common;
//
//Attempt to send a request to the orderer with the sendCreateChain method
//
var joinChannel = function(channelName, peers, username, org) {
	// on process exit, always disconnect the event hub
	var closeConnections = function(isSuccess) {
		if (isSuccess) {
			logger.debug('\n============ Join Channel is SUCCESS ============\n');
		} else {
			logger.debug('\n!!!!!!!! ERROR: Join Channel FAILED !!!!!!!!\n');
		}
		logger.debug('');
		for (var key in allEventhubs) {
			var eventhub = allEventhubs[key];
			if (eventhub && eventhub.isconnected()) {
				//logger.debug('Disconnecting the event hub');
				eventhub.disconnect();
			}
		}
	};
	//logger.debug('\n============ Join Channel ============\n')
	logger.info(util.format(
		'Calling peers in organization "%s" to join the channel', org));
	helper.setupOrderer();
	var chain = helper.getChainForOrg(org);
	var targets = helper.getTargets(peers, org);
	var eventhubs = [];
	for (let key in ORGS[org]) {
		if (ORGS[org].hasOwnProperty(key)) {
			if (key.indexOf('peer') === 0) {
				let data = fs.readFileSync(path.join(__dirname, ORGS[org][key][
					'tls_cacerts'
				]));
				let eh = new EventHub();
				eh.setPeerAddr(ORGS[org][key].events, {
					pem: Buffer.from(data).toString(),
					'ssl-target-name-override': ORGS[org][key]['server-hostname']
				});
				eh.connect();
				eventhubs.push(eh);
				allEventhubs.push(eh);
			}
		}
	}
	return helper.getRegisteredUsers(username, org).then((member) => {
		logger.info('received member object for user : ' + username);
		user = member;
		nonce = utils.getNonce();
		tx_id = chain.buildTransactionID(nonce, user);
		var request = {
			targets: targets,
			txId: tx_id,
			nonce: nonce
		};
		var eventPromises = [];
		eventhubs.forEach((eh) => {
			let txPromise = new Promise((resolve, reject) => {
				let handle = setTimeout(reject, parseInt(config.eventWaitTime));
				eh.registerBlockEvent((block) => {
					clearTimeout(handle);
					// in real-world situations, a peer may have more than one channels so
					// we must check that this block came from the channel we asked the peer to join
					if (block.data.data.length === 1) {
						// Config block must only contain one transaction
						var envelope = _commonProto.Envelope.decode(block.data.data[0]);
						var payload = _commonProto.Payload.decode(envelope.payload);
						var channel_header = _commonProto.ChannelHeader.decode(payload.header
							.channel_header);
						if (channel_header.channel_id === config.channelName) {
							logger.info('The channel \'' + config.channelName +
								'\' has been successfully joined on peer ' + eh.ep._endpoint.addr
							);
							resolve();
						}
					}
				});
			});
			eventPromises.push(txPromise);
		});
		let sendPromise = chain.joinChannel(request);
		return Promise.all([sendPromise].concat(eventPromises));
	}, (err) => {
		logger.error('Failed to enroll user \'' + username + '\' due to error: ' +
			err.stack ? err.stack : err);
		throw new Error('Failed to enroll user \'' + username +
			'\' due to error: ' + err.stack ? err.stack : err);
	}).then((results) => {
		logger.debug(util.format('Join Channel R E S P O N S E : %j', results));
		if (results[0] && results[0][0] && results[0][0].response && results[0][0]
			.response.status == 200) {
			logger.info(util.format(
				'Successfully joined peers in organization %s to the channel \'%s\'',
				org, channelName));
			closeConnections(true);
			let response = {
				success: true,
				message: util.format(
					'Successfully joined peers in organization %s to the channel \'%s\'',
					org, channelName)
			};
			return response;
		} else {
			logger.error(' Failed to join channel');
			closeConnections();
			throw new Error('Failed to join channel');
		}
	}, (err) => {
		logger.error('Failed to join channel due to error: ' + err.stack ? err.stack :
			err);
		closeConnections();
		throw new Error('Failed to join channel due to error: ' + err.stack ? err.stack :
			err);
	});
};
exports.joinChannel = joinChannel;
