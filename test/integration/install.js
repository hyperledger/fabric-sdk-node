/**
 * Copyright 2016 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';

const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('install');

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const path = require('path');
const fs = require('fs');
const e2eUtils = require('./e2e/e2eUtils.js');

const Client = require('fabric-client');
const testUtil = require('../unit/util.js');

let ORGS;

test('\n\n** Test chaincode install using chaincodePath to create chaincodePackage **\n\n', (t) => {
	testUtil.resetDefaults();
	testUtil.setupChaincodeDeploy();
	Client.addConfigFile(path.join(__dirname, 'e2e', 'config.json'));
	ORGS = Client.getConfigSetting('test-network');

	const params = {
		org: 'org1',
		testDesc: 'using chaincodePath',
		channelName: 'test-install',
		chaincodeId: 'install',
		chaincodePath: testUtil.CHAINCODE_PATH,
		chaincodeVersion: testUtil.getUniqueVersion(),
		chaincodePackage: ''
	};

	installChaincode(params, t)
		.then((info) => {
			if (info === 'success') {
				t.pass('success');
				return true;
			} else {
				t.fail(info);
				t.end();
			}
		},
		(err) => {
			t.fail('install reject: ' + err);
			t.end();
		}).catch((err) => {
			t.fail('install error. ' + err.stack ? err.stack : err);
			t.end();
		}).then(() => {
			params.channelName = params.channelName + '0';
			params.testDesc = params.testDesc + '0';
			installChaincode(params, t)
				.then((info) => {
					if (info && info instanceof Error && info.message.includes('install.' + params.chaincodeVersion + ' exists')) {
						t.pass('passed check for exists on install again');
						t.end();
					} else {
						t.fail('failed check for exists on install again');
						t.end();
					}
				},
				(err) => {
					t.fail('install reject: ' + err);
					t.end();
				}).catch((err) => {
					t.fail('install error. ' + err.stack ? err.stack : err);
					t.end();
				});
		});
});

test('\n\n** Test chaincode install using chaincodePackage[byte] **\n\n', (t) => {
	const params = {
		org: 'org1',
		testDesc: 'using chaincodePackage',
		channelName: 'test-install-package',
		chaincodeId: 'install-package',
		chaincodePath: testUtil.CHAINCODE_PATH,
		chaincodeVersion: testUtil.getUniqueVersion()
	};

	// install from source
	installChaincode(params, t)
		.then((info) => {
			if (info === 'success') {
				t.pass(params.testDesc + ' - success');
				return true;
			} else {
				t.fail(params.testDesc + ' - ' + info);
				t.end();
			}
		},
		(err) => {
			t.fail(params.testDesc + ' - install reject: ' + err);
			t.end();
		}).catch((err) => {
			t.fail(params.testDesc + ' - install error. ' + err.stack ? err.stack : err);
			t.end();
		}).then(() => {
			params.channelName = params.channelName + '0';
			params.testDesc = params.testDesc + '0';
			installChaincode(params, t)
				.then((info) => {
					if (info && info instanceof Error && info.message.includes('install-package.' + params.chaincodeVersion + ' exists')) {
						t.pass('passed check for exists same code again');
						t.end();
					} else {
						t.fail('failed check for exists same code again');
						t.end();
					}
				},
				(err) => {
					t.fail(params.testDesc + ' - install same chaincode again - reject, error');
					logger.error(err.stack ? err.stack : err);
					t.end();
				}).catch((err) => {
					t.fail(params.testDesc + ' - install same chaincode again - error');
					logger.error(err.stack ? err.stack : err);
					t.end();
				});
		});
});

function installChaincode(params, t) {
	let data;
	try {
		const org = params.org;
		const client = new Client();
		const channel = client.newChannel(params.channelName);

		const orgName = ORGS[org].name;
		const caRootsPath = ORGS.orderer.tls_cacerts;
		data = fs.readFileSync(path.join(__dirname, 'e2e', caRootsPath));
		const caroots = Buffer.from(data).toString();
		let tlsInfo = null;

		return e2eUtils.tlsEnroll(org)
			.then((enrollment) => {
				t.pass('Successfully retrieved TLS certificate');
				tlsInfo = enrollment;
				client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
				return Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg(orgName)});
			}).then((store) => {
				client.setStateStore(store);

				// get the peer org's admin required to send install chaincode requests
				return testUtil.getSubmitter(client, t, true /* get peer org admin */, org);
			}).then(() => {
				t.pass(params.testDesc + ' - Successfully enrolled user \'admin\'');

				channel.addOrderer(
					client.newOrderer(
						ORGS.orderer.url,
						{
							'pem': caroots,
							'clientCert': tlsInfo.certificate,
							'clientKey': tlsInfo.key,
							'ssl-target-name-override': ORGS.orderer['server-hostname']
						}
					)
				);

				const targets = [];
				for (const key in ORGS[org]) {
					if (ORGS[org].hasOwnProperty(key)) {
						if (key.indexOf('peer') === 0) {
							data = fs.readFileSync(path.join(__dirname, 'e2e', ORGS[org][key].tls_cacerts));
							const peer = client.newPeer(
								ORGS[org][key].requests,
								{
									pem: Buffer.from(data).toString(),
									'clientCert': tlsInfo.certificate,
									'clientKey': tlsInfo.key,
									'ssl-target-name-override': ORGS[org][key]['server-hostname']
								});
							targets.push(peer);
							channel.addPeer(peer);
						}
					}
				}

				// send proposal to endorser
				const request = {
					targets: targets,
					chaincodePath: params.chaincodePath,
					chaincodeId: params.chaincodeId,
					chaincodeVersion: params.chaincodeVersion,
					chaincodePackage: params.chaincodePackage
				};

				return client.installChaincode(request);
			},
			(err) => {
				t.fail(params.testDesc + ' - Failed to enroll user \'admin\'. ' + err);
				throw new Error(params.testDesc + ' - Failed to enroll user \'admin\'. ' + err);
			}).then((results) => {
				const proposalResponses = results[0];

				// var proposal = results[1];
				let all_good = true;
				let error = null;
				for (const i in proposalResponses) {
					let one_good = false;
					if (proposalResponses && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
						one_good = true;
						logger.info(params.testDesc + ' - install proposal was good');
					} else {
						logger.error(params.testDesc + ' - install proposal was bad');
						error = proposalResponses[i];
					}
					all_good = all_good & one_good;
				}
				if (all_good) {
					return 'success';
				} else {
					if (error) {
						return error;
					} else {
						return 'fail';
					}
				}
			},
			(err) => {
				return new Error(err.stack ? err.stack : err);
			});
	} catch (err) {
		return Promise.reject(new Error(err.stack ? err.stack : err));
	}
}
