/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import * as Client from 'fabric-client';
import { Constants } from '../constants';
import * as AdminUtils from './utility/adminUtils';
import * as BaseUtils from './utility/baseUtils';

import * as fs from 'fs';
import * as path from 'path';
import { CommonConnectionProfileHelper } from './utility/commonConnectionProfileHelper';

export async function commitProposal(proposalType: string, txId: Client.TransactionId, proposalResponses: any, proposal: any, channel: Client.Channel): Promise<void> {
	const deployId: string = txId.getTransactionID();
	const request: Client.TransactionRequest = {
		proposal,
		proposalResponses,
		txId,
	};

	BaseUtils.logMsg(`Sending ${proposalType} transaction proposal`);

	const allPeers = channel.getPeers();
	const eventPromises: Promise<string>[] = allPeers.map((peer) => {
		const channelEventHub: Client.ChannelEventHub = channel.getChannelEventHub(peer.getName());
		return new Promise((resolve, reject) => {
			BaseUtils.logMsg(`Register eventHub ${peer.getName()} tx=${deployId}`);

			const handle: NodeJS.Timeout = setTimeout(() => {
				BaseUtils.logError(`Timeout - Failed to receive the event:  waiting on ${channelEventHub.getPeerAddr()}`);
				channelEventHub.disconnect();
				reject(new Error('TIMEOUT waiting on ' + channelEventHub.getPeerAddr()));
			}, 120000);

			channelEventHub.registerTxEvent(deployId.toString(), (tx: string, code: string) => {
				BaseUtils.logMsg(`The chaincode ${proposalType} transaction has been committed on peer ${channelEventHub.getPeerAddr()}`);
				clearTimeout(handle);
				if (code !== 'VALID') {
					BaseUtils.logError(`The chaincode ${proposalType} transaction was invalid, code = ${code}`);
					reject(new Error(`Response code: ${code}`));
				} else {
					BaseUtils.logMsg(`The chaincode ${proposalType} transaction was valid.`);
					resolve(code);
				}
			}, (err: Error) => {
				BaseUtils.logError(`There was a problem with the event ${err}`);
				clearTimeout(handle);
				reject(err);
			}, {
				disconnect: true,
			});
			channelEventHub.connect();
		});
	});

	const sendPromise: Promise<Client.BroadcastResponse> = channel.sendTransaction(request);

	try {
		const allPromises = Array.of<Promise<any>>(sendPromise, ...eventPromises);
		await Promise.all(allPromises);
	} catch (error) {
		BaseUtils.logAndThrow(`The ${proposalType} transaction failed :: ${error}`);
	}

	const sendResult = await sendPromise;
	if (!sendResult.status) {
		BaseUtils.logAndThrow('Failed to submit transaction successfully to the orderer no status');
	}
	if (sendResult.status !== 'SUCCESS') {
		BaseUtils.logAndThrow(`Failed to submit transaction to the orderer, status = ${sendResult.status}`);
	}
	BaseUtils.logMsg(`Successfully submitted ${proposalType} transaction to the orderer`);

	for (const eventPromise of eventPromises) {
		const eventCode = await eventPromise;
		if (eventCode !== 'VALID') {
			BaseUtils.logAndThrow(`Transaction was not valid: code=${eventCode}`);
		}
	}
}

export async function packageContractForOrg(orgName: string, contractName: string, contractType: string, contractVersion: string,  initRequired: boolean, ccp: CommonConnectionProfileHelper): Promise<void> {
	const contractSaveName: string = `contract-${orgName}-${contractName}`;

	// Determine path for contract and metadata
	let contractPath: string;
	let metadataPath: string;
	if (contractType === 'golang') {
		contractPath = path.join(Constants.GO_PRE_PEND, contractName);
		metadataPath = path.join(contractPath, 'metadata');
	} else {
		contractPath = path.join(__dirname, Constants.LIB_TO_CHAINCODE, contractType, contractName);
		metadataPath = path.join(contractPath, 'metadata');
	}

	// Get the Client for passed Org (bare profile)
	const clientPath: string = path.join(__dirname, Constants.LIB_TO_CONFIG, orgName + '.yaml');
	const orgClient: Client = await Client.loadFromConfig(clientPath);

	// Augment it with full CCP
	await AdminUtils.assignOrgAdmin(orgClient, orgName, ccp);

	// Use client to perform chaincode package
	const chaincode: Client.Chaincode = orgClient.newChaincode(contractName, contractVersion);

	// Conditionally add init flag (old/new contract style)
	if (initRequired) {
		chaincode.setInitRequired(true);
		BaseUtils.logMsg(` -- packaging step setting init required for ${contractType} named ${contractName}`);
	} else {
		BaseUtils.logMsg(` -- packaging step NO init required for ${contractType} named ${contractName}`);
	}

	const request: Client.ChaincodePackageRequest = {
		chaincodePath: contractPath,
		chaincodeType: contractType as 'golang' | 'car' | 'java' | 'node',
	};

	// conditionally add goPath
	if (contractType === 'golang') {
		request.goPath = path.join(__dirname, Constants.GO_PATH);
	}
	// conditionally add metadata path
	if (fs.existsSync(metadataPath)) {
		request.metadataPath = metadataPath;
	}

	// Package
	BaseUtils.logMsg(`About to package ${contractType} smart contract named ${contractName}`);
	try {
		await chaincode.package(request);
		BaseUtils.logMsg(`Successfully packaged ${contractType} smart contract named ${contractName}`);
	} catch (error) {
		BaseUtils.logAndThrow('Package Error :: ' + error);
	}

	// save it for later use
	Client.setConfigSetting(contractSaveName, {value: chaincode});
}

