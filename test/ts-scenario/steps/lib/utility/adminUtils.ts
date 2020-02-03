/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from '../../constants';
import * as Chaincode from '../chaincode';
import * as BaseUtils from './baseUtils';
import { CommonConnectionProfileHelper } from './commonConnectionProfileHelper';
import { StateStore } from './stateStore';

import * as FabricCAServices from 'fabric-ca-client';
import * as Client from 'fabric-client';
import * as fs from 'fs';
import * as path from 'path';

const stateStore: StateStore = StateStore.getInstance();

/**
 * Enroll and get the cert
 * @param {string} fabricCAEndpoint the url of the FabricCA
 * @param {string} caName name of caName
 * @return {Object} something useful in a promise
 */
export async function tlsEnroll(fabricCAEndpoint: string, caName: string): Promise<any> {
	const tlsOptions: any = {
		trustedRoots: [],
		verify: false,
	};
	const caService: FabricCAServices = new FabricCAServices(fabricCAEndpoint, tlsOptions as any, caName);
	const req: any = {
		enrollmentID: 'admin',
		enrollmentSecret: 'adminpw',
		profile: 'tls',
	};

	const enrollment: any = await caService.enroll(req);
	enrollment.key  = enrollment.key.toBytes();
	return enrollment;
}

export async function getSubmitter(client: Client, peerAdmin: boolean, org: string, ccp: CommonConnectionProfileHelper): Promise<Client.User> {
	if (peerAdmin) {
		return await getOrgAdminUser(client, org, ccp);
	} else {
		return await getMember('admin', 'adminpw', client, org, ccp);
	}
}

/**
 * Retrieve the admin identity for the given organization.
 * @param {Client} client The Fabric client object.
 * @param {string} userOrg The name of the user's organization.
 * @param {CommonConnectionProfileHelper} ccp the common connection profile
 * @return {Client} The admin user identity.
 */
