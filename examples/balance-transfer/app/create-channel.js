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
var fs = require('fs');
var path = require('path');
var config = require('../config.json');
var helper = require('./helper.js');
var logger = helper.getLogger('Create-Channel');
//Attempt to send a request to the orderer with the sendCreateChain method
var createChannel = function(channelName, channelConfigPath, username, orgName) {
	logger.debug('\n====== Creating Channel \'' + channelName + '\' ======\n');
	helper.setupOrderer();
	var chain = helper.getChainForOrg(orgName);
	//Acting as a client in the given organization provided with "orgName" param
	return helper.getRegisteredUsers(username, orgName).then((member) => {
		logger.debug('Successfully enrolled user \''+username+'\'');
		// readin the envelope to send to the orderer
		var request = {
			envelope: fs.readFileSync(path.join(__dirname, channelConfigPath))
		};
		// send to orderer
		return chain.createChannel(request);
	}, (err) => {
		logger.error('Failed to enroll user \''+username+'\'. Error: ' + err);
		throw new Error('Failed to enroll user \''+username+'\'' + err);
	}).then((response) => {
		logger.debug(' response ::%j', response);
		if (response && response.status === 'SUCCESS') {
			logger.debug('Successfully created the channel.');
			let response = {
				success: true,
				message: 'Channel \'' + channelName + '\' created Successfully'
			};
		  return response;
		} else {
			logger.error('\n!!!!!!!!! Failed to create the channel \'' + channelName +
				'\' !!!!!!!!!\n\n');
			throw new Error('Failed to create the channel \'' + channelName + '\'');
		}
	}, (err) => {
		logger.error('Failed to initialize the channel: ' + err.stack ? err.stack :
			err);
		throw new Error('Failed to initialize the channel: ' + err.stack ? err.stack : err);
	});
};

exports.createChannel = createChannel;
