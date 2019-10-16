/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from '../../constants';
import { CommonConnectionProfile } from '../commonConnectionProfile';
import * as BaseUtils from './baseUtils';
import { StateStore } from './stateStore';

import * as FabricCAServices from 'fabric-ca-client';
import * as Client from 'fabric-client';
import * as fs from 'fs';

const stateStore = StateStore.getInstance();

/**
 * Enroll and get the cert
 * @param {string} fabricCAEndpoint the url of the FabricCA
 * @param {string} caName name of caName
 * @return {Object} something useful in a promise
 */
export async function tlsEnroll(fabricCAEndpoint: string, caName: string) {
	const tlsOptions = {
		trustedRoots: [],
		verify: false,
	};
	const caService = new FabricCAServices(fabricCAEndpoint, tlsOptions as any, caName);
	const req = {
		enrollmentID: 'admin',
		enrollmentSecret: 'adminpw',
		profile: 'tls',
	};

	const enrollment = await caService.enroll(req) as any;
	enrollment.key = enrollment.key.toBytes();
	return enrollment;
}

export async function getSubmitter(client: Client, peerAdmin: boolean, org: string, ccp: CommonConnectionProfile) {
	if (peerAdmin) {
		return await getOrgAdmin(client, org, ccp);
	} else {
		return await getMember('admin', 'adminpw', client, org, ccp);
	}
}

/**
 * Retrieve the admin identity for the given organization.
 * @param {Client} client The Fabric client object.
 * @param {string} userOrg The name of the user's organization.
 * @param {CommonConnectionProfile} ccp the common connection profile
 * @return {User} The admin user identity.
 */
async function getOrgAdmin(client: Client, userOrg: string, ccp: CommonConnectionProfile) {
	try {

		const org = ccp.getOrganization(userOrg);
		if (!org) {
			throw new Error('Could not find ' + userOrg + ' in configuration');
		}

		const keyPEM = fs.readFileSync(org.adminPrivateKeyPEM.path);
		const certPEM = fs.readFileSync(org.signedCertPEM.path);

		const cryptoSuite = Client.newCryptoSuite();
		client.setCryptoSuite(cryptoSuite);

		await client.createUser({
			cryptoContent: {
				privateKeyPEM: keyPEM.toString(),
				signedCertPEM: certPEM.toString(),
			},
			mspid: org.mspid,
			skipPersistence: true,
			username: 'peer' + userOrg + 'Admin',
		});
	} catch (err) {
		return Promise.reject(err);
	}
}

/**
 * Retrieve an enrolled user, or enroll the user if necessary.
 * @param {string} username The name of the user.
 * @param {string} password The enrollment secret necessary to enroll the user.
 * @param {Client} client The Fabric client object.
 * @param {string} userOrg The name of the user's organization.
 * @param {CommonConnectionProfile} ccp the common connection profile
 * @return {Promise<User>} The retrieved and enrolled user object.
 */
async function getMember(username: string, password: string, client: Client, userOrg: string, ccp: CommonConnectionProfile) {

	const org = ccp.getOrganization(userOrg);
	if (!org) {
		throw new Error('Could not find ' + userOrg + ' in configuration');
	}

	const caUrl = org.ca.url;
	const user = await client.getUserContext(username, true);

	try {
		if (user && user.isEnrolled()) {
			return user;
		}

		const member = new Client.User(username);
		let cryptoSuite = client.getCryptoSuite();
		if (!cryptoSuite) {
			cryptoSuite = Client.newCryptoSuite();
			if (userOrg) {
				client.setCryptoSuite(cryptoSuite);
			}
		}
		member.setCryptoSuite(cryptoSuite);

		// need to enroll it with CA server
		const tlsOptions = {
			trustedRoots: [],
			verify: false,
		};
		const cop = new FabricCAServices(caUrl, tlsOptions as any, org.ca.name, cryptoSuite);

		const enrollment = await cop.enroll({enrollmentID: username, enrollmentSecret: password});

		await member.setEnrollment(enrollment.key, enrollment.certificate, org.mspid);

		const skipPersistence = true;
		await client.setUserContext(member, skipPersistence);
		return member;
	} catch (error) {
		BaseUtils.logError('Failed to enroll and persist user', error);
		return Promise.reject(error);
	}
}

