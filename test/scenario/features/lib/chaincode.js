/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const Client = require('fabric-client');

const testUtil = require('./utils.js');
const fs = require('fs');
const path = require('path');

const supportedLanguageTypes = ['node', 'golang'];
const chaincodePath = '../../chaincode';
/**
 * Deploy the given chaincode to the given organization's peers.
 * @param {String} ccName The name of the chaincode to install.
 * @param {String} ccId The identifier for the chaincode to install.
 * @param {String} ccType The chaincode type to install (node | goLang | Java ...)
 * @param {String} ccVersion The chaincode version
 * @param {Boolean} tls boolean true if a tls network, false if not
 * @param {CommonConnectionProfile} ccp The common connection profile
 * @param {String} orgName The organisation to use to install
 * @param {String} channel The channel to install on
 * @return {Promise} The return promise.
 */
async function installChaincode(ccName, ccId, ccType, ccVersion, tls, ccp, orgName, channelName) {

	if (!supportedLanguageTypes.includes(ccType)) {
		Promise.reject('Unsupported test ccType: ' + ccType);
	}

	Client.setConfigSetting('request-timeout', 60000);
	const client = new Client();
	const channel = client.newChannel(channelName);

	// Conditional action on TLS enablement
	if (tls) {
		const caName = ccp.getCertificatAuthoritiesForOrg(orgName)[0];
		const fabricCAEndpoint = ccp.getCertificateAuthority(caName).url;
		const tlsInfo = await testUtil.tlsEnroll(fabricCAEndpoint, caName);
		client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
	}

	const cryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
	client.setCryptoSuite(cryptoSuite);

	const ordererName = ccp.getOrderersForChannel(channelName)[0];
	const caRootsPath = ccp.getOrderer(ordererName).tlsCACerts.path;
	let data = fs.readFileSync(caRootsPath);
	const caroots = Buffer.from(data).toString();

	channel.addOrderer(
		client.newOrderer(
			ccp.getOrderer(ordererName).url,
			{
				'pem': caroots,
				'ssl-target-name-override': ccp.getOrderer(ordererName).grpcOptions['ssl-target-name-override']
			}
		)
	);

	const targets = [];
	const peers = ccp.getPeersForOrganization(orgName);
	peers.forEach((peerName) => {
		const peer = ccp.getPeer(peerName);
		data = fs.readFileSync(peer.tlsCACerts.path);
		targets.push(
			client.newPeer(
				peer.url,
				{
					pem: Buffer.from(data).toString(),
					'ssl-target-name-override': peer.grpcOptions['ssl-target-name-override']
				}
			)
		);
	});

	try {
		const store = await Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg(orgName)});
		client.setStateStore(store);

		// set user to send install chaincode requests
		await testUtil.getSubmitter(client, true /* get peer org admin */, orgName, ccp);

		// chaincode and metadata paths
		const ccPath = path.join(__dirname, chaincodePath, ccName, ccType);
		const metadataPath = path.join(ccPath, 'metadata');

		// send proposal to endorser
		const request = {
			targets: targets,
			chaincodePath: ccPath,
			metadataPath: metadataPath,
			chaincodeId: ccId,
			chaincodeType: ccType,
			chaincodeVersion: ccVersion
		};

		testUtil.logMsg('Installing chaincode with ID [' + ccId + '] on ' + orgName + ' peers [' + ccp.getPeersForOrganization(orgName).toString() + '] ...');

		const results = await client.installChaincode(request);

		const proposalResponses = results[0];

		let proposalResponsesValid = true;
		const errors = [];
		for (const i in proposalResponses) {
			let valid = false;
			if (proposalResponses && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
				valid = true;
			} else {
				errors.push(proposalResponses[i]);
			}
			proposalResponsesValid = proposalResponsesValid && valid;
		}
		if (!proposalResponsesValid) {
			throw new Error('Failed to send install Proposal or receive valid response: %s', JSON.stringify(errors));
		} else {
			testUtil.logMsg('Successfully installed chaincode with ID [' + ccName + ']');
			return await testUtil.sleep(testUtil.TIMEOUTS.SHORT_INC);
		}
	} catch (err) {
		testUtil.logError('Failed to install chaincode');
		throw err;
	}
}

/**
 * Instantiate or upgrade the given chaincode with the given endorsement policy.
 * @param {Boolean} upgrade Indicates whether the call is an upgrade or a new instantiation.
 * @param {String} ccName The name of the chaincode to instantiate
 * @param {String} ccId The identifier of the installed chaincode to instantiate
 * @param {String} ccType The chaincode type to install (node | goLang | Java ...)
 * @param {String[]} args Chaincode arguments
 * @param {String} version The chaincode version
 * @param {Boolean} tls true if tls enabled network; false if not
 * @param {CommonConnectionProfile} ccp The common connection profile
 * @param {String} orgName The name of the organization to use
 * @param {String} channelName The channel name
 * @param {String} policy The endorsement policy object from the configuration file.
 * @return {Promise} The return promise.
 */
