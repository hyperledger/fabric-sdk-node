/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
const sinon = require('sinon');
const rewire = require('rewire');

const Channel = rewire('fabric-common/lib/Channel');
const Client = require('fabric-common/lib/Client');
const EventService = require('fabric-common/lib/EventService');
const Discoverer = require('fabric-common/lib/Discoverer');
const Endorser = require('fabric-common/lib/Endorser');
const DiscoveryService = require('fabric-common/lib/DiscoveryService');
const IdentityContext = require('fabric-common/lib/IdentityContext');

const chai = require('chai');
const expect = chai.expect;
const should = chai.should;
should();
chai.use(require('chai-as-promised'));

const Network = require('../lib/network');
const Gateway = require('../lib/gateway');
const Contract = require('../lib/contract');
const EventStrategies = require('fabric-network/lib/impl/event/defaulteventhandlerstrategies');
const EventServiceManager = require('fabric-network/lib/impl/event/eventservicemanager');
const CommitEventListener = require('fabric-network/lib/impl/event/commiteventlistener');
const BlockEventListener = require('fabric-network/lib/impl/event/blockeventlistener');

describe('Network', () => {
	let channel;
	let client;
	let identityContext;
	let gateway;
	let queryHandler;
	let eventServiceManager;
	let eventService;
	let discoverer;
	let discoveryService;
	let endorser;

	let network;

	beforeEach(() => {
		queryHandler = {};
		endorser = sinon.createStubInstance(Endorser);
		endorser.connected = true;
		endorser.name = 'peer1';
		endorser.mspid = 'msp1';
		discoverer = sinon.createStubInstance(Discoverer);
		discoveryService = sinon.createStubInstance(DiscoveryService);
		discoveryService.send.resolves();

		identityContext = sinon.createStubInstance(IdentityContext);
		identityContext.mspid = 'msp1';

		eventService = sinon.createStubInstance(EventService);
		eventService.stream = true;

		client = sinon.createStubInstance(Client);
		client.newIdentityContext.returns(identityContext);
		client.getEndorsers.returns([endorser]);
		client.newDiscoverer.returns(discoverer);

		channel = sinon.createStubInstance(Channel);
		channel.client = client;
		channel.name = 'mychannel';
		channel.newEventService.returns(eventService);
		channel.getEndorsers.returns([endorser]);
		channel.newDiscoveryService.returns(discoveryService);

		gateway = sinon.createStubInstance(Gateway);
		gateway.identityContext = identityContext;
		gateway.getOptions.returns({
			useDiscovery: false,
			transaction: {
				endorseTimeout: 30,
				commitTimeout: 300,
				strategy: EventStrategies.MSPID_SCOPE_ALLFORTX
			},
			query: {
				timeout: 3,
				strategy: (theNetwork) => {
					queryHandler.network = theNetwork;
					return queryHandler;
				}
			}
		});

		client.getEndorsers.returns([endorser]);

		eventServiceManager = sinon.createStubInstance(EventServiceManager);
		eventServiceManager.getEventService.returns(eventService);

		network = new Network(gateway, channel);
		network.eventServiceManager = eventServiceManager;

	});

	afterEach(() => {
		sinon.restore();
	});


	describe('#_initializeInternalChannel', () => {
		it('should initialize with no discovery', async () => {
			await network._initializeInternalChannel({enabled:false});
			expect(network.discoveryService).to.equal(null);
		});

		it('should initialize the network using the discovery with user specified targets', async () => {
			network.channel = channel;
			await network._initializeInternalChannel({enabled:true, targets: [endorser]});
			sinon.assert.calledOnce(channel.newDiscoveryService);
		});
		it('should fail if no peers found in targets parameter', async () => {
			return network._initializeInternalChannel({enabled:true, targets: []})
				.should.be.rejectedWith('No discovery targets found');
		});
		it('should fail if user provided peers not connected', async () => {
			endorser.connected = false;
			return network._initializeInternalChannel({enabled:true, targets: [endorser]})
				.should.be.rejectedWith('Endorser instance peer1 is not connected to an endpoint');
		});
		it('should initialize the network using the discovery with targets from channel mspid', async () => {
			await network._initializeInternalChannel({enabled:true});
			sinon.assert.calledOnce(channel.newDiscoveryService);
			sinon.assert.calledOnce(discoveryService.send);
		});
		it('should initialize the network using the discovery with targets from client mspid', async () => {
			channel.getEndorsers.returns(null);
			await network._initializeInternalChannel({enabled:true});
			sinon.assert.calledOnce(channel.newDiscoveryService);
			sinon.assert.calledOnce(discoveryService.send);
		});
		it('should initialize the network using the discovery with targets from client', async () => {
			channel.getEndorsers.returns(null);
			client.getEndorsers.returns(null);
			client.getEndorsers.withArgs('msp1').returns([endorser]);
			await network._initializeInternalChannel({enabled:true, targets: [endorser]});
			sinon.assert.calledOnce(channel.newDiscoveryService);
			sinon.assert.calledOnce(discoveryService.send);
		});
		it('should fail if no peers found', async () => {
			channel.getEndorsers.returns([]);
			client.getEndorsers.returns([]);
			return network._initializeInternalChannel({enabled:true})
				.should.be.rejectedWith('No discovery targets found');
		});

	});

	describe('#initialize', () => {
		it('should return with no action if already initialized', () => {
			network.initialized = true;
			network._initialize();
		});

		it('should initialize the internal channels', async () => {
			network.initialized = false;
			sinon.stub(network, '_initializeInternalChannel').returns();
			await network._initialize();
			network.initialized.should.equal(true);
		});
	});

	describe('#getContract', () => {
		it('should throw an error if not initialized', () => {
			network.initialized = false;
			(() => {
				network.getContract();
			}).should.throw('Unable to get contract as this network has failed to initialize');
		});

		it('should return a cached contract object', () => {
			const contract = sinon.createStubInstance(Contract);
			network.contracts.set('foo:', contract);
			network.initialized = true;
			network.getContract('foo').should.equal(contract);
		});

		it('should create a non-existent contract object', () => {
			network.initialized = true;
			const contract = network.getContract('bar');
			contract.should.be.instanceof(Contract);
			contract.chaincodeId.should.equal('bar');
		});

		it('should return a newly created contract, with namespace', () => {
			const contract = sinon.createStubInstance(Contract);
			network.contracts.set('foo:my.name.space', contract);
			network.initialized = true;
			network.getContract('foo', 'my.name.space').should.equal(contract);
		});

		it('should create a non-existent contract object with namespace', () => {
			network.initialized = true;
			const contract = network.getContract('bar', 'my.name.space');
			contract.should.be.instanceof(Contract);
			contract.chaincodeId.should.equal('bar');
			contract.namespace.should.equal('my.name.space');
		});
	});

	describe('#_dispose', () => {
		it('should cleanup the network object', () => {
			const contract = sinon.createStubInstance(Contract);
			network.contracts.set('foo', contract);
			network.contracts.size.should.equal(1);
			network.initialized = true;
			network._dispose();
			network.contracts.size.should.equal(0);
			network.initialized.should.equal(false);
		});

		it('calls close() on its channel', () => {
			network._dispose();
			sinon.assert.calledOnce(channel.close);
		});

		it('calls dispose() on the event service factory', () => {
			const spy = network.eventServiceManager.dispose;
			network._dispose();
			sinon.assert.called(spy);
		});

		it('calls unregister on its listeners', () => {
			const listener = sinon.createStubInstance(BlockEventListener);
			network.listeners.set('listener', listener);
			network._dispose();
			sinon.assert.calledOnce(listener.unregister);
		});
	});

	describe('#addBlockListener', () => {
		let callback;
		beforeEach(() => {
			callback = () => {};
		});

		it('should create options if the options param is undefined', async () => {
			const listener = await network.addBlockListener(callback);
			listener.should.to.be.instanceof(BlockEventListener);
			network.listeners.get(listener).should.to.equal(listener);
		});

		it('should create an instance of BlockEventListener and add it to the list of listeners', async () => {
			const listener = await network.addBlockListener(callback, {});
			listener.should.to.be.instanceof(BlockEventListener);
			network.listeners.get(listener).should.to.equal(listener);
		});

		it('should create an instance of BlockEventListener and add it to the list of listeners', async () => {
			const listener = await network.addBlockListener(callback, {}, eventService);
			listener.should.to.be.instanceof(BlockEventListener);
			network.listeners.get(listener).should.to.equal(listener);
			listener.eventService.should.to.equal(eventService);
		});
	});

	describe('#addCommitListener', () => {
		let callback;
		beforeEach(() => {
			callback = () => {};
		});

		it('should create options if the options param is undefined', async () => {
			const listener = await network.addCommitListener(callback, {}, eventService);
			listener.should.to.be.instanceof(CommitEventListener);
			listener.eventService.should.to.equal(eventService);
			network.listeners.get(listener).should.to.equal(listener);
		});

		it('should create an instance of BlockEventListener and add it to the list of listeners', async () => {
			const listener = await network.addCommitListener(callback, {}, eventService);
			listener.should.to.be.instanceof(CommitEventListener);
			listener.eventService.should.to.equal(eventService);
			network.listeners.get(listener).should.to.equal(listener);
		});

		it('should not set an event service if an event service is not given', async () => {
			eventServiceManager.getReplayEventService.returns(eventService);
			const listener = await network.addCommitListener(callback);
			listener.eventService.should.equal(eventService);
		});
	});

});
