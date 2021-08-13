/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const rewire = require('rewire');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const should = chai.should();
chai.use(chaiAsPromised);
const sinon = require('sinon');

const Proposal = rewire('../lib/Proposal');
const Client = require('../lib/Client');
const DiscoveryHandler = require('../lib/DiscoveryHandler');
const User = rewire('../lib/User');

const TestUtils = require('./TestUtils');

describe('Proposal', () => {

	TestUtils.setCryptoConfigSettings();

	const client = new Client('myclient');
	client._tls_mutual.clientCertHash = Buffer.from('clientCertHash');
	const channel = client.newChannel('mychannel');

	const user = User.createUser('user', 'password', 'mspid', TestUtils.certificateAsPEM, TestUtils.keyAsPEM);
	const idx = client.newIdentityContext(user);

	let proposal;
	let endorser;
	let endpoint;
	let handler;

	beforeEach(async () => {
		channel.buildChannelHeader = sinon.stub().returns(TestUtils.createChannelHeader());
		proposal = new Proposal('chaincode', channel);
		endorser = client.newEndorser('mypeer');
		endorser.type = 'Endorser';
		endpoint = client.newEndpoint({url: 'grpc://somehost.com'});
		endorser.endpoint = endpoint;
		endorser.waitForReady = sinon.stub().resolves(true);
		endorser.checkConnection = sinon.stub().resolves(true);
		handler = new DiscoveryHandler('discovery');
	});

	describe('#constructor', () => {
		it('should require a name', () => {
			(() => {
				new Proposal();
			}).should.throw('Missing chaincodeId parameter');
		});
		it('should require a Channel', () => {
			(() => {
				new Proposal('chaincode');
			}).should.throw('Missing channel parameter');
		});
		it('should create', () => {
			const p2 = new Proposal('chaincode', channel);
			p2.type.should.equal('Proposal');
		});
	});

	describe('#getTransactionId', () => {
		it('should error if not built', () => {
			(() => {
				proposal.getTransactionId();
			}).should.throw('The proposal has not been built');
		});
		it('should return txid in use', () => {
			proposal._action = {};
			proposal._action.transactionId = 'txid';
			const txid = proposal.getTransactionId();
			should.equal(txid, 'txid');
		});
	});

	describe('#buildProposalInterest', () => {
		it('should return interest', () => {
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: false}]);
		});
		it('should return interest and collections', () => {
			const collections = ['col1', 'col2'];
			proposal.collectionsInterest = collections;
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: false, collectionNames: collections}]);
		});
		it('should return interest and collections with noPrivateReads', () => {
			const collections = ['col1', 'col2'];
			proposal.collectionsInterest = collections;
			proposal.noPrivateReads = true;
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: true, collectionNames: collections}]);
		});
		it('should return interest and chaincode and chaincode collections ', () => {
			const chaincode_collection = {name: 'chain2', collectionNames: ['col1', 'col2']};
			proposal.chaincodesCollectionsInterest = [chaincode_collection];
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: false}, chaincode_collection]);
		});
		it('should return interest and chaincode and chaincode collections with no private reads ', () => {
			const chaincode_collection = {name: 'chain2', collectionNames: ['col1', 'col2'], noPrivateReads: true};
			proposal.chaincodesCollectionsInterest = [chaincode_collection];
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: false}, chaincode_collection]);
		});
		it('should return interest and chaincode and chaincode collections with no private reads ', () => {
			const chaincode_collection = {name: 'chain2', collectionNames: ['col1', 'col2'], noPrivateReads: true};
			proposal.noPrivateReads = true;
			proposal.chaincodesCollectionsInterest = [chaincode_collection];
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: true}, chaincode_collection]);
		});
	});

	describe('#addCollectionInterest', () => {
		it('should save collection interest', () => {
			proposal.addCollectionInterest('col1');
			proposal.collectionsInterest.should.deep.equal(['col1']);
		});
		it('should save collection interest', () => {
			const collections = ['col1', 'col2'];
			proposal.addCollectionInterest('col1');
			proposal.addCollectionInterest('col2');
			proposal.collectionsInterest.should.deep.equal(collections);
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: false, collectionNames: collections}]);
		});
		it('should require a string collection name', () => {
			(() => {
				proposal.addCollectionInterest({});
			}).should.throw('Invalid collectionName parameter');
		});
	});

	describe('#setNoPrivateReads', () => {
		it('should set no private reads', () => {
			proposal.setNoPrivateReads(true);
			proposal.noPrivateReads.should.equal(true);
		});
		it('should set no private reads false', () => {
			proposal.setNoPrivateReads(false);
			proposal.noPrivateReads.should.equal(false);
		});

		it('should require a boolean', () => {
			(() => {
				proposal.setNoPrivateReads({});
			}).should.throw(/The "no private reads" setting must be boolean/);
		});
	});

	describe('#addChaincodeCollectionsInterest', () => {
		it('should save chaincode collection interest', () => {
			const chaincode_collection = {name: 'chain2', noPrivateReads: false, collectionNames: ['col1', 'col2']};
			proposal.addChaincodeCollectionsInterest('chain2', 'col1', 'col2');
			proposal.chaincodesCollectionsInterest.should.deep.equal([chaincode_collection]);
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: false}, chaincode_collection]);
		});
		it('should save chaincode only chaincode collection interest', () => {
			const chaincode_collection = {name: 'chain2', noPrivateReads: false};
			proposal.addChaincodeCollectionsInterest('chain2');
			proposal.chaincodesCollectionsInterest.should.deep.equal([chaincode_collection]);
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: false}, chaincode_collection]);
		});
		it('should require a string chaincode name', () => {
			(() => {
				proposal.addChaincodeCollectionsInterest({});
			}).should.throw('Invalid chaincodeId parameter');
		});
	});

	describe('#addChaincodeNoPrivateReadsCollectionsInterest', () => {
		it('should save chaincode collection interest', () => {
			const chaincode_collection = {name: 'chain2', noPrivateReads: true, collectionNames: ['col1', 'col2']};
			proposal.addChaincodeNoPrivateReadsCollectionsInterest('chain2', true, 'col1', 'col2');
			proposal.chaincodesCollectionsInterest.should.deep.equal([chaincode_collection]);
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: false}, chaincode_collection]);
		});
		it('should save chaincode only chaincode collection interest', () => {
			const chaincode_collection = {name: 'chain2', noPrivateReads: false};
			proposal.addChaincodeNoPrivateReadsCollectionsInterest('chain2');
			proposal.chaincodesCollectionsInterest.should.deep.equal([chaincode_collection]);
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: false}, chaincode_collection]);
		});
		it('should require a string chaincode name', () => {
			(() => {
				proposal.addChaincodeNoPrivateReadsCollectionsInterest({});
			}).should.throw('Invalid chaincodeId parameter');
		});
	});

	describe('#build', () => {
		it('should require a idContext', () => {
			(() => {
				proposal.build();
			}).should.throw('Missing idContext parameter');
		});
		it('should require an array of args', () => {
			(() => {
				proposal.build(idx, {args: false});
			}).should.throw('Proposal parameter "args" must be an array.');
		});
		it('should build with default options', () => {
			proposal.build(idx);
			should.exist(proposal._action);
			should.exist(proposal._payload);
		});
		it('should build with options', () => {
			const options = {
				fcn: 'move',
				args: ['some', 'data', Buffer.from('bytes')],
				init: true,
				transientMap: {something: 'data'}
			};
			proposal.build(idx, options);
			should.exist(proposal._action);
			should.exist(proposal._payload);
		});
	});

	describe('#send', () => {
		it('throws if targets is missing', async () => {
			proposal.build(idx);
			await proposal.sign(idx);
			await proposal.send().should.be.rejectedWith('Missing targets parameter');
		});
		it('returns no results', async () => {
			proposal.build(idx);
			await proposal.sign(idx);
			sinon.stub(endorser, 'sendProposal').resolves({});
			const results = await proposal.send({targets: [endorser]});
			should.exist(results.errors);
			if (results.errors && results.errors[0]) {
				should.equal(results.errors[0].toString(), 'Error: Missing response status');
			}
		});
		it('should be able to handle result error', async () => {
			proposal.build(idx);
			await proposal.sign(idx);
			sinon.stub(endorser, 'sendProposal').resolves(new Error('forced resolved error'));
			const results = await proposal.send({targets: [endorser]});
			should.exist(results.errors);
			if (results.errors && results.errors[0]) {
				should.equal(results.errors[0].toString(), 'Error: forced resolved error');
			}
		});
		it('should be able to handle rejected error', async () => {
			proposal.build(idx);
			await proposal.sign(idx);
			sinon.stub(endorser, 'sendProposal').rejects(new Error('forced rejected error'));
			const results = await proposal.send({targets: [endorser]});
			should.exist(results.errors);
			if (results.errors && results.errors[0]) {
				should.equal(results.errors[0].toString(), 'Error: forced rejected error');
			}
		});
		it('should have responses when status included', async () => {
			proposal.build(idx);
			await proposal.sign(idx);
			sinon.stub(endorser, 'sendProposal').resolves({response: {status: 200}});
			proposal.compareProposalResponseResults = sinon.stub().returns(true);
			const results = await proposal.send({targets: [endorser]});
			should.exist(results.responses);
			if (results.responses && results.responses[0]) {
				should.equal(results.responses[0].response.status, 200);
			}
		});
		it('should have queryResults when this is a query', async () => {
			proposal.build(idx);
			await proposal.sign(idx);
			proposal.type = 'Query';
			sinon.stub(endorser, 'sendProposal').resolves({response: {status: 400, payload: 'query payload'}});
			const results = await proposal.send({targets: [endorser]});
			should.exist(results.queryResults);
			if (results.queryResults && results.queryResults[0]) {
				should.equal(results.queryResults[0], 'query payload');
			}
		});
		it('should have empty queryResults when this is a query and no good responses', async () => {
			proposal.build(idx);
			await proposal.sign(idx);
			proposal.type = 'Query';
			sinon.stub(endorser, 'sendProposal').resolves({response: {status: 200}});
			const results = await proposal.send({targets: [endorser]});
			results.queryResults.should.be.an('array').that.is.empty;
		});
		it('should have empty queryResults when this is a query and unknown responses', async () => {
			proposal.build(idx);
			await proposal.sign(idx);
			proposal.type = 'Query';
			sinon.stub(endorser, 'sendProposal').resolves({response: {payload: 'query payload'}});
			const results = await proposal.send({targets: [endorser]});
			results.queryResults.should.be.an('array').that.is.empty;
		});
		it('should have responses from handler when status included', async () => {
			proposal.build(idx);
			await proposal.sign(idx);
			sinon.stub(handler, 'endorse').resolves([{response: {status: 200}}]);
			proposal.compareProposalResponseResults = sinon.stub().returns(true);
			const results = await proposal.send({handler: handler});
			should.exist(results.responses);
			if (results.responses && results.responses[0]) {
				should.equal(results.responses[0].response.status, 200);
			}
		});
		it('should have responses from handler when status included', async () => {
			proposal.build(idx);
			await proposal.sign(idx);
			proposal.type = 'Query';
			sinon.stub(handler, 'query').resolves([{response: {status: 200}}]);
			const results = await proposal.send({handler: handler});
			should.exist(results.responses);
			if (results.responses && results.responses[0]) {
				should.equal(results.responses[0].response.status, 200);
			}
		});
		it('should have errors from handler when error included', async () => {
			proposal.build(idx);
			await proposal.sign(idx);
			sinon.stub(handler, 'endorse').resolves([new Error('Endorsement has failed')]);
			const results = await proposal.send({handler: handler});
			should.exist(results.errors);
			if (results.errors && results.errors[0]) {
				should.equal(results.errors[0].toString(), 'Error: Endorsement has failed');
			}
		});
		it('should have errors from handler when error included', async () => {
			proposal.build(idx);
			await proposal.sign(idx);
			proposal.type = 'Query';
			sinon.stub(handler, 'query').resolves([new Error('Endorsement has failed')]);
			const results = await proposal.send({handler: handler});
			should.exist(results.errors);
			if (results.errors && results.errors[0]) {
				should.equal(results.errors[0].toString(), 'Error: Endorsement has failed');
			}
		});
	});

	describe('#verifyProposalResponse', () => {
		it('should require proposalResponse', () => {
			(() => {
				proposal.verifyProposalResponse();
			}).should.throw('Missing proposalResponse parameter');
		});
		it('should be false if an error', () => {
			const results = proposal.verifyProposalResponse(new Error('bad'));
			results.should.be.false;
		});
		it('should require proposalResponse.endorsement', () => {
			(() => {
				proposal.verifyProposalResponse({});
			}).should.throw('Parameter must be a ProposalResponse Object');
		});
		it('should get not implemented', () => {
			(() => {
				proposal.verifyProposalResponse({endorsement: {}});
			}).should.throw('verifyProposalResponse[chaincode] is not implemented');
		});
	});

	describe('#toString', () => {
		it('should return string', () => {
			const string = proposal.toString();
			should.equal(string, 'Proposal: {chaincodeId: chaincode, channel: mychannel}');
		});
	});
});
