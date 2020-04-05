/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';
const FabricCAServices = require('../../../fabric-ca-client');
const {Utils: utils} = require('fabric-common');
const logger = utils.getLogger('E2E testing');

const path = require('path');
const fs = require('fs');
const util = require('util');

const Client = require('fabric-client');
const testUtil = require('../util.js');
const e2eUtils = require('./e2eUtils.js');

let ORGS;

let tx_id = null;
let the_user = null;

function init() {
	if (!ORGS) {
		Client.addConfigFile(path.join(__dirname, './config.json'));
		ORGS = Client.getConfigSetting('test-network');
	}
}

const installChaincodeWithId = async (org, chaincode_id, chaincode_path, metadata_path, version, language, t, get_admin) => {
	init();
	Client.setConfigSetting('request-timeout', 60000);
	const channel_name = Client.getConfigSetting('E2E_CONFIGTX_CHANNEL_NAME', testUtil.END2END.channel);

	const client = new Client();
	// client.setDevMode(true);
	const channel = client.newChannel(channel_name);

	const orgName = ORGS[org].name;
	const cryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
	client.setCryptoSuite(cryptoSuite);

	const caRootsPath = ORGS.orderer.tls_cacerts;
	const data = fs.readFileSync(path.join(__dirname, caRootsPath));
	let caroots = Buffer.from(data).toString();
	// make sure the cert is OK
	caroots = Client.normalizeX509(caroots);
	let tlsInfo = null;

	const enrollment = await e2eUtils.tlsEnroll(org);

	t.pass('Successfully retrieved TLS certificate');
	tlsInfo = enrollment;
	client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);

	const store = await Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg(orgName)});

	client.setStateStore(store);

	// get the peer org's admin required to send install chaincode requests
	const admin = await testUtil.getSubmitter(client, t, get_admin /* get peer org admin */, org);

	t.pass('Successfully enrolled user \'admin\' (e2eUtil 1)');
	the_user = admin;

	channel.addOrderer(
		client.newOrderer(
			ORGS.orderer.url,
			{
				'pem': caroots,
				'ssl-target-name-override': ORGS.orderer['server-hostname']
			}
		)
	);

	const targets = [];
	for (const key in ORGS[org]) {
		if (Object.prototype.hasOwnProperty.call(ORGS[org], key)) {
			if (key.indexOf('peer') === 0) {
				const newData = fs.readFileSync(path.join(__dirname, ORGS[org][key].tls_cacerts));
				const peer = client.newPeer(
					ORGS[org][key].requests,
					{
						pem: Buffer.from(newData).toString(),
						'ssl-target-name-override': ORGS[org][key]['server-hostname']
					}
				);

				targets.push(peer);    // a peer can be the target this way
				channel.addPeer(peer); // or a peer can be the target this way
				// you do not have to do both, just one, when there are
				// 'targets' in the request, those will be used and not
				// the peers added to the channel
			}
		}
	}

	// send proposal to endorser
	const request = {
		targets: targets,
		chaincodePath: chaincode_path,
		metadataPath: metadata_path,
		chaincodeId: chaincode_id,
		chaincodeType: language,
		chaincodeVersion: version
	};

	const results = await client.installChaincode(request);

	const proposalResponses = results[0];

	let all_good = true;
	const errors = [];
	for (const i in proposalResponses) {
		let one_good = false;
		if (proposalResponses && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
			one_good = true;
			logger.info('install proposal was good');
		} else {
			logger.error('install proposal was bad');
			errors.push(proposalResponses[i]);
		}
		all_good = all_good & one_good;
	}
	if (all_good) {
		t.pass(util.format('Successfully sent install Proposal and received ProposalResponse: Status - %s', proposalResponses[0].response.status));
	} else {
		throw new Error(util.format('Failed to send install Proposal or receive valid response: %s', errors));
	}

};

module.exports.installChaincodeWithId = installChaincodeWithId;

