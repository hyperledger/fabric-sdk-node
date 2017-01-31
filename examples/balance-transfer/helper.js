/**
 * Copyright 2016 IBM All Rights Reserved.
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

var User = require('fabric-client/lib/User.js');
var utils = require('fabric-client/lib/utils.js');
var copService = require('fabric-ca-client/lib/FabricCAClientImpl.js');

var config = require('./config.json');

logger.setLevel('DEBUG');

module.exports.getSubmitter = function(client) {
	var users = config.users;
	var username = users[0].username;
	var password = users[0].secret;
	var member;
	return client.getUserContext(username)
		.then((user) => {
			if (user && user.isEnrolled()) {
				logger.info('Successfully loaded member from persistence');
				return user;
			} else {
				var ca_client = new copService(config.caserver.ca_url);
				// need to enroll it with CA server
				return ca_client.enroll({
					enrollmentID: username,
					enrollmentSecret: password
				}).then((enrollment) => {
					logger.info('Successfully enrolled user \'' + username + '\'');

					member = new User(username, client);
					return member.setEnrollment(enrollment.key, enrollment.certificate);
				}).then(() => {
					return client.setUserContext(member);
				}).then(() => {
					return member;
				}).catch((err) => {
					logger.error('Failed to enroll and persist user. Error: ' + err.stack ? err.stack : err);
					throw new Error('Failed to obtain an enrolled user');
				});
			}
		});
};
module.exports.processProposal = function(chain, results, proposalType) {
	var proposalResponses = results[0];
	//logger.debug('deploy proposalResponses:'+JSON.stringify(proposalResponses));
	var proposal = results[1];
	var header = results[2];
	var all_good = true;
	for (var i in proposalResponses) {
		let one_good = false;
		if (proposalResponses && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
			one_good = true;
			logger.info(proposalType + ' proposal was good');
		} else {
			logger.error(proposalType + ' proposal was bad');
		}
		all_good = all_good & one_good;
		//FIXME:  App is supposed to check below things:
		// validate endorser certs, verify endorsement signature, and compare the WriteSet among the responses
		// to make sure they are consistent across all endorsers.
		// SDK will be enhanced to make these checks easier to perform.
	}
	if (all_good) {
		if (proposalType == 'deploy') {
			logger.info(util.format('Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s', proposalResponses[0].response.status, proposalResponses[0].response.message, proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));
		} else {
			logger.info('Successfully obtained transaction endorsements.');
		}
		var request = {
			proposalResponses: proposalResponses,
			proposal: proposal,
			header: header
		};
		return chain.sendTransaction(request);
	} else {
		logger.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
		throw new Error('Problems happened when examining proposal responses');
	}
};

module.exports.getArgs = function(chaincodeArgs) {
	var args = [];
	for (var i = 0; i < chaincodeArgs.length; i++) {
		args.push(chaincodeArgs[i]);
	}
	return args;
};

module.exports.getTxId = function() {
	return utils.buildTransactionID({
		length: 12
	});
};
