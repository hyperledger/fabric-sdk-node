/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

var tape = require('tape');
var _test = require('tape-promise').default;
var test = _test(tape);

var path = require('path');
var fs = require('fs');
var util = require('util');

var Client = require('fabric-client');
var utils = require('fabric-client/lib/utils.js');
var testUtil = require('../unit/util.js');
var e2eUtils = require('./e2e/e2eUtils.js');
var logger = utils.getLogger('upgrade-chaincode');

var client, channel, e2e, ORGS;

test('\n\n **** E R R O R  T E S T I N G on upgrade call', (t) => {
	testUtil.resetDefaults();

	e2e = testUtil.END2END;
	Client.addConfigFile(path.join(__dirname, './e2e/config.json'));
	ORGS = Client.getConfigSetting('test-network');

	var caRootsPath = ORGS.orderer.tls_cacerts;
	let data = fs.readFileSync(path.join(__dirname, '/test', caRootsPath));
	let caroots = Buffer.from(data).toString();

	var tx_id = null;
	var the_user = null;
	var allEventhubs = [];

	testUtil.setupChaincodeDeploy();

	var org = 'org1';
	client = new Client();
	channel = client.newChannel(e2e.channel);
	var orgName = ORGS[org].name;
	let tlsInfo = null;

	e2eUtils.tlsEnroll(org)
	.then((enrollment) => {
		t.pass('Successfully retrieved TLS certificate');
		tlsInfo = enrollment;
		return Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg(orgName)});
	}).then((store) => {
		client.setStateStore(store);

		return testUtil.getSubmitter(client, t, true /* use peer org admin */, org);
	})
	.then((admin) => {
		t.pass('Successfully enrolled user \'admin\'');
		the_user = admin;

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
				if (key.indexOf('peer1') === 0) {
					let data = fs.readFileSync(path.join(__dirname, '/test', ORGS[org][key]['tls_cacerts']));
					let peer = client.newPeer(
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
		}

		return channel.initialize();

	})
	.then((nothing) => {
		t.pass('Successfully initialized channel');
		tx_id = client.newTransactionID();

		// send proposal to endorser
		var request = {
			chaincodeId : e2e.chaincodeId,
			chaincodeVersion : 'v1',
			fcn: 'init',
			args: ['a', '500', 'b', '600'],
			txId: tx_id,
			transientMap: { 'test': 'transientValue' }
		};

		return channel.sendUpgradeProposal(request);

	}).then((results) => {
		testUtil.checkResults(results, 'version already exists', t);

		return Promise.resolve(true);

	}, (err) => {
		t.fail('This should not have thrown an Error ::'+ err);
		return Promise.resolve(true);
	}).then((nothing) => {
		tx_id = client.newTransactionID();

		// send proposal to endorser
		var request = {
			chaincodeId: 'dummy',
			chaincodeVersion: 'v1',
			fcn: 'init',
			args: ['a', '500', 'b', '600'],
			txId: tx_id,
			transientMap: { 'test': 'transientValue' }
		};

		return channel.sendUpgradeProposal(request);

	}).then((results) => {
		testUtil.checkResults(results, 'cannot get package for chaincode', t);

		return Promise.resolve(true);

	}).then((nothing) => {
		tx_id = client.newTransactionID();

		// send proposal to endorser
		var request = {
			chaincodeId: e2e.chaincodeId,
			chaincodeVersion: 'v333333333',
			fcn: 'init',
			args: ['a', '500', 'b', '600'],
			txId: tx_id,
			transientMap: { 'test': 'transientValue' }
		};

		return channel.sendUpgradeProposal(request);

	}).then((results) => {
		testUtil.checkResults(results, 'cannot get package for chaincode', t);
		t.end();
	}).catch((err) => {
		t.fail('Got an Error along the way :: '+ err);
		t.end();
	});
});

test('\n\n **** Testing re-initializing states during upgrade ****', (t) => {
	let eventhubs = [];
	// override t.end function so it'll always disconnect the event hub
	t.end = ((context, ehs, f) => {
		return function() {
			for(var key in ehs) {
				var eventhub = ehs[key];
				if (eventhub && eventhub.isconnected()) {
					logger.debug('Disconnecting the event hub');
					eventhub.disconnect();
				}
			}

			f.apply(context, arguments);
		};
	})(t, eventhubs, t.end);

	let tx_id = client.newTransactionID();
	let VER = 'v3';

	e2eUtils.installChaincode('org1', testUtil.CHAINCODE_UPGRADE_PATH_V2, null, VER, 'golang', t, true)
	.then(() => {
		return e2eUtils.installChaincode('org2', testUtil.CHAINCODE_UPGRADE_PATH_V2, null, VER, 'golang', t, true);
	}, (err) => {
		t.fail('Failed to install chaincode in peers of organization "org1". ' + err.stack ? err.stack : err);
		t.end();
	}).then(() => {
		return e2eUtils.instantiateChaincode('org1', testUtil.CHAINCODE_UPGRADE_PATH_V2, VER, 'golang', true, true, t);
	}).then((results) => {
		let chaincodeId = testUtil.END2END.chaincodeId;
		logger.debug('Successfully upgraded chaincode to version v3');
		return 	e2eUtils.queryChaincode('org1', VER, '1000', chaincodeId, t);

	}).then((result) => {
		if(result){
			t.pass('Successfully query chaincode on the channel after re-initializing chaincode states during upgrade');
			t.end();
		}
		else {
			t.fail('Failed to query chaincode to verify re-initialized state information');
			t.end();
		}
	}, (err) => {
		t.fail('Failed to query chaincode on the channel. ' + err.stack ? err.stack : err);
		t.end();
	}).catch((err) => {
		t.fail('Test failed due to unexpected reasons. ' + err.stack ? err.stack : err);
		t.end();
	});
});
