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
'use strict';
var log4js = require('log4js');
var logger = log4js.getLogger('Helper');
var path = require('path');
var util = require('util');
var fs = require('fs');
var User = require('fabric-client/lib/User.js');
var crypto = require('crypto');
var Orderer = require('fabric-client/lib/Orderer.js');
var Peer = require('fabric-client/lib/Peer.js');
var copService = require('fabric-ca-client/lib/FabricCAClientImpl.js');
var FabricCAClient = copService.FabricCAClient;
var config = require('../config.json');
var hfc = require('fabric-client');
hfc.addConfigFile(path.join(__dirname, 'network-config.json'));
var ORGS = hfc.getConfigSetting('network-config');
logger.setLevel('DEBUG');
var client1 = new hfc();
var chain1 = client1.newChain(config.channelName);
var client2 = new hfc();
var chain2 = client2.newChain(config.channelName);
exports.client1 = client1;
exports.client1 = client2;
exports.chain1 = chain1;
exports.chain2 = chain2;
// need to enroll it with CA server
var caClient;
var setupOrderer = function() {
	let chains = [chain1, chain2];
	chains.forEach(function(chain) {
		if (chain.getOrderers().length === 0) {
			chain.addOrderer(getOrderer());
		} else {
			var ordererList = chain.getOrderers();
			let found = false;
			for (let key in ordererList) {
				if (ordererList[key]._url === config.orderer) {
					found = true;
				}
			}
			if (!found) {
				chain.addOrderer(getOrderer());
			}
		}
	});
};
var getTarget = function(targets, peer) {
	for (let key in targets) {
		if (targets[key]._endpoint.addr === peer) {
			return targets[key];
		}
	}
};
var setupPeers = function(chain, peers, targets) {
	if (chain.getPeers().length === 0) {
		for (let index in targets) {
			chain.addPeer(targets[index]);
		}
	} else {
		var peersList = chain.getPeers();
		for (let index in peers) {
			let found = false;
			for (let key in peersList) {
				if (peersList[key]._endpoint.addr === peers[index]) {
					found = true;
				}
			}
			if (!found) {
				let target = getTarget(targets, peers[index]);
				chain.addPeer(target);
			}
		}
	}
};
var getChainForOrg = function(orgName) {
	if (orgName === config.orgsList[0]) {
		return chain1;
	} else if (orgName === config.orgsList[1]) {
		return chain2;
	}
};
var clientForOrg = function(orgName) {
	if (orgName === config.orgsList[0]) {
		return client1;
	} else if (orgName === config.orgsList[1]) {
		return client2;
	}
};
var getTargets = function(peers, org) {
	var targets = [];
	for (let index in peers) {
		for (let key in ORGS[org]) {
			if (ORGS[org].hasOwnProperty(key)) {
				//FIXME: Can we think a better solution here ?
				if (key.indexOf('peer') === 0 && ORGS[org][key]['requests'] === 'grpcs://' +
					peers[index]) {
					let data = fs.readFileSync(path.join(__dirname, ORGS[org][key][
						'tls_cacerts'
					]));
					targets.push(new Peer('grpcs://' + peers[index], {
						pem: Buffer.from(data).toString(),
						'ssl-target-name-override': ORGS[org][key]['server-hostname']
					}));
				}
			}
		}
	}
	return targets;
};
var getMspID = function(orgName) {
	logger.debug('Msp ID : ' + ORGS[orgName].mspid);
	return ORGS[orgName].mspid;
};
var setCaClient = function(userOrg) {
	var caUrl = ORGS[userOrg].ca;
	caClient = new copService(caUrl);
};
var tlsOptions = {
	trustedRoots: [],
	verify: false
};
var getAdminUser = function(userOrg) {
	var users = config.users;
	var username = users[0].username;
	var password = users[0].secret;
	var member;
	var client = clientForOrg(userOrg);
	return hfc.newDefaultKeyValueStore({
		path: getKeyStoreForOrg(getOrgName(userOrg))
	}).then((store) => {
		client.setStateStore(store);
		//NOTE: This workaround is required to be able to switch user context
		// in the client instance
		client._userContext = null;
		return client.getUserContext(username).then((user) => {
			if (user && user.isEnrolled()) {
				logger.info('Successfully loaded member from persistence');
				return user;
			} else {
				setCaClient(userOrg);
				// need to enroll it with CA server
				return caClient.enroll({
					enrollmentID: username,
					enrollmentSecret: password
				}).then((enrollment) => {
					logger.info('Successfully enrolled user \'' + username + '\'');
					member = new User(username, client);
					return member.setEnrollment(enrollment.key, enrollment.certificate,
						getMspID(userOrg));
				}).then(() => {
					return client.setUserContext(member);
				}).then(() => {
					return member;
				}).catch((err) => {
					logger.error('Failed to enroll and persist user. Error: ' + err.stack ?
						err.stack : err);
					return null;
				});
			}
		});
	});
};
var getRegisteredUsers = function(username, userOrg, isJson) {
	var member;
	var client = clientForOrg(userOrg);
	var cop = new copService(ORGS[userOrg].ca, tlsOptions, {
		keysize: 256,
		hash: 'SHA2'
	});
	var enrollmentSecret = null;
	return hfc.newDefaultKeyValueStore({
		path: getKeyStoreForOrg(getOrgName(userOrg))
	}).then((store) => {
		client.setStateStore(store);
		//NOTE: Temporary workaround, as of alpha this is not fixed in node
		client._userContext = null;
		return client.getUserContext(username).then((user) => {
			if (user && user.isEnrolled()) {
				logger.info('Successfully loaded member from persistence');
				return user;
			} else {
				setCaClient(userOrg);
				return getAdminUser(userOrg).then(function(adminUserObj) {
					member = adminUserObj;
					return cop.register({
						enrollmentID: username,
						affiliation: userOrg + '.department1'
					}, member);
				}).then((secret) => {
					enrollmentSecret = secret;
					logger.debug(username + ' registered successfully');
					return cop.enroll({
						enrollmentID: username,
						enrollmentSecret: secret
					});
				}, (err) => {
					logger.debug(username + ' failed to register');
					return '' + err;
					//return 'Failed to register '+username+'. Error: ' + err.stack ? err.stack : err;
				}).then((message) => {
					if (message && typeof message === 'string' && message.includes(
							'Error:')) {
						logger.error(username + ' enrollment failed');
						return message;
					}
					logger.debug(username + ' enrolled successfully');
					client.setUserContext(member);
					member = new User(username, client);
					member._enrollmentSecret = enrollmentSecret;
					return member.setEnrollment(message.key, message.certificate, ORGS[
						userOrg].mspid);
				}).then(() => {
					client.setUserContext(member);
					return member;
				}, (err) => {
					logger.error(username + ' enroll failed');
					return '' + err;
				});;
			}
		});
	}).then((user) => {
		if (isJson && isJson === true) {
			var response = {
				success: true,
				secret: user._enrollmentSecret,
				message: username + ' enrolled Successfully',
			};
			return response;
		}
		return user;
	}, (err) => {
		logger.error(username + ' enroll failed');
		return '' + err;
	});
};
var setupChaincodeDeploy = function() {
	process.env.GOPATH = path.join(__dirname, config.GOPATH);
};
var getLogger = function(moduleName) {
	var logger = log4js.getLogger(moduleName);
	logger.setLevel('DEBUG');
	return logger;
};
var getOrgName = function(org) {
	//logger.debug('Org name : ' + ORGS[org].name);
	return ORGS[org].name;
};
var getOrderer = function() {
	var caRootsPath = ORGS.orderer.tls_cacerts;
	let data = fs.readFileSync(path.join(__dirname, caRootsPath));
	let caroots = Buffer.from(data).toString();
	return new Orderer(config.orderer, {
		'pem': caroots,
		'ssl-target-name-override': ORGS.orderer['server-hostname']
	});
};
var getKeyStoreForOrg = function(org) {
	return config.keyValueStore + '_' + org;
};
var getArgs = function(chaincodeArgs) {
	var args = [];
	for (var i = 0; i < chaincodeArgs.length; i++) {
		args.push(chaincodeArgs[i]);
	}
	return args;
};
var getPeerAddressByName = function(org, peer) {
	var peerList = [];
	var address = ORGS[org][peer].requests;
	return address.split('grpcs://')[1];
};
var getNonce = function() {
	var length = hfc.getConfigSetting('nonce-size');
	var value = crypto.randomBytes(length);
	return value;
};
exports.getRegisteredUsers = getRegisteredUsers;
exports.getArgs = getArgs;
exports.getKeyStoreForOrg = getKeyStoreForOrg;
exports.getOrgName = getOrgName;
exports.getLogger = getLogger;
exports.setupChaincodeDeploy = setupChaincodeDeploy;
exports.getMspID = getMspID;
exports.ORGS = ORGS;
exports.setupOrderer = setupOrderer;
exports.getTargets = getTargets;
exports.getChainForOrg = getChainForOrg;
exports.clientForOrg = clientForOrg;
exports.setupPeers = setupPeers;
exports.getPeerAddressByName = getPeerAddressByName;
exports.getRegisteredUsers = getRegisteredUsers;
exports.getNonce = getNonce;
