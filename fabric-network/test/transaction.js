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

const Contract = require('fabric-network/lib/contract');
const Network = require('fabric-network/lib/network');
const Gateway = require('fabric-network/lib/gateway');
const Transaction = require('fabric-network/lib/transaction');
const TransactionEventHandler = require('fabric-network/lib/impl/event/transactioneventhandler');
const EventStrategies = require('fabric-network/lib/impl/event/defaulteventhandlerstrategies');
const QueryStrategies = require('fabric-network/lib/impl/query/queryhandlerstrategies');

describe('Transaction', () => {
	const transactionName = 'TRANSACTION_NAME';
	const chaincodeId = 'chaincode-id';
	const expectedResult = Buffer.from('42');

	const peerInfo = {name: 'peer1', url: 'grpc://fakehost:9999'};
	const validProposalResponse = {
		response: {
			status: 200,
			payload: expectedResult
		},
		connection: peerInfo
	};
	const invalidProposalResponse = {
		response: {
			status: 500,
			payload: expectedResult
		},
		connection: peerInfo
	};

	const errorResponseMessage = 'I_AM_AN_ERROR_RESPONSE';

	const errorProposalResponse = Object.assign(new Error(errorResponseMessage), {
		status: 500,
		payload: 'error',
		connection: peerInfo
	});

	const validProposalResponses = {responses: [validProposalResponse]};
	const invalidProposalResponses = {responses: [invalidProposalResponse]};
	const errorProposalResponses = {errors: [errorProposalResponse]};

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
	let eventHandler;

	beforeEach(() => {
		contract = sinon.createStubInstance(Contract);

		network = sinon.createStubInstance(Network);
		network.queryHandler = queryHandler;
		contract.network = network;

		idx = sinon.createStubInstance(IdentityContext);
		endorser = sinon.createStubInstance(Endorser);
		query = sinon.createStubInstance(Query);
		endorsement = sinon.createStubInstance(Endorsement);
		endorsement.send = sinon.stub().resolves(validProposalResponses);
		commit = sinon.createStubInstance(Commit);
		commit.send = sinon.stub().resolves({status: 'SUCCESS'});
		endorsement.newCommit = sinon.stub().returns(commit);
		channel = sinon.createStubInstance(Channel);
		channel.newEndorsement.returns(endorsement);
		channel.newQuery.returns(query);
		channel.getEndorsers.returns(['peer2']);
		network.channel = channel;
		network.addCommitListener.returns('listener');
		queryHandler = sinon.stub();
		queryHandler.evaluate = sinon.stub().resolves(expectedResult);
		network.queryHandler = queryHandler;

		contract.getChaincodeId = chaincodeId;
		contract.getDiscoveryHandler = sinon.stub().resolves('discoveryHandler');

		const mockClient = sinon.createStubInstance(Client);
		const mockGateway = sinon.createStubInstance(Gateway);
		mockGateway.client = mockClient;
		mockGateway.identityContext = idx;

		const gatewayOptions = {
			query: {
				timeout: 44,
				strategy: QueryStrategies.MSPID_SCOPE_SINGLE
			},
			transaction: {
				endorseTimeout: 55,
				commitTimeout: 88,
				strategy: EventStrategies.MSPID_SCOPE_ALLFORTX
			},
			discovery: {
				enabled: true,
				asLocalhost: false
			}
		};
		mockGateway.getOptions.returns(gatewayOptions);

		mockClient.getConfigSetting.returns(45000);
		contract.gateway = mockGateway;

		transaction = new Transaction(contract, transactionName);
		transaction._endorsingPeers = [endorser];
		eventHandler = sinon.stub();
		transaction._eventHandlerStrategyFactory = sinon.stub().returns(eventHandler);
		eventHandler.startListening = sinon.stub().resolves();
		eventHandler.waitForEvents = sinon.stub().resolves();
		eventHandler.cancelListening = sinon.stub();
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
		it('user assigned peers with valid response', async () => {
			const result = await transaction.submit();
			expect(result.toString()).to.equal('42');
		});
		it('default peers with valid response', async () => {
			transaction._endorsingPeers = null;
			contract.network.discoveryService = null;
			const result = await transaction.submit();
			expect(result.toString()).to.equal('42');
		});
		it('default peers and gateway event handler with valid response', async () => {
			transaction._endorsingPeers = null;
			contract.network.discoveryService = null;
			transaction._eventHandlerStrategyFactory = null;
			transaction._transactionOptions = {
				strategy: sinon.stub().returns(eventHandler)
			};
			const result = await transaction.submit();
			expect(result.toString()).to.equal('42');
		});
		it('user assigned peers and collections with valid response', async () => {
			contract.collections = ['collection1'];
			const result = await transaction.submit();
			expect(result.toString()).to.equal('42');
			sinon.assert.calledWith(endorsement.addCollectionInterest, 'collection1');
		});
		it('user assigned orgs with valid response', async () => {
			transaction._endorsingPeers = null;
			transaction._endorsingOrgs = ['org1'];
			const result = await transaction.submit();
			expect(result.toString()).to.equal('42');
			sinon.assert.calledWith(channel.getEndorsers, 'org1');
		});
		it('use discover handler with valid response', async () => {
			contract.network.discoveryService = 'discoveryService';
			transaction._endorsingPeers = null;
			const result = await transaction.submit();
			expect(result.toString()).to.equal('42');
		});
		it('use discover handler and assigned orgs with valid response', async () => {
			contract.network.discoveryService = 'discoveryService';
			transaction._endorsingPeers = null;
			transaction._endorsingOrgs = ['org1'];
			const result = await transaction.submit();
			expect(result.toString()).to.equal('42');
		});
		it('user assigned peers with invalid response', async () => {
			try {
				commit.send.resolves('BAD');
				await transaction.submit();
			} catch (error) {
				expect(error.message).to.contain('Failed to commit transaction');
			}
			sinon.assert.calledOnce(eventHandler.cancelListening);
		});
		it('user assigned peers with invalid response', async () => {
			try {
				endorsement.send = sinon.stub().resolves(invalidProposalResponses);
				await transaction.submit();
			} catch (error) {
				expect(error.message).to.contain('No valid responses from any peers.');
			}
		});
		it('user assigned peers with error response', async () => {
			try {
				endorsement.send = sinon.stub().resolves(errorProposalResponses);
				await transaction.submit();
			} catch (error) {
				expect(error.message).to.contain('No valid responses from any peers.');
			}
		});
	});

	describe('#_validatePeerResponses', () => {
		it('throws error', () => {
			expect(() => transaction._validatePeerResponses()).to.throw();
		});
	});

	describe('#evaluate', () => {
		it('returns the result from the query handler', async () => {
			const result = await transaction.evaluate();
			expect(result).to.equal(expectedResult);
		});
		it('returns the bad result from the query handler', async () => {
			try {
				queryHandler.evaluate = sinon.stub().resolves(invalidProposalResponse);
				await transaction.evaluate();
			} catch (error) {
				expect(error.status).to.equal(500);
			}
		});
	});

	describe('#_buildRequest', () => {
		it('builds correct request for with-args invocation', () => {
			transaction.name = 'test';
			const args = ['a', 'b', 'c'];
			const result = transaction._buildRequest(args);
			expect(result).to.deep.include({
				fcn: 'test',
				args
			});
		});
		it('builds request with transient data', () => {
			const transientMap = {key1: 'value1', key2: 'value2'};
			transaction.setTransient(transientMap);
			const result = transaction._buildRequest();
			expect(result).to.deep.include({
				transientMap
			});
		});
	});
});
