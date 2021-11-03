/**
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import * as Constants from '../constants';
import * as AdminUtils from './utility/adminUtils';
import * as BaseUtils from './utility/baseUtils';
import {CommonConnectionProfileHelper} from './utility/commonConnectionProfileHelper';

import * as Client from 'fabric-client';
import * as fs from 'fs';
import * as path from 'path';

const supportedLanguageTypes: string[] = ['node', 'golang'];

export async function sdk_chaincode_install_for_org(ccType: 'golang' | 'car' | 'java' | 'node', ccName: string,  ccVersion: string, chaincodeId: string, tls: boolean, ccp: CommonConnectionProfileHelper, orgName: string, channelName: string): Promise<void> {

	if (!supportedLanguageTypes.includes(ccType)) {
		throw new Error(`Unsupported test ccType ${ccType}`);
	}

	Client.setConfigSetting('request-timeout', Constants.INSTALL_TIMEOUT);
	const client: Client = new Client();
	const channel: Client.Channel = client.newChannel(channelName);

	// Conditional action on TLS enablement
	if (tls) {
		const caName: string = ccp.getCertificateAuthoritiesForOrg(orgName)[0];
		const fabricCAEndpoint: string = ccp.getCertificateAuthority(caName).url;
		const tlsInfo = await AdminUtils.tlsEnroll(fabricCAEndpoint, caName);
		client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
	}

	const cryptoSuite: Client.ICryptoSuite = Client.newCryptoSuite();
	client.setCryptoSuite(cryptoSuite);

	const ordererName: string = ccp.getOrderersForChannel(channelName)[0];
	const caRootsPath: string = ccp.getOrderer(ordererName).tlsCACerts.path;
	let data: Buffer = fs.readFileSync(caRootsPath);
	const pem: string = Buffer.from(data).toString();

	const orderer = ccp.getOrderer(ordererName);
	if (!orderer) {
		BaseUtils.logAndThrow(`Orderer ${ordererName} not found.`);
	}
	channel.addOrderer(
		client.newOrderer(
			orderer.url,
			{
				pem,
				'ssl-target-name-override': ccp.getOrderer(ordererName).grpcOptions['ssl-target-name-override'],
			},
		),
	);

	const targets: Client.Peer[] = [];
	const peers: string[] = ccp.getPeersForOrganization(orgName);
	peers.forEach((peerName: string) => {
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
		const chaincodePath: string = path.join(__dirname, Constants.LIB_TO_CHAINCODE, ccType, ccName);
		const metadataPath: string = path.join(chaincodePath, 'metadata');

		// send proposal to endorser
		const request: Client.ChaincodeInstallRequest = {
			chaincodeId,
			chaincodePath,
			chaincodeType: ccType,
			chaincodeVersion: ccVersion,
			metadataPath,
			targets,
		};

		BaseUtils.logMsg(`Using deprecated API to install chaincode with ID ${chaincodeId}@${ccVersion} on organization ${orgName} peers [${ccp.getPeersForOrganization(orgName).toString()}] ...`);

		const results: Client.ProposalResponseObject = await client.installChaincode(request);

		const proposalResponses: Array<Client.ProposalResponse | Client.ProposalErrorResponse> = results[0];
		if (!proposalResponses) {
			throw new Error('No response returned from client.installChaincode() request when using deprecated API');
		}

		let proposalResponsesValid = true;
		const errors: Client.ProposalErrorResponse[] = [];
		for (const proposalResponse of proposalResponses) {
			let valid = false;
			if ((proposalResponse as Client.ProposalResponse).response && (proposalResponse as Client.ProposalResponse).response.status === 200) {
				valid = true;
			} else {
				errors.push(proposalResponse as Client.ProposalErrorResponse);
			}
			proposalResponsesValid = proposalResponsesValid && valid;
		}
		if (!proposalResponsesValid) {
			throw new Error(`Failed to send install Proposal or receive valid response when using deprecated API: ${JSON.stringify(errors)}`);
		} else {
			BaseUtils.logMsg(`Successfully installed chaincode with ID ${chaincodeId}@${ccVersion} using deprecated API`);
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
 * @param {String} chaincodeId The chaincode id to deploy as
 * @param {String} args chaincode arguments
 * @param {Boolean} upgrade Indicates whether the call is an upgrade or a new instantiation.
 * @param {Boolean} tls true if tls enabled network; false if not
 * @param {CommonConnectionProfileHelper} ccp The common connection profile
 * @param {String} orgName The name of the organization to use
 * @param {String} channelName The channel name
 * @param {Object} policy The endorsement policy object from the configuration file.
 * @return {Promise} The return promise.
 */

