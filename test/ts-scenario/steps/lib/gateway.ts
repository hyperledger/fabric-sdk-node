/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from '../constants';
import * as AdminUtils from './utility/adminUtils';
import * as BaseUtils from './utility/baseUtils';
import { CommonConnectionProfileHelper } from './utility/commonConnectionProfileHelper';
import { StateStore } from './utility/stateStore';

import sampleQueryStrategy = require('../../config/handlers/sample-query-handler');
import sampleTxnEventStrategy = require('../../config/handlers/sample-transaction-event-handler');

import { DefaultEventHandlerStrategies, DefaultQueryHandlerStrategies, Gateway, GatewayOptions, Wallet, Wallets, Identity, Contract, Network, TxEventHandlerFactory, QueryHandlerFactory, EventHubManager, Transaction, TransientMap } from 'fabric-network';
import * as fs from 'fs';
import * as path from 'path';
import { ChannelEventHub } from 'fabric-client';
import Client = require('fabric-client');

const stateStore: StateStore = StateStore.getInstance();
const txnTypes: string[] = ['evaluate', 'submit'];
const txnResponseTypes: string[] = ['evaluate', 'event', 'error', 'submit'];
const supportedWallets: string[] = [Constants.FILE_WALLET as string, Constants.MEMORY_WALLET as string, Constants.COUCH_WALLET as string];

const EventStrategies: any = {
	MSPID_SCOPE_ALLFORTX : DefaultEventHandlerStrategies.MSPID_SCOPE_ALLFORTX,
	MSPID_SCOPE_ANYFORTX : DefaultEventHandlerStrategies.MSPID_SCOPE_ANYFORTX,
	NETWORK_SCOPE_ALLFORTX : DefaultEventHandlerStrategies.NETWORK_SCOPE_ALLFORTX,
	NETWORK_SCOPE_ANYFORTX : DefaultEventHandlerStrategies.NETWORK_SCOPE_ANYFORTX,
};

const QueryStrategies: any = {
	MSPID_SCOPE_SINGLE : DefaultQueryHandlerStrategies.MSPID_SCOPE_SINGLE,
	MSPID_SCOPE_ROUND_ROBIN : DefaultQueryHandlerStrategies.MSPID_SCOPE_ROUND_ROBIN,
};

/**
 * Create a gateway
 * @param {CommonConnectionProfileHelper} ccp The common connection profile
 * @param {Boolean} tls boolean true if tls network; otherwise false
 * @param {String} userName the user name to perform actions with
 * @param {String} orgName the Organization to which the user belongs
 * @param {String} gatewayName the name of the gateway
 * @param {Boolean} useDiscovery toggle discovery on
 * @param {String} walletType the type of wallet to back the gateway with (inMemory, fileBased, couchDB)
 * @return {Gateway} the connected gateway
 */
