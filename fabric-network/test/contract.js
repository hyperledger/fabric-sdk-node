/*
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
const sinon = require('sinon');

const {Channel, DiscoveryService, Endorsement, IdentityContext} = require('fabric-common');

const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-as-promised'));
chai.should();

const {ContractImpl} = require('../lib/contract');
const {Gateway} = require('../lib/gateway');
const {NetworkImpl: Network} = require('../lib/network');
const {Transaction} = require('../lib/transaction');

describe('Contract', () => {
	const chaincodeId = 'CHAINCODE_ID';
	const namespace = 'namespace';

	let network;
	let channel;
	let gateway;
	let contract;
	let transaction;
	let endorsement;
	let discoveryService;

	beforeEach(() => {
		discoveryService = sinon.createStubInstance(DiscoveryService);
		discoveryService.newHandler.returns('handler');
		discoveryService.hasDiscoveryResults.returns(true);

		channel = sinon.createStubInstance(Channel);
		channel.newDiscoveryService.returns(discoveryService);

		const identityContext = sinon.createStubInstance(IdentityContext);
		identityContext.clone.returnsThis();
		identityContext.calculateTransactionId.callsFake(() => {
			identityContext.transactionId = 'txId';
			return identityContext;
		});

		gateway = sinon.createStubInstance(Gateway);
		gateway.identityContext = identityContext;
		gateway.getOptions.returns({
			eventHandlerOptions: 'options',
			discovery: {
				asLocalhost: true
			}
		});
		gateway.getIdentity.returns({
			mspId: 'mspId'
		});

		network = new Network(gateway, channel);

		transaction = sinon.createStubInstance(Transaction);
		transaction.submit.resolves('result');
		transaction.evaluate.resolves('result');

		endorsement = sinon.createStubInstance(Endorsement);
		endorsement.buildProposalInterest.returns('interests');

		contract = new ContractImpl(network, chaincodeId, namespace);
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('#constructor', () => {
		it('throws if namespace is not a string', () => {
			(() => new ContractImpl(network, chaincodeId, 123))
				.should.throw(/Namespace must be a non-empty string/);
		});
	});

	describe('#createTransaction', () => {
		it('returns a transaction with only a name', () => {
			contract.namespace = undefined;
			const name = 'name';
			const result = contract.createTransaction(name);
			result.getName().should.equal(name);
		});

		it ('returns a transaction with both name and namespace', () => {

			const name = 'name';
			const result = contract.createTransaction(name);

			result.getName().should.equal('namespace:name');
		});

		it ('throws if name is an empty string', () => {
			(() => contract.createTransaction('')).should.throw('name');
		});

		it ('throws is name is not a string', () => {
			(() => contract.createTransaction(123)).should.throw('name');
		});
	});

	describe('#submitTransaction', () => {
		it('submits a transaction with supplied arguments', async () => {
			const args = ['a', 'b', 'c'];
			contract.createTransaction = sinon.stub().returns(transaction);
			const result = await contract.submitTransaction('name', ...args);
			result.should.equal('result');
		});
	});

	describe('#evaluateTransaction', () => {
		it('evaluates a transaction with supplied arguments', async () => {
			const args = ['a', 'b', 'c'];
			contract.createTransaction = sinon.stub().returns(transaction);
			const result = await contract.evaluateTransaction('name', ...args);
			result.should.equal('result');
		});
	});

	describe('#getDiscoveryHandler', () => {
		it('should run with no discovery', async () => {
			network.discoveryService = undefined;
			const handler = await contract.getDiscoveryHandler();
			expect(handler).to.be.undefined;
		});
		it('should run when discover is assigned to network and contract', async () => {
			network.discoveryService = discoveryService;
			contract.discoveryService = discoveryService;
			const handler = await contract.getDiscoveryHandler(endorsement);
			expect(handler).to.equal('handler');
		});
		it('should run when discover is assigned to network and not to contract', async () => {
			network.discoveryService = discoveryService;
			const handler = await contract.getDiscoveryHandler(endorsement);
			expect(handler).to.equal('handler');
		});
	});

	describe('#addDiscoveryInterest', () => {
		it ('throws when not an interest', () => {
			(() => contract.addDiscoveryInterest('intersts')).should.throw('"interest" parameter must be a DiscoveryInterest object');
		});
		it('update collection', async () => {
			const interest = {name: chaincodeId, collectionNames: ['c1', 'c2']};
			contract.addDiscoveryInterest(interest);
			expect(contract.discoveryInterests).to.deep.equal([
				interest
			]);
		});
		it('update collection with no private reads', async () => {
			const interest = {name: chaincodeId, collectionNames: ['c1', 'c2'], noPrivateReads: true};
			contract.addDiscoveryInterest(interest);
			expect(contract.discoveryInterests).to.deep.equal([
				interest
			]);
		});
		it('add chaincode', async () => {
			const other = {name: 'other'};
			contract.addDiscoveryInterest(other);
			expect(contract.discoveryInterests).to.deep.equal([
				{name: chaincodeId},
				other
			]);
		});
		it('add chaincode and collection', async () => {
			const other = {name: 'other', collectionNames: ['c1', 'c2']};
			contract.addDiscoveryInterest(other);
			expect(contract.discoveryInterests).to.deep.equal([
				{name: chaincodeId},
				other
			]);
		});
		it('add chaincode and collection with no private reads', async () => {
			const other = {name: 'other', collectionNames: ['c1', 'c2'], noPrivateReads: true};
			contract.addDiscoveryInterest(other);
			expect(contract.discoveryInterests).to.deep.equal([
				{name: chaincodeId},
				other
			]);
		});
	});

	describe('#getDiscoveryInterests', () => {
		it('get default', async () => {
			contract.getDiscoveryInterests();
			expect(contract.discoveryInterests).to.deep.equal([
				{name: chaincodeId}
			]);
		});
		it('get after an add chaincode and collection', async () => {
			const other = {name: 'other', collectionNames: ['c1', 'c2']};
			contract.addDiscoveryInterest(other);
			const interests = contract.getDiscoveryInterests();
			expect(interests).to.deep.equal([
				{name: chaincodeId},
				other
			]);
		});
	});

	describe('#registerDiscoveryResultsListener', () => {
		it('add', () => {
			contract.registerDiscoveryResultsListener(() => {});
			expect(contract.discoveryResultsListners.length).to.be.equal(1);
		});
	});

	describe('#notifyDiscoveryResultsListeners', () => {
		it('run with none added', () => {
			contract.notifyDiscoveryResultsListeners();
			expect(contract.discoveryResultsListners.length).to.be.equal(0);
		});
		it('run with one added', () => {
			contract.registerDiscoveryResultsListener(() => {});
			contract.notifyDiscoveryResultsListeners();
			expect(contract.discoveryResultsListners.length).to.be.equal(0);
		});
	});

	describe('#waitDiscoveryResults', () => {
		it('runs', async () => {
			const wait = contract.waitDiscoveryResults();
			const notify = new Promise((resolve, reject,) => {
				contract.notifyDiscoveryResultsListeners(false);
				resolve();
			});
			await Promise.all([wait, notify]).should.be.rejectedWith(/Failed to retrieve discovery results/);
		});
		it('runs', async () => {
			const wait = contract.waitDiscoveryResults();
			const notify = new Promise((resolve, reject,) => {
				contract.notifyDiscoveryResultsListeners(true);
				resolve();
			});
			await Promise.all([wait, notify]);
		});
	});
});
