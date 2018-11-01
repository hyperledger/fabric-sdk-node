/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';
const utils = require('fabric-client/lib/utils.js');
const clientUtils = require('fabric-client/lib/client-utils.js');
const logger = utils.getLogger('performance testing');
const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const util = require('util');
const fs = require('fs');
const path = require('path');
const ProtoLoader = require('fabric-client/lib/ProtoLoader');
const e2eUtils = require('../e2e/e2eUtils.js');

const Client = require('fabric-client');

const testUtil = require('../../unit/util.js');
let ORGS;

const commonProto = ProtoLoader.load(path.join(__dirname, '../../../fabric-client/lib/protos/common/common.proto')).common;
const ccProto = ProtoLoader.load(path.join(__dirname, '../../../fabric-client/lib/protos/peer/chaincode.proto')).protos;

const client = new Client();
const org = 'org1';
const total = 1000;
const proposals = [];

const DESC = '\n\n** gRPC peer client low-level API performance **';

test(DESC, (t) => {
	perfTest3(t);
	t.end();
});

async function perfTest3(t) {
	testUtil.resetDefaults();
	Client.setConfigSetting('key-value-store', 'fabric-ca-client/lib/impl/FileKeyValueStore.js');// force for 'gulp test'
	Client.addConfigFile(path.join(__dirname, '../e2e', 'config.json'));
	ORGS = Client.getConfigSetting('test-network');
	const orgName = ORGS[org].name;

	const cryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
	client.setCryptoSuite(cryptoSuite);

	const caRootsPath = ORGS[org].peer1.tls_cacerts;
	const data = fs.readFileSync(path.join(__dirname, '../e2e', caRootsPath));
	const caroots = Buffer.from(data).toString();

	const tlsInfo = await e2eUtils.tlsEnroll(org);
	client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);

	const peer = client.newPeer(
		ORGS[org].peer1.requests,
		{
			'pem': caroots,
			'ssl-target-name-override': ORGS[org].peer1['server-hostname'],
			'request-timeout': 120000
		}
	);

	let start;
	let start2;
	const endorser = peer._endorserClient;

	const promise = function(user) {
		for (let i = 0; i < total; i++) {
			const proposal = makeProposal(user, client);
			proposals.push(proposal);
		}
		start = Date.now();
		const count = 0;
		return new Promise((resolve, reject) => {
			// eslint-disable-next-line no-constant-condition
			while (true) {
				const proposal = proposals.pop();
				if (!proposal) {
					logger.debug(' sendind proposals is complete');
					break;
				}
				endorser.processProposal(proposal, (err, proposalResponse) => {
					if (err) {
						reject(err);
					} else {
						if (proposalResponse) {
							// logger.debug('Received proposal response with status - %s', proposalResponse.response.status);
							if (count === total) {
								resolve(proposalResponse);
							}
						} else {
							reject(new Error('GRPC client failed to get a proper response from the peer'));
						}
					}
				});
			}
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
			start2 = Date.now();
			promise(user);
		},
		(err) => {
			t.fail('Failed to enroll user \'admin\'. ' + err);
		}
	).then(
		() => {
			const end = Date.now();
			const end2 = Date.now();
			t.pass(util.format(
				'Completed sending %s "INVOKE" requests to peer and chaincode :: ',
				total));
			t.pass(util.format(
				'--time to send (including building proposal and signing): %s milliseconds, averaging %s requests per second.',
				end2 - start2,
				Math.round(1000 * 1000 / (end2 - start2))));
			t.pass(util.format(
				'--time to send (just sending requests)..................: %s milliseconds, averaging %s requests per second.',
				end - start,
				Math.round(1000 * 1000 / (end - start))));

			t.end();
		},
		(err) => {
			t.comment(util.format('Error: %j', err));
			t.fail(util.format('Failed to submit a valid dummy request to peer. Error code: %j', err.stack ? err.stack : err));
			t.end();
		}
	).catch((err) => {
		t.fail('Failed request. ' + err);
		t.end();
	});
}

function makeProposal(signer, targetClient) {
	const tx_id = targetClient.newTransactionID();
	const args = ['query', 'a'];
	const arg_bytes = [];
	for (let i = 0; i < args.length; i++) {
		arg_bytes.push(Buffer.from(args[i], 'utf8'));
	}
	const invokeSpec = {
		type: ccProto.ChaincodeSpec.Type.GOLANG,
		chaincode_id: {
			name: testUtil.END2END.chaincodeId
		},
		input: {
			args: arg_bytes,
		}
	};

	const channelHeader = clientUtils.buildChannelHeader(
		commonProto.HeaderType.ENDORSER_TRANSACTION,
		testUtil.END2END.channel,
		tx_id.getTransactionID(),
		null,
		testUtil.END2END.chaincodeId
	);
	const header = clientUtils.buildHeader(signer.getIdentity(), channelHeader, tx_id.getNonce());
	const proposal = clientUtils.buildProposal(invokeSpec, header);
	const signed_proposal = clientUtils.signProposal(signer.getSigningIdentity(), proposal);

	return signed_proposal;
}