export async function createGateway(ccp: CommonConnectionProfileHelper, tls: boolean, userName: string, orgName: string, gatewayName: string, useDiscovery: boolean, walletType: string): Promise<void> {

	// Might already have a wallet to use, but sanitize the passed walletType
	if (!walletType || !supportedWallets.includes(walletType)) {
		BaseUtils.logAndThrow(`Passed wallet type [${walletType}] is not supported, must be one of: ${supportedWallets}`);
	}

	const myWalletReference: string = `${Constants.WALLET}_walletType`;
	let wallet: Wallet = stateStore.get(myWalletReference);
	if (!wallet) {
		BaseUtils.logMsg(`Creating wallet of type ${walletType}`, undefined);
		switch (walletType) {
			case Constants.MEMORY_WALLET:
				wallet = await Wallets.newInMemoryWallet();
				break;
			case Constants.FILE_WALLET:
				const tempDir: string = path.join(__dirname, Constants.LIB_TO_TEMP, Constants.FILE_WALLET);
				if (fs.existsSync(tempDir)) {
					BaseUtils.recursiveDirDelete(tempDir);
				}
				await fs.mkdirSync(tempDir);
				wallet = await Wallets.newFileSystemWallet(tempDir);
				break;
			case Constants.COUCH_WALLET:
				wallet = await Wallets.newCouchDBWallet({url: Constants.COUCH_WALLET_URL as string});
				break;
			default:
				BaseUtils.logAndThrow(`Unmatched wallet backing store`);
		}
	}

	// Might already have a user@org in that wallet
	const userId: string = `${userName}@${orgName}`;
	const userIdentity: Identity | undefined = await wallet.get(userId);

	// Will always be adding a gateway
	const gateway: Gateway = new Gateway();

	if (userIdentity) {
		// We have an identity to use
		BaseUtils.logMsg(`Identity ${userId} already exists in wallet and will be used`, undefined);
	} else {
		await identitySetup(wallet, ccp, orgName, userName);

		if (tls) {
			const caName: string = ccp.getCertificateAuthoritiesForOrg(orgName)[0];
			const fabricCAEndpoint: string = ccp.getCertificateAuthority(caName).url;
			const tlsInfo: any = await AdminUtils.tlsEnroll(fabricCAEndpoint, caName);
			const caOrg: any = ccp.getOrganization(orgName);

			const tlsIdentity: any = {
				credentials: {
					certificate: tlsInfo.certificate,
					privateKey: tlsInfo.key,
				},
				mspId: caOrg.mspid,
				type: 'X.509',
			};
			await wallet.put('tlsId', tlsIdentity);
		}
	}

	const opts: GatewayOptions = {
		clientTlsIdentity: tls ? 'tlsId' : undefined,
		discovery: {
			asLocalhost: useDiscovery ? useDiscovery : undefined,
			enabled: useDiscovery,
		},
		identity: userId,
		wallet,
	};

	await gateway.connect(ccp.getProfile(), opts);
	const gatewayObj: any = {
		profile: ccp.getProfile(),
		gateway,
	};
	addGatewayObjectToStateStore(gatewayName, gatewayObj);
	BaseUtils.logMsg(`Gateway ${gatewayName} connected`, undefined);
}

function addGatewayObjectToStateStore(gatewayName: string, gateway: any): void {
	let gateways: Map<string, any> = stateStore.get(Constants.GATEWAYS);
	if (gateways) {
		gateways.set(gatewayName, gateway);
	} else {
		gateways = new Map();
		gateways.set(gatewayName, gateway);
	}

	stateStore.set(Constants.GATEWAYS, gateways);
}

function getGatewayObject(gatewayName: string): any | undefined {
	const gateways: Map<string, any> = stateStore.get(Constants.GATEWAYS);
	if (gateways.get(gatewayName)) {
		return gateways.get(gatewayName);
	} else {
		return undefined;
	}
}

export function getGateway(gatewayName: string): Gateway | undefined {
	const gateways: Map<string, any> = stateStore.get(Constants.GATEWAYS);
	if (gateways.get(gatewayName)) {
		return gateways.get(gatewayName).gateway;
	} else {
		const msg: string = `Gateway named ${gatewayName} is not present in the state store`;
		BaseUtils.logAndThrow(msg);
	}
}

/**
 * Perform an ID setup
 * @param {Wallet} wallet the in memory wallet to use
 * @param {CommonConnectionProfileHelper} ccp The common connection profile
 * @param {String} orgName the organization name
 * @param {String} userName the user name
 * @return {String} the identity name
 */
async function identitySetup(wallet: Wallet, ccp: CommonConnectionProfileHelper, orgName: string, userName: string): Promise<void> {

	const org: any = ccp.getOrganization(orgName);
	const orgMsp: string = org.mspid;

	const identityName: string = `${userName}@${orgName}`;

	const userCertPath: string = org.signedCertPEM.path.replace(/Admin/g, userName);
	const cert: string = fs.readFileSync(userCertPath).toString('utf8');

	const userKeyPath: string = org.adminPrivateKeyPEM.path.replace(/Admin/g, userName);
	const key: string = fs.readFileSync(userKeyPath).toString('utf8');

	const identity: any = {
		credentials: {
			certificate: cert,
			privateKey: key,
		},
		mspId: orgMsp,
		type: 'X.509',
	};

	BaseUtils.logMsg(`Adding identity for ${identityName} to wallet`, undefined);
	await wallet.put(identityName, identity);
}

/**
 * Perform a submit or evaluate transaction using the network API
 * @param {String} gatewayName the name of the Gateway to use
 * @param {String} contractName the smart contract name
 * @param {String} channelName the name of the channel the smart contract is instantiated on
 * @param {String} args the arguments array [func, arg0, arg1, ..., argX]
 * @param {String} txnType the type of transaction (submit/evaluate)
 * @return {Object} resolved Promise if a submit transaction; evaluate result if not
 */