export function getPeerObjectsForClientOnChannel(orgClient: Client, channelName: string, ccp: CommonConnectionProfile) {
	const peerObjects: Client.Peer[] = [];
	const peerNames = Object.keys(ccp.getPeersForChannel(channelName)) as string[];

	peerNames.forEach((peerName) => {
		const peer = ccp.getPeer(peerName);
		const data = fs.readFileSync(peer.tlsCACerts.path);
		peerObjects.push(orgClient.newPeer(
			peer.url,
			{
				'pem': Buffer.from(data).toString(),
				'ssl-target-name-override': peer.grpcOptions['ssl-target-name-override'],
			},
		));
	});
	return peerObjects;
}

/**
 * Augment a base client instance (that only knows the client org/connection options) with peer and orderers from a CCP
 * @param client The base client object
 * @param orgName The org name to augment with
 * @param ccp The CCP to use to augment the base client
 * @param tls Boolean tls enabled
 */
export async function augmentBaseClientWithCcp(client: Client, orgName: string, ccp: CommonConnectionProfile, tls: boolean) {
	// Add peers to orgClient
	const peers = ccp.getPeersForOrganization(orgName) as string[];
	peers.forEach((peerName) => {
		const peer = ccp.getPeer(peerName);
		const data = fs.readFileSync(peer.tlsCACerts.path);
		client.newPeer(
			peer.url,
			{
				'pem': Buffer.from(data).toString(),
				'ssl-target-name-override': peer.grpcOptions['ssl-target-name-override'],
			},
		);
	});

	// Add orderers to orgClient
	const orderers = ccp.getOrderersForChannel(Constants.LIFECYCLE_CHANNEL) as string[];
	orderers.forEach((ordererName) => {
		const orderer = ccp.getOrderer(ordererName);
		const data = fs.readFileSync(orderer.tlsCACerts.path);
		client.newOrderer(
			orderer.url,
			{
				'name': ordererName,
				'pem': Buffer.from(data).toString(),
				'ssl-target-name-override': orderer.grpcOptions['ssl-target-name-override'],
			},
		);
	});

	// set tls cert/key (if tls)
	if (tls) {
		const caName = ccp.getCertificateAuthoritiesForOrg(orgName)[0];
		const fabricCAEndpoint = ccp.getCertificateAuthority(caName).url;
		const tlsInfo = await tlsEnroll(fabricCAEndpoint, caName);
		client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
	}

	getOrgAdmin(client, orgName, ccp);
}

/**
 * Check if a smart contract is known to be installed by checking the state store
 * @param scName the name <name>@<version> of the smart contract to search for
 * @returns @type {boolean} true if the smart contract is deployed
 */
export function isContractInstalled(scName: string) {
	const installed = stateStore.get(Constants.INSTALLED_SC);
	if (installed) {
		BaseUtils.logMsg(`Known installed smart contracts: [${installed}]`, undefined);
	} else {
		BaseUtils.logMsg('No known installed smart contracts', undefined);
	}

	return (installed && installed.includes(scName));
}

/**
 * Add a smart contract to the list of known deployed smart contracts
 * @param scName the name <name>@<version> of the smart contract to add
 */
export function addToInstalledContracts(scName: string) {
	let installed = stateStore.get(Constants.INSTALLED_SC);
	if (installed) {
		installed = installed.concat(scName);
		stateStore.set(Constants.INSTALLED_SC, installed);
	} else {
		stateStore.set(Constants.INSTALLED_SC, [scName]);
	}
}

/**
 * Clear all installed contracts from the state store
 */
export function clearInstalledContracts() {
	stateStore.set(Constants.INSTALLED_SC, []);
}

/**
 * Check if a smart contract is known to be instantiated on a channel by checking the state store
 * @param scName the name <name>@<version> of the smart contract to search for
 * @param channelName the name of the channel to search on
 */
export function isInstantiatedOnChannel(scName: string, channelName: string) {
	const instantiated = stateStore.get(Constants.INSTANTIATED_SC);
	return (instantiated && instantiated[channelName] && instantiated[channelName].includes(scName));
}

