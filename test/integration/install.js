/**
 * Copyright 2016 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';

var rewire = require('rewire');
var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('install');

var tape = require('tape');
var _test = require('tape-promise').default;
var test = _test(tape);

var path = require('path');
var fs = require('fs');
var e2eUtils = require('./e2e/e2eUtils.js');

var Client = require('fabric-client');
var Packager = require('fabric-client/lib/Packager.js');
var testUtil = require('../unit/util.js');

var ORGS;

test('\n\n** Test chaincode install using chaincodePath to create chaincodePackage **\n\n', (t) => {
	testUtil.resetDefaults();
	testUtil.setupChaincodeDeploy();
	Client.addConfigFile(path.join(__dirname, 'e2e', 'config.json'));
	ORGS = Client.getConfigSetting('test-network');

	var params = {
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
	var params = {
		org: 'org1',
		testDesc: 'using chaincodePackage',
		channelName: 'test-install-package',
		chaincodeId: 'install-package',
		chaincodePath: testUtil.CHAINCODE_PATH,
		chaincodeVersion: testUtil.getUniqueVersion()
	};

	let _getChaincodeDeploymentSpec = rewire('fabric-client/lib/Client.js').__get__('_getChaincodeDeploymentSpec');

	// install from source
	let p = _getChaincodeDeploymentSpec(params, false)
		.then((cdsBytes) => {
			params.chaincodePackage = cdsBytes;
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
	t.end();
});

function installChaincode(params, t) {
	try {
		var org = params.org;
		var client = new Client();
		var channel = client.newChannel(params.channelName);

		let orgName = ORGS[org].name;
		var caRootsPath = ORGS.orderer.tls_cacerts;
		let data = fs.readFileSync(path.join(__dirname, 'e2e', caRootsPath));
		let caroots = Buffer.from(data).toString();
		let tlsInfo = null;

		return e2eUtils.tlsEnroll(org)
			.then((enrollment) => {
				t.pass('Successfully retrieved TLS certificate');
				tlsInfo = enrollment;
				client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
				return Client.newDefaultKeyValueStore({ path: testUtil.storePathForOrg(orgName) });
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

				var targets = [];
				for (let key in ORGS[org]) {
					if (ORGS[org].hasOwnProperty(key)) {
						if (key.indexOf('peer') === 0) {
							let data = fs.readFileSync(path.join(__dirname, 'e2e', ORGS[org][key]['tls_cacerts']));
							let peer = client.newPeer(
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
				var request = {
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
					var proposalResponses = results[0];

					//var proposal = results[1];
					var all_good = true;
					var error = null;
					for (var i in proposalResponses) {
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
						}
						else return 'fail';
					}
				},
					(err) => {
						return new Error(err.stack ? err.stack : err);
					});
	} catch (err) {
		return Promise.reject(new Error(err.stack ? err.stack : err));
	}
}