function instantiateChaincodeWithId(userOrg, chaincode_id, chaincode_path, version, language, upgrade, badTransient, t, channel_name) {
	init();

	if (!channel_name) {
		channel_name = Client.getConfigSetting('E2E_CONFIGTX_CHANNEL_NAME', testUtil.END2END.channel);
	}

	const targets = [];
	const txEventHubs = [];

	let type = 'instantiate';
	if (upgrade) {
		type = 'upgrade';
	}

	const client = new Client();
	const channel = client.newChannel(channel_name);

	const orgName = ORGS[userOrg].name;
	const cryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
	client.setCryptoSuite(cryptoSuite);

	const caRootsPath = ORGS.orderer.tls_cacerts;
	const data = fs.readFileSync(path.join(__dirname, caRootsPath));
	const caroots = Buffer.from(data).toString();

	const badTransientMap = {'test1': Buffer.from('transientValue')}; // have a different key than what the chaincode example_cc1.go expects in Init()
	const transientMap = {'test': Buffer.from('transientValue')};
	let tlsInfo = null;
	let request = null;

	return e2eUtils.tlsEnroll(userOrg)
		.then((enrollment) => {
			t.pass('Successfully retrieved TLS certificate');
			tlsInfo = enrollment;
			client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);

			return Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg(orgName)});
		}).then((store) => {

			client.setStateStore(store);
			return testUtil.getSubmitter(client, t, true /* use peer org admin*/, userOrg);

		}).then((admin) => {

			t.pass('Successfully enrolled user \'admin\' (e2eUtil 2)');
			the_user = admin;

			channel.addOrderer(
				client.newOrderer(
					ORGS.orderer.url,
					{
						'pem': caroots,
						'ssl-target-name-override': ORGS.orderer['server-hostname']
					}
				)
			);

			for (const org in ORGS) {
				if (Object.prototype.hasOwnProperty.call(ORGS[org], 'peer1')) {
					const key = 'peer1';
					const newData = fs.readFileSync(path.join(__dirname, ORGS[org][key].tls_cacerts));
					logger.debug(' create new peer %s', ORGS[org][key].requests);
					const peer = client.newPeer(
						ORGS[org][key].requests,
						{
							pem: Buffer.from(newData).toString(),
							'ssl-target-name-override': ORGS[org][key]['server-hostname']
						}
					);

					targets.push(peer);
					channel.addPeer(peer);

					const eh = channel.newChannelEventHub(peer);
					txEventHubs.push(eh);
				}
			}

			// read the config block from the peer for the channel
			// and initialize the verify MSPs based on the participating
			// organizations
			return channel.initialize();
		}, (err) => {

			t.fail('Failed to enroll user \'admin\'. ' + err);
			throw new Error('Failed to enroll user \'admin\'. ' + err);

		}).then(() => {
			t.pass('Successfully initialized Channel');
			logger.debug(' orglist:: ', channel.getOrganizations());
			// the v1 chaincode has Init() method that expects a transient map
			if (upgrade && badTransient) {
				// first test that a bad transient map would get the chaincode to return an error
				request = buildChaincodeProposal(client, the_user, chaincode_id, chaincode_path, version, language, upgrade, badTransientMap);
				tx_id = request.txId;

				logger.debug(util.format(
					'Upgrading chaincode "%s" at path "%s" to version "%s" by passing args "%s" to method "%s" in transaction "%s"',
					request.chaincodeId,
					request.chaincodePath,
					request.chaincodeVersion,
					request.args,
					request.fcn,
					request.txId.getTransactionID()
				));

				// this is the longest response delay in the test, sometimes
				// x86 CI times out. set the per-request timeout to a super-long value
				return channel.sendUpgradeProposal(request, 10 * 60 * 1000)
					.then((results) => {
						const proposalResponses = results[0];

						if (version === 'v1') {
							// expecting both peers to return an Error due to the bad transient map
							let success = false;
							if (proposalResponses && proposalResponses.length > 0) {
								proposalResponses.forEach((response) => {
									if (response && response instanceof Error &&
										response.message.includes('Did not find expected key "test" in the transient map of the proposal')) {
										success = true;
									} else {
										success = false;
									}
								});
							}

							if (success) {
								// successfully tested the negative conditions caused by
								// the bad transient map, now send the good transient map
								request = buildChaincodeProposal(client, the_user, chaincode_id, chaincode_path,
									version, language, upgrade, transientMap);
								tx_id = request.txId;

								return channel.sendUpgradeProposal(request, 10 * 60 * 1000);
							} else {
								throw new Error('Failed to test for bad transient map. The chaincode should have rejected the upgrade proposal.');
							}
						} else if (version === 'v3') {
							return Promise.resolve(results);
						}
					});
			} else {
				const request2 = buildChaincodeProposal(client, the_user, chaincode_id, chaincode_path, version, language, upgrade, transientMap);
				tx_id = request2.txId;

				// this is the longest response delay in the test, sometimes
				// x86 CI times out. set the per-request timeout to a super-long value
				if (upgrade) {
					return channel.sendUpgradeProposal(request2, 10 * 60 * 1000);
				} else {
					return channel.sendInstantiateProposal(request2, 10 * 60 * 1000);
				}
			}

		}, (err) => {

			t.fail(util.format('Failed to initialize the channel. %s', err.stack ? err.stack : err));
			throw new Error('Failed to initialize the channel');

		}).then((results) => {

			const proposalResponses = results[0];

			const proposal = results[1];
			let all_good = true;
			for (const response of proposalResponses) {
				if (response instanceof Error) {
					t.comment('Proposal failed to ' + chaincode_id + ' :: ' + response.toString());
					all_good = false;
				} else if (response.response && response.response.status === 200) {
					logger.info(type + ' proposal was good');
				} else {
					logger.error(type + ' proposal was bad for unknown reason');
					all_good = false;
				}
			}
			if (all_good) {
				t.pass('Successfully sent Proposal and received ProposalResponse');
				logger.debug(util.format('Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s', proposalResponses[0].response.status, proposalResponses[0].response.message, proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));
				request = {
					proposalResponses: proposalResponses,
					proposal: proposal
				};
			} else {
				logger.debug(JSON.stringify(proposalResponses));
				throw new Error('All proposals were not good');
			}

			const deployId = tx_id.getTransactionID();
			const eventPromises = [];
			eventPromises.push(channel.sendTransaction(request));

			txEventHubs.forEach((eh) => {
				const txPromise = new Promise((resolve, reject) => {
					const handle = setTimeout(() => {
						t.fail('Timeout - Failed to receive the event for instantiate:  waiting on ' + eh.getPeerAddr());
						eh.disconnect();
						reject('TIMEOUT waiting on ' + eh.getPeerAddr());
					}, 120000);

					eh.registerTxEvent(deployId.toString(), (tx, code) => {
						t.pass('The chaincode ' + type + ' transaction has been committed on peer ' + eh.getPeerAddr());
						clearTimeout(handle);
						if (code !== 'VALID') {
							t.fail('The chaincode ' + type + ' transaction was invalid, code = ' + code);
							reject();
						} else {
							t.pass('The chaincode ' + type + ' transaction was valid.');
							resolve();
						}
					}, (err) => {
						t.fail('There was a problem with the instantiate event ' + err);
						clearTimeout(handle);
						reject();
					}, {
						disconnect: true
					});
					eh.connect();
				});
				logger.debug('register eventhub %s with tx=%s', eh.getPeerAddr(), deployId);
				eventPromises.push(txPromise);
			});

			return Promise.all(eventPromises);
		}).then((results) => {
			if (results && !(results[0] instanceof Error) && results[0].status === 'SUCCESS') {
				t.pass('Successfully sent ' + type + 'transaction to the orderer.');
				return true;
			} else {
				t.fail('Failed to order the ' + type + 'transaction. Error code: ' + results[0].status);
				Promise.reject(new Error('Failed to order the ' + type + 'transaction. Error code: ' + results[0].status));
			}
		}).catch((err) => {
			t.fail('Failed to instantiate ' + type + ' due to error: ' + err.stack ? err.stack : err);
		});
}

