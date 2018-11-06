/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const {Gateway, InMemoryWallet, X509WalletMixin} = require('fabric-network');
const testUtil = require('./utils.js');
const fs = require('fs');

// Internal Map of connected gateways
const gateways = new Map();

/**
 * Perform an  in memeory ID setup
 * @param {InMemoryWallet} inMemoryWallet the in memory wallet to use
 * @param {CommonConnectionProfile} ccp The common connection profile
 * @param {String} orgName the organization name
 * @param {String} userName the user name
 * @return {String} the identity name
 */
async function inMemoryIdentitySetup(inMemoryWallet, ccp, orgName, userName) {

	const org = ccp.getOrganization(orgName);
	const orgMsp = org.mspid;

	const identity = userName + '@' + orgName;

	const userCertPath = org.signedCertPEM.path.replace(/Admin/g, userName);
	const userKeyPath = org.adminPrivateKeyPEM.path.replace(/Admin/g, userName);

	const cert = fs.readFileSync(userCertPath);
	const key = fs.readFileSync(userKeyPath);
	await inMemoryWallet.import(identity, X509WalletMixin.createIdentity(orgMsp, cert, key));
	return identity;
}

/**
 * Connect a gateway
 * @param {CommonConnectionProfile} ccp The common connection profile
 * @param {Booelan} tls boolean true if tls network; otherwise false
 * @param {String} userName the user name to perform actinos with
 * @param {String} orgName the Organization to which the user belongs
 * @param {String} gatewayName the name of the gateway
 * @return {Gateway} the connected gateway
 */
async function connectGateway(ccp, tls, userName, orgName, gatewayName) {

	const gateway = new Gateway();
	const inMemoryWallet = new InMemoryWallet();

	// import specified user to wallet
	const userIdentity = await inMemoryIdentitySetup(inMemoryWallet, ccp, orgName, userName);

	if (tls) {
		const caName = ccp.getCertificatAuthoritiesForOrg(orgName)[0];
		const fabricCAEndpoint = ccp.getCertificateAuthority(caName).url;
		const tlsInfo = await testUtil.tlsEnroll(fabricCAEndpoint, caName);
		await inMemoryWallet.import('tlsId', X509WalletMixin.createIdentity(userIdentity, tlsInfo.certificate, tlsInfo.key));
	}

	const opts = {
		wallet: inMemoryWallet,
		identity: userIdentity,
		discovery: {enabled: false}
	};

	if (tls) {
		opts.clientTlsIdentity = 'tlsId';
	}

	await gateway.connect(ccp.profile, opts);
	gateways.set(gatewayName, gateway);

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
		const gateway = gateways.get(gatewayName);
		await gateway.disconnect();
		gateways.delete(gatewayName);
	} catch (err) {
		testUtil.logError('disconnectGateway failed with error ', err);
		throw err;
	}
}

/**
 * Disconnect all gateways within the  `gateways` Map
 */
async function disconnectAllGateways() {
	try {
		for (const key of gateways.keys()) {
			testUtil.logMsg('disconnecting from Gateway ', key);
			const gateway = gateways.get(key);
			await gateway.disconnect();
		}
		gateways.clear();
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
	const gateway = gateways.get(gatewayName);
	const contract = await retrieveContractFromGateway(gateway, channelName, ccName);

	// Split args
	const argArray = args.slice(1, -1).split(',');
	const func = argArray[0];
	const funcArgs = argArray.slice(1);
	try {
		if (submit) {
			testUtil.logMsg('Submitting transaction [' + func + '] ...');
			await contract.submitTransaction(func, ...funcArgs);
			testUtil.logMsg('Successfully submitted transaction [' + func + ']');
		} else {
			testUtil.logMsg('Evaluating transaction [' + func + '] ...');
			const result = await contract.evaluateTransaction(func, ...funcArgs);
			testUtil.logMsg('Successfully evaluated transaction [' + func  + '] with result [' + result + ']');
			return result.toString();
		}
	} catch (err) {
		testUtil.logError(err);
		throw err;
	}
}

module.exports.connectGateway = connectGateway;
module.exports.performGatewayTransaction = performGatewayTransaction;
module.exports.disconnectGateway = disconnectGateway;
module.exports.disconnectAllGateways = disconnectAllGateways;
