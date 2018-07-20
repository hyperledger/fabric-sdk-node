/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const util = require('util');
const fs = require('fs');
const path = require('path');
const grpc = require('grpc');

const Client = require('fabric-client');

const testUtil = require('../../unit/util.js');
const e2eUtils = require('../e2e/e2eUtils.js');
let ORGS;

const commonProto = grpc.load(path.join(__dirname, '../../../fabric-client/lib/protos/common/common.proto')).common;

const client = new Client();

const org = 'org1';
const total = 1000;

const DESC = 	'\n\n************************************************' +
			'\n**' +
			'\n** Performance Tests' +
			'\n**' +
			'\n************************************************' +
			'\n\n** gRPC orderer client low-level API performance **';

test(DESC, (t) => {
	perfTest1(t);
	t.end();
});

async function perfTest1(t) {
	testUtil.resetDefaults();
	Client.setConfigSetting('key-value-store', 'fabric-ca-client/lib/impl/FileKeyValueStore.js');//force for 'gulp test'
	Client.addConfigFile(path.join(__dirname, '../e2e', 'config.json'));
	ORGS = Client.getConfigSetting('test-network');
	const orgName = ORGS[org].name;

	client.setConfigSetting('grpc-wait-for-ready-timeout', 10000);

	const cryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
	client.setCryptoSuite(cryptoSuite);

	const caRootsPath = ORGS.orderer.tls_cacerts;
	const data = fs.readFileSync(path.join(__dirname, '../e2e', caRootsPath));
	const caroots = Buffer.from(data).toString();

	const tlsInfo = await e2eUtils.tlsEnroll(org);
	client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);

	const orderer = client.newOrderer(
		ORGS.orderer.url,
		{
			name: 'perfTest1',
			'pem': caroots,
			'ssl-target-name-override': ORGS.orderer['server-hostname'],
			'request-timeout': 120000
		}
	);

	let start;
	const broadcast = orderer._ordererClient.broadcast();

	const send = function(msg, type) {
		start = Date.now();
		for(let i=0; i<total; i++) {
			broadcast.write(msg);
		}

		const end = Date.now();
		t.pass(util.format(
			'Sent 1000 "%s" requests to orderer client low-level API in %s milliseconds, averaging %s sent requests per second',
			type,
			end - start,
			Math.round(1000 * 1000 / (end - start))
		));
	};

	const promise = function() {
		let count = 0;
		return new Promise((resolve, reject) => {
			broadcast.on('data', (response) => {
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

			broadcast.on('end', () => {
				t.comment('Ending the broadcast stream');
				broadcast.cancel();
			});

			broadcast.on('error', (err) => {
				broadcast.end();
				return reject(new Error(err));
			});
		});
	};

	let user;
	return Client.newDefaultKeyValueStore({
		path: testUtil.KVS
	}).then((store) => {
		client.setStateStore(store);
		return testUtil.getSubmitter(client, t, org);
	}).then(
		(admin) => {
			user = admin;
			const envelope = makeMessageEnvelope(user);
			send(envelope, 'MESSAGE');
			return promise();
		},
		(err) => {
			t.fail('Failed to enroll user \'admin\'. ' + err);
			t.end();
		}
	).then(
		() => {
			const end = Date.now();
			t.pass(util.format(
				'Completed 1000 "MESSAGE" requests to orderer client low-level API in %s milliseconds, averaging %s requests per second.',
				end - start,
				Math.round(1000 * 1000 / (end - start))
			));

			const envelope = makeTransactionEnvelope(user);
			send(envelope, 'ENDORSER_TRANSACTION');
			return promise();
		},
		(err) => {
			t.comment(util.format('Error: %j', err));
			t.fail(util.format('Failed to submit a valid dummy request to orderer. Error code: %j', err.stack ? err.stack : err));
			t.end();
		}
	).then(
		() => {
			const end = Date.now();
			t.pass(util.format(
				'Completed 1000 "ENDORSER_TRANSACTION" requests to orderer client low-level API in %s milliseconds, averaging %s requests per second.',
				end - start,
				Math.round(1000 * 1000 / (end - start))
			));

			broadcast.end();
			t.end();
		},
		(err) => {
			t.comment(util.format('Error: %j', err));
			t.fail(util.format('Failed to submit a valid dummy request to orderer. Error code: %j', err.stack ? err.stack : err));
			t.end();
		}
	).catch((err) => {
		t.fail('Failed request. ' + err);
		t.end();
	});
}

test('\n\n** Orderer.js class sendBroadcast() API performance **', (t) => {
	perfTest2(t);
	t.end();
});

async function perfTest2(t) {
	const caRootsPath = ORGS.orderer.tls_cacerts;
	const data = fs.readFileSync(path.join(__dirname, '../e2e', caRootsPath));
	const caroots = Buffer.from(data).toString();

	const tlsInfo = await e2eUtils.tlsEnroll(org);
	client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);

	const orderer = client.newOrderer(
		ORGS.orderer.url,
		{
			name: 'perfTest2',
			'pem': caroots,
			'ssl-target-name-override': ORGS.orderer['server-hostname'],
			'request-timeout': 120000
		}
	);

	let start;
	const send = function(msg, type) {
		const promises = [];
		start = Date.now();
		for(let i=0; i<total; i++) {
			promises.push(orderer.sendBroadcast(msg));
		}
		const end = Date.now();
		t.pass(util.format(
			'Sent 1000 "%s" requests to orderer broadcast API in %s milliseconds, averaging %s sent requests per second',
			type,
			end - start,
			Math.round(1000 * 1000 / (end - start))
		));

		return Promise.all(promises);
	};

	let user;
	return Client.newDefaultKeyValueStore({
		path: testUtil.KVS
	}).then((store) => {
		client.setStateStore(store);
		return testUtil.getSubmitter(client, t, org);
	}).then(
		(admin) => {
			user = admin;
			const envelope = makeMessageEnvelope(user);
			return send(envelope, 'MESSAGE');
		},
		(err) => {
			t.fail('Failed to enroll user \'admin\'. ' + err);
			t.end();
		}
	).then(
		() => {
			const end = Date.now();
			t.pass(util.format(
				'Completed 1000 "MESSAGE" requests to orderer broadcast API in %s milliseconds, averaging %s requests per second.',
				end - start,
				Math.round(1000 * 1000 / (end - start))
			));

			const envelope = makeTransactionEnvelope(user);
			return send(envelope, 'ENDORSER_TRANSACTION');
		},
		(err) => {
			t.comment(util.format('Error: %j', err));
			t.fail(util.format('Failed to submit a valid dummy request to orderer. Error code: %j', err.stack ? err.stack : err));
			t.end();
		}
	).then(
		() => {
			const end = Date.now();
			t.pass(util.format(
				'Completed 1000 "ENDORSER_TRANSACTION" requests to orderer broadcast API in %s milliseconds, averaging %s requests per second.',
				end - start,
				Math.round(1000 * 1000 / (end - start))
			));

			t.end();
		},
		(err) => {
			t.comment(util.format('Error: %j', err));
			t.fail(util.format('Failed to submit a valid dummy request to orderer. Error code: %j', err.stack ? err.stack : err));
			t.end();
		}
	).catch((err) => {
		t.fail('Failed request. ' + err);
		t.end();
	});
}

function makeTransactionEnvelope(signer) {
	return makeEnvelope(signer, commonProto.HeaderType.ENDORSER_TRANSACTION);
}

function makeMessageEnvelope(signer) {
	return makeEnvelope(signer, commonProto.HeaderType.MESSAGE);
}

function makeEnvelope(signer, type) {
	const dummyPayload = new commonProto.Payload();
	const cHeader = new commonProto.ChannelHeader();
	cHeader.setType(type);
	cHeader.setChannelId(testUtil.END2END.channel);

	const sHeader = new commonProto.SignatureHeader();
	sHeader.setCreator(signer.getIdentity().serialize());
	sHeader.setNonce(Buffer.from('23456'));

	dummyPayload.setHeader({
		channel_header: cHeader.toBuffer(),
		signature_header: sHeader.toBuffer()
	});
	dummyPayload.setData('Dummy data');

	const sig = signer.getSigningIdentity().sign(dummyPayload.toBuffer());
	const envelope = {
		signature: Buffer.from(sig),
		payload: dummyPayload.toBuffer()
	};

	return envelope;
}

// send to orderer
// 		var request = {
// 			proposalResponses: 'blah',
// 			proposal: 'blah'
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