async function instantiateChaincode(ccName, ccId, ccType, args, version, upgrade, tls, ccp, orgName, channelName, policy) {
	if (!supportedLanguageTypes.includes(ccType)) {
		Promise.reject('Unsupported test ccType: ' + ccType);
	}

	Client.setConfigSetting('request-timeout', 120000);

	const type = upgrade ? 'upgrade' : 'instantiate';

	const targets = [];
	const eventhubs = [];
	const client = new Client();
	const channel = client.newChannel(channelName);

	const cryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
	client.setCryptoSuite(cryptoSuite);

	// Conditional action on TLS enablement
	if (tls) {
		const caName = ccp.getCertificatAuthoritiesForOrg(orgName)[0];
		const fabricCAEndpoint = ccp.getCertificateAuthority(caName).url;
		const tlsInfo = await testUtil.tlsEnroll(fabricCAEndpoint, caName);
		client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
	}

	const ordererName = ccp.getOrderersForChannel(channelName)[0];
	const caRootsPath = ccp.getOrderer(ordererName).tlsCACerts.path;
	let data = fs.readFileSync(caRootsPath);
	const caroots = Buffer.from(data).toString();

	channel.addOrderer(
		client.newOrderer(
			ccp.getOrderer(ordererName).url,
			{
				'pem': caroots,
				'ssl-target-name-override': ccp.getOrderer(ordererName).grpcOptions['ssl-target-name-override']
			}
		)
	);

	try {
		testUtil.logMsg('Performing ' + type + ' transaction on chaincode with ID [' + ccName + '] as organization [' + orgName + '] ...');

		const store = await Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg(orgName)});
		client.setStateStore(store);

		// set user to send install chaincode requests
		await testUtil.getSubmitter(client, true /* get peer org admin */, orgName, ccp);

		const peers = ccp.getPeersForOrganization(orgName);
		peers.forEach((peerName) => {
			const thisPeer = ccp.getPeer(peerName);
			data = fs.readFileSync(thisPeer.tlsCACerts.path);
			const peer = client.newPeer(
				thisPeer.url,
				{
					pem: Buffer.from(data).toString(),
					'ssl-target-name-override': thisPeer.grpcOptions['ssl-target-name-override']
				});

			targets.push(peer);
			channel.addPeer(peer);
			const eh = channel.newChannelEventHub(peer);
			eventhubs.push(eh);
		});

		await channel.initialize();

		const transientMap = {'test': 'transientValue'};
		const ccPath = path.join(__dirname, chaincodePath, ccName, ccType);
		const proposalRequest = buildChaincodeProposal(client, ccId, ccPath, version, ccType, args, upgrade, transientMap, policy);

		let results;
		if (upgrade) {
			results = await channel.sendUpgradeProposal(proposalRequest);
		} else {
			results = await channel.sendInstantiateProposal(proposalRequest);
		}

		const proposalResponses = results[0];
		const proposal = results[1];
		for (const i in proposalResponses) {
			if (!(proposalResponses && proposalResponses[i].response && proposalResponses[i].response.status === 200)) {
				Promise.reject(type + ' proposal was bad: ' + JSON.stringify(proposalResponses[i]));
			}
		}

		const request = {
			proposalResponses: proposalResponses,
			proposal: proposal
		};

		const deployId = proposalRequest.txId.getTransactionID();

		const eventPromises = [];
		eventPromises.push(channel.sendTransaction(request));
		eventhubs.forEach((eh) => {
			const txPromise = new Promise((resolve, reject) => {
				const handle = setTimeout(reject, 300000);

				eh.registerTxEvent(deployId.toString(), (tx, code) => {
					clearTimeout(handle);
					if (code !== 'VALID') {
						testUtil.logError('The chaincode ' + type + ' transaction was invalid, code = ' + code);
						reject('The chaincode ' + type + ' transaction was invalid, code = ' + code);
					} else {
						resolve();
					}
				}, (err) => {
					clearTimeout(handle);
					testUtil.logError('There was a problem with the ' + type + ' transaction event ' + JSON.stringify(err));
					reject('There was a problem with the ' + type + ' transaction event ' + JSON.stringify(err));
				}, {
					disconnect: true
				});
				eh.connect();
			});
			eventPromises.push(txPromise);
		});

		results = await Promise.all(eventPromises);
		if (results && !(results[0] instanceof Error) && results[0].status === 'SUCCESS') {
			testUtil.logMsg('Successfully performed ' + type + ' transaction on chaincode with ID [' + ccName + ']');
			return await testUtil.sleep(testUtil.TIMEOUTS.SHORT_INC);
		} else {
			testUtil.logError('Failed to order the ' + type + 'transaction. Error code: ' + results[0].status);
			throw new Error('Failed to order the ' + type + 'transaction. Error code: ' + results[0].status);
		}
	} catch (err) {
		testUtil.logError('Failed to perform ' + type + ' instantiation on chaincode with ID [' + ccName + ']');
		throw new Error('Failed to perform ' + type + ' instantiation on chaincode with ID [' + ccName + '] due to error: ' + err.stack ? err.stack : err);
	}
}

function buildChaincodeProposal(client, ccId, ccPath, version, ccType, args, upgrade, transientMap, policy) {
	const tx_id = client.newTransactionID();

	// args is a string array for the arguments to pass [function, arg0, arg1, arg2, ..., argn]
	const argArray = args.slice(1, -1).split(',');
	const func = argArray[0];
	const funcArgs = argArray.slice(1);

	// send proposal to endorser
	const request = {
		chaincodePath: ccPath,
		chaincodeId: ccId,
		chaincodeVersion: version,
		fcn: func,
		args: funcArgs,
		txId: tx_id,
		chaincodeType: ccType,
		'endorsement-policy': policy
	};

	if (upgrade) {
		// use this call to test the transient map support during chaincode instantiation
		request.transientMap = transientMap;
	}

	return request;
}

module.exports.installChaincode = installChaincode;
module.exports.instantiateChaincode = instantiateChaincode;
