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
	let network;
	let channelStub;
	let eventHubStub;
	let checkpointerStub;
	let eventHubManagerStub;
	let contractEventListener;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		contractStub = sandbox.createStubInstance(Contract);
		contractStub.getChaincodeId.returns('chaincodeid');
		network = new Network();
		channelStub = sandbox.createStubInstance(Channel);
		channelStub.getName.returns('channelName');
		sandbox.stub(network, 'getChannel').returns(channelStub);
		contractStub.getNetwork.returns(network);
		eventHubManagerStub = sinon.createStubInstance(EventHubManager);
		sandbox.stub(network, 'getEventHubManager').returns(eventHubManagerStub);
		eventHubStub = sandbox.createStubInstance(ChannelEventHub);
		eventHubStub.connect.yields((filtered) => {
			eventHubStub.isconnected.returns(true);
			return eventHubStub._filtered_stream = filtered;
		});
		eventHubManagerStub.getPeers.returns(['peer1']);
		eventHubManagerStub.getEventHub.returns(eventHubStub);
		eventHubManagerStub.getReplayEventHub.returns(eventHubStub);
		checkpointerStub = new Checkpointer();
		sandbox.stub(checkpointerStub, 'load');
		sandbox.stub(checkpointerStub, 'save');
		checkpointerStub.load.returns({});
		contractEventListener = new ContractEventListener(contractStub, 'contractTest', 'eventName', () => {}, {replay: true, filtered: true});
		eventHubStub.isFiltered.returns(true);
	});

	afterEach(() => {
		sandbox.reset();
	});

	describe('#contructor', () => {
		it('should set the listener name', () => {
			expect(contractEventListener.eventName).to.equal('eventName');
		});

		it('should set as_array on clientOptions with replay on', () => {
			const listener = new ContractEventListener(contractStub, 'contractAsArrayTest', 'eventName', () => {}, {asArray: true, replay: true});
			expect(listener.clientOptions.as_array).to.be.true;
		});

		it('should set as_array on clientOptions with replay off', () => {
			const listener = new ContractEventListener(contractStub, 'contractReplayTest', 'eventName', () => {}, {asArray: true, replay: false});
			expect(listener.clientOptions.as_array).to.be.true;
		});

		it('should set as_array to false on clientOptions with replay off', () => {
			const listener = new ContractEventListener(contractStub, 'contractReplayOffTest2', 'eventName', () => {}, {asArray: false, replay: false});
			expect(listener.clientOptions.as_array).to.be.false;
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
				{as_array: true}
			);
			sinon.assert.calledWith(contractEventListener._onEvent.bind, contractEventListener);
			sinon.assert.calledWith(contractEventListener._onError.bind, contractEventListener);
			sinon.assert.called(eventHubStub.connect);
			expect(contractEventListener._registered).to.be.true;
		});

		it('should call _registerWithNewEventHub', async () => {
			sandbox.spy(contractEventListener, '_registerWithNewEventHub');
			await contractEventListener.register();
			sinon.assert.called(contractEventListener._registerWithNewEventHub);
		});

		it('should automatically set as_array on event registration if replay is used', async () => {
			contractEventListener.eventHub = eventHubStub;
			await contractEventListener.register();
			sinon.assert.calledWith(
				eventHubStub.registerChaincodeEvent,
				'chaincodeid',
				'eventName',
				sinon.match.func,
				sinon.match.func,
				{as_array: true}
			);
		});

		it('should return if _abandonEventHubConnect is true', async () => {
			sandbox.spy(contractEventListener, '_registerWithNewEventHub');
			sandbox.spy(contractEventListener, '_unsetEventHubConnectTimeout');
			contractEventListener._eventHubConnectTimeout = true;
			contractEventListener._abandonEventHubConnect = true;
			await contractEventListener.register();
			sinon.assert.called(contractEventListener._unsetEventHubConnectTimeout);
			sinon.assert.notCalled(contractEventListener._registerWithNewEventHub);
		});

		it('should call _setEventHubConnectWait if its not the first registration', async () => {
			sandbox.stub(contractEventListener, '_setEventHubConnectWait');
			contractEventListener._firstRegistrationAttempt = false;
			await contractEventListener.register();
			sinon.assert.called(contractEventListener._setEventHubConnectWait);
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

		it('should call the event callback', async () => {
			const event = {name: 'eventName'};
			const blockNumber = '10';
			const transactionId = 'transactionId';
			const status = 'VALID';
			await contractEventListener._onEvent(event, blockNumber, transactionId, status);
			sinon.assert.calledWith(contractEventListener.eventCallback, null, event, Number(blockNumber), transactionId, status);
			sinon.assert.notCalled(checkpointerStub.save);
			sinon.assert.notCalled(contractEventListener.unregister);
		});

		it('should emit multiple events events if received as an array', async () => {
			const blockNumber = '10';
			const status = 'VALID';
			const events = [
				{chaincode_event: {name: 'eventName0'}, tx_id: '1', block_num: blockNumber, tx_status: status},
				{chaincode_event: {name: 'eventName1'}, tx_id: '2', block_num: blockNumber, tx_status: status}
			];
			await contractEventListener._onEvent(events);
			sinon.assert.calledTwice(contractEventListener.eventCallback);
			sinon.assert.calledWith(contractEventListener.eventCallback, null, events[0].chaincode_event, Number(blockNumber), '1', status);
			sinon.assert.calledWith(contractEventListener.eventCallback, null, events[1].chaincode_event, Number(blockNumber), '2', status);
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

		it('should save multiple checkpoints if events received as an array', async () => {
			const blockNumber = '10';
			const status = 'VALID';
			const events = [
				{chaincode_event: {name: 'eventName0'}, tx_id: '1', block_num: blockNumber, tx_status: status},
				{chaincode_event: {name: 'eventName1'}, tx_id: '2', block_num: blockNumber, tx_status: status}
			];
			contractEventListener.checkpointer = checkpointerStub;
			contractEventListener.options.replay = true;
			contractEventListener.clientOptions.as_array = true;
			await contractEventListener._onEvent(events);

			sinon.assert.calledTwice(checkpointerStub.save);
			sinon.assert.calledWith(checkpointerStub.save, '1', Number(blockNumber));
			sinon.assert.calledWith(checkpointerStub.save, '2', Number(blockNumber));
			sinon.assert.notCalled(contractEventListener.unregister);
		});

		it('should unregister if registration.unregister is set', async () => {
			const event = {name: 'eventName'};
			const blockNumber = '10';
			const transactionId = 'transactionId';
			const status = 'VALID';
			contractEventListener.checkpointer = checkpointerStub;
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
			const checkpoint = {blockNumber: 10, transactionIds: ['transactionId']};
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

		it('should deal with as_array checkpoints', async () => {
			contractEventListener.checkpointer = checkpointerStub;
			checkpointerStub.load.resolves({1: {blockNumber: 1, transactionIds: ['txId']}});
			const event = {name: 'eventName'};
			const blockNumber = '2';
			const transactionId = 'txId2';
			const status = 'VALID';
			contractEventListener.options.replay = true;
			await contractEventListener._onEvent(event, blockNumber, transactionId, status);
			sinon.assert.called(contractEventListener.eventCallback);
		});

		it('should emit a list of events if asArray is on', async () => {
			contractEventListener.options.asArray = true;
			const events = [{eventId: 1}, {eventId: 2}];
			await contractEventListener._onEvent(events);
			sinon.assert.calledWith(contractEventListener.eventCallback, events);
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
			expect(contractEventListener.clientOptions.startBlock.toInt()).to.equal(2);
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