export async function installPackagedContractForOrg(orgName: string, contractName: string, ccp: CommonConnectionProfileHelper): Promise<void> {
	const contractSaveName: string = `contract-${orgName}-${contractName}`;

	// Get the Client for passed Org
	const orgClient: Client = await Client.loadFromConfig(ccp.getProfile());

	// Get the first target peer for our org
	const peer: Client.Peer = orgClient.getPeersForOrg(orgName + 'MSP')[0];

	const chaincode: Client.Chaincode = Client.getConfigSetting(contractSaveName).value;

	const request: Client.ChaincodeInstallRequest = {
		request_timeout: Constants.INSTALL_TIMEOUT as number,
		target: peer,
	};

	// Install
	try {
		BaseUtils.logMsg(`About to perform install for the smart contract named ${contractName} on org ${orgName}`);
		const packageId: string = await chaincode.install(request);
		BaseUtils.logMsg(`Installed the smart contract with package ID of ${packageId} on org ${orgName}`);
	} catch (error) {
		BaseUtils.logAndThrow('Install Error :: ' + error);
	}
}

export async function approveInstalledContractForOrg(orgName: string, contractName: string, channelName: string, ccp: CommonConnectionProfileHelper, policyType: string): Promise<void> {
	const contractSaveName: string = `contract-${orgName}-${contractName}`;

	// Get the Client for passed Org
	const orgClient: Client = await Client.loadFromConfig(ccp.getProfile());
	await AdminUtils.getSubmitter(orgClient, true, orgName, ccp);

	// Get the first target peer for our org
	const peer: Client.Peer = orgClient.getPeersForOrg(orgName + 'MSP')[0];
	const channel: Client.Channel = orgClient.getChannel(channelName);

	const chaincode: Client.Chaincode = Client.getConfigSetting(contractSaveName).value;

	// Conditionally act on passed policy
	if (policyType.localeCompare('default') !== 0) {
		const policy: any = require(path.join(__dirname, Constants.LIB_TO_POLICIES))[policyType];
		chaincode.setEndorsementPolicyDefinition(policy);
	}

	// replace the saved one with the one updated with endorsement policy
	Client.setConfigSetting(contractSaveName, {value: chaincode});

	const txId: Client.TransactionId = orgClient.newTransactionID(true);

	const request: Client.ChaincodeRequest = {
		chaincode,
		request_timeout: 60000,
		targets: [peer],
		txId,
	};

	try {
		BaseUtils.logMsg('Chaincode approve - building request');
		// A P P R O V E  for  O R G
		const {proposalResponses, proposal} = await channel.approveChaincodeForOrg(request);
		if (proposalResponses) {
			for (const response of proposalResponses) {
				BaseUtils.logMsg('Processing approve endorsement response from peer ...');
				if (response instanceof Error) {
					BaseUtils.logAndThrow(response);
				} else if (response.response && response.response.status) {
					if (response.response.status === 200) {
						BaseUtils.logMsg(`Chaincode approve - Good peer response status :: ${response.response.status}`);
					} else {
						BaseUtils.logAndThrow(`Chaincode approve - Problem with the chaincode approval :: ${response.response.status} ${response.response.message}`);
					}
				} else {
					BaseUtils.logAndThrow('Chaincode approve - Problem with the chaincode approval no response(s) returned');
				}
			}

			// commit this endorsement like any other
			await commitProposal(Constants.APPROVE, txId, proposalResponses, proposal, channel);
			BaseUtils.logMsg(`Chaincode approval complete`);
		} else {
			BaseUtils.logAndThrow('No chaincode approval proposalResponses was returned');
		}
	} catch (error) {
		BaseUtils.logAndThrow(error);
	}
}

