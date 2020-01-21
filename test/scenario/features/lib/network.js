/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const {Gateway, Wallets} = require('fabric-network');
const testUtil = require('./utils.js');
const fs = require('fs');
const chai = require('chai');
const expect = chai.expect;

// Internal Map of connected gateways
const gateways = new Map();

// Internal Map of event listenerData
// {calls, payloads}
const listeners = new Map();
// {listener, payloads}
const transactions = new Map();

// transaction types
const types = ['evaluate', 'error', 'submit'];

/**
 * Perform an ID setup
 * @param {Wallet} wallet the in memory wallet to use
 * @param {CommonConnectionProfile} ccp The common connection profile
 * @param {String} orgName the organization name
 * @param {String} userName the user name
 * @return {String} the identity name
 */
async function identitySetup(wallet, ccp, orgName, userName) {

	const org = ccp.getOrganization(orgName);
	const orgMsp = org.mspid;

	const identityName = userName + '@' + orgName;

	const userCertPath = org.signedCertPEM.path.replace(/Admin/g, userName);
	const cert = fs.readFileSync(userCertPath).toString('utf8');

	const userKeyPath = org.adminPrivateKeyPEM.path.replace(/Admin/g, userName);
	const key = fs.readFileSync(userKeyPath).toString('utf8');

	const identity = {
		credentials: {
			certificate: cert,
			privateKey: key
		},
		mspId: orgMsp,
		type: 'X.509'
	};
	await wallet.put(identityName, identity);
	return identityName;
}

/**
 * Connect a gateway
 * @param {CommonConnectionProfile} ccp The common connection profile
 * @param {Booelan} tls boolean true if tls network; otherwise false
 * @param {String} userName the user name to perform actinos with
 * @param {String} orgName the Organization to which the user belongs
 * @param {String} gatewayName the name of the gateway
 * @param {Boolean} useDiscovery toggle discovery on
 * @return {Gateway} the connected gateway
 */
async function connectGateway(ccp, tls, userName, orgName, gatewayName, useDiscovery) {

	const gateway = new Gateway();
	const wallet = await Wallets.newInMemoryWallet();

	// import specified user to wallet
	const userIdentity = await identitySetup(wallet, ccp, orgName, userName);

	if (tls) {
		const caName = ccp.getCertificatAuthoritiesForOrg(orgName)[0];
		const fabricCAEndpoint = ccp.getCertificateAuthority(caName).url;
		const tlsInfo = await testUtil.tlsEnroll(fabricCAEndpoint, caName);
		const caOrg = ccp.getOrganization(orgName);

		const tlsIdentity = {
			credentials: {
				certificate: tlsInfo.certificate,
				privateKey: tlsInfo.key
			},
			mspId: caOrg.mspid,
			type: 'X.509'
		};
		await wallet.put('tlsId', tlsIdentity);
	}
	const opts = {
		wallet,
		identity: userIdentity,
		discovery: {enabled: useDiscovery}
	};

	if (useDiscovery) {
		opts.discovery.asLocalhost = true;
	}

	if (tls) {
		opts.clientTlsIdentity = 'tlsId';
	}

	await gateway.connect(ccp.profile, opts);
	gateways.set(gatewayName, {gateway: gateway});

	// Ensure that all connections have had time to process in the background
	await testUtil.sleep(testUtil.TIMEOUTS.SHORT_INC);

	return gateway;
}

/**
 * Disconnect and delete the named gateway
 * @param {String} gatewayName the name of the gateway to work with
 */
async function disconnectGateway(gatewayName) {
	try {
		const gateway = gateways.get(gatewayName).gateway;
		await gateway.disconnect();
		gateways.delete(gatewayName);
	} catch (err) {
		testUtil.logError('disconnectGateway failed with error ', err);
		throw err;
	}
}

/**
 * Disconnect all gateways within the `gateways` Map
 */
async function disconnectAllGateways() {
	try {
		for (const key of gateways.keys()) {
			testUtil.logMsg('disconnecting from Gateway ', key);
			const gateway = gateways.get(key).gateway;
			await gateway.disconnect();
		}
		gateways.clear();
		listeners.clear();
		transactions.clear();
	} catch (err) {
		testUtil.logError('disconnectAllGateways() failed with error ', err);
		throw err;
	}
}

/**
 * Retrieve the smart contract from teh gateway
 * @param {Gateway} gateway the gateway to work with
 * @param {String} channelName the channel name to use
 * @param {String} chaincodeId the chaincode ID to retrieve the smart contract for
 * @return {Contract} the contract for the instantiated chaincode ID on the channel
 */
