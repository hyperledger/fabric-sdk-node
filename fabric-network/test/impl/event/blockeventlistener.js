/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
chai.use(require('chai-as-promised'));

const Contract = require('fabric-network/lib/contract');
const Network = require('fabric-network/lib/network');
const ChannelEventHub = require('fabric-client/lib/ChannelEventHub');
const Channel = require('fabric-client/lib/Channel');
const EventHubDisconnectError = require('fabric-client/lib/errors/EventHubDisconnectError');
const BlockEventListener = require('fabric-network/lib/impl/event/blockeventlistener');
const EventHubManager = require('fabric-network/lib/impl/event/eventhubmanager');
const BaseCheckpointer = require('fabric-network/lib/impl/event/basecheckpointer');
const InMemoryCheckpointer = require('./inmemorycheckpointer');

describe('BlockEventListener', () => {
	let sandbox;
	let channelStub;
	let contractStub;
	let network;
	let eventHubStub;
	let checkpointerStub;
	let eventHubManagerStub;
	let blockEventListener;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		channelStub = sandbox.createStubInstance(Channel);
		channelStub.getName.returns('mychannel');
		contractStub = sandbox.createStubInstance(Contract);
		contractStub.getChaincodeId.returns('chaincodeid');
		network = new Network();
		sandbox.stub(network, 'getChannel').returns(channelStub);
		contractStub.getNetwork.returns(network);
		eventHubManagerStub = sinon.createStubInstance(EventHubManager);
		eventHubManagerStub.getPeers.returns(['peer1']);
		sandbox.stub(network, 'getEventHubManager').returns(eventHubManagerStub);
		eventHubStub = sandbox.createStubInstance(ChannelEventHub);
		checkpointerStub = sandbox.createStubInstance(BaseCheckpointer);
		blockEventListener = new BlockEventListener(network, 'blockTest', () => {}, {replay: true});
		eventHubStub.isFiltered.returns(true);
	});
	describe('#register', () => {
		it('should register a block event, connect to the event hub and set the register flag', async () => {
			blockEventListener.eventHub = eventHubStub;
			sandbox.spy(blockEventListener._onEvent, 'bind');
			sandbox.spy(blockEventListener._onError, 'bind');
			await blockEventListener.register();
			sinon.assert.calledWith(
				eventHubStub.registerBlockEvent,
				sinon.match.func,
				sinon.match.func,
				{}
			);
			sinon.assert.calledWith(blockEventListener._onEvent.bind, blockEventListener);
			sinon.assert.calledWith(blockEventListener._onError.bind, blockEventListener);
			sinon.assert.called(eventHubStub.connect);
			expect(blockEventListener._registered).to.be.true;
		});

		it('should call _registerWithNewEventHub', async () => {
			sandbox.spy(blockEventListener, '_registerWithNewEventHub');
			await blockEventListener.register();
			sinon.assert.called(blockEventListener._registerWithNewEventHub);
		});
	});

	describe('#unregister', () => {
		it('should not call ChannelEventHub.unregisterBlockEvent', async () => {
			await blockEventListener.unregister();
			sinon.assert.notCalled(eventHubStub.unregisterBlockEvent);
		});

		it('should call ChannelEventHub.unregisterBlockEvent', async () => {
			eventHubStub.registerBlockEvent.returns('registration');
			blockEventListener.eventHub = eventHubStub;
			await blockEventListener.register();
			blockEventListener.unregister();
			sinon.assert.calledWith(eventHubStub.unregisterBlockEvent, 'registration');
		});
	});

	describe('#_onEvent', () => {
		beforeEach(() => {
			blockEventListener._registration = {};
			sandbox.spy(blockEventListener, 'unregister');
			sandbox.stub(blockEventListener, 'eventCallback');
		});

		it('should call the event callback', async () => {
			const block = {header: {number: '10'}};
			await blockEventListener._onEvent(block);
			sinon.assert.calledWith(blockEventListener.eventCallback, null, block);
			sinon.assert.notCalled(checkpointerStub.save);
			sinon.assert.notCalled(blockEventListener.unregister);
		});

		it('should save a checkpoint', async () => {
			const block = {header: {number: '10'}};
			checkpointerStub.load.returns({});
			blockEventListener.checkpointer = checkpointerStub;
			await blockEventListener._onEvent(block);
			sinon.assert.calledWith(checkpointerStub.save, null, 10);
		});

		it('should unregister if registration.unregister is set', async () => {
			const block = {header: {number: '10'}};
			blockEventListener._registration.unregister = true;
			await blockEventListener._onEvent(block);
			sinon.assert.calledWith(blockEventListener.eventCallback, null, block);
			sinon.assert.called(blockEventListener.unregister);
		});

		it ('should not save a checkpoint if the callback fails', async () => {
			const block = {header: {number: '10'}};
			blockEventListener.eventCallback.throws(new Error());
			blockEventListener.checkpointer = checkpointerStub;
			await blockEventListener._onEvent(block);
			sinon.assert.calledWith(blockEventListener.eventCallback, null, block);
			sinon.assert.notCalled(checkpointerStub.save);
		});
	});

	describe('#_onError', () => {
		beforeEach(() => {
			blockEventListener.eventHub = eventHubStub;
			eventHubStub._peer = 'peer';
			blockEventListener._registration = {};
			sandbox.spy(blockEventListener, 'unregister');
			sandbox.stub(blockEventListener, 'eventCallback');
			sandbox.stub(blockEventListener, '_registerWithNewEventHub');
		});

		it('should call the event callback with an error', async () => {
			const error = new EventHubDisconnectError();
			await blockEventListener._onError(error);
			sinon.assert.calledWith(blockEventListener.eventCallback, error);
		});

		it('should update event hub availability and reregister if disconnected', async () => {
			const error = new EventHubDisconnectError();
			blockEventListener.eventHub = eventHubStub;
			blockEventListener._registered = true;
			await blockEventListener._onError(error);
			sinon.assert.calledWith(eventHubManagerStub.updateEventHubAvailability, 'peer');
			sinon.assert.called(blockEventListener._registerWithNewEventHub);
			sinon.assert.calledWith(blockEventListener.eventCallback, error);
		});

		it('should call the error callback if the error is null', async () => {
			const error = null;
			blockEventListener.eventHub = eventHubStub;
			blockEventListener._registered = true;
			await blockEventListener._onError(error);
			sinon.assert.calledWith(blockEventListener.eventCallback, error);
		});
	});

	describe('#_registerWithNewEventHub', () => {
		beforeEach(() => {
			blockEventListener._registration = {};
			sandbox.spy(blockEventListener, 'unregister');
			sandbox.stub(blockEventListener, 'eventCallback');
			eventHubManagerStub.getReplayEventHub.returns(eventHubStub);
			eventHubManagerStub.getEventHub.returns(eventHubStub);
		});

		it('should call unregister, get a new event hub and reregister', async () => {
			sandbox.stub(blockEventListener, 'register');
			await blockEventListener._registerWithNewEventHub();
			sinon.assert.called(blockEventListener.unregister);
			sinon.assert.called(eventHubManagerStub.getEventHub);
			sinon.assert.called(blockEventListener.register);
		});

		it('should get a replay event hub if a checkpointer is present', async () => {
			sandbox.stub(blockEventListener, 'register');
			blockEventListener.checkpointer = checkpointerStub;
			blockEventListener.options.replay = true;
			await blockEventListener._registerWithNewEventHub();
			sinon.assert.called(blockEventListener.unregister);
			sinon.assert.called(eventHubManagerStub.getReplayEventHub);
			sinon.assert.called(blockEventListener.register);
		});

		it('should throw if options.fixedEventHub is true and no event hub is set', () => {
			blockEventListener.setEventHub(null, true);
			return expect(blockEventListener.register()).to.be.rejectedWith('No event hub given and option fixedEventHub is set');
		});

		it('should throw if options.fixedEventHub is true and no event hub is set', () => {
			blockEventListener.setEventHub(null, true);
			return expect(blockEventListener._registerWithNewEventHub()).to.be.rejectedWith('No event hub given and option fixedEventHub is set');
		});

		it('should get an new instance of the existing event hub', async () => {
			blockEventListener.checkpointer = checkpointerStub;
			eventHubStub._peer = 'peer';
			blockEventListener.setEventHub(eventHubStub, true);
			await blockEventListener._registerWithNewEventHub();

			sinon.assert.calledWith(eventHubManagerStub.getReplayEventHub, eventHubStub._peer);
		});

		it('should get the same existing event hub', async () => {
			eventHubStub._peer = 'peer';
			blockEventListener.setEventHub(eventHubStub, true);
			await blockEventListener._registerWithNewEventHub();

			sinon.assert.calledWith(eventHubManagerStub.getEventHub, eventHubStub._peer);
		});

		it('should get an existing event hub', async () => {
			eventHubStub._peer = 'peer';
			await blockEventListener._registerWithNewEventHub();

			sinon.assert.calledWith(eventHubManagerStub.getEventHub);
		});
	});

	describe('Checkpointing Behaviour', () => {
		let checkpointer;
		it('should set the block number and transaction ID', async () => {
			checkpointer = new InMemoryCheckpointer();
			blockEventListener = new BlockEventListener(network, 'listener', (block) => {}, {replay: true, checkpointer: {factory: () => checkpointer}});
			blockEventListener.eventHub = eventHubStub;
			eventHubStub.registerBlockEvent.returns({});
			await blockEventListener.register();
			await blockEventListener._onEvent({header: {number: 1}});
			const checkpoint = await checkpointer.load();
			expect(checkpoint.blockNumber).to.equal(1);
		});

		it('should update with a new block number (filtered)', async () => {
			checkpointer = new InMemoryCheckpointer();
			blockEventListener = new BlockEventListener(network, 'listener', (block) => {}, {filtered: true, replay: true, checkpointer: {factory: () => checkpointer}});
			blockEventListener.eventHub = eventHubStub;
			eventHubStub.registerBlockEvent.returns({});
			await blockEventListener.register();
			await blockEventListener._onEvent({number: 2});
			await blockEventListener._onEvent({number: 1});
			const checkpoint = await checkpointer.load();
			expect(checkpoint.blockNumber).to.equal(2);
		});

		it('should update with a new block number (unfiltered)', async () => {
			checkpointer = new InMemoryCheckpointer();
			blockEventListener = new BlockEventListener(network, 'listener', (block) => {}, {replay: true, checkpointer: {factory: () => checkpointer}});
			blockEventListener.eventHub = eventHubStub;
			eventHubStub.registerBlockEvent.returns({});
			await blockEventListener.register();
			await blockEventListener._onEvent({header: {number: 2}});
			await blockEventListener._onEvent({header: {number: 1}});
			const checkpoint = await checkpointer.load();
			expect(checkpoint.blockNumber).to.equal(2);
		});

		it('should set the start block', async() => {
			channelStub.queryInfo.resolves({height: '3'});
			checkpointer = new InMemoryCheckpointer();
			checkpointer.checkpoint = {blockNumber: '1'};
			blockEventListener = new BlockEventListener(network, 'listener', (block) => {}, {replay: true, checkpointer: {factory: () => checkpointer}});
			blockEventListener.eventHub = eventHubStub;
			eventHubStub.registerBlockEvent.returns({});
			await blockEventListener.register();
			expect(blockEventListener.clientOptions.startBlock.toInt()).to.equal(2);
		});

		it('should not set the start block if it equals the current height', async() => {
			channelStub.queryInfo.resolves({height: '3'});
			checkpointer = new InMemoryCheckpointer();
			checkpointer.checkpoint = {blockNumber: '2'};
			blockEventListener = new BlockEventListener(network, 'listener', (block) => {}, {replay: true, checkpointer: {factory: () => checkpointer}});
			blockEventListener.eventHub = eventHubStub;
			eventHubStub.registerBlockEvent.returns({});
			await blockEventListener.register();
			expect(blockEventListener.options.startBlock).to.be.undefined;
		});
	});
});
