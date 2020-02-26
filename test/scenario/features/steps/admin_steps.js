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
	this.Then(/^I can sleep (\d+)$/, {timeout: testUtil.TIMEOUTS.MED_STEP}, async (millis) => {
		testUtil.logMsg(' .....sleeping ' + millis);
		await testUtil.sleep(millis);
		testUtil.logMsg(' .....awake');
	});


	this.Then(/^I can update to an anchored common connection profile channel named (.+?)$/, {timeout: testUtil.TIMEOUTS.MED_STEP}, async (channelName) => {
		testUtil.logMsg(' Running update channel with anchored peer config');
		const profile =  new CCP(path.join(__dirname, tlsCcpPath), true);
		return channel_util.create_channel(channelName, path.join(__dirname, channelRoot), profile, true, channelName + '-org1anchor.tx');
	});

	this.Then(/^I can create a channels from the (.+?) common connection profile$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (tlsType) => {
		if (tlsType.localeCompare('non-tls') === 0) {
			const profile =  new CCP(path.join(__dirname, ccpPath), true);
			return channel_util.create_channels(path.join(__dirname, channelRoot), profile, false);
		} else {
			const profile =  new CCP(path.join(__dirname, tlsCcpPath), true);
			return channel_util.create_channels(path.join(__dirname, channelRoot), profile, true);
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

		await channel_util.create_channels(path.join(__dirname, channelRoot), profile, tls);

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
		if (!installedChaincodesOnPeers.has(orgName)) {
			installedChaincodesOnPeers.set(orgName, []);
		}
		if (!installedChaincodesOnPeers.get(orgName).includes(`${ccName}${version}${ccType}`)) {
			await chaincode_util.installChaincode(ccName, ccName, ccType, version, tls, profile, orgName, channelName);
			installedChaincodesOnPeers.set(orgName, [...installedChaincodesOnPeers.get(orgName), `${ccName}${version}${ccType}`]);
		}
		return true;
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

		if (!installedChaincodesOnPeers.has(orgName)) {
			installedChaincodesOnPeers.set(orgName, []);
		}
		if (!installedChaincodesOnPeers.get(orgName).includes(`${ccName}${version}${ccType}`)) {
			await chaincode_util.installChaincode(ccName, ccName, ccType, version, tls, profile, orgName, channelName);
			installedChaincodesOnPeers.set(orgName, [installedChaincodesOnPeers.get(orgName), `${ccName}${version}${ccType}`]);
		}
		return true;
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

	this.Then(/^I can install and instantiate (.+?) chaincode at version (.+?) named (.+?) to channel (.+?) with collection (.+?) as (.+?) with endorsement policy (.+?) and args (.+?)$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (ccType, version, ccName, channelName, collectionName, ccId, policyType, args) => {
		const tls = true;
		const profile = new CCP(path.join(__dirname, tlsCcpPath), true);
		const policy = require(path.join(__dirname, policiesPath))[policyType];
		const collectionDef = require(path.join(__dirname, configRoot, '/collections.json'))[collectionName];
		testUtil.logMsg('Install/Instantiate with collection: ', JSON.stringify(collectionDef));

		const collections = [collectionDef];

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
				await chaincode_util.instantiateChaincode(
					ccName, ccId, ccType, args, version, false, tls, profile, orgs[0], channelName, policy, collections
				);
				instantiatedChaincodesOnChannels.set(channelName, [...instantiatedChaincodesOnChannels.get(channelName), `${ccName}${version}${ccType}`]);
			}
			return true;
		} catch (err) {
			testUtil.logError('Install/Instantiate failed with error: ', err);
			throw err;
		}

	});

};