export async function performGatewayTransaction(gatewayName: string, contractName: string, channelName: string, args: string, txnType: string): Promise<void> {
	// What type of txn is this?
	if (txnTypes.indexOf(txnType) === -1) {
		throw  new Error(`Unknown transaction type ${txnType}, must be one of ${txnTypes}`);
	}
	const submit: boolean = ( txnType.localeCompare('submit') === 0 );

	// Get contract from Gateway
	const gateways: Map<string, any> = stateStore.get(Constants.GATEWAYS);

	if (!gateways || !gateways.has(gatewayName)) {
		throw new Error(`Gateway named ${gatewayName} is not present in the state store ${Object.keys(gateways)}`);
	}

	const gatewayObj: any = gateways.get(gatewayName);
	const gateway: Gateway = gatewayObj.gateway;
	const contract: Contract = await retrieveContractFromGateway(gateway, channelName, contractName);

	// Split args
	const argArray: string[] = args.slice(1, -1).split(',');
	const func: string = argArray[0];
	const funcArgs: string[] = argArray.slice(1);
	try {
		if (submit) {
			BaseUtils.logMsg('Submitting transaction [' + func + '] with arguments ' + args, undefined);
			const result: Buffer = await contract.submitTransaction(func, ...funcArgs);
			gatewayObj.result = {type: 'submit', response: result.toString()};
			BaseUtils.logMsg('Successfully submitted transaction [' + func + ']', undefined);
		} else {
			BaseUtils.logMsg('Evaluating transaction [' + func + '] with arguments ' + args, undefined);
			const result: Buffer = await contract.evaluateTransaction(func, ...funcArgs);
			BaseUtils.logMsg('Successfully evaluated transaction [' + func  + '] with result [' + result.toString() + ']', undefined);
			gatewayObj.result = {type: 'evaluate', response: JSON.parse(result.toString())};
		}
	} catch (err) {
		gatewayObj.result = {type: 'error', response: err.toString()};
		// Don't log the full error, since we might be forcing the error
		BaseUtils.logError(err.toString(), undefined);
	}
}

/**
 * Perform a transaction using a handler
 * @param gatewayName the name of the gateway to use
 * @param ccName chaincode name to use
 * @param channelName chanel to submit on
 * @param args transaction arguments
 * @param txnType the type of transaction (submit/evaluate)
 * @param handlerOption the handler option to use
 */