export async function queryCommitReadinessAsOrgOnChannel(orgName: string, contractName: string, channelName: string, ccp: CommonConnectionProfileHelper, expectedStatus: any): Promise<void> {
	const contractSaveName: string = `contract-${orgName}-${contractName}`;

	// Get the Client for passed Org
	const orgClient: Client = await Client.loadFromConfig(ccp.getProfile());
	await AdminUtils.getSubmitter(orgClient, true, orgName, ccp);

	// Get the first target peer for our org
	const target: Client.Peer = orgClient.getPeersForOrg(orgName + 'MSP')[0];
	const channel: Client.Channel = orgClient.getChannel(channelName);

	const chaincode: Client.Chaincode = Client.getConfigSetting(contractSaveName).value;

	const txId: Client.TransactionId = orgClient.newTransactionID(true);

	const request: Client.QueryApprovalStatusRequest = {
		chaincode,
		target,
		txId,
	};

	try {
		BaseUtils.logMsg(`About to checkCommitReadiness on channel ${channelName} for org ${orgName}`);
		const results: Client.QueryApprovalStatusResponse = await channel.checkCommitReadiness(request);
		if (typeof results === 'object' && Object.prototype.hasOwnProperty.call(results, 'approvals')) {
			const approvals: Client.QueryApprovalStatusResults = results.approvals;
			for (const key of Object.keys(expectedStatus)) {
				if (!Object.prototype.hasOwnProperty.call(approvals, key)) {
					BaseUtils.logAndThrow(`Missing approval response for ${key}`);
				}
				if (results.approvals[key] !== expectedStatus[key]) {
					BaseUtils.logAndThrow(`Unexpected approval response from  ${key}: expected ${expectedStatus[key]} but had ${results.approvals[key]}`);
				}
			}
			BaseUtils.logMsg(`Query commit status - Good peer response, the commit status map: ${results}`);
		} else {
			BaseUtils.logAndThrow(`Problem with the channel.checkCommitReadiness(request) response ${results}`);
		}
	} catch (error) {
		BaseUtils.logAndThrow(`Problem with the Query commit ${error}`);
	}
}

export async function retrieveContractPackageAsOrgOnChannel(orgName: string, contractName: string, channelName: string, ccp: CommonConnectionProfileHelper): Promise<Client.GetInstalledChaincodePackageResult | undefined> {
	const contractSaveName: string = `contract-${orgName}-${contractName}`;

	// Get the Client for passed Org
	const orgClient: Client = await Client.loadFromConfig(ccp.getProfile());
	await AdminUtils.getSubmitter(orgClient, true, orgName, ccp);

	// Get the first target peer for our org
	const peer: Client.Peer = orgClient.getPeersForOrg(orgName + 'MSP')[0];
	const channel: Client.Channel = orgClient.getChannel(channelName);

	const txId: Client.TransactionId = orgClient.newTransactionID(true);
	const chaincode: Client.Chaincode = Client.getConfigSetting(contractSaveName).value;

	const request: Client.GetInstalledChaincodePackageRequest = {
		package_id: chaincode.getPackageId(),
		target : peer,
		txId,
	};

	// Run method
	let result: any;
	try {
		BaseUtils.logMsg(`About to getInstalledChaincodePackage on channel ${channelName} for org ${orgName}`);
		result = await channel.getInstalledChaincodePackage(request);
	} catch (error) {
		BaseUtils.logError('Problem with executing channel.getInstalledChaincodePackage(request): ', error);
		throw error;
	}

	if (result && Object.prototype.hasOwnProperty.call(result, 'chaincode_install_package')) {
		BaseUtils.logMsg('Successfully retrieved chaincode_install_package');
		return result;
	} else {
		BaseUtils.logAndThrow('Problem with executing channel.getInstalledChaincodePackage(request): no response returned');
	}
}

