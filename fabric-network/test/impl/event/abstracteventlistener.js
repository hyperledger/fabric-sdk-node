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
	let networkStub;
	let checkpointerStub;
	let eventHubManagerStub;
	let channelStub;

	beforeEach(() => {
		sandbox = sinon.createSandbox();

		eventHubManagerStub = sandbox.createStubInstance(EventHubManager);
		contractStub = sandbox.createStubInstance(Contract);
		networkStub = sandbox.createStubInstance(Network);
		networkStub.getEventHubManager.returns(eventHubManagerStub);
		contractStub.getNetwork.returns(networkStub);
		checkpointerStub = sandbox.createStubInstance(FileSystemCheckpointer);
		checkpointerStub.setChaincodeId = sandbox.stub();
		channelStub = sandbox.createStubInstance(Channel);
		networkStub.getChannel.returns(channelStub);
		channelStub.getName.returns('mychannel');
		eventHubManagerStub.getPeers.returns(['peer1']);
		channelStub.queryInfo.returns({height: 10});

		contractStub.getChaincodeId.returns('ccid');
		const callback = (err) => {};
		testListener = new AbstractEventListener(networkStub, 'testListener', callback, {option: 'anoption', replay: true});

	});

	afterEach(() => {
		sandbox.reset();
	});

	describe('#constructor', () => {
		it('should set the correct properties on instantiation', () => {
			const callback = (err) => {};
			const listener = new AbstractEventListener(networkStub, 'testlistener', callback, {option: 'anoption'});
			expect(listener.network).to.equal(networkStub);
			expect(listener.listenerName).to.equal('testlistener');
			expect(listener.eventCallback).to.equal(callback);
			expect(listener.options).to.deep.equal({option: 'anoption'});
			expect(listener.checkpointer).to.be.undefined;
			expect(listener._registered).to.be.false;
			expect(listener._firstCheckpoint).to.deep.equal({});
			expect(listener._registration).to.be.null;
		});

		it('should set options if options is undefined', () => {
			const callback = (err) => {};
			const listener = new AbstractEventListener(networkStub, 'testlistener', callback);
			expect(listener.options).to.deep.equal({});
		});

		it('should set this.filtered to be options.filtered', () => {
			const listener = new AbstractEventListener(networkStub, 'testListener', () => {}, {filtered: false});
			expect(listener._filtered).to.be.false;
		});
	});

	describe('#register', () => {
		it('should throw if the listener is already registered', () => {
			testListener._registered = true;
			expect(testListener.register()).to.be.rejectedWith('Listener already registered');
		});

		it('should not call checkpointer._initialize() or checkpointer.load()', async () => {
			await testListener.register();
			sinon.assert.notCalled(checkpointerStub.load);
		});

		it('should not call checkpointer.initialize()', async () => {
			const checkpoint = {transactionId: 'txid', blockNumber: '8'};
			checkpointerStub.load.returns(checkpoint);
			testListener.checkpointer = checkpointerStub;
			await testListener.register();
			sinon.assert.called(checkpointerStub.load);
			expect(testListener.options.startBlock.toNumber()).to.equal(9); // Start block is a Long
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
			const listener = new AbstractEventListener(networkStub, 'testlistener', () => {}, {replay: true, checkpointer: {factory: checkpointerFactoryStub}});
			await listener.register();
			sinon.assert.calledWith(checkpointerFactoryStub, 'mychannel', 'testlistener');
			sinon.assert.called(checkpointerStub.setChaincodeId);
			expect(listener.checkpointer).to.equal(checkpointerStub);
		});

		it('should log an error if replay is enabled and no checkpointer is given', async () => {
			const listener = new AbstractEventListener(networkStub, 'testlistener', () => {}, {replay: true});
			await listener.register();
		});

	});

	describe('#unregister', () => {
		beforeEach(async () => {
			checkpointerStub.load.returns({transactionId: 'txid', blockNumber: '10'});
			testListener.checkpointer = checkpointerStub;
			await testListener.register();
		});
		it('should reset the correct variables', async () => {
			await testListener.unregister();
			expect(testListener._registered).to.be.false;
			expect(testListener.startBlock).to.be.undefined;
			expect(testListener.options.endBlock).to.be.undefined;
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
});
