/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from '../constants';
import * as AdminUtils from './utility/adminUtils';
import * as BaseUtils from './utility/baseUtils';
import { CommonConnectionProfileHelper } from './utility/commonConnectionProfileHelper';
import { StateStore } from './utility/stateStore';

import { createQueryHandler as sampleQueryStrategy } from '../../config/handlers/sample-query-handler';
import { createTransactionEventHandler as sampleTxnEventStrategy } from '../../config/handlers/sample-transaction-event-handler';

import { DefaultEventHandlerStrategies, QueryHandlerStrategies, Gateway, GatewayOptions, Wallet, Wallets, Identity, Contract, Network, TxEventHandlerFactory, QueryHandlerFactory, Transaction, TransientMap } from 'fabric-network';
import * as fs from 'fs';
import * as path from 'path';

const stateStore: StateStore = StateStore.getInstance();
const txnTypes: string[] = ['evaluate', 'submit'];
const txnResponseTypes: string[] = ['evaluate', 'error', 'submit'];
const supportedWallets: string[] = [Constants.FILE_WALLET as string, Constants.MEMORY_WALLET as string, Constants.COUCH_WALLET as string];

const EventStrategies: any = {
	MSPID_SCOPE_ALLFORTX : DefaultEventHandlerStrategies.MSPID_SCOPE_ALLFORTX,
	MSPID_SCOPE_ANYFORTX : DefaultEventHandlerStrategies.MSPID_SCOPE_ANYFORTX,
	NETWORK_SCOPE_ALLFORTX : DefaultEventHandlerStrategies.NETWORK_SCOPE_ALLFORTX,
	NETWORK_SCOPE_ANYFORTX : DefaultEventHandlerStrategies.NETWORK_SCOPE_ANYFORTX,
};