export async function sdk_chaincode_instantiate(ccName: string, ccType: 'golang' | 'car' | 'java' | 'node', ccVersion: string, chaincodeId: string, args: string, upgrade: boolean, tls: boolean, ccp: CommonConnectionProfileHelper, orgName: string, channelName: string, policy: Client.EndorsementPolicy): Promise<void> {
	if (!supportedLanguageTypes.includes(ccType)) {
		throw new Error(`Unsupported test ccType: ${ccType}`);
	}

	Client.setConfigSetting('request-timeout', Constants.INSTANTIATE_TIMEOUT);

	const type: string = upgrade ? 'upgrade' : 'instantiate';

	const targets: Client.Peer[] = [];
	const eventHubs: Client.ChannelEventHub[]  = [];
	const client: Client = new Client();
	const channel: Client.Channel = client.newChannel(channelName);

	const cryptoSuite: Client.ICryptoSuite = Client.newCryptoSuite();
	client.setCryptoSuite(cryptoSuite);

	// Conditional action on TLS enablement
	if (tls) {
		const caName: string = ccp.getCertificateAuthoritiesForOrg(orgName)[0];
		const fabricCAEndpoint: string = ccp.getCertificateAuthority(caName).url;
		const tlsInfo = await AdminUtils.tlsEnroll(fabricCAEndpoint, caName);
		client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
	}

	const ordererName: string = ccp.getOrderersForChannel(channelName)[0];
	const caRootsPath: string = ccp.getOrderer(ordererName).tlsCACerts.path;
	let data: Buffer = fs.readFileSync(caRootsPath);
	const pem: string = Buffer.from(data).toString();

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
		BaseUtils.logMsg(`Using deprecated API to perform ${type} transaction on chaincode with ID ${chaincodeId}@${ccVersion} as organization ${orgName} ...`);
		// set user to send install chaincode requests
		await AdminUtils.getSubmitter(client, true /* get peer org admin */, orgName, ccp);

		const peers: string[] = ccp.getPeersForOrganization(orgName);
		peers.forEach((peerName: string) => {
			const thisPeer = ccp.getPeer(peerName);
			data = fs.readFileSync(thisPeer.tlsCACerts.path);
			const peer: Client.Peer = client.newPeer(
				thisPeer.url,
				{
					'pem': Buffer.from(data).toString(),
					'ssl-target-name-override': thisPeer.grpcOptions['ssl-target-name-override'],
				});

			targets.push(peer);
			channel.addPeer(peer, ccp.getOrganization(orgName).mspid);
			const eh: Client.ChannelEventHub = channel.newChannelEventHub(peer);
			eventHubs.push(eh);
		});

		await channel.initialize();

		const transientMap: any = {test: 'transientValue'};
		const proposalRequest: Client.ChaincodeInstantiateUpgradeRequest = buildChaincodeProposal(client, chaincodeId,
			ccVersion, ccType, args, upgrade, transientMap, policy);

		let results: Client.ProposalResponseObject;
		if (upgrade) {
			results = await channel.sendUpgradeProposal(proposalRequest);
		} else {
			results = await channel.sendInstantiateProposal(proposalRequest);
		}

		const proposalResponses: Array<Client.ProposalResponse> = results[0] as Array<Client.ProposalResponse>;
		if (!proposalResponses) {
			throw new Error('No response returned from channel.sendInstantiateProposal() request when using deprecated API');
		}
		const proposal: Client.Proposal = results[1];
		for (const proposalResponse of proposalResponses) {
			if (!((proposalResponse).response && (proposalResponse).response.status === 200)) {
				throw new Error(`The proposal of type ${type} was bad: ${JSON.stringify(proposalResponse)}`);
			}
		}

		const request: Client.TransactionRequest = {
			proposal,
			proposalResponses,
		};

		const deployId: string = proposalRequest.txId.getTransactionID();

		const eventPromises: Promise<any>[] = [];
		eventPromises.push(channel.sendTransaction(request));
		eventHubs.forEach((eh: Client.ChannelEventHub) => {
			const txPromise: Promise<void> = new Promise<void>((resolve, reject) => {
				const handle: NodeJS.Timeout = setTimeout(() => reject(), 300000);

				eh.registerTxEvent(deployId.toString(), (tx: any, code: string) => {
					clearTimeout(handle);
					if (code !== 'VALID') {
						const msg = `The chaincode ${type} transaction was invalid, code = ${code}`;
						BaseUtils.logError(msg);
						reject(msg);
					} else {
						resolve();
					}
				}, (err: Error) => {
					clearTimeout(handle);
					const msg = `There was a problem with the ${type} transaction event: ${JSON.stringify(err)}`;
					BaseUtils.logError(msg);
					reject(msg);
				}, {
					disconnect: true,
				});
				eh.connect();
			});
			eventPromises.push(txPromise);
		});

		const eventResults: any[] = await Promise.all(eventPromises) ;
		if (eventResults && !(eventResults[0] instanceof Error) && (eventResults[0].status === 'SUCCESS')) {
			BaseUtils.logMsg(`Successfully performed ${type} transaction on chaincode with ID ${chaincodeId}@${ccVersion} using deprecated API`);
			return await BaseUtils.sleep(Constants.INC_SHORT);
		} else {
			const msg = `Failed to order the ${type} transaction using deprecated API. Error code: ${String(eventResults[0].status)}`;
			BaseUtils.logError(msg);
			throw new Error(msg);
		}
	} catch (err) {
		const msg = `Failed to perform ${type} instantiation on chaincode with ID ${chaincodeId}@${ccVersion} using deprecated API`;
		BaseUtils.logError(msg, err);
		throw new Error(`${msg} due to error: ${String((err as Error).stack ? (err as Error).stack : err)}`);
	}
}

function buildChaincodeProposal(client: Client, chaincodeId: string, chaincodeVersion: string, chaincodeType: 'golang' | 'car' | 'java' | 'node', ccArgs: string, isUpgrade: boolean, transientMap: any, policy: any): Client.ChaincodeInstantiateUpgradeRequest {
	const txId: Client.TransactionId = client.newTransactionID();

	// args is a string array for the arguments to pass [function, arg0, arg1, arg2, ..., argn]
	const argArray: string[] = ccArgs.slice(1, -1).split(',');
	const fcn: string = argArray[0];
	const args: string[] = argArray.slice(1);

	// send proposal to endorser
	const request: Client.ChaincodeInstantiateUpgradeRequest = {
		args,
		chaincodeId,
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
