/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from '../constants';
import { CommonConnectionProfile } from './commonConnectionProfile';
import * as AdminUtils from './utility/adminUtils';
import * as BaseUtils from './utility/baseUtils';
import { StateStore } from './utility/stateStore';

import * as FabricCAServices from 'fabric-ca-client';
import { Gateway, Wallet, Wallets } from 'fabric-network';
import * as fs from 'fs';

const stateStore = StateStore.getInstance();
const txnTypes = ['evaluate', 'submit'];
const txnResponseTypes = ['evaluate', 'error', 'submit'];

/**
 * Create a gateway
 * @param {CommonConnectionProfile} ccp The common connection profile
 * @param {Boolean} tls boolean true if tls network; otherwise false
 * @param {String} userName the user name to perform actions with
 * @param {String} orgName the Organization to which the user belongs
 * @param {String} gatewayName the name of the gateway
 * @param {Boolean} useDiscovery toggle discovery on
 * @return {Gateway} the connected gateway
 */
export async function CreateGateway(ccp: CommonConnectionProfile, tls: boolean, userName: string, orgName: string, gatewayName: string, useDiscovery: boolean) {

	// Might already have a wallet to use
	let wallet = stateStore.get(Constants.WALLET);
	if (!wallet) {
		wallet = await Wallets.newInMemoryWallet();
	}

	// Might already have a user@org in that wallet
	const userId = `${userName}@${orgName}`;
	let userIdentity = await wallet.get(userId);

	// Will always be adding a gateway
	const gateway = new Gateway();

	if (userIdentity) {
		// We have an identity to use
		BaseUtils.logMsg(`Identity ${userId} already exists in wallet and will be used`, undefined);
	} else {
		userIdentity = await identitySetup(wallet, ccp, orgName, userName);

		if (tls) {
			const caName = ccp.getCertificateAuthoritiesForOrg(orgName)[0];
			const fabricCAEndpoint = ccp.getCertificateAuthority(caName).url;
			const tlsInfo = await AdminUtils.tlsEnroll(fabricCAEndpoint, caName);
			const caOrg = ccp.getOrganization(orgName);

			const tlsIdentity = {
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

	const opts = {
		clientTlsIdentity: tls ? 'tlsId' : undefined,
		discovery: {
			asLocalhost: useDiscovery ? useDiscovery : undefined,
			enabled: useDiscovery,
		},
		identity: userIdentity,
		wallet,
	};

	await gateway.connect(ccp.getProfile(), opts);

	BaseUtils.logMsg(`Gateway ${gatewayName} connected`, undefined);
	let gateways = stateStore.get(Constants.GATEWAYS);
	if (gateways) {
		gateways.set(gatewayName, { gateway });
	} else {
		gateways = new Map();
		gateways.set(gatewayName, { gateway });
	}

	stateStore.set(Constants.GATEWAYS, gateways);
}

/**
 * Perform an ID setup
 * @param {Wallet} wallet the in memory wallet to use
 * @param {CommonConnectionProfile} ccp The common connection profile
 * @param {String} orgName the organization name
 * @param {String} userName the user name
 * @return {String} the identity name
 */
async function identitySetup(wallet: Wallet, ccp: CommonConnectionProfile, orgName: string, userName: string) {

	const org = ccp.getOrganization(orgName);
	const orgMsp = org.mspid;

	const identityName = `${userName}@${orgName}`;

	const userCertPath = org.signedCertPEM.path.replace(/Admin/g, userName);
	const cert = fs.readFileSync(userCertPath).toString('utf8');

	const userKeyPath = org.adminPrivateKeyPEM.path.replace(/Admin/g, userName);
	const key = fs.readFileSync(userKeyPath).toString('utf8');

	const identity = {
		credentials: {
			certificate: cert,
			privateKey: key,
		},
		mspId: orgMsp,
		type: 'X.509',
	};

	BaseUtils.logMsg(`Adding identity for ${identityName} to wallet`, undefined);
	await wallet.put(identityName, identity);
	return identityName;
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
export async function PerformGatewayTransaction(gatewayName: string, contractName: string, channelName: string, args: string, txnType: string) {
	// What type of txn is this?
	if (txnTypes.indexOf(txnType) === -1) {
		throw  new Error(`Unknown transaction type ${txnType}, must be one of ${txnTypes}`);
	}
	const submit = ( txnType.localeCompare('submit') === 0 );

	// Get contract from Gateway
	const gateways = stateStore.get(Constants.GATEWAYS);

	if (!gateways || !gateways.has(gatewayName)) {
		throw new Error(`Gateway named ${gatewayName} is not present in the state store ${Object.keys(gateways)}`);
	}

	const gatewayObj = gateways.get(gatewayName);
	const gateway = gatewayObj.gateway;
	const contract = await retrieveContractFromGateway(gateway, channelName, contractName);

	// Split args
	const argArray = args.slice(1, -1).split(',');
	const func = argArray[0];
	const funcArgs = argArray.slice(1);
	try {
		if (submit) {
			BaseUtils.logMsg('Submitting transaction [' + func + '] with arguments ' + args, undefined);
			const result = await contract.submitTransaction(func, ...funcArgs);
			gatewayObj.result = {type: 'submit', response: result.toString()};
			BaseUtils.logMsg('Successfully submitted transaction [' + func + ']', undefined);
			return Promise.resolve();
		} else {
			BaseUtils.logMsg('Evaluating transaction [' + func + '] with arguments ' + args, undefined);
			const result = await contract.evaluateTransaction(func, ...funcArgs);
			BaseUtils.logMsg('Successfully evaluated transaction [' + func  + '] with result [' + result + ']', undefined);
			gatewayObj.result = {type: 'evaluate', response: result.toString()};
			return result.toString();
		}
	} catch (err) {
		gatewayObj.result = {type: 'error', result: err.toString()};
		BaseUtils.logError(err, undefined);
		throw err;
	}
}

/**
 * Retrieve the smart contract from the gateway
 * @param {Gateway} gateway the gateway to work with
 * @param {String} channelName the channel name to use
 * @param {String} contractId the smart contract ID to retrieve the smart contract for
 * @return {Contract} the contract for the instantiated smart contract ID on the channel
 */
async function retrieveContractFromGateway(gateway: Gateway, channelName: string, contractId: string) {
	try {
		BaseUtils.logMsg(`Retrieving contract from channel ${channelName}`, undefined);
		const network = await gateway.getNetwork(channelName);
		const contract = network.getContract(contractId);
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
export function LastTransactionTypeCompare(gatewayName: string, type: string) {
	const gateways = stateStore.get(Constants.GATEWAYS);
	const gatewayObj = gateways.get(gatewayName);

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
 * @param {String} type type of response
 */
export function GetLastTransactionResult(gatewayName: string) {
	const gatewayObj = getGatewayObject(gatewayName);
	return gatewayObj.result;
}

/**
 * Compare the last gateway transaction response with a passed value
 * @param {String} type type of response
 * @param {*} msg the message to compare against
 */
export function LastTransactionResponseCompare(gatewayName: string, msg: string) {
	const gatewayObj = getGatewayObject(gatewayName);
	return (gatewayObj.result.response.localeCompare(msg) === 0);
}

function getGatewayObject(gatewayName: string) {
	const gateways = stateStore.get(Constants.GATEWAYS);
	if (gateways.get(gatewayName)) {
		return gateways.get(gatewayName);
	} else {
		return undefined;
	}
}

/**
 * Disconnect all gateways within the `gateways` Map
 */
export async function DisconnectAllGateways() {
	try {
		const gateways = stateStore.get(Constants.GATEWAYS);
		if (gateways) {
			const iterator = gateways.keys();
			let next = iterator.next();
			while (!next.done) {
				BaseUtils.logMsg('disconnecting from Gateway ', next.value);
				const gateway = gateways.get(next.value).gateway;
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
