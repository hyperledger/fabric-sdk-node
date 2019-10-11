/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from '../constants';
import { CommonConnectionProfile } from './commonConnectionProfile';
import * as AdminUtils from './utility/adminUtils';
import * as BaseUtils from './utility/baseUtils';
import { StateStore } from './utility/stateStore';

import * as Client from 'fabric-client';
import * as fs from 'fs';
import * as path from 'path';

const stateStore = StateStore.getInstance();
const supportedLanguageTypes = ['node', 'golang'];
const chaincodeRootPath = '../../../ts-fixtures/chaincode';

export async function sdk_chaincode_install_for_org(ccType: string, ccName: string,  ccVersion: string, chaincodeId: string, tls: boolean, ccp: CommonConnectionProfile, orgName: string, channelName: string) {

	if (!supportedLanguageTypes.includes(ccType)) {
		Promise.reject(`Unsupported test ccType ${ccType}`);
	}

	Client.setConfigSetting('request-timeout', Constants.INSTALL_TIMEOUT);
	const client = new Client();
	const channel = client.newChannel(channelName);

	// Conditional action on TLS enablement
	if (tls) {
		const caName = ccp.getCertificateAuthoritiesForOrg(orgName)[0];
		const fabricCAEndpoint = ccp.getCertificateAuthority(caName).url;
		const tlsInfo = await AdminUtils.tlsEnroll(fabricCAEndpoint, caName);
		client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
	}

	const cryptoSuite = Client.newCryptoSuite();
	client.setCryptoSuite(cryptoSuite);

	const ordererName = ccp.getOrderersForChannel(channelName)[0];
	const caRootsPath = ccp.getOrderer(ordererName).tlsCACerts.path;
	let data = fs.readFileSync(caRootsPath);
	const pem = Buffer.from(data).toString();

	channel.addOrderer(
		client.newOrderer(
			ccp.getOrderer(ordererName).url,
			{
				pem,
				'ssl-target-name-override': ccp.getOrderer(ordererName).grpcOptions['ssl-target-name-override'],
			},
		),
	);

	const targets: Client.Peer[] = [];
	const peers = ccp.getPeersForOrganization(orgName) as string[];
	peers.forEach((peerName) => {
		const peer = ccp.getPeer(peerName);
		data = fs.readFileSync(peer.tlsCACerts.path);
		targets.push(
			client.newPeer(
				peer.url,
				{
					'pem': Buffer.from(data).toString(),
					'ssl-target-name-override': peer.grpcOptions['ssl-target-name-override'],
				},
			),
		);
	});

	try {
		// set user to send install chaincode requests
		await AdminUtils.getSubmitter(client, true /* get peer org admin */, orgName, ccp);

		// chaincode and metadata paths
		const chaincodePath = path.join(__dirname, chaincodeRootPath, ccType, ccName);
		const metadataPath = path.join(chaincodePath, 'metadata');

		// send proposal to endorser
		const request = {
			chaincodeId,
			chaincodePath,
			chaincodeType: ccType,
			chaincodeVersion: ccVersion,
			metadataPath,
			targets,
		};

		BaseUtils.logMsg(`Using deprecated API to install chaincode with ID ${chaincodeId}@${ccVersion} on organization ${orgName} peers [${ccp.getPeersForOrganization(orgName).toString()}] ...`, undefined);

		const results = await client.installChaincode(request as any);

		const proposalResponses = results[0];
		if (!proposalResponses) {
			throw new Error('No response returned from client.installChaincode() request when using deprecated API');
		}

		let proposalResponsesValid = true;
		const errors = [];
		for (const proposalResponse of proposalResponses) {
			let valid = false;
			if ((proposalResponse  as any).response && (proposalResponse  as any).response.status === 200) {
				valid = true;
			} else {
				errors.push(proposalResponse);
			}
			proposalResponsesValid = proposalResponsesValid && valid;
		}
		if (!proposalResponsesValid) {
			throw new Error(`Failed to send install Proposal or receive valid response when using deprecated API: ${JSON.stringify(errors)}`);
		} else {
			BaseUtils.logMsg(`Successfully installed chaincode with ID ${chaincodeId}@${ccVersion} using deprecated API`, undefined);
			return await BaseUtils.sleep(Constants.INC_SHORT);
		}
	} catch (err) {
		BaseUtils.logError('Failed to install chaincode using deprecated API', err);
		throw err;
	}
}

/**
 * Instantiate or upgrade the given chaincode with the given endorsement policy.
 * @param {String} ccName The name of the chaincode to instantiate
 * @param {String} ccType The chaincode type to install (node | goLang | Java ...)
 * @param {String} ccVersion The chaincode version
 * @param {String} chaincodeId The chaincode id to delploy as
 * @param {String} args chaincode arguments
 * @param {Boolean} upgrade Indicates whether the call is an upgrade or a new instantiation.
 * @param {Boolean} tls true if tls enabled network; false if not
 * @param {CommonConnectionProfile} ccp The common connection profile
 * @param {String} orgName The name of the organization to use
 * @param {String} channelName The channel name
 * @param {String} policy The endorsement policy object from the configuration file.
 * @return {Promise} The return promise.
 */
