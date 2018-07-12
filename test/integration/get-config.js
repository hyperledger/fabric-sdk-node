/**
 * Copyright 2016 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';

var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('get-config');

var tape = require('tape');
var _test = require('tape-promise').default;
var test = _test(tape);

var path = require('path');
var fs = require('fs');
var e2eUtils = require('./e2e/e2eUtils.js');

var Client = require('fabric-client');
var testUtil = require('../unit/util.js');
var Peer = require('fabric-client/lib/Peer.js');
var Orderer = require('fabric-client/lib/Orderer.js');


var client = new Client();
// IMPORTANT ------>>>>> MUST RUN e2e/create-channel.js FIRST
var channel = client.newChannel(testUtil.END2END.channel);
var ORGS;

var querys = [];
if (process.argv.length > 2) {
	for (let i=2; i<process.argv.length; i++) {
		querys.push(process.argv[i]);
	}
}
logger.info('Found query: %s', querys);

test('  ---->>>>> get config <<<<<-----', function(t) {
	testUtil.resetDefaults();
	testUtil.setupChaincodeDeploy();
	Client.addConfigFile(path.join(__dirname, 'e2e', 'config.json'));
	ORGS = Client.getConfigSetting('test-network');

	var org = 'org1';
	var orgName = ORGS[org].name;
	var caRootsPath = ORGS.orderer.tls_cacerts;
	let data = fs.readFileSync(path.join(__dirname, 'e2e', caRootsPath));
	let caroots = Buffer.from(data).toString();
	var tlsInfo = null;

	e2eUtils.tlsEnroll(org)
	.then((enrollment) => {
		t.pass('Successfully retrieved TLS certificate');
		tlsInfo = enrollment;
		client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
		return Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg(orgName)});
	}).then( function (store) {
		client.setStateStore(store);
		var cryptoSuite = Client.newCryptoSuite();
		cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
		client.setCryptoSuite(cryptoSuite);

		testUtil.getSubmitter(client, t, org)
			.then(
				function() {
					t.pass('Successfully enrolled user');

					channel.addOrderer(
						new Orderer(
							ORGS.orderer.url,
							{
								'pem': caroots,
								'clientCert': tlsInfo.certificate,
								'clientKey': tlsInfo.key,
								'ssl-target-name-override': ORGS.orderer['server-hostname']
							}
						)
					);

					for (let key in ORGS[org]) {
						if (ORGS[org].hasOwnProperty(key)) {
							if (key.indexOf('peer') === 0) {
								let data = fs.readFileSync(path.join(__dirname, 'e2e', ORGS[org][key]['tls_cacerts']));
								let peer = new Peer(
									ORGS[org][key].requests,
									{
										pem: Buffer.from(data).toString(),
										'clientCert': tlsInfo.certificate,
										'clientKey': tlsInfo.key,
										'ssl-target-name-override': ORGS[org][key]['server-hostname']
									});
								channel.addPeer(peer);
							}
						}
					}

					// use default primary peer
					// send query
					logger.debug('will initialize the channel');
					return channel.initialize();
				},
				function(err) {
					t.fail('Failed to enroll user: ' + err.stack ? err.stack : err);
					t.end();
				}
			).then(
				function() {
					t.pass('channel was successfully initialized');
					let orgs = channel.getOrganizations();
					logger.debug(' Got the following orgs back %j', orgs);
					t.equals(orgs.length, 2, 'Checking the that we got back the right number of orgs');
					if(orgs[0].id.indexOf('Or') == 0) {
						t.pass('Found the org name '+ orgs[0].id);
					}
					else {
						t.fail('Did not find the org name of \'org\' :: found ' + orgs[0].id);
					}
					t.end();
				},
				function(err) {
					t.fail('Failed to send query due to error: ' + err.stack ? err.stack : err);
					t.end();
				}
			).catch(
				function(err) {
					t.fail('Failed to query with error:' + err.stack ? err.stack : err);
					t.end();
				}
			);
	});
});
