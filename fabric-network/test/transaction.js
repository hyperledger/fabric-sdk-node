/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-as-promised'));

const Client = require('fabric-common/lib/Client');
const Channel = require('fabric-common/lib/Channel');
const Endorsement = require('fabric-common/lib/Endorsement');
const Query = require('fabric-common/lib/Query');
const Endorser = require('fabric-common/lib/Endorser');
const Commit = require('fabric-common/lib/Commit');
const IdentityContext = require('fabric-common/lib/IdentityContext');
const DiscoveryHandler = require('fabric-common/lib/DiscoveryHandler');
const Committer = require('fabric-common/lib/Committer');

const Contract = require('fabric-network/lib/contract');
const Network = require('fabric-network/lib/network');
const Gateway = require('fabric-network/lib/gateway');
const Transaction = require('fabric-network/lib/transaction');
const TransactionEventHandler = require('fabric-network/lib/impl/event/transactioneventhandler');
const QueryStrategies = require('fabric-network/lib/impl/query/queryhandlerstrategies');

describe('Transaction', () => {
	const transactionName = 'TRANSACTION_NAME';
	const chaincodeId = 'chaincode-id';
	const expectedResult = Buffer.from('42');

	const peerInfo = {name: 'peer1', url: 'grpc://fakehost:9999'};
	const validEnsorsementResponse = {
		endorsement: {},
		response: {
			status: 200,
			payload: expectedResult
		},
		connection: peerInfo
	};
	const invalidEndorsementResponse = {
		response: {
			status: 500,
			message: 'ERROR_RESPONSE_MESSAGE'
		},
		connection: peerInfo
	};
	const emptyStringEndorsementResponse = {
		endorsement: {},
		response: {
			status: 200,
			payload: Buffer.from('')
		},
		connection: peerInfo
	};
	const noPayloadEndorsementResponse = {
		endorsement: {},
		response: {
			status: 200,
		},
		connection: peerInfo
	};

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
	let query;
	let commit;
	let queryHandler;
	let network;
	let idx;
	let gatewayOptions;
	let discoveryHandler;
	let client;
	let committers;

	beforeEach(() => {
		contract = sinon.createStubInstance(Contract);

		network = sinon.createStubInstance(Network);
		network.queryHandler = queryHandler;
		contract.network = network;

		idx = sinon.createStubInstance(IdentityContext);
		endorser = sinon.createStubInstance(Endorser);
		query = sinon.createStubInstance(Query);
		endorsement = sinon.createStubInstance(Endorsement);
		endorsement.send.resolves(newProposalResponse([validEnsorsementResponse]));
		commit = sinon.createStubInstance(Commit);
		commit.send.resolves({status: 'SUCCESS'});
		endorsement.newCommit.returns(commit);
		channel = sinon.createStubInstance(Channel);
		channel.newEndorsement.returns(endorsement);
		channel.newQuery.withArgs(chaincodeId).returns(query);
		channel.getEndorsers.returns([endorser]);
		network.channel = channel;
		queryHandler = {
			evaluate: sinon.stub().resolves(expectedResult)
		};
		network.queryHandler = queryHandler;

		contract.chaincodeId = chaincodeId;
		discoveryHandler = sinon.createStubInstance(DiscoveryHandler);
		contract.getDiscoveryHandler.withArgs(sinon.match.instanceOf(Endorsement)).resolves(discoveryHandler);
		committers = [sinon.createStubInstance(Committer)];
		channel.getCommitters.returns(committers);

		client = sinon.createStubInstance(Client);
		client.getConfigSetting.returnsArg(1); // Return the default value passed in

		const mockGateway = sinon.createStubInstance(Gateway);
		mockGateway.client = client;
		mockGateway.identityContext = idx;

		gatewayOptions = {
			query: {
				strategy: QueryStrategies.MSPID_SCOPE_SINGLE
			},
			transaction: {
				strategy: null
			},
			discovery: {
				enabled: true,
				asLocalhost: false
			}
		};
		mockGateway.getOptions.returns(gatewayOptions);

		contract.gateway = mockGateway;

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

	describe('#setEventHandlerStrategy', () => {
		it('returns this', () => {
			const stubEventHandler = sinon.createStubInstance(TransactionEventHandler);
			const stubEventHandlerFactoryFn = () => stubEventHandler;
			const result = transaction.setEventHandlerStrategy(stubEventHandlerFactoryFn);
			expect(result).to.equal(transaction);
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

	describe('#getNetwork', () => {
		it('returns network', () => {
			transaction.network = network;
			const result = transaction.getNetwork();
			expect(result).to.equal(network);
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

		it('returns null or undefined for no proposal response payload', async () => {
			endorsement.send.resolves(newProposalResponse([noPayloadEndorsementResponse]));
			const result = await transaction.submit();
			expect(result).to.not.exist;
		});

		it('returns proposal response payload', async () => {
			const result = await transaction.submit();
			expect(result).to.equal(expectedResult);
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

		it('uses a supplied event handler strategy', async () => {
			const stubEventHandler = sinon.createStubInstance(TransactionEventHandler);
			const stubEventHandlerFactoryFn = sinon.stub();
			stubEventHandlerFactoryFn.withArgs(transaction).returns(stubEventHandler);

			await transaction.setEventHandlerStrategy(stubEventHandlerFactoryFn).submit();

			sinon.assert.called(stubEventHandler.startListening);
			sinon.assert.called(stubEventHandler.waitForEvents);
		});

		it('uses event handler strategy from gateway options', async () => {
			const stubEventHandler = sinon.createStubInstance(TransactionEventHandler);
			const stubEventHandlerFactoryFn = sinon.stub();
			gatewayOptions.transaction.strategy = stubEventHandlerFactoryFn;
			transaction = new Transaction(contract, transactionName);
			stubEventHandlerFactoryFn.withArgs(transaction).returns(stubEventHandler);

			await transaction.submit();

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
			gatewayOptions.transaction.endorseTimeout = 55;

			await transaction.submit();

			sinon.assert.calledWithMatch(endorsement.send, {requestTimeout: 55000});
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

		it('passes collections from the contract to the endorsement', async () => {
			contract.collections = ['collection1', 'collection2'];

			await transaction.submit();

			for (const collection of contract.collections) {
				sinon.assert.calledWith(endorsement.addCollectionInterest, collection);
			}
		});

		it('commits using timeout from gateway options', async () => {
			gatewayOptions.transaction.commitTimeout = 55;

			await transaction.submit();

			sinon.assert.calledWithMatch(commit.send, {requestTimeout: 55000});
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

			sinon.assert.calledWith(query.build, idx, sinon.match({
				fcn: transactionName,
				args: []
			}));
		});

		it('builds correct request for with-args invocation', async () => {
			const args = ['a', 'b', 'c'];

			await transaction.evaluate(...args);

			sinon.assert.calledWith(query.build, idx, sinon.match({
				fcn: transactionName,
				args
			}));
		});

		it('builds request with transient data', async () => {
			const transientMap = {key1: 'value1', key2: 'value2'};
			transaction.setTransient(transientMap);

			await transaction.evaluate();

			sinon.assert.calledWith(query.build, idx, sinon.match({transientMap}));
		});

		it('returns empty string response', async () => {
			queryHandler.evaluate = sinon.fake.resolves(Buffer.from(''));

			const result = await transaction.evaluate();

			expect(result.toString()).to.equal('');
		});

		it('builds correct request with timeout from gateway options', async () => {
			gatewayOptions.query.timeout = 55;

			await transaction.evaluate();

			sinon.assert.calledWith(query.build, idx, sinon.match({requestTimeout: 55000}));
		});
	});
});
