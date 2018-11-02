/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const channel_util = require('../lib/channel');
const chaincode_util = require('../lib/chaincode');
const CCP = require('../lib/common_connection');
const testUtil = require('../lib/utils');

const path = require('path');

const configRoot = '../../config';
const ccpPath = '../../config/ccp.json';
const tlsCcpPath = '../../config/ccp-tls.json';
const policiesPath = '../../config/policies.json';

module.exports = function () {

	this.Then(/^I can create a channels from the (.+?) common connection profile$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (tlsType) => {
		if (tlsType.localeCompare('non-tls') === 0) {
			const profile =  new CCP(path.join(__dirname, ccpPath), true);
			return channel_util.create_channels(path.join(__dirname, configRoot), profile, false);
		} else {
			const profile =  new CCP(path.join(__dirname, tlsCcpPath), true);
			return channel_util.create_channels(path.join(__dirname, configRoot), profile, true);
		}
	});

	this.Then(/^I can join organization (.+?) to the (.+?) enabled channel named (.+?)$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (orgName, tlsType, channelName) => {
		if (tlsType.localeCompare('non-tls') === 0) {
			const profile =  new CCP(path.join(__dirname, ccpPath), true);
			return channel_util.join_channel(profile, false, channelName, orgName);
		} else {
			const profile =  new CCP(path.join(__dirname, tlsCcpPath), true);
			return channel_util.join_channel(profile, true, channelName, orgName);
		}
	});

	this.Then(/^I can create and join all channels from the (.+?) common connection profile$/, {timeout: testUtil.TIMEOUTS.MED_STEP}, async (tlsType) => {
		let tls;
		let profile;

		if (tlsType.localeCompare('non-tls') === 0) {
			tls = false;
			profile = new CCP(path.join(__dirname, ccpPath), true);
		} else {
			tls = true;
			profile = new CCP(path.join(__dirname, tlsCcpPath), true);
		}

		await channel_util.create_channels(path.join(__dirname, configRoot), profile, tls);

		const channels = profile.getChannels();
		try {
			for (const channelName in channels) {
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

	this.Then(/^I can install (.+?) chaincode at version (.+?) named (.+?) to the (.+?) Fabric network as organization (.+?) on channel (.+?)$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (ccType, version, ccName, tlsType, orgName, channelName) => {
		let profile;
		let tls;
		if (tlsType.localeCompare('non-tls') === 0) {
			tls = false;
			profile = new CCP(path.join(__dirname, ccpPath), true);
		} else {
			tls = true;
			profile =  new CCP(path.join(__dirname, tlsCcpPath), true);
		}
		return chaincode_util.installChaincode(ccName, ccName, ccType, version, tls, profile, orgName, channelName);
	});

	this.Then(/^I can install (.+?) chaincode at version (.+?) named (.+?) as (.+?) to the (.+?) Fabric network as organization (.+?) on channel (.+?)$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (ccType, version, ccName, ccId, tlsType, orgName, channelName) => {
		let profile;
		let tls;
		if (tlsType.localeCompare('non-tls') === 0) {
			tls = false;
			profile = new CCP(path.join(__dirname, ccpPath), true);
		} else {
			tls = true;
			profile =  new CCP(path.join(__dirname, tlsCcpPath), true);
		}
		return chaincode_util.installChaincode(ccName, ccId, ccType, version, tls, profile, orgName, channelName);
	});

	this.Then(/^I can install (.+?) chaincode named (.+?) to the (.+?) Fabric network$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (ccType, ccName, tlsType) => {
		let profile;
		let tls;
		if (tlsType.localeCompare('non-tls') === 0) {
			tls = false;
			profile = new CCP(path.join(__dirname, ccpPath), true);
		} else {
			tls = true;
			profile = new CCP(path.join(__dirname, tlsCcpPath), true);
		}

		// use first org in ccp
		const orgName = profile.getOrganizations()[0];

		// use first channel in ccp
		const channelName = profile.getChannels()[0];

		// fixed version
		const version = '1.0.0';

		return chaincode_util.installChaincode(ccName, ccName, ccType, version, tls, profile, orgName, channelName);
	});

	this.Then(/^I can install (.+?) chaincode named (.+?) as (.+?) to the (.+?) Fabric network$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (ccType, ccName, ccId, tlsType) => {
		let profile;
		let tls;
		if (tlsType.localeCompare('non-tls') === 0) {
			tls = false;
			profile = new CCP(path.join(__dirname, ccpPath), true);
		} else {
			tls = true;
			profile = new CCP(path.join(__dirname, tlsCcpPath), true);
		}

		// use first org in ccp
		const orgName = profile.getOrganizations()[0];

		// use first channel in ccp
		const channelName = profile.getChannels()[0];

		// fixed version
		const version = '1.0.0';

		return chaincode_util.installChaincode(ccName, ccId, ccType, version, tls, profile, orgName, channelName);
	});

	this.Then(/^I can instantiate the (.+?) installed (.+?) chaincode at version (.+?) named (.+?) on the (.+?) Fabric network as organization (.+?) on channel (.+?) with endorsement policy (.+?) and args (.+?)$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (exisiting, ccType, version, ccName, tlsType, orgName, channelName, policyType, args) => {
		let profile;
		let tls;
		let upgrade;
		if (tlsType.localeCompare('non-tls') === 0) {
			tls = false;
			profile = new CCP(path.join(__dirname, ccpPath), true);
		} else {
			tls = true;
			profile = new CCP(path.join(__dirname, tlsCcpPath), true);
		}

		if (exisiting.localeCompare('newly') === 0) {
			upgrade = false;
		} else {
			upgrade = true;
		}

		const policy = require(path.join(__dirname, policiesPath))[policyType];
		return chaincode_util.instantiateChaincode(ccName, ccName, ccType, args, version, upgrade, tls, profile, orgName, channelName, policy);
	});

	this.Then(/^I can instantiate the (.+?) installed (.+?) chaincode at version (.+?) named (.+?) with identifier (.+?) on the (.+?) Fabric network as organization (.+?) on channel (.+?) with endorsement policy (.+?) and args (.+?)$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (exisiting, ccType, version, ccName, ccId, tlsType, orgName, channelName, policyType, args) => {
		let profile;
		let tls;
		let upgrade;
		if (tlsType.localeCompare('non-tls') === 0) {
			tls = false;
			profile = new CCP(path.join(__dirname, ccpPath), true);
		} else {
			tls = true;
			profile = new CCP(path.join(__dirname, tlsCcpPath), true);
		}

		if (exisiting.localeCompare('newly') === 0) {
			upgrade = false;
		} else {
			upgrade = true;
		}

		const policy = require(path.join(__dirname, policiesPath))[policyType];
		return chaincode_util.instantiateChaincode(ccName, ccId, ccType, args, version, upgrade, tls, profile, orgName, channelName, policy);
	});

	this.Then(/^I can install\/instantiate (.+?) chaincode at version (.+?) named (.+?) to the (.+?) Fabric network for all organizations on channel (.+?) with endorsement policy (.+?) and args (.+?)$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (ccType, version, ccName, tlsType, channelName, policyType, args) => {
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
				await chaincode_util.installChaincode(ccName, ccName, ccType, version, tls, profile, orgName, channelName);
			}

			return chaincode_util.instantiateChaincode(ccName, ccName, ccType, args, version, false, tls, profile, orgs[0], channelName, policy);
		} catch (err) {
			testUtil.logError('Install/Instantiate failed with error: ', err);
			throw err;
		}

	});

	this.Then(/^I can install\/instantiate (.+?) chaincode at version (.+?) named (.+?) to the (.+?) Fabric network for all organizations on channel (.+?) as (.+?) with endorsement policy (.+?) and args (.+?)$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (ccType, version, ccName, tlsType, channelName, ccId, policyType, args) => {
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

			return chaincode_util.instantiateChaincode(ccName, ccId, ccType, args, version, false, tls, profile, orgs[0], channelName, policy);
		} catch (err) {
			testUtil.logError('Install/Instantiate failed with error: ', err);
			throw err;
		}

	});

};
