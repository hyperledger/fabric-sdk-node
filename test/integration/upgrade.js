/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const path = require('path');
const fs = require('fs');

const Client = require('fabric-client');
const utils = require('fabric-client/lib/utils.js');
const testUtil = require('../unit/util.js');
const e2eUtils = require('./e2e/e2eUtils.js');
const logger = utils.getLogger('upgrade-chaincode');

let client, channel, e2e, ORGS;

test('\n\n **** E R R O R  T E S T I N G on upgrade call', async (t) => {
	testUtil.resetDefaults();

	e2e = testUtil.END2END;
	Client.addConfigFile(path.join(__dirname, './e2e/config.json'));
	ORGS = Client.getConfigSetting('test-network');

	const caRootsPath = ORGS.orderer.tls_cacerts;
	const data = fs.readFileSync(path.join(__dirname, '/test', caRootsPath));
	const caroots = Buffer.from(data).toString();


	testUtil.setupChaincodeDeploy();

	const org = 'org1';
	client = new Client();
	channel = client.newChannel(e2e.channel);
	const orgName = ORGS[org].name;

	const transientMap = {'test': Buffer.from('transientValue')};
	const tlsInfo = await e2eUtils.tlsEnroll(org);
	t.pass('Successfully retrieved TLS certificate');
	client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
	const store = await Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg(orgName)});
	client.setStateStore(store);
	await testUtil.getSubmitter(client, t, true /* use peer org admin */, org);
	t.pass('Successfully enrolled user \'admin\'');

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
		if (ORGS[org].hasOwnProperty(key)) {
			if (key.indexOf('peer1') === 0) {
				const data = fs.readFileSync(path.join(__dirname, '/test', ORGS[org][key]['tls_cacerts']));
				const peer = client.newPeer(
					ORGS[org][key].requests,
					{
						pem: Buffer.from(data).toString(),
						'ssl-target-name-override': ORGS[org][key]['server-hostname']
					}
				);
				targets.push(peer);
				channel.addPeer(peer);
			}
		}
	}

	await channel.initialize();


	t.pass('Successfully initialized channel');
	let tx_id = client.newTransactionID();

	// send proposal to endorser
	let request = {
		chaincodeId: e2e.chaincodeId,
		chaincodeVersion: 'v1',
		fcn: 'init',
		args: ['a', '500', 'b', '600'],
		txId: tx_id,
		transientMap
	};

	let results = await channel.sendUpgradeProposal(request);

	testUtil.checkResults(results, 'version already exists', t);


	tx_id = client.newTransactionID();

	// send proposal to endorser
	request = {
		chaincodeId: 'dummy',
		chaincodeVersion: 'v1',
		fcn: 'init',
		args: ['a', '500', 'b', '600'],
		txId: tx_id,
		transientMap
	};

	results = await channel.sendUpgradeProposal(request);

	testUtil.checkResults(results, 'cannot get package for chaincode', t);


	tx_id = client.newTransactionID();

	// send proposal to endorser
	request = {
		chaincodeId: e2e.chaincodeId,
		chaincodeVersion: 'v333333333',
		fcn: 'init',
		args: ['a', '500', 'b', '600'],
		txId: tx_id,
		transientMap
	};

	results = await channel.sendUpgradeProposal(request);

	testUtil.checkResults(results, 'cannot get package for chaincode', t);
	t.end();
});

test('\n\n **** Testing re-initializing states during upgrade ****', async (t) => {

	const VER = 'v3';

	await e2eUtils.installChaincode('org1', testUtil.CHAINCODE_UPGRADE_PATH_V2, null, VER, 'golang', t, true);
	await e2eUtils.installChaincode('org2', testUtil.CHAINCODE_UPGRADE_PATH_V2, null, VER, 'golang', t, true);
	await e2eUtils.instantiateChaincode('org1', testUtil.CHAINCODE_UPGRADE_PATH_V2, VER, 'golang', true, true, t);
	const fcn = 'query';
	const args = ['b'];
	const expectedResult = '1000';
	const targets = [];  // empty array, meaning client will get the peers from the channel
	const chaincodeId = testUtil.END2END.chaincodeId;
	logger.debug('Successfully upgraded chaincode to version v3');
	const result = await e2eUtils.queryChaincode('org1', VER, targets, fcn, args, expectedResult, chaincodeId, t);

	if (result) {
		t.pass('Successfully query chaincode on the channel after re-initializing chaincode states during upgrade');
		t.end();
	}
	else {
		t.fail('Failed to query chaincode to verify re-initialized state information');
		t.end();
	}
});