async function getOrgAdminUser(client: Client, userOrg: string, ccp: CommonConnectionProfileHelper): Promise<Client.User> {
	try {

		const org: any = ccp.getOrganization(userOrg);
		if (!org) {
			throw new Error('Could not find ' + userOrg + ' in configuration');
		}

		const keyPEM: Buffer = fs.readFileSync(org.adminPrivateKeyPEM.path);
		const certPEM: Buffer = fs.readFileSync(org.signedCertPEM.path);

		const cryptoSuite: Client.ICryptoSuite = Client.newCryptoSuite();
		client.setCryptoSuite(cryptoSuite);

		const user: Client.User = await client.createUser({
			cryptoContent: {
				privateKeyPEM: keyPEM.toString(),
				signedCertPEM: certPEM.toString(),
			},
			mspid: org.mspid,
			skipPersistence: true,
			username: 'peer' + userOrg + 'Admin',
		});

		return user;
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
 * @param {CommonConnectionProfileHelper} ccp the common connection profile
 * @return {Promise<User>} The retrieved and enrolled user object.
 */
async function getMember(username: string, password: string, client: Client, userOrg: string, ccp: CommonConnectionProfileHelper): Promise<Client.User> {

	const org: any = ccp.getOrganization(userOrg);
	if (!org) {
		throw new Error('Could not find ' + userOrg + ' in configuration');
	}

	const caUrl: string = org.ca.url;
	const user: Client.User = await client.getUserContext(username, true);

	try {
		if (user && user.isEnrolled()) {
			return user;
		}

		const member: Client.User = new Client.User(username);
		let cryptoSuite: Client.ICryptoSuite = client.getCryptoSuite();
		if (!cryptoSuite) {
			cryptoSuite = Client.newCryptoSuite();
			if (userOrg) {
				client.setCryptoSuite(cryptoSuite);
			}
		}
		member.setCryptoSuite(cryptoSuite);

		// need to enroll it with CA server
		const tlsOptions: any = {
			trustedRoots: [],
			verify: false,
		};
		const cop: FabricCAServices = new FabricCAServices(caUrl, tlsOptions as any, org.ca.name);

		const enrollment: FabricCAServices.IEnrollResponse = await cop.enroll({enrollmentID: username, enrollmentSecret: password});

		await member.setEnrollment(enrollment.key, enrollment.certificate, org.mspid);

		const skipPersistence: boolean = true;
		await client.setUserContext(member, skipPersistence);
		return member;
	} catch (error) {
		BaseUtils.logError('Failed to enroll and persist user', error);
		return Promise.reject(error);
	}
}

export function getPeerObjectsForClientOnChannel(orgClient: Client, channelName: string, ccp: CommonConnectionProfileHelper): Client.Peer[] {
	const peerObjects: Client.Peer[] = [];
	const peerNames: string[] = Object.keys(ccp.getPeersForChannel(channelName)) as string[];

	peerNames.forEach((peerName: string) => {
		const peer: any = ccp.getPeer(peerName);
		const data: Buffer = fs.readFileSync(peer.tlsCACerts.path);
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
 * Augment a base client instance (that only knows the client org/connection options) with identity
 * @param client The base client object
 * @param orgName The org name to augment with
 * @param ccp The CCP to use to augment the base client
 */
export async function assignOrgAdmin(client: Client, orgName: string, ccp: CommonConnectionProfileHelper): Promise<void> {

	// set tls cert/key (if tls)
	if (ccp.isTls()) {
		const caName: string = ccp.getCertificateAuthoritiesForOrg(orgName)[0];
		const fabricCAEndpoint: string = ccp.getCertificateAuthority(caName).url;
		const tlsInfo: any = await tlsEnroll(fabricCAEndpoint, caName);
		client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
	}

	const org: any = ccp.getOrganization(orgName);
	if (!org) {
		throw new Error('Could not find ' + orgName + ' in configuration');
	}

	const keyPEM: Buffer = fs.readFileSync(org.adminPrivateKeyPEM.path);
	const certPEM: Buffer = fs.readFileSync(org.signedCertPEM.path);
	const cryptoSuite: Client.ICryptoSuite = Client.newCryptoSuite();
	client.setCryptoSuite(cryptoSuite);

	await client.setAdminSigningIdentity(keyPEM.toString(), certPEM.toString(), org.mspid);
}

/**
 * Check if a smart contract is installed using a client.queryInstalledChaincodes()
 * @param orgName the name of the org
 * @param ccp the common connection profile
 * @param chaincodeName the name of the contract
 * @param chaincodeVersion the version of the contract
 */
export async function isOrgChaincodeInstalled(orgName: string, ccp: CommonConnectionProfileHelper, chaincodeName: string, chaincodeVersion: string): Promise<boolean> {
	BaseUtils.logMsg(`Checking if smart contract ${chaincodeName} at version ${chaincodeVersion} has been installed`);
	const clientPath: string = path.join(__dirname, Constants.UTIL_TO_CONFIG, orgName + '.json');
	const orgClient: Client = await Client.loadFromConfig(clientPath);

	// Augment it with full CCP
	await assignOrgAdmin(orgClient, orgName, ccp);

	// Get the first target peer for our org
	const peer: Client.Peer = orgClient.getPeersForOrg(orgName + 'MSP')[0];

	BaseUtils.logMsg(`Querying peer ${peer.getName()} for known chaincode`);
	const message: Client.ChaincodeQueryResponse = await orgClient.queryInstalledChaincodes(peer, true);

	// loop over message array if present
	let hasInstalled: boolean = false;
	for (const chaincode of message.chaincodes) {
		if ( (chaincode.name.localeCompare(chaincodeName) === 0) && (chaincode.version.localeCompare(chaincodeVersion) === 0)) {
			hasInstalled = true;
			break;
		}
	}

	return hasInstalled;
}

export async function isOrgChaincodeLifecycleInstalledOnChannel(orgName: string, ccp: CommonConnectionProfileHelper, chaincodeName: string, channelName: string): Promise<boolean> {
	BaseUtils.logMsg(`Checking if smart contract ${chaincodeName} has been installed`);
	const clientPath: string = path.join(__dirname, Constants.UTIL_TO_CONFIG, orgName + '.json');
	const orgClient: Client = await Client.loadFromConfig(clientPath);

	// Augment it with full CCP
	await assignOrgAdmin(orgClient, orgName, ccp);

	// Get the channel and a peer
	const channel: Client.Channel = orgClient.getChannel(channelName);
	const peer: Client.Peer = orgClient.getPeersForOrg(orgName + 'MSP')[0];

	BaseUtils.logMsg(`Querying peer ${peer.getName()} for known chaincode`);
	const installedRequests: Client.QueryInstalledChaincodesRequest = {
		target: peer,
		txId: orgClient.newTransactionID(true),
	};
	const message: Client.QueryInstalledChaincodesResult = await channel.queryInstalledChaincodes(installedRequests);

	// loop over message array if present
	let hasInstalled: boolean = false;
	for (const chaincode of message.installed_chaincodes) {
		if (chaincode.label.localeCompare(chaincodeName) === 0) {
			hasInstalled = true;
			break;
		}
	}

	return hasInstalled;
}

export async function isOrgChaincodeLifecycleCommittedOnChannel(orgName: string, ccp: CommonConnectionProfileHelper, chaincodeName: string, deployedAs: string, channelName: string): Promise<boolean> {
	BaseUtils.logMsg(`Checking if smart contract has been committed to channel ${channelName} as ${deployedAs}`);
	const clientPath: string = path.join(__dirname, Constants.UTIL_TO_CONFIG, orgName + '.json');
	const orgClient: Client = await Client.loadFromConfig(clientPath);

	// Augment it with full CCP
	await assignOrgAdmin(orgClient, orgName, ccp);

	// Get the channel and a peer
	const channel: Client.Channel = orgClient.getChannel(channelName);
	const peer: Client.Peer = orgClient.getPeersForOrg(orgName + 'MSP')[0];

	BaseUtils.logMsg(`Querying peer ${peer.getName()} for known chaincode`);
	const installedRequests: Client.QueryInstalledChaincodesRequest = {
		target: peer,
		txId: orgClient.newTransactionID(true),
	};
	const message: Client.QueryInstalledChaincodesResult = await channel.queryInstalledChaincodes(installedRequests);

	// loop over message array if present
	let hasCommitted: boolean = false;
	for (const chaincode of message.installed_chaincodes) {
		if (chaincode.label.localeCompare(chaincodeName) === 0) {
			// check references for the deployed version on the channel
			if (Object.prototype.hasOwnProperty.call(chaincode.references, channelName)) {
				for (const reference of chaincode.references[channelName].chaincodes) {
					if (reference.name.localeCompare(deployedAs) === 0) {
						hasCommitted = true;
						break;
					}
				}
			}
		}
	}

	return hasCommitted;
}

/**
 * Check if a smart contract is instantiated using a channel.queryInstantiatedChaincodes()
 * @param orgName the name of the org
 * @param ccp the common connection profile
 * @param chaincodeName the name of the contract
 * @param chaincodeVersion the version of the contract
 */
export async function isChaincodeInstantiatedOnChannel(orgName: string, ccp: CommonConnectionProfileHelper, channelName: string, chaincodeName: string, chaincodeVersion: string): Promise<boolean> {
	BaseUtils.logMsg(`Checking if smart contract ${chaincodeName} has been instantiated on channel ${channelName}`);
	const clientPath: string = path.join(__dirname, Constants.UTIL_TO_CONFIG, orgName + '.json');
	const orgClient: Client = await Client.loadFromConfig(clientPath);

	// Augment it with full CCP
	await assignOrgAdmin(orgClient, orgName, ccp);

	// Get the channel and a peer
	const channel: Client.Channel = orgClient.getChannel(channelName);
	const peer: Client.Peer = orgClient.getPeersForOrg(orgName + 'MSP')[0];

	BaseUtils.logMsg(`Querying channel ${channel.getName()} for instantiated chaincode`);
	const message: Client.ChaincodeQueryResponse = await channel.queryInstantiatedChaincodes(peer, true);

	// loop over message array if present
	let isInstantiated: boolean = false;
	for (const chaincode of message.chaincodes) {
		if ( (chaincode.name.localeCompare(chaincodeName) === 0) && (chaincode.version.localeCompare(chaincodeVersion) === 0)) {
			isInstantiated = true;
			break;
		}
	}

	return isInstantiated;
}

export async function performChannelQueryOperation(queryOperation: string, channelName: string, orgName: string, ccp: CommonConnectionProfileHelper, args: any): Promise<any> {
	const clientPath: string = path.join(__dirname, Constants.UTIL_TO_CONFIG, orgName + '.json');
	const orgClient: Client = await Client.loadFromConfig(clientPath);

	// Augment it with full CCP
	await assignOrgAdmin(orgClient, orgName, ccp);

	// Get the channel and a peer
	const channel: Client.Channel = orgClient.getChannel(channelName);
	const peer: Client.Peer = orgClient.getPeersForOrg(orgName + 'MSP')[0];

	BaseUtils.logMsg(`Performing query operation ${queryOperation} on channel ${channel.getName()}`);

	switch (queryOperation) {
		case 'queryInfo':
			return await channel.queryInfo(peer, true);
		case 'queryInstantiatedChaincodes':
			return await channel.queryInstantiatedChaincodes(peer, true);
		case 'queryInstalledChaincode':
			// require a packageId for this, which is a generated UUID each test run, so we need to query it first
			let packageId: string = '';
			const request: Client.QueryInstalledChaincodesRequest = {
				target: peer,
				txId: orgClient.newTransactionID(true),
			};
			const chaincodes: Client.QueryInstalledChaincodesResult = await channel.queryInstalledChaincodes(request);
			if ( (Object.prototype.hasOwnProperty.call(chaincodes, 'installed_chaincodes')) &&  (chaincodes.installed_chaincodes.length !== 0) ) {
				for (const chaincode of chaincodes.installed_chaincodes) {
					if (chaincode.label.localeCompare(args.contract) === 0) {
						packageId = chaincode.package_id;
						break;
					}
				}
				if (packageId.length < 1) {
					BaseUtils.logAndThrow(`Unable to retrieve package_id for contract ${args.contract}`);
				}
			} else {
				BaseUtils.logAndThrow(`Unable to retrieve package_id for contract ${args.contract}`);
			}

			const installedRequest: Client.QueryInstalledChaincodeRequest = {
				package_id: packageId,
				target: peer,
				txId: orgClient.newTransactionID(true),
			};
			return await channel.queryInstalledChaincode(installedRequest);
		case 'queryInstalledChaincodes':
			const installedRequests: Client.QueryInstalledChaincodesRequest = {
				target: peer,
				txId: orgClient.newTransactionID(true),
			};
			return await channel.queryInstalledChaincodes(installedRequests);
		case 'queryChaincodeDefinition':
			const definitionRequest: Client.QueryChaincodeDefinitionRequest = {
				chaincodeId: args.contract,
				target: peer,
				txId: orgClient.newTransactionID(true),
			};
			return await channel.queryChaincodeDefinition(definitionRequest);
		case 'queryBlock':
			return await channel.queryBlock(args.block, peer, true);
		case 'queryBlockByHash':
			const hashInfo: Client.BlockchainInfo = await channel.queryInfo(peer, true);
			return await channel.queryBlockByHash(hashInfo.currentBlockHash, peer, true, false);
		case 'queryBlockByTxId':
			// Need to get a txId
			const result: any = await Chaincode.performContractTransactionForOrg(args.contract, args.function, JSON.stringify(args.contractAgs), orgName, channelName, ccp, true, undefined, undefined);
			return await channel.queryBlockByTxID(result.txId.getTransactionID(), peer, true, false);
		default:
			BaseUtils.logAndThrow(`Unknown channel query operation passed: ${queryOperation}`);
	}
}

/**
 * Check if a channel has been created
 * @param channelName the name of the channel to check for
 */
export function isChannelCreated(channelName: string): boolean {
	const channels: string[] = stateStore.get(Constants.CREATED_CHANNELS);
	return (channels && channels.includes(channelName));
}

/**
 * Check if the org has joined a channel
 * @param orgName the org to check for
 * @param ccp the common connection profile for the network
 * @param channelName the name of the channel to check
 */
export async function isOrgChannelJoined(orgName: string, ccp: CommonConnectionProfileHelper, channelName: string): Promise<boolean> {
	const clientPath: string = path.join(__dirname, Constants.UTIL_TO_CONFIG, orgName + '.json');
	const orgClient: Client = await Client.loadFromConfig(clientPath);

	// Augment it with full CCP
	await assignOrgAdmin(orgClient, orgName, ccp);

	// Get the first target peer for our org
	const peer: Client.Peer = orgClient.getPeersForOrg(orgName + 'MSP')[0];

	BaseUtils.logMsg(`Querying peer ${peer.getName()} for known channels`);
	const message: Client.ChannelQueryResponse = await orgClient.queryChannels(peer, true);

	// loop over message array if present
	let hasJoined: boolean = false;
	for (const msg of message.channels) {
		if (msg.channel_id.localeCompare(channelName) === 0) {
			hasJoined = true;
			break;
		}
	}

	return hasJoined;
}

/**
 * Add a channel to the known created
 * @param channelName the channel to add
 */
export function addToCreatedChannels(channelName: string): void {
	let channels: string[] = stateStore.get(Constants.CREATED_CHANNELS);
	if (channels) {
		channels = channels.concat(channelName);
		stateStore.set(Constants.CREATED_CHANNELS, channels);
	} else {
		stateStore.set(Constants.CREATED_CHANNELS, [channelName]);
	}
}

/**
 * Check if the channel has been updated
 * @param channelName the channel name
 * @param txName the txUpdate name
 */
export function channelHasBeenUpdated(channelName: string, txName: string): boolean {
	const updatedChannels: any = stateStore.get(Constants.UPDATED_CHANNELS);
	return (updatedChannels && updatedChannels[channelName] && updatedChannels[channelName].includes(txName));
}

export function addToUpdatedChannel(channelName: string, txName: string): void {
	let updatedChannels: any = stateStore.get(Constants.UPDATED_CHANNELS);
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
