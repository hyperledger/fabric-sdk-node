// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var path = require('path');

var hfc = require('../..');
var util = require('util');
var grpc = require('grpc');
var testUtil = require('./util.js');

var _headerProto = grpc.load(path.join(__dirname, '../../lib/protos/fabric_transaction_header.proto')).protos;
var _ccProposalProto = grpc.load(path.join(__dirname,'../../lib/protos/chaincode_proposal.proto')).protos;
var _ccTxProto = grpc.load(path.join(__dirname,'../../lib/protos/chaincode_transaction.proto')).protos;
var _prProto = grpc.load(path.join(__dirname,'../../lib/protos/fabric_proposal_response.proto')).protos;
var _txProto = grpc.load(path.join(__dirname,'../../lib/protos/fabric_transaction.proto')).protos;

var chain = hfc.newChain('testChain-e2e');
var webUser;

testUtil.setupChaincodeDeploy();

chain.setKeyValueStore(hfc.newKeyValueStore({
	path: '/tmp/kvs-hfc-e2e'
}));

chain.setMemberServicesUrl('grpc://localhost:7054');
chain.setOrderer('grpc://localhost:5151');

test('End-to-end flow of chaincode deploy, transaction invocation, and query', function(t) {
	chain.enroll('admin', 'Xurw3yU9zI0l')
	.then(
		function(admin) {
			t.pass('Successfully enrolled user \'admin\'');
			webUser = admin;

			// send proposal to endorser
			var request = {
				endorserUrl: 'grpc://localhost:7051',
				chaincodePath: testUtil.CHAINCODE_PATH,
				fcn: 'init',
				args: ['a', '100', 'b', '200']
			};

			return admin.sendDeploymentProposal(request);
		},
		function(err) {
			t.fail('Failed to enroll user \'admin\'. ' + err);
			t.end();
		}
	).then(
		function(data) {
			let response = data[0];
			let payload = data[1];

			if (response && response.response && response.response.status === 200) {
				t.pass(util.format('Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s', response.response.status, response.response.message, response.response.payload, response.endorsement.signature));

				let headerExt = new _ccProposalProto.ChaincodeHeaderExtension();
				let header = new _headerProto.Header();
				header.setType(_headerProto.Header.Type.CHAINCODE);
				header.setExtensions(headerExt.toBuffer());

				let ccaPayload = new _ccTxProto.ChaincodeActionPayload();
				ccaPayload.setChaincodeProposalPayload(payload);
				ccaPayload.setAction({
					proposalResponsePayload: response.payload,
					endorsements: [response.endorsement]
				});

				let tx = new _txProto.Transaction2();
				tx.setActions([{
					header:header.toBuffer(),
					payload: ccaPayload.toBuffer()
				}]);

				return webUser.sendTransaction(tx.toBuffer());

			} else {
				t.fail('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
				t.end();
			}
		},
		function(err) {
			t.fail('Failed to send deployment proposal due to error: ' + err.stack ? err.stack : err);
			t.end();
		}
	).then(
		function(data) {
			t.pass(util.format('Response from orderer: %j', data));

			t.end();
		}
	).catch(
		function(err) {
			t.fail('Failed to send deployment proposal. ' + err.stack ? err.stack : err);
			t.end();
		}
	);
});
