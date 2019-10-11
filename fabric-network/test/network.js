/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
const sinon = require('sinon');
const rewire = require('rewire');

const InternalChannel = rewire('fabric-client/lib/Channel');
const Peer = InternalChannel.__get__('ChannelPeer');
const Client = require('fabric-client');
const ChannelEventHub = Client.ChannelEventHub;
const TransactionID = require('fabric-client/lib/TransactionID.js');
const FABRIC_CONSTANTS = require('fabric-client/lib/Constants');

const chai = require('chai');
const should = chai.should;
should();
chai.use(require('chai-as-promised'));

const Network = require('../lib/network');
const Gateway = require('../lib/gateway');
const Contract = require('../lib/contract');
const EventStrategies = require('fabric-network/lib/impl/event/defaulteventhandlerstrategies');
const AbstractEventHubSelectionStrategy = require('fabric-network/lib/impl/event/abstracteventhubselectionstrategy');
const EventHubManager = require('fabric-network/lib/impl/event/eventhubmanager');
const CommitEventListener = require('fabric-network/lib/impl/event/commiteventlistener');
const BlockEventListener = require('fabric-network/lib/impl/event/blockeventlistener');
const BaseCheckpointer = require('fabric-network/lib/impl/event/basecheckpointer');

describe('Network', () => {
	let mockChannel, mockClient;
	let mockPeer1, mockPeer2, mockPeer3, mockPeer4, mockPeer5;
	let peerArray;
	let network;
	let mockTransactionID, mockGateway;
	let stubQueryHandler;
	let stubEventHubSelectionStrategy;
	let mockEventHubManager;
	let mockEventHub;
	let mockCheckpointer;

	beforeEach(() => {
		mockChannel = sinon.createStubInstance(InternalChannel);
		mockEventHub = sinon.createStubInstance(ChannelEventHub);
		mockClient = sinon.createStubInstance(Client);
		mockTransactionID = sinon.createStubInstance(TransactionID);
		mockTransactionID.getTransactionID.returns('00000000-0000-0000-0000-000000000000');
		mockClient.newTransactionID.returns(mockTransactionID);

		mockChannel.getName.returns('testchainid');
		const stubEventHub = sinon.createStubInstance(ChannelEventHub);
		stubEventHub.isconnected.returns(true);
		mockChannel.getChannelEventHub.returns(stubEventHub);

		mockPeer1 = sinon.createStubInstance(Peer);
		mockPeer1.index = 1; // add these so that the mockPeers can be distiguished when used in WithArgs().
		mockPeer1.getName.returns('Peer1');

		mockPeer2 = sinon.createStubInstance(Peer);
		mockPeer2.index = 2;
		mockPeer2.getName.returns('Peer2');

		mockPeer3 = sinon.createStubInstance(Peer);
		mockPeer3.index = 3;
		mockPeer3.getName.returns('Peer3');

		mockPeer4 = sinon.createStubInstance(Peer);
		mockPeer4.index = 4;
		mockPeer5 = sinon.createStubInstance(Peer);
		mockPeer5.index = 5;

		mockPeer1.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(true);
		mockPeer2.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(false);
		mockPeer3.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(true);
		mockPeer4.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(true);
		mockPeer5.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(false);
		peerArray = [mockPeer1, mockPeer2, mockPeer3, mockPeer4, mockPeer5];
		mockChannel.getPeers.returns(peerArray);
		mockCheckpointer = sinon.createStubInstance(BaseCheckpointer);

		stubQueryHandler = {};

		stubEventHubSelectionStrategy = sinon.createStubInstance(AbstractEventHubSelectionStrategy);

		mockGateway = sinon.createStubInstance(Gateway);
		mockGateway.getOptions.returns({
			useDiscovery: false,
			eventHandlerOptions: {
				commitTimeout: 300,
				strategy: EventStrategies.MSPID_SCOPE_ALLFORTX
			},
			queryHandlerOptions: {
				strategy: (theNetwork) => {
					stubQueryHandler.network = theNetwork;
					return stubQueryHandler;
				}
			},
			eventHubSelectionOptions: {
				strategy: (theNetwork) => {
					stubEventHubSelectionStrategy.network = theNetwork;
					return stubEventHubSelectionStrategy;
				}
			}
		});

		mockGateway.getClient.returns(mockClient);
		mockClient.getPeersForOrg.returns([mockPeer1, mockPeer2]);

		mockEventHubManager = sinon.createStubInstance(EventHubManager);
		mockEventHubManager.getPeers.returns([mockPeer1, mockPeer2]);
		mockEventHubManager.getEventHub.returns(mockEventHub);

		network = new Network(mockGateway, mockChannel);
		network.eventHubManager = mockEventHubManager;
		mockCheckpointer = sinon.createStubInstance(BaseCheckpointer);
		network.checkpointer = mockCheckpointer;
	});

	afterEach(() => {
		sinon.restore();
	});


	describe('#_initializeInternalChannel', () => {
		it('should initialize the network using the first peer', async () => {
			mockChannel.initialize.resolves();
			await network._initializeInternalChannel({enabled:false, asLocalhost: false});
			sinon.assert.calledOnce(mockChannel.initialize);
		});

		it('should initialize the network using the first peer with discovery', async () => {
			mockChannel.initialize.resolves();
			await network._initializeInternalChannel({enabled:true});
			sinon.assert.calledOnce(mockChannel.initialize);
		});

		it('should try other peers if initialization fails', async () => {
			network.initialized = false;
			// create a real mock
			mockChannel.initialize.onCall(0).rejects(new Error('connect failed'));
			mockChannel.initialize.onCall(1).resolves();
			await network._initializeInternalChannel({enabled:false, asLocalhost: false});
			sinon.assert.calledTwice(mockChannel.initialize);
			sinon.assert.calledWith(mockChannel.initialize.firstCall, {target: mockPeer1, discover:false, asLocalhost: false});
			sinon.assert.calledWith(mockChannel.initialize.secondCall, {target: mockPeer3, discover: false, asLocalhost: false});
		});

		it('should fail if all peers fail', async () => {
			network.initialized = false;
			mockChannel.initialize.onCall(0).rejects(new Error('connect failed'));
			mockChannel.initialize.onCall(1).rejects(new Error('connect failed next'));
			mockChannel.initialize.onCall(2).rejects(new Error('connect failed again'));
			let error;
			try {
				await network._initializeInternalChannel({enabled:false, asLocalhost: true});
			} catch (_error) {
				error = _error;
			}
			error.should.match(/connect failed again/);
			sinon.assert.calledThrice(mockChannel.initialize);
			sinon.assert.calledWith(mockChannel.initialize.firstCall, {target: mockPeer1, discover: false, asLocalhost: true});
			sinon.assert.calledWith(mockChannel.initialize.secondCall, {target: mockPeer3, discover: false, asLocalhost: true});
			sinon.assert.calledWith(mockChannel.initialize.thirdCall, {target: mockPeer4, discover: false, asLocalhost: true});
		});

		it('should fail if there are no LEDGER_QUERY_ROLE peers', async () => {
			network.initialized = false;
			mockPeer1.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(false);
			mockPeer2.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(false);
			mockPeer3.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(false);
			mockPeer4.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(false);
			mockPeer5.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(false);
			peerArray = [mockPeer1, mockPeer2, mockPeer3, mockPeer4, mockPeer5];
			mockChannel.getPeers.returns(peerArray);
			return network._initializeInternalChannel({enabled:false, asLocalhost: true})
				.should.be.rejectedWith(/No peers defined in channel that have the ledger query role/);
		});

		it('should fail if no peers defined for specified MSP', async () => {
			network.initialized = false;
			mockClient.getPeersForOrg.returns([]);
			mockClient.getMspid.returns('myMSP');
			return network._initializeInternalChannel({enabled:true, asLocalhost: true})
				.should.be.rejectedWith(/No peers defined for MSP \'myMSP\' to discover from/);
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

	describe('#getChannel', () => {
		it('should return the fabric-client channel object', () => {
			network.getChannel().should.equal(mockChannel);
		});
	});

	describe('#getContract', () => {
		it('should throw an error if not initialized', () => {
			network.initialized = false;
			(() => {
				network.getContract();
			}).should.throw(/Unable to get contract as network has failed to initialize/);
		});

		it('should return a cached contract object', () => {
			const mockContract = sinon.createStubInstance(Contract);
			network.contracts.set('foo:', mockContract);
			network.initialized = true;
			network.getContract('foo').should.equal(mockContract);
		});

		it('should create a non-existent contract object', () => {
			network.initialized = true;
			const contract = network.getContract('bar');
			contract.should.be.instanceof(Contract);
			contract.chaincodeId.should.equal('bar');
		});

		it('should return a newly created contract, with namespace', () => {
			const mockContract = sinon.createStubInstance(Contract);
			network.contracts.set('foo:my.name.space', mockContract);
			network.initialized = true;
			network.getContract('foo', 'my.name.space').should.equal(mockContract);
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
			const mockContract = sinon.createStubInstance(Contract);
			network.contracts.set('foo', mockContract);
			network.contracts.size.should.equal(1);
			network.initialized = true;
			network._dispose();
			network.contracts.size.should.equal(0);
			network.initialized.should.equal(false);
		});

		it('calls close() on its channel', () => {
			network._dispose();
			sinon.assert.calledOnce(mockChannel.close);
		});

		it('calls dispose() on the event hub factory', () => {
			const spy = network.getEventHubManager().dispose;
			network._dispose();
			sinon.assert.called(spy);
		});

		it('calls unregister on its listeners', () => {
			const mockListener = sinon.createStubInstance(BlockEventListener);
			network.listeners.set('mockListener', mockListener);
			network._dispose();
			sinon.assert.calledOnce(mockListener.unregister);
		});
	});

	describe('#getQueryHandler', () => {
		it('Undefined before initialization', async () => {
			const result = network.getQueryHandler();
			should(result).not.exist;
		});

		it('Returns a query handler after initialization', async () => {
			mockChannel.initialize.resolves();
			await network._initialize({enabled: true});

			const result = network.getQueryHandler();

			result.network.should.equal(network);
		});
	});

	describe('#addCommitListener', () => {
		let listenerName;
		let callback;
		beforeEach(() => {
			listenerName = '00000000-0000-0000-0000-000000000000';
			callback = () => {};
			mockEventHub._transactionRegistrations = {};
			mockEventHub._transactionRegistrations[listenerName] = {}; // Preregister listener with eh
			mockEventHub.isFiltered.returns(true);
		});

		it('should create options if the options param is undefined', async () => {
			const listener = await network.addCommitListener(listenerName, callback, null, mockEventHub);
			listener.should.to.be.instanceof(CommitEventListener);
			listener.eventHub.should.to.equal(mockEventHub);
			network.listeners.get(listener.listenerName).should.to.equal(listener);
		});

		it('should create an instance of BlockEventListener and add it to the list of listeners', async () => {
			const listener = await network.addCommitListener(listenerName, callback, {}, mockEventHub);
			listener.should.to.be.instanceof(CommitEventListener);
			listener.eventHub.should.to.equal(mockEventHub);
			network.listeners.get(listener.listenerName).should.to.equal(listener);
		});

		it('should not set an event hub if an event hub is not given', async () => {
			mockEventHubManager.getReplayEventHub.returns(mockEventHub);
			const listener = await network.addCommitListener(listenerName, callback, null);
			listener.eventHub.should.equal(mockEventHub);
		});
	});

	describe('#addBlockListener', () => {
		let listenerName;
		let callback;
		beforeEach(() => {
			listenerName = 'testBlockListener';
			callback = () => {};
			mockEventHub.isFiltered.returns(true);
		});

		it('should create options if the options param is undefined', async () => {
			const listener = await network.addBlockListener(listenerName, callback);
			listener.should.to.be.instanceof(BlockEventListener);
			network.listeners.get(listenerName).should.to.equal(listener);
		});

		it('should create an instance of BlockEventListener and add it to the list of listeners', async () => {
			const listener = await network.addBlockListener(listenerName, callback, {});
			listener.should.to.be.instanceof(BlockEventListener);
			network.listeners.get(listenerName).should.to.equal(listener);
		});

		it('should change options.replay=undefined to options.replay=false', async () => {
			sinon.spy(network, 'getCheckpointer');
			await network.addBlockListener(listenerName, callback, {replay: undefined});
			sinon.assert.calledWith(network.getCheckpointer, {checkpointer: mockCheckpointer, replay: false});
		});

		it('should change options.replay=\'true\' to options.replay=true', async () => {
			sinon.spy(network, 'getCheckpointer');
			await network.addBlockListener(listenerName, callback, {replay: 'true'});
			sinon.assert.calledWith(network.getCheckpointer, {checkpointer: mockCheckpointer, replay: true});
		});
	});

	describe('#getCheckpointer', () => {
		beforeEach(() => {
			network.checkpointer = mockCheckpointer;
		});

		it('should return the global checkpointer if it is undefined in options', () => {
			const checkpointer = network.getCheckpointer();
			checkpointer.should.equal(mockCheckpointer);
		});

		it('should return the global checkpointer if it is undefined in options object', () => {
			const checkpointer = network.getCheckpointer({});
			checkpointer.should.equal(mockCheckpointer);
		});

		it('should return the global checkpointer if it is true in options', () => {
			const checkpointer = network.getCheckpointer({checkpointer: 'something'});
			checkpointer.should.equal(mockCheckpointer);
		});

		it('should return the checkpointer passed as an option', () => {
			const options = {checkpointer: {factory: () => {}}};
			const checkpointer = network.getCheckpointer(options);
			checkpointer.should.equal(options.checkpointer);
			checkpointer.should.not.equal(mockCheckpointer);
		});

		it('should return null if checkpointer is false', () => {
			const checkpointer = network.getCheckpointer({checkpointer: false});
			should().equal(checkpointer, null);
		});
	});

	describe('#saveListener', () => {
		it ('should register a new listener if the name isnt taken', () => {
			const listener = {};
			network.listeners.set('listener1', {});
			network.saveListener('listener2', listener);
			network.listeners.get('listener2').should.equal(listener);
		});

		it('should throw if the listener is registered with an existing name', () => {
			const listener = sinon.createStubInstance(BlockEventListener);
			network.listeners.set('listener1', listener);
			(() => {
				network.saveListener('listener1', listener);
			}).should.throw('Listener already exists with the name listener1');
		});
	});

	describe('#_checkListenerNameIsUnique', () => {
		it('should throw if the listener name has been used before', () => {
			network.listeners.set('listenerName', {});
			(() => {
				network._checkListenerNameIsUnique('listenerName');
			}).should.throw('Listener already exists with the name listenerName');
		});
	});
});