export async function performHandledGatewayTransaction(gatewayName: string, ccName: string, channelName: string, args: string, txnType: string, handlerOption: string): Promise<void> {
	// Split args out, we need these for later
	const argArray: string[] = args.slice(1, -1).split(',');
	const func: string = argArray[0];
	const funcArgs: string[] = argArray.slice(1);

	// Retrieve the base gateway
	const gateways: Map<string, any> = stateStore.get(Constants.GATEWAYS);

	if (!gateways || !gateways.has(gatewayName)) {
		throw new Error(`Gateway named ${gatewayName} is not present in the state store ${Object.keys(gateways)}`);
	}

	const gatewayObj: any = gateways.get(gatewayName);
	const gateway: Gateway = gatewayObj.gateway;

	const currentOptions: GatewayOptions = gateway.getOptions();

	// Disconnect
	await gateway.disconnect();

	// Reconnect with new options based on modifying existing with handler option
	const submit: boolean = ( txnType.localeCompare('submit') === 0 );
	if (submit) {
		// add event handler options
		if (handlerOption.localeCompare('custom') === 0) {
			currentOptions.eventHandlerOptions = {
				strategy: sampleTxnEventStrategy as TxEventHandlerFactory
			};
		} else {
			currentOptions.eventHandlerOptions = {
				strategy: EventStrategies[handlerOption]
			};
		}
	} else {
		// Add queryHandlerOptions
		if (handlerOption.localeCompare('custom') === 0) {
			currentOptions.queryHandlerOptions = {
				strategy: sampleQueryStrategy as QueryHandlerFactory
			};
		} else {
			currentOptions.queryHandlerOptions = {
				strategy: QueryStrategies[handlerOption]
			};
		}
	}

	// Reconnect
	await gateway.connect(gatewayObj.profile, currentOptions);

	// Retrieve contract
	const network: Network = await gateway.getNetwork(channelName);
	const contract: Contract = network.getContract(ccName);

	// Build a transaction
	const transaction: Transaction = contract.createTransaction(func);
	const transactionId: string = transaction.getTransactionID().getTransactionID();

	// Submit/evaluate transaction
	if (submit) {
		// Create event hubs to monitor so we can test it worked
		const org1EventHub: ChannelEventHub = await getInternalEventHubForOrg(gateway, channelName, 'Org1MSP');
		const org2EventHub: ChannelEventHub = await getInternalEventHubForOrg(gateway, channelName, 'Org2MSP');

		let org1EventsFired: any = 0;
		let org2EventsFired: number = 0;
		org1EventHub.registerTxEvent('all', (txId: string, code: string) => {
			if (code === 'VALID' && txId === transactionId) {
				org1EventsFired++;
			}
		}, () => {
			// Ignore errors
		});
		org2EventHub.registerTxEvent('all', (txId: string, code: string) => {
			if (code === 'VALID' && txId === transactionId) {
				org2EventsFired++;
			}
		}, () => {
			// Ignore errors
		});

		try {
			// Split args, do not capture response
			await transaction.submit(...funcArgs);
			BaseUtils.logMsg(`Successfully submitted transaction [${func}] using handler [${EventStrategies[handlerOption]}]`, undefined);
		} catch (error) {
			gatewayObj.result = {type: 'error', response: error.toString()};
			BaseUtils.logError(error.toString(), undefined);
		}

		// Record result on gateway object
		const events: any = {
			Org1: org1EventsFired,
			Org2: org2EventsFired,
		};

		gatewayObj.result = {type: 'event', response: JSON.stringify(events)};

	} else {
		// No event hubs, just query away
		try {
			// Split args, capture response
			const result: Buffer = await transaction.evaluate(...funcArgs);
			BaseUtils.logMsg(`Successfully evaluated transaction [${func}] using handler [${QueryStrategies[handlerOption]}] with result [${result}]`, undefined);
			gatewayObj.result = {type: 'evaluate', response: JSON.parse(result.toString())};
		} catch (error) {
			gatewayObj.result = {type: 'error', response: error.toString()};
			BaseUtils.logError(error.toString(), undefined);
		}
	}
}

/**
 * Perform a transaction that uses transient data
 * @param gatewayName the gateway to use
 * @param ccName the chaincode name
 * @param channelName the channel to submit on
 * @param txnArgs transaction arguments [methodName, methodArgs...]
 * @param txnType the type of transaction (submit/evaluate)
 */
export async function performTransientGatewayTransaction(gatewayName: string, ccName: string, channelName: string, args: string, txnType: string): Promise<void> {
	// Split args out, we need these for later
	const argArray: string[] = args.slice(1, -1).split(',');
	const func: string = argArray[0];
	const funcArgs: string[] = argArray.slice(1);

	// Retrieve the base gateway
	const gateways: Map<string, any> = stateStore.get(Constants.GATEWAYS);

	if (!gateways || !gateways.has(gatewayName)) {
		throw new Error(`Gateway named ${gatewayName} is not present in the state store ${Object.keys(gateways)}`);
	}

	// Retrieve gateway and contract
	const gatewayObj: any = gateways.get(gatewayName);
	const gateway: Gateway = gatewayObj.gateway;
	const network: Network = await gateway.getNetwork(channelName);
	const contract: Contract = network.getContract(ccName);

	// Build a transaction
	const transaction: Transaction = contract.createTransaction(func);
	const transactionId: string = transaction.getTransactionID().getTransactionID();

	// Build Transient data
	const transientMap: TransientMap = {};
	let i: number = 0;
	for (const value of funcArgs) {
		transientMap[`key${i}`] = Buffer.from(value);
		i++;
	}

	try {
		const submit: boolean = ( txnType.localeCompare('submit') === 0 );
		if (submit) {
			const result: Buffer = await transaction.setTransient(transientMap).submit();
			BaseUtils.logMsg(`Successfully submitted transaction [${func}] with transient data`, undefined);
			gatewayObj.result = {type: 'submit', response: JSON.parse(result.toString())};
		} else {
			const result: Buffer = await transaction.setTransient(transientMap).evaluate();
			BaseUtils.logMsg(`Successfully evaluated transaction [${func}] with transient data`, undefined);
			gatewayObj.result = {type: 'evaluate', response: JSON.parse(result.toString())};
		}
	} catch (error) {
		gatewayObj.result = {type: 'error', response: error.toString()};
		BaseUtils.logError(error.toString(), undefined);
	}
}

