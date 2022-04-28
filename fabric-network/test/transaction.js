/*
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-as-promised'));

const path = require('path');

const Client = require('fabric-common/lib/Client');
const Channel = require('fabric-common/lib/Channel');
const Endorsement = require('fabric-common/lib/Endorsement');
const Endorser = require('fabric-common/lib/Endorser');
const QueryProposal = require('fabric-common/lib/Query');
const Commit = require('fabric-common/lib/Commit');
const DiscoveryHandler = require('fabric-common/lib/DiscoveryHandler');
const Committer = require('fabric-common/lib/Committer');
const DiscoveryService = require('fabric-common/lib/DiscoveryService');
const Discoverer = require('fabric-common/lib/Discoverer');

const {Gateway} = require('fabric-network/lib/gateway');
const {Transaction} = require('fabric-network/lib/transaction');
const {TransactionEventHandler} = require('fabric-network/lib/impl/event/transactioneventhandler');
const {QueryImpl: Query} = require('fabric-network/lib/impl/query/query');
const {Wallets} = require('../lib/impl/wallet/wallets');
const {newEndorsementResponse} = require('./testutils');

describe('Transaction', () => {
	const networkName = 'NETWORK_NAME';
	const transactionName = 'TRANSACTION_NAME';
	const chaincodeId = 'chaincode-id';
	const expectedResult = Buffer.from('42');

	const peerInfo = {name: 'peer1', url: 'grpc://fakehost:9999'};
	const validEnsorsementResponse = newEndorsementResponse(
		{
			payload: expectedResult,
			status: 200,
		},
		{
			connection: peerInfo,
		}
	);
	const invalidEndorsementResponse = newEndorsementResponse(
		{
			status: 500,
			message: 'ERROR_RESPONSE_MESSAGE'
		},
		{
			connection: peerInfo,
			endorsement: undefined,
		},
	);
	const emptyStringEndorsementResponse = newEndorsementResponse(
		{
			payload: Buffer.alloc(0),
			status: 200,
		},
		{
			connection: peerInfo,
		},
	);
	const noPayloadEndorsementResponse = newEndorsementResponse(
		{
			status: 200,
		},
		{
			connection: peerInfo,
		},
	);

	const endorsementError = Object.assign(new Error('GRPC_ERROR_MESSAGE'), {
		connection: peerInfo
	});

	function newProposalResponse(validReponses = [], errorResponses = []) {
		return {
			responses: validReponses,
			errors: errorResponses
		};
	}

	let contract;
	let transaction;
	let channel;
	let endorsement;
	let endorser;
	let queryProposal;
	let commit;
	let queryHandler;
	let network;
	let discoveryHandler;
	let client;
	let committers;
	let eventHandler;
	let gateway;

	beforeEach(async () => {
		client = Client.newClient('test');

		const discoverer = sinon.createStubInstance(Discoverer);
		sinon.replace(client, 'newDiscoverer', sinon.fake.returns(discoverer));

		channel = sinon.createStubInstance(Channel);
		sinon.replace(client, 'getChannel', sinon.fake.returns(channel));
		channel.client = client;

		endorsement = sinon.createStubInstance(Endorsement);
		endorsement.send.resolves(newProposalResponse([validEnsorsementResponse]));
		commit = sinon.createStubInstance(Commit);
		commit.send.resolves({status: 'SUCCESS'});
		endorsement.newCommit.returns(commit);
		channel.newEndorsement.returns(endorsement);

		queryProposal = sinon.createStubInstance(QueryProposal);
		queryProposal.send.resolves(newProposalResponse([validEnsorsementResponse]));
		channel.newQuery.withArgs(chaincodeId).returns(queryProposal);

		endorser = sinon.createStubInstance(Endorser);
		endorser.name = peerInfo.name;
		channel.getEndorsers.returns([endorser]);

		channel.getEndorser.callsFake(name => {
			const result = sinon.createStubInstance(Endorser);
			result.name = name;
			return result;
		});

		committers = [sinon.createStubInstance(Committer)];
		channel.getCommitters.returns(committers);

		const discoveryService = sinon.createStubInstance(DiscoveryService);
		discoveryService.hasDiscoveryResults.returns(true);
		discoveryHandler = sinon.createStubInstance(DiscoveryHandler);
		discoveryService.newHandler.returns(discoveryHandler);
		channel.newDiscoveryService.returns(discoveryService);

		queryHandler = {
			evaluate: sinon.fake.resolves(expectedResult)
		};
		eventHandler = sinon.createStubInstance(TransactionEventHandler);

		const wallet = await Wallets.newFileSystemWallet(path.join(__dirname, 'wallet'));
		gateway = new Gateway();
		await gateway.connect(client, {
			queryHandlerOptions: {
				strategy: () => queryHandler,
			},
			eventHandlerOptions: {
				endorseTimeout: 55,
				commitTimeout: 55,
				strategy: () => eventHandler,
			},
			discovery: {
				enabled: true,
				asLocalhost: false,
			},
			wallet,
			identity: 'testuser'
		});

		network = await gateway.getNetwork(networkName);
		contract = network.getContract(chaincodeId);
		transaction = new Transaction(contract, transactionName);
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('#constructor', () => {
		it('should run', () => {
			const t = new Transaction(contract, transactionName);
			expect(t.queryHandler).to.equal(queryHandler);

		});
	});

	describe('#getName', () => {
		it('return the name', () => {
			const result = transaction.getName();
			expect(result).to.equal(transactionName);
		});
	});

	describe('#setTransient', () => {
		it('returns this', () => {
			const result = transaction.setTransient(new Map());
			expect(result).to.equal(transaction);
		});
	});

	describe('#setEndorsingPeers', () => {
		it('returns this', () => {
			const result = transaction.setEndorsingPeers([]);
			expect(result).to.equal(transaction);
		});
	});

	describe('#setEndorsingOrganizations', () => {
		it('returns this', () => {
			const result = transaction.setEndorsingOrganizations([]);
			expect(result).to.equal(transaction);
		});
	});

	describe('#submit', () => {
		it('sends proposal with no arguments', async () => {
			await transaction.submit();

			sinon.assert.calledWith(endorsement.build, sinon.match.any, sinon.match({args: []}));
		});

		it('builds and sends proposal with arguments', async () => {
			const args = ['one', 'two', 'three'];

			await transaction.submit(...args);

			sinon.assert.calledWith(endorsement.build, sinon.match.any, sinon.match({args}));
		});

		it('returns empty buffer for no proposal response payload', async () => {
			endorsement.send.resolves(newProposalResponse([noPayloadEndorsementResponse]));
			const result = await transaction.submit();
			expect(result).to.exist.and.to.have.length(0);
		});

		it('returns proposal response payload', async () => {
			const result = await transaction.submit();
			expect(result.toString()).to.equal(expectedResult.toString());
		});

		it('throws if no peer responses are returned', () => {
			endorsement.send.resolves(newProposalResponse());
			const promise = transaction.submit();
			return expect(promise).to.be.rejectedWith('No valid responses from any peers');
		});

		it('throws if proposal responses are all errors', () => {
			endorsement.send.resolves(newProposalResponse([], [endorsementError]));
			const promise = transaction.submit();
			return expect(promise).to.be.rejectedWith(endorsementError.message);
		});

		it('throws if proposal responses are all invalid', () => {
			endorsement.send.resolves(newProposalResponse([invalidEndorsementResponse]));
			const promise = transaction.submit();
			return expect(promise).to.be.rejectedWith(invalidEndorsementResponse.response.message);
		});

		it('handles invalid proposal responses without connection property', async () => {
			const response = {
				response: invalidEndorsementResponse.response
			};
			endorsement.send.resolves(newProposalResponse([response]));

			const promise = transaction.submit();

			await expect(promise).to.be.rejectedWith(invalidEndorsementResponse.response.message);
		});

		it('handles error responses without connection property', async () => {
			const error = new Error('DISCOVERY_ERROR');
			endorsement.send.resolves(newProposalResponse([], [error]));

			const promise = transaction.submit();

			await expect(promise).to.be.rejectedWith(error.message);
		});

		it('throws with peer responses if the orderer returns an unsuccessful response', () => {
			const status = 'FAILURE';
			commit.send.resolves({status});
			const promise = transaction.submit();
			return expect(promise).to.be.eventually.rejectedWith(status).and.have.deep.property('responses', [validEnsorsementResponse]);
		});

		it('does not submit to orderer if proposal responses are all invalid', async () => {
			endorsement.send.resolves(newProposalResponse([invalidEndorsementResponse]));
			try {
				await transaction.submit();
			} catch (error) {
				// Ignore
			}
			sinon.assert.notCalled(commit.send);
		});

		it('succeeds if some proposal responses are valid', () => {
			endorsement.send.resolves(newProposalResponse([validEnsorsementResponse, invalidEndorsementResponse], [endorsementError]));
			const promise = transaction.submit();
			return expect(promise).to.be.fulfilled;
		});

		it('throws if the orderer returns an unsuccessful response', () => {
			const status = 'FAILURE';
			commit.send.resolves({status});
			const promise = transaction.submit();
			return expect(promise).to.be.rejectedWith(status);
		});

		it('uses event handler strategy from gateway options', async () => {
			transaction = new Transaction(contract, transactionName);

			await transaction.submit();

			sinon.assert.called(eventHandler.startListening);
			sinon.assert.called(eventHandler.waitForEvents);
		});

		it('uses event handler set on the transaction', async () => {
			transaction = new Transaction(contract, transactionName);

			const stubEventHandler = sinon.createStubInstance(TransactionEventHandler);
			const stubEventHandlerFactoryFn = sinon.stub()
				.withArgs(transaction.getTransactionId(), network)
				.returns(stubEventHandler);

			await transaction.setEventHandler(stubEventHandlerFactoryFn)
				.submit();

			sinon.assert.called(stubEventHandler.startListening);
			sinon.assert.called(stubEventHandler.waitForEvents);
		});

		it('sends a proposal with transient data', async () => {
			const transientMap = {key1: 'value1', key2: 'value2'};

			await transaction.setTransient(transientMap).submit();

			sinon.assert.calledWith(endorsement.build, sinon.match.any, sinon.match({transientMap}));
		});

		it('returns empty string proposal response payload', async () => {
			endorsement.send.resolves(newProposalResponse([emptyStringEndorsementResponse]));
			const result = await transaction.submit();
			expect(result.toString()).to.equal('');
		});

		it('sends proposal using endorsement timeout from gateway options', async () => {
			await transaction.submit();

			const expected = gateway.getOptions().eventHandlerOptions.endorseTimeout * 1000;
			sinon.assert.calledWithMatch(endorsement.send, {requestTimeout: expected});
		});

		it('sends proposal to specified peers without discovery', async () => {
			network.discoveryService = false;
			const targets = ['peer1'];

			await transaction.setEndorsingPeers(targets).submit();

			sinon.assert.calledWithMatch(endorsement.send, {targets});
		});

		it('sends proposal to specified organizations without discovery', async () => {
			network.discoveryService = false;
			const orgs = ['org1', 'org2'];
			const targets = orgs.map((org) => org + 'peer');
			orgs.forEach((org, i) => channel.getEndorsers.withArgs(org).returns([targets[i]]));

			await transaction.setEndorsingOrganizations(...orgs).submit();

			sinon.assert.calledWithMatch(endorsement.send, {targets});
		});

		it('send proposal to specified peers with discovery does not use discovery handler', async () => {
			const targets = ['peer1'];
			network.discoveryService = true;

			await transaction.setEndorsingPeers(targets).submit();

			sinon.assert.calledWithMatch(endorsement.send, {targets});
			sinon.assert.neverCalledWithMatch(endorsement.send, {handler: discoveryHandler});
		});

		it('sends proposal with discovery uses discovery handler', async () => {
			network.discoveryService = true;

			await transaction.submit();

			sinon.assert.calledWithMatch(endorsement.send, {handler: discoveryHandler});
		});

		it('sends proposal to specified organizations with discovery uses discovery handler and sets requiredOrgs', async () => {
			const orgs = ['org1', 'org2'];
			network.discoveryService = true;

			await transaction.setEndorsingOrganizations(...orgs).submit();

			sinon.assert.calledWithMatch(endorsement.send, {handler: discoveryHandler, requiredOrgs: orgs});
		});

		it('commits using timeout from gateway options', async () => {
			await transaction.submit();

			const expected = gateway.getOptions().eventHandlerOptions.commitTimeout * 1000;
			sinon.assert.calledWithMatch(commit.send, {requestTimeout: expected});
		});

		it('commit with discovery uses discovery handler', async () => {
			network.discoveryService = true;

			await transaction.submit();

			sinon.assert.calledWithMatch(commit.send, {handler: discoveryHandler});
			sinon.assert.neverCalledWithMatch(commit.send, {targets: committers});
		});

		it('commit without discovery targets channel commiters', async () => {
			network.discoveryService = false;

			await transaction.submit();

			sinon.assert.calledWithMatch(commit.send, {targets: committers});
			sinon.assert.neverCalledWithMatch(commit.send, {handler: discoveryHandler});
		});

		it('prevents proposal build from changing transaction ID on identity context', async () => {
			await transaction.submit();

			sinon.assert.calledWith(endorsement.build, gateway.identityContext, sinon.match({generateTransactionId: false}));
		});
	});

	describe('#evaluate', () => {
		it('returns the result from the query handler', async () => {
			const result = await transaction.evaluate();
			expect(result).to.equal(expectedResult);
		});

		it('passes a query to the query handler', async () => {
			await transaction.evaluate();
			sinon.assert.calledWith(queryHandler.evaluate, sinon.match.instanceOf(Query));
		});

		it('builds correct request for no-args invocation', async () => {
			await transaction.evaluate();

			sinon.assert.calledWith(queryProposal.build, gateway.identityContext, sinon.match({
				fcn: transactionName,
				args: []
			}));
		});

		it('builds correct request for with-args invocation', async () => {
			const args = ['a', 'b', 'c'];

			await transaction.evaluate(...args);

			sinon.assert.calledWith(queryProposal.build, gateway.identityContext, sinon.match({
				fcn: transactionName,
				args
			}));
		});

		it('builds request with transient data', async () => {
			const transientMap = {key1: 'value1', key2: 'value2'};
			transaction.setTransient(transientMap);

			await transaction.evaluate();

			sinon.assert.calledWith(queryProposal.build, gateway.identityContext, sinon.match({transientMap}));
		});

		it('returns empty string response', async () => {
			queryHandler.evaluate = sinon.fake.resolves(Buffer.from(''));

			const result = await transaction.evaluate();

			expect(result.toString()).to.equal('');
		});

		it('prevents proposal build from changing transaction ID on identity context', async () => {
			await transaction.evaluate();

			sinon.assert.calledWith(queryProposal.build, gateway.identityContext, sinon.match({generateTransactionId: false}));
		});
	});


	describe('#serialize', () => {
		async function testSubmit(originalTx) {
			const serializedTx = originalTx.serialize();
			const deserializedTx = contract.deserializeTransaction(serializedTx);

			await originalTx.submit();
			const [expectedIdentityContext, expectedBuildRequest] = endorsement.build.getCall(0).args;
			const expectedSendRequest = endorsement.send.getCall(0).args[0];

			endorsement.build.resetHistory();
			endorsement.send.resetHistory();

			await deserializedTx.submit();
			const [actualIdentityContext, actualBuildRequest] = endorsement.build.getCall(0).args;
			const actualSendRequest = endorsement.send.getCall(0).args[0];

			expect(actualIdentityContext.nonce, 'nonce mismatch').to.deep.equal(expectedIdentityContext.nonce);
			expect(actualIdentityContext.transactionId, 'transaction ID mismatch').to.equal(expectedIdentityContext.transactionId);
			expect(actualBuildRequest, 'build request mismatch').to.deep.equal(expectedBuildRequest);
			expect(actualSendRequest, 'send request mismatch').to.deep.equal(expectedSendRequest);
		}

		it('allows identical transaction submit for basic transaction', async () => {
			const tx = contract.createTransaction('penguin');
			await testSubmit(tx);
		});

		it('allows identical transaction submit for transient data', async () => {
			const tx = contract.createTransaction('penguin')
				.setTransient({
					key: Buffer.from('value'),
				});
			await testSubmit(tx);
		});

		it('allows identical transaction submit for endorsing organizations', async () => {
			const tx = contract.createTransaction('penguin')
				.setEndorsingOrganizations('org1');
			await testSubmit(tx);
		});

		it('allows identical transaction submit for endorsing peers', async () => {
			const peer = channel.getEndorser('peer1');
			const tx = contract.createTransaction('penguin')
				.setEndorsingPeers([peer]);
			await testSubmit(tx);
		});
	});

});