async function retrieveContractFromGateway(gateway, channelName, chaincodeId) {
	try {
		const network = await gateway.getNetwork(channelName);
		return network.getContract(chaincodeId);
	} catch (err) {
		testUtil.logError('createContract failed with error ', err);
		throw err;
	}
}

/**
 * Perform a submit or evaluate transaction using the network API
 * @param {String} gatewayName the name of the Gateway to use
 * @param {String} ccName the chaincode ID
 * @param {String} channelName the name of the channel the chaincode is instantiated on
 * @param {String[]} args the argument array [func, arg0, arg1, ..., argn]
 * @param {Boolean} submit flag to idicate if a submit transaction (true) or evaluate (false)
 * @return {Object} resolved Promise if a submit transaction; evaluate result if not
 */
async function performGatewayTransaction(gatewayName, ccName, channelName, args, submit) {
	// Get contract from Gateway
	const gatewayObj = gateways.get(gatewayName);
	const gateway = gatewayObj.gateway;
	const contract = await retrieveContractFromGateway(gateway, channelName, ccName);

	// Split args
	const argArray = args.slice(1, -1).split(',');
	const func = argArray[0];
	const funcArgs = argArray.slice(1);
	try {
		if (submit) {
			testUtil.logMsg('Submitting transaction [' + func + '] with arguments ' + args);
			const result = await contract.submitTransaction(func, ...funcArgs);
			gatewayObj.result = {type: 'submit', response: result.toString()};
			testUtil.logMsg('Successfully submitted transaction [' + func + ']');
			return Promise.resolve();
		} else {
			testUtil.logMsg('Evaluating transaction [' + func + '] with arguments ' + args);
			const result = await contract.evaluateTransaction(func, ...funcArgs);
			testUtil.logMsg('Successfully evaluated transaction [' + func  + '] with result [' + result + ']');
			gatewayObj.result = {type: 'evaluate', response: result.toString()};
			return result.toString();
		}
	} catch (err) {
		gatewayObj.result = {type: 'error', result: err.toString()};
		testUtil.logError(err);
		throw err;
	}
}

async function performGatewayTransactionWithListener(gatewayName, ccName, channelName, args) {
	// Get contract from Gateway
	const gatewayObj = gateways.get(gatewayName);
	const gateway = gatewayObj.gateway;
	const contract = await retrieveContractFromGateway(gateway, channelName, ccName);

	// Split args
	const argArray = args.slice(1, -1).split(',');
	const func = argArray[0];
	const funcArgs = argArray.slice(1);
	try {
		testUtil.logMsg('Submitting transaction [' + func + '] with arguments ' + args);
		// const result = await contract.submitTransaction(func, ...funcArgs);
		const transaction = contract.createTransaction(func);
		await transaction.addCommitListener((err, ...cbArgs) => {

		});
		const result = await transaction.submit(...funcArgs);
		gatewayObj.result = {type: 'submit', response: result.toString()};
		testUtil.logMsg('Successfully submitted transaction [' + func + ']');
		return Promise.resolve();
	} catch (err) {
		gatewayObj.result = {type: 'error', result: err.toString()};
		testUtil.logError(err);
		throw err;
	}
}

/**
 * Compare the last gateway transaction response with a passed value
 * @param {String} type type of resposne
 * @param {*} msg the message to compare against
 */
function lastResponseCompare(gatewayName, msg) {
	const gatewayObj = gateways.get(gatewayName);
	return (gatewayObj.result.response.localeCompare(msg) === 0);
}

/**
 * Retrieve the last gateway transaction result
 * @param {String} type type of resposne
 */
function lastResult(gatewayName) {
	const gatewayObj = gateways.get(gatewayName);
	return gatewayObj.result;
}

/**
 * Compare the last gateway transaction type with a passed value
 * @param {String} gatewayName gateway name
 * @param {String} type type of resposne
 */
function lastTypeCompare(gatewayName, type) {
	const gatewayObj = gateways.get(gatewayName);

	if (!gatewayObj) {
		throw  new Error('Unknown gateway with name ' + gatewayName);
	}

	if (!gatewayObj.result) {
		throw  new Error('No existing response on gateway ' + gatewayName);
	}

	if (types.indexOf(type) === -1) {
		throw  new Error('Unknown type transaction type ' + type + ', must be one of [evaluate, error, submit]');
	}

	return gatewayObj.result.type.localeCompare(type) === 0;
}

function getGateway(gatewayName) {
	if (gateways.get(gatewayName)) {
		return gateways.get(gatewayName).gateway;
	} else {
		return undefined;
	}
}

