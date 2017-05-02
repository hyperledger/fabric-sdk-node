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
var path = require('path');
var fs = require('fs');
var util = require('util');
var hfc = require('fabric-client');
var Peer = require('fabric-client/lib/Peer.js');
var EventHub = require('fabric-client/lib/EventHub.js');
var config = require('../config.json');
var helper = require('./helper.js');
var logger = helper.getLogger('Query');
var tx_id = null;
var nonce = null;
var member = null;
var queryChaincode = function(peer, channelName, chaincodeName,
	chaincodeVersion, args, username, org) {
	var peers = [];
	peers.push(helper.getPeerAddressByName(org, peer));
	var chain = helper.getChainForOrg(org);
	var targets = helper.getTargets(peers, org);
	helper.setupPeers(chain, peers, targets);
	return helper.getRegisteredUsers(username, org).then((user) => {
		member = user;
		nonce = helper.getNonce();
		tx_id = chain.buildTransactionID(nonce, member);
		// send query
		var request = {
			targets: targets,
			chaincodeId: chaincodeName,
			chaincodeVersion: chaincodeVersion,
			chainId: channelName,
			txId: tx_id,
			nonce: nonce,
			fcn: config.functionName,
			args: helper.getArgs(args)
		};
		return chain.queryByChaincode(request);
	}, (err) => {
		logger.info('Failed to get submitter \''+username+'\'');
		return 'Failed to get submitter \''+username+'\'. Error: ' + err.stack ? err.stack :
			err;
	}).then((response_payloads) => {
		if (response_payloads) {
			for (let i = 0; i < response_payloads.length; i++) {
				logger.info('User b now has ' + response_payloads[i].toString('utf8') +
					' after the move');
				return 'User b now has ' + response_payloads[i].toString('utf8') +
					' after the move';
			}
		} else {
			logger.error('response_payloads is null');
			return 'response_payloads is null';
		}
	}, (err) => {
		logger.error('Failed to send query due to error: ' + err.stack ? err.stack :
			err);
		return 'Failed to send query due to error: ' + err.stack ? err.stack : err;
	}).catch((err) => {
		logger.error('Failed to end to end test with error:' + err.stack ? err.stack :
			err);
		return 'Failed to end to end test with error:' + err.stack ? err.stack :
			err;
	});
};
var getBlockByNumber = function(peer, blockNumber, username, org) {
	var peers = [];
	peers.push(helper.getPeerAddressByName(org, peer));
	var chain = helper.getChainForOrg(org);
	var targets = helper.getTargets(peers, org);
	helper.setupPeers(chain, peers, targets);
	return helper.getRegisteredUsers(username, org).then((member) => {
		adminUser = member;
		return chain.queryBlock(parseInt(blockNumber));
	}, (err) => {
		logger.info('Failed to get submitter "' + username + '"');
		return 'Failed to get submitter "' + username + '". Error: ' + err.stack ?
			err.stack : err;
	}).then((response_payloads) => {
		if (response_payloads) {
			//logger.debug(response_payloads);
			logger.debug(response_payloads);
			return response_payloads; //response_payloads.data.data[0].buffer;
		} else {
			logger.error('response_payloads is null');
			return 'response_payloads is null';
		}
	}, (err) => {
		logger.error('Failed to send query due to error: ' + err.stack ? err.stack :
			err);
		return 'Failed to send query due to error: ' + err.stack ? err.stack : err;
	}).catch((err) => {
		logger.error('Failed to query with error:' + err.stack ? err.stack : err);
		return 'Failed to query with error:' + err.stack ? err.stack : err;
	});
};
var getTransactionByID = function(peer, trxnID, username, org) {
	var peers = [];
	peers.push(helper.getPeerAddressByName(org, peer));
	var chain = helper.getChainForOrg(org);
	var targets = helper.getTargets(peers, org);
	helper.setupPeers(chain, peers, targets);
	return helper.getRegisteredUsers(username, org).then((member) => {
		adminUser = member;
		return chain.queryTransaction(trxnID);
	}, (err) => {
		logger.info('Failed to get submitter "' + username + '"');
		return 'Failed to get submitter "' + username + '". Error: ' + err.stack ?
			err.stack : err;
	}).then((response_payloads) => {
		if (response_payloads) {
			logger.debug(response_payloads);
			return response_payloads;
		} else {
			logger.error('response_payloads is null');
			return 'response_payloads is null';
		}
	}, (err) => {
		logger.error('Failed to send query due to error: ' + err.stack ? err.stack :
			err);
		return 'Failed to send query due to error: ' + err.stack ? err.stack : err;
	}).catch((err) => {
		logger.error('Failed to query with error:' + err.stack ? err.stack : err);
		return 'Failed to query with error:' + err.stack ? err.stack : err;
	});
};
var getBlockByHash = function(peer, hash, username, org) {
	var peers = [];
	peers.push(helper.getPeerAddressByName(org, peer));
	var chain = helper.getChainForOrg(org);
	var targets = helper.getTargets(peers, org);
	helper.setupPeers(chain, peers, targets);
	return helper.getRegisteredUsers(username, org).then((member) => {
		adminUser = member;
		//chain.setPrimaryPeer(targets[0]);
		return chain.queryBlockByHash(Buffer.from(hash));
	}, (err) => {
		logger.info('Failed to get submitter "' + username + '"');
		return 'Failed to get submitter "' + username + '". Error: ' + err.stack ?
			err.stack : err;
	}).then((response_payloads) => {
		if (response_payloads) {
			logger.debug(response_payloads);
			return response_payloads;
		} else {
			logger.error('response_payloads is null');
			return 'response_payloads is null';
		}
	}, (err) => {
		logger.error('Failed to send query due to error: ' + err.stack ? err.stack :
			err);
		return 'Failed to send query due to error: ' + err.stack ? err.stack : err;
	}).catch((err) => {
		logger.error('Failed to query with error:' + err.stack ? err.stack : err);
		return 'Failed to query with error:' + err.stack ? err.stack : err;
	});
};
var getChainInfo = function(peer, username, org) {
	var peers = [];
	peers.push(helper.getPeerAddressByName(org, peer));
	var chain = helper.getChainForOrg(org);
	var targets = helper.getTargets(peers, org);
	helper.setupPeers(chain, peers, targets);
	return helper.getRegisteredUsers(username, org).then((member) => {
		adminUser = member;
		//chain.setPrimaryPeer(targets[0]);
		return chain.queryInfo();
	}, (err) => {
		logger.info('Failed to get submitter "' + username + '"');
		return 'Failed to get submitter "' + username + '". Error: ' + err.stack ?
			err.stack : err;
	}).then((blockchainInfo) => {
		if (blockchainInfo) {
			// FIXME: Save this for testing 'getBlockByHash'  ?
			logger.debug('===========================================');
			logger.debug(blockchainInfo.currentBlockHash);
			logger.debug('===========================================');
			//logger.debug(blockchainInfo);
			return blockchainInfo;
		} else {
			logger.error('response_payloads is null');
			return 'response_payloads is null';
		}
	}, (err) => {
		logger.error('Failed to send query due to error: ' + err.stack ? err.stack :
			err);
		return 'Failed to send query due to error: ' + err.stack ? err.stack : err;
	}).catch((err) => {
		logger.error('Failed to query with error:' + err.stack ? err.stack : err);
		return 'Failed to query with error:' + err.stack ? err.stack : err;
	});
};
//getInstalledChaincodes
var getInstalledChaincodes = function(peer, installed, username, org) {
	var peers = [];
	peers.push(helper.getPeerAddressByName(org, peer));
	var chain = helper.getChainForOrg(org);
	var targets = helper.getTargets(peers, org);
	helper.setupPeers(chain, peers, targets);
	return helper.getRegisteredUsers(username, org).then((member) => {
		peers.push(helper.getPeerAddressByName(org, peer));
		adminUser = member;
		//chain.setPrimaryPeer(targets[0]);
		//TODO: move this to contants
		if (installed === 'installed') {
			return chain.queryInstalledChaincodes(targets[0]);
		} else {
			return chain.queryInstantiatedChaincodes();
		}
	}, (err) => {
		logger.info('Failed to get submitter "' + username + '"');
		return 'Failed to get submitter "' + username + '". Error: ' + err.stack ?
			err.stack : err;
	}).then((response) => {
		if (response) {
			if (installed === 'true') {
				logger.debug('<<< Installed Chaincodes >>>');
			} else {
				logger.debug('<<< Instantiated Chaincodes >>>');
			}
			var details = [];
			for (let i = 0; i < response.chaincodes.length; i++) {
				logger.debug('name: ' + response.chaincodes[i].name + ', version: ' +
					response.chaincodes[i].version + ', path: ' + response.chaincodes[i].path
				);
				details.push('name: ' + response.chaincodes[i].name + ', version: ' +
					response.chaincodes[i].version + ', path: ' + response.chaincodes[i].path
				);
			}
			return details;
		} else {
			logger.error('response is null');
			return 'response is null';
		}
	}, (err) => {
		logger.error('Failed to send query due to error: ' + err.stack ? err.stack :
			err);
		return 'Failed to send query due to error: ' + err.stack ? err.stack : err;
	}).catch((err) => {
		logger.error('Failed to query with error:' + err.stack ? err.stack : err);
		return 'Failed to query with error:' + err.stack ? err.stack : err;
	});
};
var getChannels = function(peer, username, org) {
	var peers = [];
	peers.push(helper.getPeerAddressByName(org, peer));
	var chain = helper.getChainForOrg(org);
	var targets = helper.getTargets(peers, org);
	helper.setupPeers(chain, peers, targets);
	return helper.getRegisteredUsers(username, org).then((member) => {
		adminUser = member;
		//chain.setPrimaryPeer(targets[0]);
		return chain.queryChannels(targets[0]);
	}, (err) => {
		logger.info('Failed to get submitter "' + username + '"');
		return 'Failed to get submitter "' + username + '". Error: ' + err.stack ?
			err.stack : err;
	}).then((response) => {
		if (response) {
			logger.debug('<<< channels >>>');
			var channelNames = [];
			for (let i = 0; i < response.channels.length; i++) {
				channelNames.push('channel id: ' + response.channels[i].channel_id);
			}
			logger.debug(channelNames);
			return response;
		} else {
			logger.error('response_payloads is null');
			return 'response_payloads is null';
		}
	}, (err) => {
		logger.error('Failed to send query due to error: ' + err.stack ? err.stack :
			err);
		return 'Failed to send query due to error: ' + err.stack ? err.stack : err;
	}).catch((err) => {
		logger.error('Failed to query with error:' + err.stack ? err.stack : err);
		return 'Failed to query with error:' + err.stack ? err.stack : err;
	});
};
exports.queryChaincode = queryChaincode;
exports.getBlockByNumber = getBlockByNumber;
exports.getTransactionByID = getTransactionByID;
exports.getBlockByHash = getBlockByHash;
exports.getChainInfo = getChainInfo;
exports.getInstalledChaincodes = getInstalledChaincodes;
exports.getChannels = getChannels;
