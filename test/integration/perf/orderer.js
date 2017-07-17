/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var util = require('util');
var fs = require('fs');
var path = require('path');
var grpc = require('grpc');

var Client = require('fabric-client');

var testUtil = require('../../unit/util.js');
var keyValStorePath = testUtil.KVS;
var ORGS;

var commonProto = grpc.load(path.join(__dirname, '../../../fabric-client/lib/protos/common/common.proto')).common;

var client = new Client();
var org = 'org1';
var total = 1000;

var DESC = 	'\n\n************************************************' +
			'\n**' +
			'\n** Performance Tests' +
			'\n**' +
			'\n************************************************' +
			'\n\n** gRPC orderer client low-level API performance **';

test(DESC, function(t) {
	testUtil.resetDefaults();
	Client.setConfigSetting('key-value-store', 'fabric-ca-client/lib/impl/FileKeyValueStore.js');//force for 'gulp test'
	Client.addConfigFile(path.join(__dirname, '../e2e', 'config.json'));
	ORGS = Client.getConfigSetting('test-network');
	let orgName = ORGS[org].name;

	let cryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
	client.setCryptoSuite(cryptoSuite);

	var caRootsPath = ORGS.orderer.tls_cacerts;
	let data = fs.readFileSync(path.join(__dirname, '../e2e', caRootsPath));
	let caroots = Buffer.from(data).toString();

	let orderer = client.newOrderer(
		ORGS.orderer.url,
		{
			'pem': caroots,
			'ssl-target-name-override': ORGS.orderer['server-hostname'],
			'request-timeout': 120000
		}
	);

	let start;
	let broadcast = orderer._ordererClient.broadcast();

	var send = function(msg, type) {
		start = Date.now();
		for(let i=0; i<total; i++) {
			broadcast.write(msg);
		}

		let end = Date.now();
		t.pass(util.format(
			'Sent 1000 "%s" requests to orderer client low-level API in %s milliseconds, averaging %s sent requests per second',
			type,
			end - start,
			Math.round(1000 * 1000 / (end - start))
		));
	};

	var promise = function() {
		let count = 0;
		return new Promise((resolve, reject) => {
			broadcast.on('data', function (response) {
				if(response.status) {
					if (response.status === 'SUCCESS') {
						count ++;
						if (count === total) {
							return resolve('ALL_DONE');
						}
					} else {
						return reject(new Error(response.status));
					}
				}
				else {
					return reject(new Error('SYSTEM_ERROR'));
				}
			});

			broadcast.on('end', function (response) {
				t.comment('Ending the broadcast stream');
				broadcast.cancel();
			});

			broadcast.on('error', function (err) {
				broadcast.end();
				return reject(new Error(err));
			});
		});
	};

	var user;
	return Client.newDefaultKeyValueStore({
		path: testUtil.KVS
	}).then((store) => {
		client.setStateStore(store);
		return testUtil.getSubmitter(client, t, org);
	}).then(
		function(admin) {
			user = admin;
			let envelope = makeMessageEnvelope(user);
			send(envelope, 'MESSAGE');
			return promise();
		},
		function(err) {
			t.fail('Failed to enroll user \'admin\'. ' + err);
			t.end();
		}
	).then(
		function() {
			let end = Date.now();
			t.pass(util.format(
				'Completed 1000 "MESSAGE" requests to orderer client low-level API in %s milliseconds, averaging %s requests per second.',
				end - start,
				Math.round(1000 * 1000 / (end - start))
			));

			let envelope = makeTransactionEnvelope(user);
			send(envelope, 'ENDORSER_TRANSACTION');
			return promise();
		},
		function(err) {
			t.comment(util.format('Error: %j', err));
			t.fail(util.format('Failed to submit a valid dummy request to orderer. Error code: %j', err.stack ? err.stack : err));
			t.end();
		}
	).then(
		function() {
			let end = Date.now();
			t.pass(util.format(
				'Completed 1000 "ENDORSER_TRANSACTION" requests to orderer client low-level API in %s milliseconds, averaging %s requests per second.',
				end - start,
				Math.round(1000 * 1000 / (end - start))
			));

			broadcast.end();
			t.end();
		},
		function(err) {
			t.comment(util.format('Error: %j', err));
			t.fail(util.format('Failed to submit a valid dummy request to orderer. Error code: %j', err.stack ? err.stack : err));
			t.end();
		}
	).catch(function(err) {
		t.fail('Failed request. ' + err);
		t.end();
	});
});