async function createContractListener(gatewayName, channelName, ccName, eventName, listenerName, replay, filtered) {
	if (typeof filtered === 'undefined') {
		filtered = true;
	}
	if (typeof replay === 'undefined') {
		replay = false;
	}
	const gateway = gateways.get(gatewayName).gateway;
	const contract = await retrieveContractFromGateway(gateway, channelName, ccName);
	if (!listeners.has(listenerName)) {
		listeners.set(listenerName, {calls: 0, payloads: []});
	}
	const listener = await contract.addContractListener(listenerName, eventName, (err, ...args) => {
		if (err) {
			testUtil.logMsg('Contract event error', err);
			return err;
		}
		testUtil.logMsg(`Received a contract event [${listenerName}]`);
		if (!filtered) {
			const [event] = args;
			expect(event.payload.toString('utf8')).to.equal('content');
		}

		const listenerInfo = listeners.get(listenerName);
		listenerInfo.payloads.push(args);
		listenerInfo.calls = listenerInfo.payloads.length;
	}, {replay, filtered});
	const listenerInfo = listeners.get(listenerName);
	listenerInfo.listener = listener;
	listeners.set(listenerName, listenerInfo);
}

async function createBlockListener(gatewayName, channelName, ccName, listenerName, filtered, replay, startBlock, endBlock) {
	const gateway = gateways.get(gatewayName).gateway;
	const contract = await retrieveContractFromGateway(gateway, channelName, ccName);
	const network = contract.getNetwork();
	if (!listeners.has(listenerName)) {
		listeners.set(listenerName, {calls: 0, payloads: []});
	}
	const listener = await network.addBlockListener(listenerName, (err, block) => {
		if (err) {
			testUtil.logMsg('Block event error', err);
			return err;
		}
		testUtil.logMsg('Received a block event', listenerName);
		if (filtered) {
			expect(block).to.have.property('channel_id');
			expect(block).to.have.property('number');
			expect(block).to.have.property('filtered_transactions');
		} else {
			expect(block).to.have.property('header');
			expect(block).to.have.property('data');
			expect(block).to.have.property('metadata');
		}
		const blockNumber = filtered ? block.number : block.header.number;
		if (startBlock) {
			expect(Number(blockNumber)).to.be.greaterThan(Number(startBlock) - 1);
		}
		if (endBlock) {
			expect(Number(blockNumber)).to.be.lessThan(Number(endBlock) + 1);
		}
		const listenerInfo = listeners.get(listenerName);
		listenerInfo.payloads.push(block);
		listenerInfo.calls = listenerInfo.payloads.length;
	}, {filtered, replay, startBlock, endBlock});
	const listenerInfo = listeners.get(listenerName);
	listenerInfo.listener = listener;
	listeners.set(listenerName, listenerInfo);
}

function getListenerInfo(listenerName) {
	if (listeners.has(listenerName)) {
		return listeners.get(listenerName);
	}
	return {};
}

function resetListenerCalls(listenerName) {
	if (listeners.has(listenerName)) {
		const listenerInfo = listeners.get(listenerName);
		listenerInfo.payloads = [];
		listenerInfo.calls = 0;
	}
}

async function createTransaction(gatewayName, transactionName, fcnName, chaincodeId, channelName) {
	const gateway = getGateway(gatewayName);
	const contract = await retrieveContractFromGateway(gateway, channelName, chaincodeId);
	const transaction = contract.createTransaction(fcnName);
	transactions.set(transactionName, transaction);
}

async function createCommitListener(transactionName, listenerName) {
	const transaction = transactions.get(transactionName);
	if (!transaction) {
		throw new Error(`Transaction with name ${transactionName} does not exist`);
	}
	const listener = await transaction.addCommitListener((err, ...args) => {
		if (err) {
			testUtil.logMsg('Commit event error', err);
			return err;
		}
		testUtil.logMsg('Received a commit event', listenerName);
		const listenerInfo = listeners.get(listenerName);
		listenerInfo.payloads.push(args);
		listenerInfo.calls = listenerInfo.payloads.length;
	});
	listeners.set(listenerName, {listener, payloads: [], calls: 0});
}

async function submitExistingTransaction(transactionName, args) {
	const transaction = transactions.get(transactionName);
	if (!transaction) {
		throw new Error(`Transaction with name ${transactionName} does not exist`);
	}
	const argsSplit = args.slice(1, -1).split(', ');
	return await transaction.submit(...argsSplit);
}


module.exports = {
	connectGateway,
	performGatewayTransaction,
	performGatewayTransactionWithListener,
	disconnectGateway,
	disconnectAllGateways,
	lastResponseCompare,
	lastResult,
	lastTypeCompare,
	getGateway,
	createContractListener,
	createBlockListener,
	getListenerInfo,
	resetListenerCalls,
	createTransaction,
	createCommitListener,
	submitExistingTransaction
};
