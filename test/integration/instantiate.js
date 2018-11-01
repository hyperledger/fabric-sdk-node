/**
 * Copyright 2017 Hitachi America Ltd. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const path = require('path');
const fs = require('fs');
const util = require('util');

const Client = require('fabric-client');
const utils = require('fabric-client/lib/utils.js');
const e2eUtils = require('./e2e/e2eUtils.js');
const testUtil = require('../unit/util.js');
const logger = utils.getLogger('instantiate-chaincode');

const e2e = testUtil.END2END;
const version = 'v0';
let data;

test('\n\n **** E R R O R  T E S T I N G : instantiate call fails with non-existent Chaincode version', (t) => {
	const request = {
		chaincodeId: e2e.chaincodeId,
		chaincodeVersion: 'v333333333',
		fcn: 'init',
		args: ['a', '500', 'b', '600'],
		txId: ''
	};

	const error_snip = 'cannot get package for chaincode';
	instantiateChaincodeForError(request, error_snip, t);
});

test('\n\n **** E R R O R  T E S T I N G : instantiate call fails with non-existent Chaincode name', (t) => {
	const request = {
		chaincodeId: 'dummy',
		chaincodeVersion: version,
		fcn: 'init',
		args: ['a', '500', 'b', '600'],
		txId: ''
	};

	const error_snip = 'cannot get package for chaincode';
	instantiateChaincodeForError(request, error_snip, t);
});

test('\n\n***** End-to-end flow: instantiate chaincode *****\n\n', (t) => {
	e2eUtils.instantiateChaincode('org1', testUtil.CHAINCODE_PATH, 'v0', 'golang', false, false, t)
		.then((result) => {
			if (result) {
				t.pass('Successfully instantiated chaincode on the channel');
				return e2eUtils.sleep(5000);
			} else {
				t.fail('Failed to instantiate chaincode ');
				t.end();
			}
		}, (err) => {
			t.fail('Failed to instantiate chaincode on the channel. ' + err.stack ? err.stack : err);
			t.end();
		}).then(() => {
			logger.debug('Successfully slept 5s to wait for chaincode instantiate to be completed and committed in all peers');
			t.end();
		}).catch((err) => {
			t.fail('Test failed due to unexpected reasons. ' + err);
			t.end();
		});
});

test('\n\n **** E R R O R  T E S T I N G : instantiate call fails by instantiating the same Chaincode twice', (t) => {
	const request = {
		chaincodeId : e2e.chaincodeId,
		chaincodeVersion : version,
		fcn: 'init',
		args: ['a', '500', 'b', '600'],
		txId: ''
	};

	const error_snip = 'already exists';
	instantiateChaincodeForError(request, error_snip, t);
});

function instantiateChaincodeForError(request, error_snip, t) {

	Client.addConfigFile(path.join(__dirname, './e2e/config.json'));
	const ORGS = Client.getConfigSetting('test-network');

	const caRootsPath = ORGS.orderer.tls_cacerts;
	data = fs.readFileSync(path.join(__dirname, '/test', caRootsPath));
	const caroots = Buffer.from(data).toString();

	const userOrg = 'org1';
	const client = new Client();
	const channel_name = Client.getConfigSetting('E2E_CONFIGTX_CHANNEL_NAME', testUtil.END2END.channel);
	logger.debug(' channel_name %s', channel_name);
	const channel = client.newChannel(channel_name);
	const orgName = ORGS[userOrg].name;
	let tlsInfo = null;

	e2eUtils.tlsEnroll(userOrg)
		.then((enrollment) => {
			t.pass('Successfully retrieved TLS certificate');
			tlsInfo = enrollment;
			client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
			return Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg(orgName)});
		}).then((store) => {
			client.setStateStore(store);
			return testUtil.getSubmitter(client, t, true /* use peer org admin */, userOrg);
		}).then(() => {
			t.pass('Successfully enrolled user \'admin\'');

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
			for (const org in ORGS) {
				if (ORGS[org].hasOwnProperty('peer1')) {
					const key = 'peer1';
					data = fs.readFileSync(path.join(__dirname, '/test', ORGS[org][key].tls_cacerts));
					logger.debug(' create new peer %s', ORGS[org][key].requests);
					const peer = client.newPeer(
						ORGS[org][key].requests,
						{
							pem: Buffer.from(data).toString(),
							'clientCert': tlsInfo.certificate,
							'clientKey': tlsInfo.key,
							'ssl-target-name-override': ORGS[org][key]['server-hostname']
						}
					);
					targets.push(peer);
					channel.addPeer(peer);
				}
			}

			return channel.initialize();
		}, (err) => {
			t.fail('Failed to enroll user \'admin\'. ' + err);
			throw new Error('Failed to enroll user \'admin\'. ' + err);
		}).then(() => {
			t.pass('Successfully initialized channel');
			request.txId = client.newTransactionID();
			return channel.sendInstantiateProposal(request);
		}, (err) => {
			t.fail(util.format('Failed to initialize the channel. %s', err.stack ? err.stack : err));
			throw new Error('Failed to initialize the channel');
		}).then((results) => {
			testUtil.checkResults(results, error_snip, t);
			t.end();
		}, (err) => {
			t.fail('Failed to send instantiate proposal due to error: ' + err.stack ? err.stack : err);
			throw new Error('Failed to send instantiate proposal due to error: ' + err.stack ? err.stack : err);
		}).catch((err) => {
			t.fail('Test failed due to unexpected reasons. ' + err);
			t.end();
		});
}