/**
 * Retrieve the smart contract from the gateway
 * @param {Gateway} gateway the gateway to work with
 * @param {String} channelName the channel name to use
 * @param {String} contractId the smart contract ID to retrieve the smart contract for
 * @return {Contract} the contract for the instantiated smart contract ID on the channel
 */
export async function retrieveContractFromGateway(gateway: Gateway, channelName: string, contractId: string): Promise<Contract> {
	try {
		BaseUtils.logMsg(`Retrieving contract from channel ${channelName}`, undefined);
		const network: Network = await gateway.getNetwork(channelName);
		const contract: Contract = network.getContract(contractId);
		return contract;
	} catch (err) {
		BaseUtils.logError('retrieveContractFromGateway failed with error ', err);
		throw err;
	}
}

/**
 * Compare the last gateway transaction type with a passed value
 * @param {String} gatewayName gateway name
 * @param {String} type type of response
 */
export function lastTransactionTypeCompare(gatewayName: string, type: string): boolean {
	const gateways: Map<string, any> = stateStore.get(Constants.GATEWAYS);
	const gatewayObj: any = gateways.get(gatewayName);

	if (!gatewayObj) {
		throw  new Error('Unknown gateway with name ' + gatewayName);
	}

	if (!gatewayObj.result) {
		throw  new Error('No existing response on gateway ' + gatewayName);
	}

	if (txnResponseTypes.indexOf(type) === -1) {
		throw  new Error('Unknown type transaction response type ' + type + ', must be one of [evaluate, error, submit]');
	}

	return gatewayObj.result.type.localeCompare(type) === 0;
}

/**
 * Retrieve the last gateway transaction result
 * @param {String} gatewayName the gateway to get the result from
 */
export function getLastTransactionResult(gatewayName: string): any {
	return getGatewayObject(gatewayName).result;
}

/**
 * Compare the last gateway transaction response with a passed value
 * @param {String} gatewayName the gateway to get the response from
 * @param {*} msg the message to compare against
 */
export function lastTransactionResponseCompare(gatewayName: string, msg: string, exactMatch: boolean): boolean {
	const gatewayObj: any = getGatewayObject(gatewayName);
	if (exactMatch) {
		return (gatewayObj.result.response.localeCompare(JSON.parse(msg)) === 0);
	} else {
		return gatewayObj.result.response.includes(JSON.parse(msg));
	}
}

/**
 * Disconnect all gateways within the `gateways` Map
 */
export async function disconnectAllGateways(): Promise<void> {
	try {
		const gateways: Map<string, Gateway> = stateStore.get(Constants.GATEWAYS);
		if (gateways) {
			const iterator: IterableIterator<string> = gateways.keys();
			let next: IteratorResult<string> = iterator.next();
			while (!next.done) {
				BaseUtils.logMsg('disconnecting from Gateway ', next.value);
				const gatewayObj: any = gateways.get(next.value);
				const gateway: Gateway = gatewayObj.gateway;
				await gateway.disconnect();
				next = iterator.next();
			}
			gateways.clear();
			stateStore.set(Constants.GATEWAYS, gateways);
		}
	} catch (err) {
		BaseUtils.logError('disconnectAllGateways() failed with error ', err);
		throw err;
	}
}

async function getInternalEventHubForOrg(gateway: Gateway, channelName: string, orgMSP: string): Promise<ChannelEventHub> {
	const network: Network = await gateway.getNetwork(channelName);
	const channel: Client.Channel = network.getChannel();
	const orgPeer: any = channel.getPeersForOrg(orgMSP)[0]; // Only one peer per org in the test configuration

	// Using private functions to get hold of an internal event hub. Don't try this at home, kids!
	const eventHubManager: EventHubManager = (network as any).getEventHubManager();
	return eventHubManager.getEventHub(orgPeer);
}