export async function queryForDefinedContractAsOrgOnChannel(orgName: string, contractName: string, channelName: string, ccp: CommonConnectionProfileHelper, expected: any): Promise<void> {
	const contractSaveName: string = `contract-${orgName}-${contractName}`;

	// Get the Client for passed Org
	const orgClient: Client = await Client.loadFromConfig(ccp.getProfile());
	await AdminUtils.getSubmitter(orgClient, true, orgName, ccp);

	// Get the first target peer for our org
	const peer: Client.Peer = orgClient.getPeersForOrg(orgName + 'MSP')[0] as Client.Peer;
	const channel: Client.Channel = orgClient.getChannel(channelName) as any;

	const txId: Client.TransactionId = orgClient.newTransactionID(true);
	const chaincode: Client.Chaincode = Client.getConfigSetting(contractSaveName).value;

	const request: Client.QueryChaincodeDefinitionRequest = {
		chaincodeId: chaincode.getName(),
		target : peer,
		txId,
	};

	// Run method
	let result: any;
	try {
		BaseUtils.logMsg(`About to queryChaincodeDefinition on channel ${channelName} for org ${orgName}`);
		result = await channel.queryChaincodeDefinition(request);

		// We might want to actually check what is in the response result
		if (expected && result) {
			for (const key of Object.keys(expected)) {
				if (!Object.prototype.hasOwnProperty.call(result, key)) {
					BaseUtils.logAndThrow(`Missing approval response for ${key}`);
				}
				if (result[key] !== expected[key]) {
					BaseUtils.logAndThrow(`Unexpected chaincode definition for ${key}: expected ${expected[key]} but had ${result[key]}`);
				}
			}
		} else {
			if (result) {
				BaseUtils.logMsg(`queryChaincodeDefinition on channel succeeded, no options passed to compare result against`);
			} else {
				BaseUtils.logAndThrow('Problem with the chaincode query for definition no response returned');
			}
		}
	} catch (error) {
		BaseUtils.logError('Problem with executing channel.queryChaincodeDefinition(request): ', error);
		throw error;
	}
}

export async function performContractCommitWithOrgOnChannel(contractName: string, orgName: string, channelName: string, ccp: CommonConnectionProfileHelper): Promise<void> {
	const contractSaveName: string = `contract-${orgName}-${contractName}`;

	// Get the Client for passed Org
	const orgClient: Client = await Client.loadFromConfig(ccp.getProfile());
	await AdminUtils.getSubmitter(orgClient, true, orgName, ccp);

	// get all the peers
	const targets: Client.Peer[] = AdminUtils.getPeerObjectsForClientOnChannel(orgClient, channelName, ccp);

	const channel: Client.Channel = orgClient.getChannel(channelName);
	const txId: Client.TransactionId = orgClient.newTransactionID(true);
	const chaincode: Client.Chaincode = Client.getConfigSetting(contractSaveName).value;

	const request: any = {
		chaincode,
		request_timeout: Constants.INSTALL_TIMEOUT,
		targets,
		txId,
	};

	try {
		BaseUtils.logMsg('About to perform channel.commitChaincode(request)');
		// C O M M I T   for   C H A N N E L
		const {proposalResponses, proposal} = await channel.commitChaincode(request);
		if (proposalResponses) {
			for (const response of proposalResponses) {
				BaseUtils.logMsg(`Checking proposal response messages ...`);
				if (response instanceof Error) {
					BaseUtils.logAndThrow(response);
				} else if (response.response && response.response.status) {
					if (response.response.status === 200) {
						BaseUtils.logMsg(`Valid response status: ${response.response.status}`);
					} else {
						BaseUtils.logAndThrow(`Problem with the chaincode commit :: status: ${response.response.status} message: ${response.response.message}`);
					}
				} else {
					BaseUtils.logAndThrow('Problem with the chaincode commit no response returned');
				}
			}
		} else {
			BaseUtils.logAndThrow('No chaincode commit proposalResponses was returned');
		}

		// if we get this far, commit this endorsement to the ledger like any other
		await commitProposal(Constants.COMMIT, txId, proposalResponses, proposal, channel);
	} catch (error) {
		BaseUtils.logAndThrow(error);
	}
}