const QueryStrategies: any = {
	MSPID_SCOPE_SINGLE : QueryHandlerStrategies.MSPID_SCOPE_SINGLE,
	MSPID_SCOPE_ROUND_ROBIN : QueryHandlerStrategies.MSPID_SCOPE_ROUND_ROBIN,
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
		BaseUtils.logMsg(`Creating wallet of type ${walletType}`);
		switch (walletType) {
			case Constants.MEMORY_WALLET:
				wallet = await Wallets.newInMemoryWallet();
				break;
			case Constants.FILE_WALLET:
				const tempDir: string = path.join(__dirname, Constants.LIB_TO_TEMP, Constants.FILE_WALLET);
				if (fs.existsSync(tempDir)) {
					BaseUtils.recursiveDirDelete(tempDir);
				}
				fs.mkdirSync(tempDir);
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
		BaseUtils.logMsg(`Identity ${userId} already exists in wallet and will be used`);
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
	BaseUtils.logMsg(`Gateway ${gatewayName} connected`);
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

function getGatewayObject(gatewayName: string): any {
	const gateways: Map<string, any> = stateStore.get(Constants.GATEWAYS);
	if (gateways.get(gatewayName)) {
		return gateways.get(gatewayName);
	} else {
		const msg: string = `Gateway named ${gatewayName} is not present in the state store`;
		BaseUtils.logAndThrow(msg);
	}
}

function getGateway(gatewayName: string): any {
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

	BaseUtils.logMsg(`Adding identity for ${identityName} to wallet`);
	await wallet.put(identityName, identity);
}

/**
 * Perform a submit or evaluate transaction using the network API
 * @param {String} gatewayName the name of the Gateway to use
 * @param {String} contractName the smart contract name
 * @param {String} channelName the name of the channel the smart contract is instantiated on
 * @param {String} args the arguments array [func, arg0, arg1, ..., argX]
 * @param {String} txnType the type of transaction (submit/evaluate)
 * @param {String} handlerOption Optional: the handler option to use
 */
export async function performGatewayTransaction(gatewayName: string, contractName: string, channelName: string, args: string, txnType: string, handlerOption?: string): Promise<void> {

	const gatewayObj: any = getGatewayObject(gatewayName);
	const gateway: Gateway = getGateway(gatewayName);

	const submit: boolean = isSubmit(txnType);

	// If a commit event handler was specified
	if (handlerOption) {

		gateway.disconnect();

		const currentOptions: GatewayOptions = gateway.getOptions();

		if (submit) {
			// add event handler options
			if (handlerOption.localeCompare('custom') === 0) {
				currentOptions.transaction = {
					strategy: sampleTxnEventStrategy as TxEventHandlerFactory
				};
			} else {
				currentOptions.transaction = {
					strategy: EventStrategies[handlerOption]
				};
			}
		} else {
			// Add queryHandlerOptions
			if (handlerOption.localeCompare('custom') === 0) {
				currentOptions.query = {
					strategy: sampleQueryStrategy as QueryHandlerFactory
				};
			} else {
				currentOptions.query = {
					strategy: QueryStrategies[handlerOption]
				};
			}
		}
		// Reconnect with new options based on modifying existing with handler option
		await gateway.connect(gatewayObj.profile, currentOptions);

	}

	const contract: Contract = await retrieveContractFromGateway(gateway, channelName, contractName);

	// Split args
	const argArray: string[] = args.slice(1, -1).split(',');
	const func: string = argArray[0];
	const funcArgs: string[] = argArray.slice(1);

	// Submit/evaluate transaction
	try {
		const transaction: Transaction = contract.createTransaction(func);
		let resultBuffer: Buffer;
		if (submit) {
			resultBuffer = await transaction.submit(...funcArgs);
		} else {
			resultBuffer = await transaction.evaluate(...funcArgs);
		}
		const result: string = resultBuffer.toString('utf8');
		BaseUtils.logMsg(`Successfully performed ${txnType} transaction [${func}] with result [${result}]`);
		gatewayObj.result = {type: txnType, response: result};

	} catch (error) {
		gatewayObj.result = {type: 'error', response: error.toString()};
		BaseUtils.logError(' --- in gateway transaction:' + error.toString());
	}
}

/**
 * Perform a transaction that uses transient data
 * @param gatewayName the gateway to use
 * @param contractName the contract name
 * @param channelName the channel to submit on
 * @param txnArgs transaction arguments [methodName, methodArgs...]
 * @param txnType the type of transaction (submit/evaluate)
 */
export async function performTransientGatewayTransaction(gatewayName: string, contractName: string, channelName: string, args: string, txnType: string): Promise<void> {

	// Retrieve gateway and contract
	const gatewayObj: any = getGatewayObject(gatewayName);
	const gateway: Gateway = getGateway(gatewayName);
	const contract: Contract = await retrieveContractFromGateway(gateway, channelName, contractName);

	// Split args out
	const argArray: string[] = args.slice(1, -1).split(',');
	const func: string = argArray[0];
	const funcArgs: string[] = argArray.slice(1);

	// Build Transient data
	const transientMap: TransientMap = {};
	let i: number = 0;
	for (const value of funcArgs) {
		transientMap[`key${i}`] = Buffer.from(value);
		i++;
	}

	const submit: boolean = isSubmit(txnType);

	try {
		const transaction: Transaction = contract.createTransaction(func);
		let resultBuffer: Buffer;
		if (submit) {
			resultBuffer = await transaction.setTransient(transientMap).submit();
		} else {
			resultBuffer = await transaction.setTransient(transientMap).evaluate();
		}
		const result: string = resultBuffer.toString('utf8');
		BaseUtils.logMsg(`Successfully performed ${txnType} transaction [${func}] with transient data with result of [${result}]`);
		gatewayObj.result = {type: txnType, response: result};
	} catch (error) {
		gatewayObj.result = {type: 'error', response: error.toString()};
		BaseUtils.logError('--- in ' + txnType + ' with transient: ' + error.toString());
	}
}

/**
 * Determine if txnType is valid and is equal to 'submit'
 * @param {String} txnType the txnType to check
 * @returns {boolean} true if txnType is valid and equal to 'submit'
 */
function isSubmit(txnType: string): boolean {

	if (txnTypes.indexOf(txnType) === -1) {
		throw  new Error(`Unknown transaction type ${txnType}, must be one of ${txnTypes}`);
	}
	return txnType.localeCompare('submit') === 0 ;
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
		BaseUtils.logMsg(`Retrieving contract from channel ${channelName}`);
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
 * @param {String} msg the message to compare against
 * @param {boolean} exactMatch boolean flag to indicate if an exact match is being performed
 */
export function lastTransactionResponseCompare(gatewayName: string, msg: string, exactMatch: boolean): boolean {
	const gatewayObj: any = getGatewayObject(gatewayName);

	let result: string;
	if (typeof gatewayObj.result.response === 'string') {
		result = gatewayObj.result.response;
	} else { // must be an object
		result = JSON.stringify(gatewayObj.result.response);
	}

	BaseUtils.logMsg(`Comparing gatewayObj.result.response ${result} to msg ${msg}`);

	if (exactMatch) {
		return (result.localeCompare(msg) === 0);
	} else {
		return result.includes(msg);
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
				gateway.disconnect();
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
