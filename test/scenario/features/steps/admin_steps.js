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

const instantiatedChaincodesOnChannels = new Map();
const installedChaincodesOnPeers = new Map();

module.exports = function () {

	this.Given(/^I create all channels from the (.+?) common connection profile$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (tlsType) => {

		let profile;
		let tls;

		if (tlsType.localeCompare('non-tls') === 0) {
			tls = false;
			profile =  new CCP(path.join(__dirname, ccpPath), true);
		} else {
			profile =  new CCP(path.join(__dirname, tlsCcpPath), true);
			tls = true;
		}

		try {
			for (const channelName in profile.getChannels()) {
				// Create
				await channel_util.create_channel(path.join(__dirname, channelRoot), profile, tls, channelName);
			}
			return Promise.resolve();
		} catch (err) {
			return Promise.reject(err);
		}

	});

	this.Given(/^I update channel with name (.+?) with config file (.+?) from the (.+?) common connection profile/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (channelName, txFileName, tlsType) => {
		if (tlsType.localeCompare('non-tls') === 0) {
			const profile =  new CCP(path.join(__dirname, ccpPath), true);
			return channel_util.update_channel(profile, channelName, path.join(channelRoot, txFileName), false);
		} else {
			const profile =  new CCP(path.join(__dirname, tlsCcpPath), true);
			return channel_util.update_channel(profile, channelName, path.join(channelRoot, txFileName), true);
		}
	}),

	this.Then(/^I can join organization (.+?) to the (.+?) enabled channel named (.+?)$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (orgName, tlsType, channelName) => {
		if (tlsType.localeCompare('non-tls') === 0) {
			const profile =  new CCP(path.join(__dirname, ccpPath), true);
			return channel_util.join_channel(profile, false, channelName, orgName);
		} else {
			const profile =  new CCP(path.join(__dirname, tlsCcpPath), true);
			return channel_util.join_channel(profile, true, channelName, orgName);
		}
	});

	this.Given(/^I create and join all channels from the (.+?) common connection profile$/, {timeout: testUtil.TIMEOUTS.MED_STEP}, async (tlsType) => {
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
			const channels = profile.getChannels();
			for (const channelName in channels) {
				// Create
				await channel_util.create_channel(path.join(__dirname, cryptoRoot), profile, tls, channelName);

				// Join
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

	this.Given(/^I have created and joint all channels from the (.+?) common connection profile$/, {timeout: testUtil.TIMEOUTS.MED_STEP}, async (tlsType) => {
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

	this.Given(/^I install (.+?) chaincode at version (.+?) named (.+?) to the (.+?) Fabric network as organization (.+?) on channel (.+?)$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (ccType, version, ccName, tlsType, orgName, channelName) => {
		let profile;
		let tls;
		if (tlsType.localeCompare('non-tls') === 0) {
			tls = false;
			profile = new CCP(path.join(__dirname, ccpPath), true);
		} else {
			tls = true;
			profile =  new CCP(path.join(__dirname, tlsCcpPath), true);
		}
		if (!installedChaincodesOnPeers.has(orgName)) {
			installedChaincodesOnPeers.set(orgName, []);
		}
		if (!installedChaincodesOnPeers.get(orgName).includes(`${ccName}${version}${ccType}`)) {
			await chaincode_util.installChaincode(ccName, ccName, ccType, version, tls, profile, orgName, channelName);
			installedChaincodesOnPeers.set(orgName, [...installedChaincodesOnPeers.get(orgName), `${ccName}${version}${ccType}`]);
		}
		return true;
	});

	this.Given(/^I install (.+?) chaincode named (.+?) to the (.+?) Fabric network$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (ccType, ccName, tlsType) => {
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

		if (!installedChaincodesOnPeers.has(orgName)) {
			installedChaincodesOnPeers.set(orgName, []);
		}
		if (!installedChaincodesOnPeers.get(orgName).includes(`${ccName}${version}${ccType}`)) {
			await chaincode_util.installChaincode(ccName, ccName, ccType, version, tls, profile, orgName, channelName);
			installedChaincodesOnPeers.set(orgName, [installedChaincodesOnPeers.get(orgName), `${ccName}${version}${ccType}`]);
		}
		return true;
	});

	this.Given(/^I install (.+?) chaincode named (.+?) as (.+?) to the (.+?) Fabric network$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (ccType, ccName, ccId, tlsType) => {
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

		if (!installedChaincodesOnPeers.has(orgName)) {
			installedChaincodesOnPeers.set(orgName, []);
		}
		if (!installedChaincodesOnPeers.get(orgName).includes(`${ccName}${version}${ccType}`)) {
			await chaincode_util.installChaincode(ccName, ccId, ccType, version, tls, profile, orgName, channelName);
			installedChaincodesOnPeers.set(orgName, [...installedChaincodesOnPeers.get(orgName), `${ccName}${version}${ccType}`]);
		}
		return true;
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
		if (!instantiatedChaincodesOnChannels.has(channelName)) {
			instantiatedChaincodesOnChannels.set(channelName, []);
		}
		if (!instantiatedChaincodesOnChannels.get(channelName).includes(`${ccName}${version}${ccType}`)) {
			await chaincode_util.instantiateChaincode(ccName, ccName, ccType, args, version, upgrade, tls, profile, orgName, channelName, policy);
			instantiatedChaincodesOnChannels.set(channelName, [...instantiatedChaincodesOnChannels.get(channelName), `${ccName}${version}${ccType}`]);
		}
		return true;
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
		if (!instantiatedChaincodesOnChannels.has(channelName)) {
			instantiatedChaincodesOnChannels.set(channelName, []);
		}
		if (!instantiatedChaincodesOnChannels.get(channelName).includes(`${ccName}${version}${ccType}`)) {
			await chaincode_util.instantiateChaincode(ccName, ccId, ccType, args, version, upgrade, tls, profile, orgName, channelName, policy);
			instantiatedChaincodesOnChannels.set(channelName, [...instantiatedChaincodesOnChannels.get(channelName), `${ccName}${version}${ccType}`]);
		}
		return true;
	});

	this.Given(/^I install\/instantiate (.+?) chaincode named (.+?) at version (.+?) as (.+?) to the (.+?) Fabric network for all organizations on channel (.+?) with endorsement policy (.+?) and args (.+?)$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (ccType, ccName, version, ccId, tlsType, channelName, policyType, args) => {
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
				if (!installedChaincodesOnPeers.has(orgName)) {
					installedChaincodesOnPeers.set(orgName, []);
				}
				if (!installedChaincodesOnPeers.get(orgName).includes(`${ccName}${version}${ccType}`)) {
					await chaincode_util.installChaincode(ccName, ccId, ccType, version, tls, profile, orgName, channelName);
					installedChaincodesOnPeers.set(orgName, [...installedChaincodesOnPeers.get(orgName), `${ccName}${version}${ccType}`]);
				}
			}

			if (!instantiatedChaincodesOnChannels.has(channelName)) {
				instantiatedChaincodesOnChannels.set(channelName, []);
			}
			if (!instantiatedChaincodesOnChannels.get(channelName).includes(`${ccName}${version}${ccType}`)) {
				await chaincode_util.instantiateChaincode(ccName, ccId, ccType, args, version, false, tls, profile, orgs[0], channelName, policy);
				instantiatedChaincodesOnChannels.set(channelName, [...instantiatedChaincodesOnChannels.get(channelName), `${ccName}${version}${ccType}`]);
			}
			return true;
		} catch (err) {
			testUtil.logError('Install/Instantiate failed with error: ', err);
			throw err;
		}

	});

};