module.exports.instantiateChaincodeWithId = instantiateChaincodeWithId;

function buildChaincodeProposal(client, theuser, chaincode_id, chaincode_path, version, type, upgrade, transientMap) {
	tx_id = client.newTransactionID();

	// send proposal to endorser
	const request = {
		chaincodePath: chaincode_path,
		chaincodeId: chaincode_id,
		chaincodeVersion: version,
		fcn: 'init',
		args: ['a', '100', 'b', '200'],
		txId: tx_id,
		chaincodeType: type,
		// use this to demonstrate the following policy:
		// 'if signed by org1 admin, then that's the only signature required,
		// but if that signature is missing, then the policy can also be fulfilled
		// when members (non-admin) from both orgs signed'
		'endorsement-policy': {
			identities: [
				{role: {name: 'member', mspId: ORGS.org1.mspid}},
				{role: {name: 'member', mspId: ORGS.org2.mspid}},
				{role: {name: 'admin', mspId: ORGS.org1.mspid}}
			],
			policy: {
				'1-of': [
					{'signed-by': 2},
					{'2-of': [{'signed-by': 0}, {'signed-by': 1}]}
				]
			}
		},
		'collections-config': testUtil.COLLECTIONS_CONFIG_PATH
	};

	if (version === 'v3') {
		request.args = ['b', '1000'];
	}

	if (upgrade) {
		// use this call to test the transient map support during chaincode instantiation
		request.transientMap = transientMap;
	}

	return request;
}

module.exports.buildChaincodeProposal = buildChaincodeProposal;

module.exports.sleep = testUtil.sleep;

function tlsEnroll(orgName) {
	return new Promise(((resolve, reject) => {
		FabricCAServices.addConfigFile(path.join(__dirname, 'config.json'));
		const orgs = FabricCAServices.getConfigSetting('test-network');
		if (!orgs[orgName]) {
			throw new Error('Invalid org name: ' + orgName);
		}
		const fabricCAEndpoint = orgs[orgName].ca.url;
		const tlsOptions = {
			trustedRoots: [],
			verify: false
		};
		const caService = new FabricCAServices(fabricCAEndpoint, tlsOptions, orgs[orgName].ca.name);
		const req = {
			enrollmentID: 'admin',
			enrollmentSecret: 'adminpw',
			profile: 'tls'
		};
		caService.enroll(req).then(
			(enrollment) => {
				enrollment.key = enrollment.key.toBytes();
				return resolve(enrollment);
			},
			(err) => {
				return reject(err);
			}
		);
	}));
}

module.exports.tlsEnroll = tlsEnroll;
