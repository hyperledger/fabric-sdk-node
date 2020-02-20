/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const channel_util = require('../lib/channel');
const chaincode_util = require('../lib/chaincode');
const CCP = require('../lib/common_connection');
const testUtil = require('../lib/utils');

const path = require('path');

const cryptoRoot = '../../../fixtures/crypto-material';
const configRoot = '../../config';
const channelRoot = cryptoRoot + '/channel-config';
const ccpPath = configRoot + '/ccp.json';
const tlsCcpPath = configRoot + '/ccp-tls.json';
const policiesPath = configRoot + '/policies.json';

module.exports = function () {
	this.Given(/^I put a log message (.+?)$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (message) => {

		testUtil.logMsg('\n\n\n**********************************************************************************');
		testUtil.logMsg('**********************************************************************************');
		testUtil.logMsg(`****** ${message} ******`);
		testUtil.logMsg('**********************************************************************************');
		testUtil.logMsg('**********************************************************************************\n\n\n');

	});

	this.Given(/^I update channel with name (.+?) with config file (.+?) from the (.+?) common connection profile/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (channelName, txFileName, tlsType) => {
		if (tlsType.localeCompare('non-tls') === 0) {
			const profile =  new CCP(path.join(__dirname, ccpPath), true);
			return channel_util.update_channel(profile, channelName, path.join(channelRoot, txFileName), false);
		} else {
			const profile =  new CCP(path.join(__dirname, tlsCcpPath), true);
			return channel_util.update_channel(profile, channelName, path.join(channelRoot, txFileName), true);
		}
	});

	this.Given(/^I have created and joined all channels from the (.+?) common connection profile$/, {timeout: testUtil.TIMEOUTS.MED_STEP}, async (tlsType) => {
		let tls;
		let profile;

		if (tlsType.localeCompare('non-tls') === 0) {
			tls = false;
			profile = new CCP(path.join(__dirname, ccpPath), true);
		} else {
			tls = true;
			profile = new CCP(path.join(__dirname, tlsCcpPath), true);
		}

		try {
			// Determine which channels should be created/joint
			const jointChannels = await channel_util.existing_channels(profile, tls);
			const ccpChannels = profile.getChannels();
			const channels = [];
			for (const channelName in ccpChannels) {
				if (jointChannels.indexOf(channelName) === -1) {
					testUtil.logMsg(`Adding channel ${channelName} to list of channels to be created`);
					channels.push(channelName);
				}
			}

			// Create and join any channels identified
			for (const channelName of channels) {
				// Create
				await channel_util.create_channel(path.join(__dirname, channelRoot), profile, tls, channelName);

				// Join all orgs to the channel
				const channel = profile.getChannel(channelName);
				const orgs = profile.getOrganizations();
				for (const orgName in orgs) {
					const org = profile.getOrganization(orgName);
					const orgPeers = org.peers;
					if (Object.keys(channel.peers).some((peerName) => orgPeers.includes(peerName))) {
						await channel_util.join_channel(profile, tls, channelName, orgName);
					}
				}
			}
			return Promise.resolve();
		} catch (err) {
			return Promise.reject(err);
		}
	});

	this.Given(/^I force install\/instantiate (.+?) chaincode named (.+?) at version (.+?) as (.+?) to the (.+?) Fabric network for all organizations on channel (.+?) with endorsement policy (.+?) and args (.+?)$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (ccType, ccName, version, ccId, tlsType, channelName, policyType, args) => {
		let profile;
		let tls;
		if (tlsType.localeCompare('non-tls') === 0) {
			tls = false;
			profile = new CCP(path.join(__dirname, ccpPath), true);
		} else {
			tls = true;
			profile = new CCP(path.join(__dirname, tlsCcpPath), true);
		}
		const policy = require(path.join(__dirname, policiesPath))[policyType];

		const orgs = profile.getOrganizationsForChannel(channelName);

		try {
			for (const org in orgs) {
				const orgName = orgs[org];
				await chaincode_util.installChaincode(ccName, ccId, ccType, version, tls, profile, orgName, channelName);
			}
			await chaincode_util.instantiateChaincode(ccName, ccId, ccType, args, version, false, tls, profile, orgs[0], channelName, policy);

			return true;
		} catch (err) {
			testUtil.logError('Force Install/Instantiate failed with error: ', err);
			throw err;
		}

	});
};
