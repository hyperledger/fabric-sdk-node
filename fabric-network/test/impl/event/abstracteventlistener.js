/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');

const Channel = require('fabric-client/lib/Channel');
const ChannelEventHub = require('fabric-client/lib/ChannelEventHub');
const EventHubDisconnectError = require('fabric-client/lib/errors/EventHubDisconnectError');
const Contract = require('./../../../lib/contract');
const Network = require('./../../../lib/network');
const EventHubManager = require('./../../../lib/impl/event/eventhubmanager');
const AbstractEventListener = require('./../../../lib/impl/event/abstracteventlistener');
const FileSystemCheckpointer = require('./../../../lib/impl/event/filesystemcheckpointer');

describe('AbstractEventListener', () => {
	let sandbox;

	let testListener;
	let contractStub;
	let network;
	let checkpointerStub;
	let eventHubManagerStub;
	let channelStub;

	beforeEach(() => {
		sandbox = sinon.createSandbox();

		eventHubManagerStub = sandbox.createStubInstance(EventHubManager);
		contractStub = sandbox.createStubInstance(Contract);
		network = new Network();
		contractStub.getNetwork.returns(network);
		checkpointerStub = sandbox.createStubInstance(FileSystemCheckpointer);
		checkpointerStub.setChaincodeId = sandbox.stub();
		channelStub = sandbox.createStubInstance(Channel);
		sandbox.stub(network, 'getChannel').returns(channelStub);
		channelStub.getName.returns('mychannel');
		eventHubManagerStub.getPeers.returns(['peer1']);
		channelStub.queryInfo.returns({height: 10});
		sandbox.stub(network, 'getEventHubManager').returns(eventHubManagerStub);

		contractStub.getChaincodeId.returns('ccid');
		const callback = (err) => {};
		testListener = new AbstractEventListener(network, 'testListener', callback, {option: 'anoption', replay: true});

	});

	afterEach(() => {
		sandbox.reset();
	});

	describe('#constructor', () => {
		it('should set the correct properties on instantiation', () => {
			const callback = (err) => {};
			const listener = new AbstractEventListener(network, 'testlistener', callback, {option: 'anoption'});
			expect(listener.network).to.equal(network);
			expect(listener.listenerName).to.equal('testlistener');
			expect(listener.eventCallback).to.equal(callback);
			expect(listener.options).to.deep.equal({option: 'anoption', eventHubConnectTimeout: 30000, eventHubConnectWait: 1000});
			expect(listener.checkpointer).to.be.undefined;
			expect(listener._registered).to.be.false;
			expect(listener._firstCheckpoint).to.deep.equal({});
			expect(listener._registration).to.be.null;
			expect(listener._filtered).to.be.false;
		});

		it('should set options if options is undefined', () => {
			const callback = (err) => {};
			const listener = new AbstractEventListener(network, 'testlistener', callback);
			expect(listener.options).to.deep.equal({eventHubConnectTimeout: 30000, eventHubConnectWait: 1000});
		});

		it('should set this.filtered to be options.filtered', () => {
			const listener = new AbstractEventListener(network, 'testListener', () => {}, {filtered: true});
			expect(listener._filtered).to.be.true;
		});

		it('should set and unset the startBlock from clientOptions and options respectively', () => {
			const callback = (err) => {};
			const listener = new AbstractEventListener(network, 'testlistener', callback, {startBlock: 0});
			expect(listener.options).to.deep.equal({eventHubConnectTimeout: 30000, eventHubConnectWait: 1000});
			expect(listener.clientOptions).to.deep.equal({startBlock: 0});
		});

		it('should set and unset the endBlock from clientOptions and options respectively', () => {
			const callback = (err) => {};
			const listener = new AbstractEventListener(network, 'testlistener', callback, {endBlock: 0});
			expect(listener.options).to.deep.equal({eventHubConnectTimeout: 30000, eventHubConnectWait: 1000});
			expect(listener.clientOptions).to.deep.equal({endBlock: 0});
		});

		it('should set and unset the startBlock and endBlock from clientOptions and options respectively', () => {
			const callback = (err) => {};
			const listener = new AbstractEventListener(network, 'testlistener', callback, {startBlock: 0, endBlock: 10});
			expect(listener.options).to.deep.equal({eventHubConnectTimeout: 30000, eventHubConnectWait: 1000});
			expect(listener.clientOptions).to.deep.equal({startBlock: 0, endBlock: 10});
		});
	});

	describe('#register', () => {
		it('should throw if the listener is already registered', async () => {
			testListener._registered = true;
			await expect(testListener.register()).to.be.rejectedWith('Listener already registered');
		});

		it('should not call checkpointer._initialize() or checkpointer.loadLatestCheckpoint()', async () => {
			await testListener.register();
			sinon.assert.notCalled(checkpointerStub.loadLatestCheckpoint);
		});

		it('should not call checkpointer.initialize()', async () => {
			const checkpoint = {transactionId: 'txid', blockNumber: '8'};
			checkpointerStub.loadLatestCheckpoint.returns(checkpoint);
			testListener.checkpointer = checkpointerStub;
			await testListener.register();
			sinon.assert.called(checkpointerStub.loadLatestCheckpoint);
			expect(testListener.clientOptions.startBlock.toNumber()).to.equal(9); // Start block is a Long
			expect(testListener._firstCheckpoint).to.deep.equal(checkpoint);
		});

		it('should disconnect and reset the event hub if it emits the wrong type of events', async () => {
			const eventHub = sinon.createStubInstance(ChannelEventHub);
			eventHub.isFiltered.returns(true);
			eventHub.isconnected.returns(true);
			testListener.eventHub = eventHub;
			testListener._filtered = false;
			await testListener.register();
			sinon.assert.called(eventHub.disconnect);
			expect(testListener.eventHub).to.be.null;
		});

		it('should return undefined and log when no peers are available', async() => {
			eventHubManagerStub.getPeers.returns([]);
			await testListener.register();
		});

		it('should call the checkpointer factory if it is set', async () => {
			const checkpointerFactoryStub = sinon.stub().returns(checkpointerStub);
			const listener = new AbstractEventListener(network, 'testlistener', () => {}, {replay: true, checkpointer: {factory: checkpointerFactoryStub}});
			await listener.register();
			sinon.assert.calledWith(checkpointerFactoryStub, 'mychannel', 'testlistener');
			sinon.assert.called(checkpointerStub.setChaincodeId);
			expect(listener.checkpointer).to.equal(checkpointerStub);
		});

		it('should log an error if replay is enabled and no checkpointer is given', async () => {
			const listener = new AbstractEventListener(network, 'testlistener', () => {}, {replay: true});
			await listener.register();
		});

		it('should not reset the event hub if it is fixed and filtered status doesn\'t match', async () => {
			const listener = new AbstractEventListener(network, 'testlistener', () => {}, {filtered: true});
			const eventHub = sandbox.createStubInstance(ChannelEventHub);
			eventHub.isFiltered.returns(false);
			eventHub.isconnected.returns(true);
			listener.setEventHub(eventHub, true);
			await listener.register();
			expect(listener.eventHub).to.equal(eventHub);
		});

		it('should set startBlock of 1', async () => {
			checkpointerStub.load.returns({transactionId: 'txid', blockNumber: 0});
			checkpointerStub.loadLatestCheckpoint.returns({transactionId: 'txid', blockNumber: '0'});
			testListener.checkpointer = checkpointerStub;
			await testListener.register();
			expect(testListener.clientOptions.startBlock.toInt()).to.equal(1);
		});

		it('should register the listener with the network', async () => {
			await testListener.register();
			expect(network.listeners.get(testListener.listenerName)).to.equal(testListener);
		});

		it('should do nothing if the event hub is connected and the filtered status has not changed', async () => {
			const eventHub = sandbox.createStubInstance(ChannelEventHub);
			eventHub.isconnected.returns(true);
			eventHub.isFiltered.returns(false);
			testListener.eventHub = eventHub;
			await testListener.register();
			sinon.assert.notCalled(eventHub.disconnect);
		});

		it('should set replay to false if startBlock is set', async () => {
			const eventHub = sandbox.createStubInstance(ChannelEventHub);
			eventHub.isconnected.returns(true);
			eventHub.isFiltered.returns(false);
			testListener.eventHub = eventHub;
			testListener.options.replay = true;
			testListener.clientOptions.startBlock = 0;
			await testListener.register();
			expect(testListener.options.replay).to.be.false;
		});

		it('should set replay to false if endBlock is set', async () => {
			const eventHub = sandbox.createStubInstance(ChannelEventHub);
			eventHub.isconnected.returns(true);
			eventHub.isFiltered.returns(false);
			testListener.eventHub = eventHub;
			testListener.options.replay = true;
			testListener.clientOptions.endBlock = 10;
			await testListener.register();
			expect(testListener.options.replay).to.be.false;
		});
	});

	describe('#unregister', () => {
		beforeEach(async () => {
			checkpointerStub.loadLatestCheckpoint.returns({transactionId: 'txid', blockNumber: '10'});
			testListener.checkpointer = checkpointerStub;
			await testListener.register();
		});
		it('should reset the correct variables', async () => {
			await testListener.unregister();
			expect(testListener._registered).to.be.false;
			expect(testListener.startBlock).to.be.undefined;
			expect(testListener.clientOptions.endBlock).to.be.undefined;
			expect(testListener._firstCheckpoint).to.deep.equal({});
		});
	});

	describe('#isRegistered', () => {
		it('should return false if the listener has not been registered', () => {
			expect(testListener.isregistered()).to.be.false;
		});

		// Abstract listener does not change the register status
		it('should return false if the listener has been registered', async () => {
			await testListener.register();
			expect(testListener.isregistered()).to.be.false;
		});

		it('should return false if registered and unregistered', async () => {
			await testListener.register();
			testListener.unregister();
			expect(testListener.isregistered()).to.be.false;
		});
	});

	describe('#getCheckpointer', () => {
		it('should return undefined if checkpointer has not been set', () => {
			expect(testListener.getCheckpointer()).to.be.undefined;
		});

		it('should return the checkpointer if it has been set', () => {
			testListener.checkpointer = checkpointerStub;
			expect(testListener.getCheckpointer()).to.equal(checkpointerStub);
		});
	});

	describe('#getEventHubManager', () => {
		it('shouild return the event hub manager from the network', () => {
			expect(testListener.getEventHubManager()).to.equal(eventHubManagerStub);
		});
	});

	describe('#_isShutdownMessage', () => {
		it('should return false if an error is not given', () => {
			expect(testListener._isShutdownMessage()).to.be.false;
		});

		it('should return false if error message does not match', () => {
			expect(testListener._isShutdownMessage(new Error('An error'))).to.be.false;
		});

		it('should return true if the error message does match', () => {
			expect(testListener._isShutdownMessage(new EventHubDisconnectError())).to.be.true;
		});
	});

	describe('#_setEventHubConnectWait', async () => {
		it('should resolve', async () => {
			testListener.options.eventHubConnectWait = 0;
			expect(testListener._setEventHubConnectWait()).to.eventually.be.fulfilled;
		});
	});

	describe('#_setEventHubConnectTimeout', async () => {
		it('should unset _abandonEventHubConnect', async () => {
			testListener.options.eventHubConnectTimeout = 0;
			testListener._setEventHubConnectTimeout();
			expect(testListener._abandonEventHubConnect).to.be.false;
		});
	});

	describe('#_unsetEventHubConnectTimeout', async () => {
		it('should unset _eventHubConnectTimeout', async () => {
			testListener._unsetEventHubConnectTimeout();
			expect(testListener._eventHubConnectTimeout).to.be.null;
		});
	});
});