test('\n\n** Orderer.js class sendBroadcast() API performance **', function(t) {
	var caRootsPath = ORGS.orderer.tls_cacerts;
	let data = fs.readFileSync(path.join(__dirname, '../e2e', caRootsPath));
	let caroots = Buffer.from(data).toString();

	let orderer = client.newOrderer(
		ORGS.orderer.url,
		{
			'pem': caroots,
			'ssl-target-name-override': ORGS.orderer['server-hostname'],
			'request-timeout': 120000
		}
	);

	let start;
	var send = function(msg, type) {
		let promises = [];
		start = Date.now();
		for(let i=0; i<total; i++) {
			promises.push(orderer.sendBroadcast(msg));
		}
		let end = Date.now();
		t.pass(util.format(
			'Sent 1000 "%s" requests to orderer broadcast API in %s milliseconds, averaging %s sent requests per second',
			type,
			end - start,
			Math.round(1000 * 1000 / (end - start))
		));

		return Promise.all(promises);
	};

	var user;
	return Client.newDefaultKeyValueStore({
		path: testUtil.KVS
	}).then((store) => {
		client.setStateStore(store);
		return testUtil.getSubmitter(client, t, org);
	}).then(
		function(admin) {
			user = admin;
			let envelope = makeMessageEnvelope(user);
			return send(envelope, 'MESSAGE');
		},
		function(err) {
			t.fail('Failed to enroll user \'admin\'. ' + err);
			t.end();
		}
	).then(
		function() {
			let end = Date.now();
			t.pass(util.format(
				'Completed 1000 "MESSAGE" requests to orderer broadcast API in %s milliseconds, averaging %s requests per second.',
				end - start,
				Math.round(1000 * 1000 / (end - start))
			));

			let envelope = makeTransactionEnvelope(user);
			return send(envelope, 'ENDORSER_TRANSACTION');
		},
		function(err) {
			t.comment(util.format('Error: %j', err));
			t.fail(util.format('Failed to submit a valid dummy request to orderer. Error code: %j', err.stack ? err.stack : err));
			t.end();
		}
	).then(
		function() {
			let end = Date.now();
			t.pass(util.format(
				'Completed 1000 "ENDORSER_TRANSACTION" requests to orderer broadcast API in %s milliseconds, averaging %s requests per second.',
				end - start,
				Math.round(1000 * 1000 / (end - start))
			));

			t.end();
		},
		function(err) {
			t.comment(util.format('Error: %j', err));
			t.fail(util.format('Failed to submit a valid dummy request to orderer. Error code: %j', err.stack ? err.stack : err));
			t.end();
		}
	).catch(function(err) {
		t.fail('Failed request. ' + err);
		t.end();
	});
});

function makeTransactionEnvelope(signer) {
	return makeEnvelope(signer, commonProto.HeaderType.ENDORSER_TRANSACTION);
}

function makeMessageEnvelope(signer) {
	return makeEnvelope(signer, commonProto.HeaderType.MESSAGE);
}

function makeEnvelope(signer, type) {
	let dummyPayload = new commonProto.Payload();
	let cHeader = new commonProto.ChannelHeader();
	cHeader.setType(type);
	cHeader.setChannelId(testUtil.END2END.channel);

	let sHeader = new commonProto.SignatureHeader();
	sHeader.setCreator(signer.getIdentity().serialize());
	sHeader.setNonce(Buffer.from('23456'));

	dummyPayload.setHeader({
		channel_header: cHeader.toBuffer(),
		signature_header: sHeader.toBuffer()
	});
	dummyPayload.setData('Dummy data');

	let sig = signer.getSigningIdentity().sign(dummyPayload.toBuffer());
	let envelope = {
		signature: Buffer.from(sig),
		payload: dummyPayload.toBuffer()
	};

	return envelope;
}

			// send to orderer
	// 		var request = {
	// 			proposalResponses: 'blah',
	// 			proposal: 'blah',
	// 			header: 'blah'
	// 		};
	// 		return channel.sendTransaction(request);
	// ).then(
	// 	function(status) {
	// 		t.comment('Status: ' + status + ', type: (' + typeof status + ')');
	// 		if (status === 0) {
	// 			t.fail('Successfully submitted request, which is bad because request is invalid');
	// 		} else {
	// 			t.pass('Successfully tested invalid submission due to the invalid request. Error code: ' + status);
	// 		}
	// 		t.end();
	// 	},
	// 	function(err) {
	// 		t.comment('Failed to submit. Error: ');
	// 		t.pass('Error :' + err.stack ? err.stack : err);
	// 		t.end();
	// 	}
	// ).catch(function(err) {
	// 	t.comment('Failed to submit orderer request.  Error: ');
	// 	t.pass('Error: ' + err);
	// 	t.end();
	// });

