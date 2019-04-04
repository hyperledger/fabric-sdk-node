/*
 Copyright 2019 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');

const Contract = require('fabric-network/lib/contract');
const Network = require('fabric-network/lib/network');
const Channel = require('fabric-client/lib/Channel');
const ChannelEventHub = require('fabric-client/lib/ChannelEventHub');
const EventHubDisconnectError = require('fabric-client/lib/errors/EventHubDisconnectError');
const ContractEventListener = require('fabric-network/lib/impl/event/contracteventlistener');
const EventHubManager = require('fabric-network/lib/impl/event/eventhubmanager');
const Checkpointer = require('fabric-network/lib/impl/event/basecheckpointer');
const InMemoryCheckpointer = require('./inmemorycheckpointer');

describe('ContractEventListener', () => {
	let sandbox;
	let contractStub;
	let networkStub;
	let channelStub;
	let eventHubStub;
	let checkpointerStub;
	let eventHubManagerStub;
	let contractEventListener;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		contractStub = sandbox.createStubInstance(Contract);
		contractStub.getChaincodeId.returns('chaincodeid');
		networkStub = sandbox.createStubInstance(Network);
		channelStub = sandbox.createStubInstance(Channel);
		channelStub.getName.returns('channelName');
		networkStub.getChannel.returns(channelStub);
		contractStub.getNetwork.returns(networkStub);
		eventHubManagerStub = sinon.createStubInstance(EventHubManager);
		networkStub.getEventHubManager.returns(eventHubManagerStub);
		eventHubManagerStub.getPeers.returns(['peer1']);
		eventHubStub = sandbox.createStubInstance(ChannelEventHub);
		checkpointerStub = sandbox.createStubInstance(Checkpointer);
		checkpointerStub.load.returns({});
		contractEventListener = new ContractEventListener(contractStub, 'test', 'eventName', () => {}, {replay: true});
	});

	afterEach(() => {
		sandbox.reset();
	});

	describe('#contructor', () => {
		it('should set the listener name', () => {
			expect(contractEventListener.eventName).to.equal('eventName');
		});
	});

	describe('#register', () => {
		it('should register a block event, connect to the event hub and set the register flag', async () => {
			contractEventListener.eventHub = eventHubStub;
			sandbox.spy(contractEventListener._onEvent, 'bind');
			sandbox.spy(contractEventListener._onError, 'bind');
			await contractEventListener.register();
			sinon.assert.calledWith(
				eventHubStub.registerChaincodeEvent,
				'chaincodeid',
				'eventName',
				sinon.match.func,
				sinon.match.func,
				{replay: true}
			);
			sinon.assert.calledWith(contractEventListener._onEvent.bind, contractEventListener);
			sinon.assert.calledWith(contractEventListener._onError.bind, contractEventListener);
			sinon.assert.called(eventHubStub.connect);
			expect(contractEventListener._registered).to.be.true;
		});

		it('should call _registerWithNewEventHub', async () => {
			sandbox.stub(contractEventListener, '_registerWithNewEventHub');
			await contractEventListener.register();
			sinon.assert.called(contractEventListener._registerWithNewEventHub);
		});
	});

	describe('#unregister', () => {
		it('should not call ChannelEventHub.unregisterChaincodeEvent', () => {
			contractEventListener.unregister();
			sinon.assert.notCalled(eventHubStub.unregisterChaincodeEvent);
		});

		it('should call ChannelEventHub.unregisterBlockEvent', async () => {
			eventHubStub.registerChaincodeEvent.returns('registration');
			contractEventListener.eventHub = eventHubStub;
			await contractEventListener.register();
			contractEventListener.unregister();
			sinon.assert.calledWith(eventHubStub.unregisterChaincodeEvent, 'registration');
		});
	});

	describe('#_onEvent', () => {
		beforeEach(() => {
			contractEventListener._registration = {};
			sandbox.spy(contractEventListener, 'unregister');
			sandbox.stub(contractEventListener, 'eventCallback');
		});

		it('should call the event callback', () => {
			const event = {name: 'eventName'};
			const blockNumber = '10';
			const transactionId = 'transactionId';
			const status = 'VALID';
			contractEventListener._onEvent(event, blockNumber, transactionId, status);
			sinon.assert.calledWith(contractEventListener.eventCallback, null, event, Number(blockNumber), transactionId, status);
			sinon.assert.notCalled(checkpointerStub.save);
			sinon.assert.notCalled(contractEventListener.unregister);
		});

		it('should save a checkpoint', async () => {
			const event = {name: 'eventName'};
			const blockNumber = '10';
			const transactionId = 'transactionId';
			const status = 'VALID';
			contractEventListener.checkpointer = checkpointerStub;
			contractEventListener.options.replay = true;
			await contractEventListener._onEvent(event, blockNumber, transactionId, status);
			sinon.assert.calledWith(contractEventListener.eventCallback, null, event, Number(blockNumber), transactionId, status);
			sinon.assert.calledWith(checkpointerStub.save, 'transactionId', 10);
			sinon.assert.notCalled(contractEventListener.unregister);
		});

		it('should unregister if registration.unregister is set', async () => {
			const event = {name: 'eventName'};
			const blockNumber = '10';
			const transactionId = 'transactionId';
			const status = 'VALID';
			contractEventListener._registration.unregister = true;
			await contractEventListener._onEvent(event, blockNumber, transactionId, status);
			sinon.assert.calledWith(contractEventListener.eventCallback, null, event, Number(blockNumber), transactionId, status);
			sinon.assert.called(contractEventListener.unregister);
		});

		it ('should not save a checkpoint if the callback fails', async () => {
			const event = {name: 'eventName'};
			const blockNumber = '10';
			const transactionId = 'transactionId';
			const status = 'VALID';
			contractEventListener.eventCallback.throws(new Error());
			contractEventListener.checkpointer = checkpointerStub;
			contractEventListener.options.replay = true;
			await contractEventListener._onEvent(event, blockNumber, transactionId, status);
			sinon.assert.calledWith(contractEventListener.eventCallback, null, event, Number(blockNumber), transactionId, status);
			sinon.assert.notCalled(checkpointerStub.save);
		});

		it('should skip a transaction if it is in the checkpoint', async () => {
			contractEventListener.checkpointer = checkpointerStub;
			const checkpoint = {transactionIds: ['transactionId']};
			contractEventListener._firstCheckpoint = checkpoint;
			checkpointerStub.load.returns(checkpoint);
			const event = {name: 'eventName'};
			const blockNumber = '10';
			const transactionId = 'transactionId';
			const status = 'VALID';
			contractEventListener.options.replay = true;
			await contractEventListener._onEvent(event, blockNumber, transactionId, status);
			sinon.assert.notCalled(contractEventListener.eventCallback);
		});
	});

	describe('#_onError', () => {
		beforeEach(() => {
			eventHubStub._peer = 'peer';
			contractEventListener._registration = {};
			sandbox.spy(contractEventListener, 'unregister');
			sandbox.stub(contractEventListener, 'eventCallback');
			sandbox.stub(contractEventListener, '_registerWithNewEventHub');
		});

		it('should call the event callback with an error', () => {
			contractEventListener.eventHub = eventHubStub;
			const error = new Error();
			contractEventListener._onError(error);
			sinon.assert.calledWith(contractEventListener.eventCallback, error);
		});

		it('should update event hub availability and reregister if disconnected', async () => {
			const error = new EventHubDisconnectError('ChannelEventHub has been shutdown');
			contractEventListener.eventHub = eventHubStub;
			contractEventListener._registered = true;
			await contractEventListener._onError(error);
			sinon.assert.calledWith(eventHubManagerStub.updateEventHubAvailability, 'peer');
			sinon.assert.called(contractEventListener._registerWithNewEventHub);
			sinon.assert.calledWith(contractEventListener.eventCallback, error);
		});

		it('should call the error callback if the error is null', async () => {
			const error = null;
			contractEventListener.eventHub = eventHubStub;
			contractEventListener._registered = true;
			await contractEventListener._onError(error);
			sinon.assert.calledWith(contractEventListener.eventCallback, error);
		});
	});

	describe('#_registerWithNewEventHub', () => {
		beforeEach(() => {
			contractEventListener._registration = {};
			sandbox.spy(contractEventListener, 'unregister');
			sandbox.stub(contractEventListener, 'eventCallback');
			eventHubManagerStub.getReplayEventHub.returns(eventHubStub);
			eventHubManagerStub.getEventHub.returns(eventHubStub);
		});

		it('should call unregister, get a new event hub and reregister', async () => {
			sinon.stub(contractEventListener, 'register');
			await contractEventListener._registerWithNewEventHub();
			sinon.assert.called(contractEventListener.unregister);
			sinon.assert.called(eventHubManagerStub.getEventHub);
			sinon.assert.called(contractEventListener.register);
		});

		it('should get a replay event hub if a checkpointer is present', async () => {
			sinon.stub(contractEventListener, 'register');
			contractEventListener.checkpointer = checkpointerStub;
			contractEventListener.options.replay = true;
			await contractEventListener._registerWithNewEventHub();
			sinon.assert.called(contractEventListener.unregister);
			sinon.assert.called(eventHubManagerStub.getReplayEventHub);
			sinon.assert.called(contractEventListener.register);
		});

		it('should throw if options.fixedEventHub is true and no event hub is set', () => {
			contractEventListener.setEventHub(null, true);
			return expect(contractEventListener.register()).to.be.rejectedWith('No event hub given and option fixedEventHub is set');
		});

		it('should throw if options.fixedEventHub is true and no event hub is set', () => {
			contractEventListener.setEventHub(null, true);
			return expect(contractEventListener._registerWithNewEventHub()).to.be.rejectedWith('No event hub given and option fixedEventHub is set');
		});

		it('should get an new instance of the existing event hub', async () => {
			contractEventListener.checkpointer = checkpointerStub;
			eventHubStub._peer = 'peer';
			contractEventListener.setEventHub(eventHubStub, true);
			await contractEventListener._registerWithNewEventHub();

			sinon.assert.calledWith(eventHubManagerStub.getReplayEventHub, eventHubStub._peer);
		});

		it('should get the same existing event hub', async () => {
			eventHubStub._peer = 'peer';
			contractEventListener.setEventHub(eventHubStub, true);
			await contractEventListener._registerWithNewEventHub();

			sinon.assert.calledWith(eventHubManagerStub.getEventHub, eventHubStub._peer);
		});

		it('should get an existing event hub', async () => {
			eventHubStub._peer = 'peer';
			await contractEventListener._registerWithNewEventHub();

			sinon.assert.calledWith(eventHubManagerStub.getEventHub);
		});
	});

	describe('Checkpointing Behaviour', () => {
		let checkpointer;
		it('should set the block number and transaction ID', async () => {
			checkpointer = new InMemoryCheckpointer();
			contractEventListener = new ContractEventListener(contractStub, 'listener', 'event', (err, event) => {}, {replay: true, checkpointer: {factory: () => checkpointer}});
			contractEventListener.eventHub = eventHubStub;
			eventHubStub.registerChaincodeEvent.returns({});
			await contractEventListener.register();
			await contractEventListener._onEvent({}, 1, 'TRANSACTION_ID');
			const checkpoint = await checkpointer.load();
			expect(checkpoint.blockNumber).to.equal(1);
			expect(checkpoint.transactionIds).to.deep.equal(['TRANSACTION_ID']);
		});

		it('should update with a new block number', async () => {
			checkpointer = new InMemoryCheckpointer();
			contractEventListener = new ContractEventListener(contractStub, 'listener', 'event', (err, event) => {}, {replay: true, checkpointer: {factory: () => checkpointer}});
			contractEventListener.eventHub = eventHubStub;
			eventHubStub.registerChaincodeEvent.returns({});
			await contractEventListener.register();
			await contractEventListener._onEvent({}, 1, 'TRANSACTION_ID');
			await contractEventListener._onEvent({}, 1, 'TRANSACTION_ID_2');
			let checkpoint = await checkpointer.load();
			expect(checkpoint.blockNumber).to.equal(1);
			expect(checkpoint.transactionIds).to.deep.equal(['TRANSACTION_ID', 'TRANSACTION_ID_2']);
			await contractEventListener._onEvent({}, 2, 'TRANSACTION_ID_3');
			checkpoint = await checkpointer.load();
			expect(checkpoint.blockNumber).to.equal(2);
			expect(checkpoint.transactionIds).to.deep.equal(['TRANSACTION_ID_3']);
		});

		it('should set the start block', async () => {
			channelStub.queryInfo.resolves({height: '3'});
			checkpointer = new InMemoryCheckpointer();
			checkpointer.checkpoint = {blockNumber: 2, transactionIds: []};
			contractEventListener = new ContractEventListener(contractStub, 'listener', 'event', (err, event) => {}, {replay: true, checkpointer: {factory: () => checkpointer}});
			contractEventListener.eventHub = eventHubStub;
			eventHubStub.registerChaincodeEvent.returns({});
			await contractEventListener.register();
			expect(contractEventListener.options.startBlock).to.be.undefined;
		});

		it('should not set the start block', async () => {
			channelStub.queryInfo.resolves({height: '3'});
			checkpointer = new InMemoryCheckpointer();
			checkpointer.checkpoint = {blockNumber: 1, transactionIds: []};
			contractEventListener = new ContractEventListener(contractStub, 'listener', 'event', (err, event) => {}, {replay: true, checkpointer: {factory: () => checkpointer}});
			contractEventListener.eventHub = eventHubStub;
			eventHubStub.registerChaincodeEvent.returns({});
			await contractEventListener.register();
			expect(contractEventListener.options.startBlock.toInt()).to.equal(2);
		});

		it('should skip a transaction that is already checkpointed', async () => {
			checkpointer = new InMemoryCheckpointer();
			let calls = 0;
			contractEventListener = new ContractEventListener(contractStub, 'listener', 'event', (err, event) => {
				if (err) {
					return;
				}
				calls++;
			}, {replay: true, checkpointer: {factory: () => checkpointer}});
			contractEventListener.eventHub = eventHubStub;
			eventHubStub.registerChaincodeEvent.returns({});
			await contractEventListener.register();
			await contractEventListener._onEvent({}, 1, 'TRANSACTION_ID');
			await contractEventListener._onEvent({}, 1, 'TRANSACTION_ID_2');
			await contractEventListener._onEvent({}, 1, 'TRANSACTION_ID_2');
			expect(calls).to.equal(2);
		});
	});
});
