/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';
var utils = require('fabric-client/lib/utils.js');
var clientUtils = require('fabric-client/lib/client-utils.js');
var logger = utils.getLogger('performance testing');
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
var proposalProto = grpc.load(path.join(__dirname, '../../../fabric-client/lib/protos/peer/proposal.proto')).protos;
var ccProto = grpc.load(path.join(__dirname, '../../../fabric-client/lib/protos/peer/chaincode.proto')).protos;

var client = new Client();
var org = 'org1';
var total = 1000;
var proposals = [];

var DESC = '\n\n** gRPC peer client low-level API performance **';

test(DESC, function(t) {
	testUtil.resetDefaults();
	Client.setConfigSetting('key-value-store', 'fabric-ca-client/lib/impl/FileKeyValueStore.js');//force for 'gulp test'
	Client.addConfigFile(path.join(__dirname, '../e2e', 'config.json'));
	ORGS = Client.getConfigSetting('test-network');
	let orgName = ORGS[org].name;

	let cryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
	client.setCryptoSuite(cryptoSuite);

	var caRootsPath = ORGS[org].peer1.tls_cacerts;
	let data = fs.readFileSync(path.join(__dirname, '../e2e', caRootsPath));
	let caroots = Buffer.from(data).toString();

	let peer = client.newPeer(
		ORGS[org].peer1.requests,
		{
			'pem': caroots,
			'ssl-target-name-override': ORGS[org].peer1['server-hostname'],
			'request-timeout': 120000
		}
	);

	var start;
	var start2;
	var endorser = peer._endorserClient;

	var promise = function(user) {
		for(let i=0; i<total; i++) {
			let proposal = makeProposal(user, client);
			proposals.push(proposal);
		}
		start = Date.now();
		let count = 0;
		return new Promise((resolve, reject) => {
			while(true) {
				let proposal = proposals.pop();
				if(!proposal){
					logger.debug(' sendind proposals is complete');
					break;
				}
				endorser.processProposal(proposal, function(err, proposalResponse) {
					if (err) {
						reject(err);
					} else {
						if (proposalResponse) {
							//logger.debug('Received proposal response with status - %s', proposalResponse.response.status);
							if(count == total) {
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

	var user;
	return Client.newDefaultKeyValueStore({
		path: testUtil.KVS
	}).then((store) => {
		client.setStateStore(store);
		return testUtil.getSubmitter(client, t, org);
	}).then(
		function(admin) {
			user = admin;
			start2 = Date.now();
			promise(user);
		},
		function(err) {
			t.fail('Failed to enroll user \'admin\'. ' + err);
		}
	).then(
		function() {
			let end = Date.now();
			let end2 = Date.now();
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
		function(err) {
			t.comment(util.format('Error: %j', err));
			t.fail(util.format('Failed to submit a valid dummy request to peer. Error code: %j', err.stack ? err.stack : err));
			t.end();
		}
	).catch(function(err) {
		t.fail('Failed request. ' + err);
		t.end();
	});
});

function makeProposal(signer, client) {
	let tx_id = client.newTransactionID();
	let args = ['query', 'a'];
	let arg_bytes = [];
	for(let i=0; i<args.length; i++) {
		arg_bytes.push(Buffer.from(args[i], 'utf8'));
	}
	let invokeSpec = {
		type: ccProto.ChaincodeSpec.Type.GOLANG,
		chaincode_id: {
			name: testUtil.END2END.chaincodeId
		},
		input: {
			args: arg_bytes,
		}
	};

	var channelHeader = clientUtils.buildChannelHeader(
		commonProto.HeaderType.ENDORSER_TRANSACTION,
		testUtil.END2END.channel,
		tx_id.getTransactionID(),
		null,
		testUtil.END2END.chaincodeId
	);
	let header = clientUtils.buildHeader(signer.getIdentity(), channelHeader, tx_id.getNonce());
	let proposal = clientUtils.buildProposal(invokeSpec, header);
	let signed_proposal = clientUtils.signProposal(signer.getSigningIdentity(), proposal);

	return signed_proposal;
}
