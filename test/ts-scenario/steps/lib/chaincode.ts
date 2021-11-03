
/**
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as Client from 'fabric-client';
import * as Constants from '../constants';
import * as AdminUtils from './utility/adminUtils';
import * as BaseUtils from './utility/baseUtils';

// import * as fs from 'fs';
// import * as path from 'path';
import {CommonConnectionProfileHelper} from './utility/commonConnectionProfileHelper';

export interface ExpectedError {
	message: string;
	status: number;
}

export async function commitProposal(proposalType: string, txId: Client.TransactionId, proposalResponses: any, proposal: any,
	channel: Client.Channel): Promise<void> {
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
				BaseUtils.logError(`There was a problem with the event ${err as unknown as string}`);
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
		BaseUtils.logAndThrow(`The ${proposalType} transaction failed :: ${String(error)}`);
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

export async function performContractTransactionForOrg(contract: string, contractFunction: string,
	contractArgs: string, orgName: string, channelName: string, ccp: CommonConnectionProfileHelper, isSubmit: boolean,
	expectedResult: any, expectedError: ExpectedError | undefined): Promise<any> {

	// Get the Client for passed Org
	const orgClient: Client = Client.loadFromConfig(ccp.getProfile());
	await AdminUtils.getSubmitter(orgClient, true, orgName, ccp);

	// get all the peers
	const targets: Client.Peer[] = AdminUtils.getPeerObjectsForClientOnChannel(orgClient, channelName, ccp) ;

	const channel: Client.Channel = orgClient.getChannel(channelName);
	const txId: any = orgClient.newTransactionID(true);

	// cast string args into what the request requires
	const args: any = JSON.parse(contractArgs);
	const request: Client.ChaincodeInvokeRequest = {
		args,
		chaincodeId: contract,
		fcn: contractFunction,
		targets,
		txId,
	};

	// These are old style contracts that require init to be called by lifecycle.
	// This will force this sendTransactionProposal to be direct call to the 'Init'
	// method of the chaincode.
	if (contractFunction === 'init') {
		(request as any).is_init = true;
	}

	try {
		if (isSubmit) {
			await submitChannelRequest(channel, request, expectedError, expectedResult);
		} else {
			await queryChannelRequest(channel, request, expectedError, expectedResult);
		}
	} catch (error) {
		BaseUtils.logError('Unexpected error thrown in channel.sendTransactionProposal', error);
		throw (error);
	}

	// Conceivably, we might want to return something for a test to use, so create an object to pass back.
	return {
		txId,
	};
}

async function submitChannelRequest(
	channel: Client.Channel,
	request: Client.ChaincodeInvokeRequest,
	expectedError: ExpectedError | undefined,
	expectedResult: any,
): Promise<void> {
	const [proposalResponses, proposal] = await channel.sendTransactionProposal(request, Constants.STEP_MED);
	if (proposalResponses) {
		for (const response of proposalResponses) {
			if (response instanceof Error) {
				// We might be forcing an error, so can condition for that here
				if (expectedError) {
					if ((response as any).status !== expectedError.status) {
						const msg = `Expected channel.sendTransactionProposal() to have status ${expectedError.status} but was ${String((response as any).status)}`;
						BaseUtils.logAndThrow(msg);
					}
					if (!response.message.includes(expectedError.message)) {
						const msg = `Expected channel.sendTransactionProposal() fail with message text ${expectedError.message} but was ${response.message}`;
						BaseUtils.logAndThrow(msg);
					}
					// We were expecting this error, and it passed the check, so return here
					BaseUtils.logMsg('Expected channel.sendTransactionProposal() failure condition met');
					return;
				} else {
					const msg = `Unconditioned error in channel.sendTransactionProposal() with response: ${String(response)}`;
					BaseUtils.logAndThrow(msg);
				}
			} else if (response.response && response.response.status) {
				if (response.response.status === 200) {
					BaseUtils.logMsg(` - Good peer response ${response.response.status as number}`);
				} else {
					BaseUtils.logAndThrow(`Problem with the chaincode invoke :: status: ${response.response.status} message: ${response.response.message}`);
				}
			} else {
				BaseUtils.logAndThrow('Problem with the chaincode invoke no response returned');
			}
		}

		// Results from running are in each peer
		if (expectedResult) {
			// Each peer should have the same result, so we check over each array item
			for (const peerResponse of proposalResponses as Client.ProposalResponse[]) {
				const txnResult = JSON.parse(peerResponse.response.payload.toString());
				if (txnResult !== expectedResult) {
					BaseUtils.logAndThrow(`Expected peer submit response payload to be ${expectedResult as string} but was ${txnResult as string}`);
				} else {
					BaseUtils.logMsg(`Confirmed expected peer submit response ${expectedResult as string}`);
				}
			}
		}

		// if we get this far then all responses are good (status = 200), go ahead and commit
		await commitProposal(Constants.SUBMIT, request.txId, proposalResponses, proposal, channel);
		BaseUtils.logMsg(' Committed Channel Request');
	} else {
		BaseUtils.logAndThrow('No chaincode invoke proposalResponses was returned');
	}
}

async function queryChannelRequest(
	channel: Client.Channel,
	request: Client.ChaincodeQueryRequest,
	expectedError: ExpectedError | undefined,
	expectedResult: any,
): Promise<void> {
	const payloads: Buffer[] = await channel.queryByChaincode(request);
	if (payloads) {
		// Results from running are in each peer
		if (expectedResult) {
			// Each peer should have the same result, so we check over each array item
			for (const payload of payloads) {
				const txnResult: any = JSON.parse(payload.toString());
				if (txnResult !== expectedResult) {
					BaseUtils.logAndThrow(`Expected peer query response payload to be ${expectedResult as string} but was ${txnResult as string}`);
				} else {
					BaseUtils.logMsg(`Confirmed expected peer query response ${expectedResult as string}`);
				}
			}
		}
	} else {
		BaseUtils.logAndThrow('No chaincode query proposalResponses was returned');
	}
}