export async function performContractTransactionForOrg(contract: string, contractFunction: string, contractArgs: any, orgName: string, channelName: string, ccp: CommonConnectionProfileHelper, isSubmit: boolean, expectedResult: any, expectedError: any): Promise<any> {

	// Get the Client for passed Org
	const orgClient: any = await Client.loadFromConfig(ccp.getProfile());
	await AdminUtils.getSubmitter(orgClient, true, orgName, ccp);

	// get all the peers
	const targets: Client.Peer[] = AdminUtils.getPeerObjectsForClientOnChannel(orgClient, channelName, ccp) as Client.Peer[];

	const channel: Client.Channel = orgClient.getChannel(channelName) as Client.Channel;
	const txId: any = orgClient.newTransactionID(true);

	// cast string args into what the request requires
	const args: any = JSON.parse(contractArgs);
	const request: any = {
		args,
		chaincodeId: contract,
		fcn: contractFunction,
		targets,
		txId,
	} as  any;

	// These are old style contracts that require init to be called by lifecycle.
	// This will force this sendTransactionProposal to be direct call to the 'Init'
	// method of the chaincode.
	if (contractFunction === 'init') {
		request.is_init = true;
	}

	try {
		if (isSubmit) {
			await submitChannelRequest(channel, request, expectedError, expectedResult);
		} else {
			await queryChannelRequest(channel, request, expectedError, expectedResult);
		}
	} catch (error) {
		BaseUtils.logError(`Unexpected error thrown in channel.sendTransactionProposal`, error);
		throw(error);
	}

	// Conceivably, we might want to return something for a test to use, so create an object to pass back.
	return {
		txId,
	};
}

async function submitChannelRequest(channel: Client.Channel, request: any, expectedError: any, expectedResult: any): Promise<void> {
	const results: [(Client.ProposalResponse | Client.ProposalErrorResponse)[], Client.Proposal] = await channel.sendTransactionProposal(request, Constants.STEP_MED);
	if (results && results[0]) {
		const proposalResponses: any = results[0];
		for (const response of proposalResponses) {
			if (response instanceof Error) {
				// We might be forcing an error, so can condition for that here
				if (expectedError) {
					if ((response as any).status !== expectedError.status) {
						const msg: string = `Expected channel.sendTransactionProposal() to have status ${expectedError.status} but was ${(response as any).status}`;
						BaseUtils.logAndThrow(msg);
					}
					if (!response.message.includes(expectedError.message)) {
						const msg: string = `Expected channel.sendTransactionProposal() fail with message text ${expectedError.message} but was ${response.message}`;
						BaseUtils.logAndThrow(msg);
					}
					// We were expecting this error, and it passed the check, so return here
					BaseUtils.logMsg(`Expected channel.sendTransactionProposal() failure condition met`);
					return;
				} else {
					const msg: string = `Unconditioned error in channel.sendTransactionProposal() with response: ${response}`;
					BaseUtils.logAndThrow(msg);
				}
			} else if (response.response && response.response.status) {
				if (response.response.status === 200) {
					BaseUtils.logMsg(` - Good peer response ${response.response.status}`);
				} else {
					BaseUtils.logAndThrow(`Problem with the chaincode invoke :: status: ${response.response.status} message: ${response.response.message}`);
				}
			} else {
				BaseUtils.logAndThrow('Problem with the chaincode invoke no response returned');
			}
		}

		// Results from running are in each peer
		const peerResponses: (Client.ProposalResponse | Client.ProposalErrorResponse)[] = results[0];
		if (expectedResult) {
			// Each peer should have the same result, so we check over each array item
			for (const peerResponse of peerResponses) {
				const txnResult: any = JSON.parse((peerResponse as any).response.payload.toString());
				if (txnResult !== expectedResult) {
					BaseUtils.logAndThrow(`Expected peer submit response payload to be ${expectedResult} but was ${txnResult}`);
				} else {
					BaseUtils.logMsg(`Confirmed expected peer submit response ${expectedResult}`);
				}
			}
		}

		const proposal: Client.Proposal = results[1];

		// if we get this far then all responses are good (status = 200), go ahead and commit
		await commitProposal(Constants.SUBMIT, request.txId, proposalResponses, proposal, channel);
		BaseUtils.logMsg(` Committed Channel Request`);
	} else {
		BaseUtils.logAndThrow('No chaincode invoke proposalResponses was returned');
	}
}

async function queryChannelRequest(channel: Client.Channel, request: any, expectedError: any, expectedResult: any): Promise<void> {
	const payloads: Buffer[] = await channel.queryByChaincode(request);
	if (payloads) {
		// Results from running are in each peer
		if (expectedResult) {
			// Each peer should have the same result, so we check over each array item
			for (const payload of payloads) {
				const txnResult: any = JSON.parse(payload.toString());
				if (txnResult !== expectedResult) {
					BaseUtils.logAndThrow(`Expected peer query response payload to be ${expectedResult} but was ${txnResult}`);
				} else {
					BaseUtils.logMsg(`Confirmed expected peer query response ${expectedResult}`);
				}
			}
		}
	} else {
		BaseUtils.logAndThrow('No chaincode query proposalResponses was returned');
	}
}