/**
 * Add a smart contract to the list of known deployed smart contracts on a nominated channel
 * @param scName the name <name>@<version> of the smart contract to add
 * @param channelName the name channel to add for
 */
export function addToInstantiatedContractsOnChannel(scName: string, channelName: string) {
	let instantiated = stateStore.get(Constants.INSTANTIATED_SC);
	if (instantiated && instantiated[channelName]) {
		instantiated[channelName] = instantiated[channelName].concat(scName);
		stateStore.set(Constants.INSTANTIATED_SC, instantiated);
	} else {
		if (instantiated) {
			// object exists, but no channel items
			instantiated[channelName] = [scName];
		} else {
			// no object (first run through)
			instantiated = {};
			instantiated[channelName] = [scName];
		}
		stateStore.set(Constants.INSTANTIATED_SC, instantiated);
	}
}

/**
 * Clear all instantiated contracts from the state store
 */
export function clearInstantiatedContracts() {
	stateStore.set(Constants.INSTANTIATED_SC, {});
}

/**
 * Check if a channel has been created
 * @param channelName the name of the channel to check for
 */
export function isChannelCreated(channelName: string) {
	const channels = stateStore.get(Constants.CREATED_CHANNELS);
	return (channels && channels.includes(channelName));
}

/**
 * Add a channel to the known created
 * @param channelName the channel to add
 */
export function addToCreatedChannels(channelName: string) {
	let channels = stateStore.get(Constants.CREATED_CHANNELS);
	if (channels) {
		channels = channels.concat(channelName);
		stateStore.set(Constants.CREATED_CHANNELS, channels);
	} else {
		stateStore.set(Constants.CREATED_CHANNELS, [channelName]);
	}
}

/**
 * Clear all created channels from the state store
 */
export function clearCreatedChannels() {
	stateStore.set(Constants.INSTALLED_SC, []);
}

/**
 * Check if the organization has joint the channel
 * @param orgName the org name
 * @param channelName the channel name
 */
export function orgHasJointChannel(orgName: string, channelName: string) {
	const joinedChannels = stateStore.get(Constants.JOINED_CHANNELS);
	return (joinedChannels && joinedChannels[channelName] && joinedChannels[channelName].includes(orgName));
}

export function addOrgToJointChannel(orgName: string, channelName: string) {
	let joinedChannels = stateStore.get(Constants.JOINED_CHANNELS);
	if (joinedChannels && joinedChannels[channelName]) {
		joinedChannels[channelName] = joinedChannels[channelName].concat(orgName);
		stateStore.set(Constants.INSTANTIATED_SC, joinedChannels);
	} else {
		if (joinedChannels) {
			// object exists, but no channel items
			joinedChannels[channelName] = [orgName];
		} else {
			// no object (first run through)
			joinedChannels = {};
			joinedChannels[channelName] = [orgName];
		}
		stateStore.set(Constants.JOINED_CHANNELS, joinedChannels);
	}
}

/**
 * Check if the channel has been updated
 * @param channelName the channel name
 * @param txName the txUpdate name
 */
export function channelHasBeenUpdated(channelName: string, txName: string) {
	const updatedChannels = stateStore.get(Constants.UPDATED_CHANNELS);
	return (updatedChannels && updatedChannels[channelName] && updatedChannels[channelName].includes(txName));
}

export function addToUpdatedChannel(channelName: string, txName: string) {
	let updatedChannels = stateStore.get(Constants.UPDATED_CHANNELS);
	if (updatedChannels && updatedChannels[channelName]) {
		updatedChannels[channelName] = updatedChannels[channelName].concat(txName);
		stateStore.set(Constants.UPDATED_CHANNELS, updatedChannels);
	} else {
		if (updatedChannels) {
			// object exists, but no channel items
			updatedChannels[channelName] = [txName];
		} else {
			// no object (first run through)
			updatedChannels = {};
			updatedChannels[channelName] = [txName];
		}
		stateStore.set(Constants.UPDATED_CHANNELS, updatedChannels);
	}
}