export async function sdk_chaincode_instantiate(ccName: string, ccType: string, ccVersion: string, chaincodeId: string, args: string, upgrade: boolean, tls: boolean, ccp: CommonConnectionProfile, orgName: string, channelName: string, policy: string) {
	if (!supportedLanguageTypes.includes(ccType)) {
		Promise.reject(`Unsupported test ccType: ${ccType}`);
	}

	Client.setConfigSetting('request-timeout', Constants.INSTANTIATE_TIMEOUT);

	const type = upgrade ? 'upgrade' : 'instantiate';

	const targets: Client.Peer[] = [];
	const eventHubs: Client.ChannelEventHub[]  = [];
	const client = new Client();
	const channel: Client.Channel = client.newChannel(channelName);

	const cryptoSuite = Client.newCryptoSuite();
	client.setCryptoSuite(cryptoSuite);

	// Conditional action on TLS enablement
	if (tls) {
		const caName = ccp.getCertificateAuthoritiesForOrg(orgName)[0];
		const fabricCAEndpoint = ccp.getCertificateAuthority(caName).url;
		const tlsInfo = await AdminUtils.tlsEnroll(fabricCAEndpoint, caName);
		client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
	}

	const ordererName = ccp.getOrderersForChannel(channelName)[0];
	const caRootsPath = ccp.getOrderer(ordererName).tlsCACerts.path;
	let data = fs.readFileSync(caRootsPath);
	const pem = Buffer.from(data).toString();

	channel.addOrderer(
		client.newOrderer(
			ccp.getOrderer(ordererName).url,
			{
				pem,
				'ssl-target-name-override': ccp.getOrderer(ordererName).grpcOptions['ssl-target-name-override'],
			},
		),
	);

	try {
		BaseUtils.logMsg(`Using deprecated API to perform ${type} transaction on chaincode with ID ${chaincodeId}@${ccVersion} as organization ${orgName} ...`, undefined);
		// set user to send install chaincode requests
		await AdminUtils.getSubmitter(client, true /* get peer org admin */, orgName, ccp);

		const peers = ccp.getPeersForOrganization(orgName) as string[];
		peers.forEach((peerName) => {
			const thisPeer = ccp.getPeer(peerName);
			data = fs.readFileSync(thisPeer.tlsCACerts.path);
			const peer = client.newPeer(
				thisPeer.url,
				{
					'pem': Buffer.from(data).toString(),
					'ssl-target-name-override': thisPeer.grpcOptions['ssl-target-name-override'],
				});

			targets.push(peer);
			channel.addPeer(peer, ccp.getOrganization(orgName).mspid);
			const eh = channel.newChannelEventHub(peer);
			eventHubs.push(eh);
		});

		await channel.initialize();

		const transientMap = {test: 'transientValue'};
		const ccPath = path.join(__dirname, chaincodeRootPath, ccName, ccType);
		const proposalRequest = buildChaincodeProposal(client, chaincodeId, ccPath, ccVersion, ccType, args, upgrade, transientMap, policy);

		let results;
		if (upgrade) {
			results = await channel.sendUpgradeProposal(proposalRequest as any);
		} else {
			results = await channel.sendInstantiateProposal(proposalRequest as any);
		}

		const proposalResponses = results[0];
		if (!proposalResponses) {
			throw new Error('No response returned from channel.sendInstantiateProposal() request when using deprecated API');
		}
		const proposal = results[1];
		for (const proposalResponse of proposalResponses) {
			if (!((proposalResponse as any).response && (proposalResponse as any).response.status === 200)) {
				Promise.reject(`The proposal of type ${type} was bad: ${JSON.stringify(proposalResponse)}`);
			}
		}

		const request = {
			proposal,
			proposalResponses,
		};

		const deployId = proposalRequest.txId.getTransactionID();

		const eventPromises = [];
		eventPromises.push(channel.sendTransaction(request as any));
		eventHubs.forEach((eh) => {
			const txPromise = new Promise((resolve, reject) => {
				const handle = setTimeout(reject, 300000);

				eh.registerTxEvent(deployId.toString(), (tx, code) => {
					clearTimeout(handle);
					if (code !== 'VALID') {
						const msg = `The chaincode ${type} transaction was invalid, code = ${code}`;
						BaseUtils.logError(msg, undefined);
						reject(msg);
					} else {
						resolve();
					}
				}, (err) => {
					clearTimeout(handle);
					const msg = `There was a problem with the ${type} transaction event: ${JSON.stringify(err)}`;
					BaseUtils.logError(msg, undefined);
					reject(msg);
				}, {
					disconnect: true,
				});
				eh.connect();
			});
			eventPromises.push(txPromise);
		});

		results = await Promise.all(eventPromises);
		if (results && !(results[0] instanceof Error) && results[0].status === 'SUCCESS') {
			BaseUtils.logMsg(`Successfully performed ${type} transaction on chaincode with ID ${chaincodeId}@${ccVersion} using deprecated API`, undefined);
			return await BaseUtils.sleep(Constants.INC_SHORT);
		} else {
			const msg = `Failed to order the ${type} transaction using deprecated API. Error code: ${results[0].status}`;
			BaseUtils.logError(msg, undefined);
			throw new Error(msg);
		}
	} catch (err) {
		const msg = `Failed to perform ${type} instantiation on chaincode with ID ${chaincodeId}@${ccVersion} using deprecated API`;
		BaseUtils.logError(msg, err);
		throw new Error(`${msg} due to error: ${err.stack ? err.stack : err}`);
	}
}

function buildChaincodeProposal(client: Client, chaincodeId: string, chaincodePath: string, chaincodeVersion: string, chaincodeType: string, ccArgs: string, isUpgrade: boolean, transientMap: any, policy: any) {
	const txId = client.newTransactionID();

	// args is a string array for the arguments to pass [function, arg0, arg1, arg2, ..., argn]
	const argArray = ccArgs.slice(1, -1).split(',');
	const fcn = argArray[0];
	const args = argArray.slice(1);

	// send proposal to endorser
	const request = {
		args,
		chaincodeId,
		chaincodePath,
		chaincodeType,
		chaincodeVersion,
		'endorsement-policy': policy,
		fcn,
		txId,
	};

	if (isUpgrade) {
		(request as any).transientMap = transientMap;
	}
	return request;
}
