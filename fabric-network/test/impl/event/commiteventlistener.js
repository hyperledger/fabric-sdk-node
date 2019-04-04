/**
 * Copyright 2019 Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const sinon = require('sinon');

const Channel = require('fabric-client/lib/Channel');
const Contract = require('fabric-network/lib/contract');
const Network = require('fabric-network/lib/network');
const EventHubManager = require('fabric-network/lib/impl/event/eventhubmanager');
const ChannelEventHub = require('fabric-client/lib/ChannelEventHub');
const CommitEventListener = require('fabric-network/lib/impl/event/commiteventlistener');

describe('CommitEventListener', () => {
	let sandbox;
	let eventHubManagerStub;
	let eventHubStub;
	let contractStub;
	let networkStub;
	let channelStub;
	let listener;
	let callback;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		eventHubStub = sandbox.createStubInstance(ChannelEventHub);
		eventHubStub._transactionRegistrations = {};
		contractStub = sandbox.createStubInstance(Contract);
		networkStub = sandbox.createStubInstance(Network);
		channelStub = sandbox.createStubInstance(Channel);
		networkStub.getChannel.returns(channelStub);
		contractStub.getNetwork.returns(networkStub);
		eventHubManagerStub = sinon.createStubInstance(EventHubManager);
		eventHubManagerStub.getPeers.returns(['peer1']);
		networkStub.getEventHubManager.returns(eventHubManagerStub);

		callback = () => {};
		listener = new CommitEventListener(networkStub, 'transactionId', callback, {});
	});

	afterEach(() => {
		sandbox.reset();
	});

	describe('#constructor', () => {
		it('should set the listener name and transactionId', () => {
			expect(listener.transactionId).to.equal('transactionId');
			expect(listener.listenerName).to.match(/^transactionId[.0-9]+$/);
		});
	});

	describe('#register', () => {
		beforeEach(() => {
			sandbox.stub(listener, '_registerWithNewEventHub');
			// sandbox.stub(eventHubManagerStub, 'getEventHub');
		});

		it('should grab a new event hub if one isnt given', async () => {
			await listener.register();
			sinon.assert.called(listener._registerWithNewEventHub);
		});

		it('should assign a new event hub if given on has registrations', async () => {
			const newEventHub = sandbox.createStubInstance(ChannelEventHub);
			newEventHub._transactionRegistrations = {};
			eventHubManagerStub.getEventHub.returns(newEventHub);
			listener.eventHub = eventHubStub;
			eventHubStub._peer = 'peer';
			eventHubStub._transactionRegistrations = {transactionId: 'registration'};
			await listener.register();
			sinon.assert.calledWith(eventHubManagerStub.getEventHub, 'peer');
		});

		it('should call registerTxEvent', async () => {
			listener.eventHub = eventHubStub;
			await listener.register();
			sinon.assert.calledWith(
				eventHubStub.registerTxEvent,
				'transactionId',
				sinon.match.func,
				sinon.match.func,
				{unregister: true}
			);
			sinon.assert.called(eventHubStub.connect);
			expect(listener._registered).to.be.true;
		});

		it('should assign an an event hub instance from the same peer if options.fixedEventHub is true', async () => {
			eventHubManagerStub.getFixedEventHub.returns(eventHubStub);
			eventHubStub._peer = 'peer';
			listener.setEventHub(eventHubStub, true);
			eventHubStub._transactionRegistrations = {transactionId: {}};
			await listener.register();
			sinon.assert.calledWith(eventHubManagerStub.getFixedEventHub, eventHubStub._peer);
		});
	});

	describe('#unregister', () => {
		it('should not call ChannelEventHub.unregisterTxEvent', () => {
			listener.unregister();
			sinon.assert.notCalled(eventHubStub.unregisterTxEvent);
		});

		it('should call ChannelEventHub.unregisterBlockEvent', () => {
			listener.eventHub = eventHubStub;
			listener.register();
			listener.unregister();
			sinon.assert.calledWith(eventHubStub.unregisterTxEvent, 'transactionId');
		});
	});

	describe('#_onEvent', () => {
		beforeEach(() => {
			listener._registration = {};
			sandbox.spy(listener, 'unregister');
			sandbox.stub(listener, 'eventCallback');
		});

		it('should call the event callback', async () => {
			const blockNumber = '10';
			const transactionId = 'transactionId';
			const status = 'VALID';
			await listener._onEvent(transactionId, status, blockNumber);
			sinon.assert.calledWith(listener.eventCallback, null, transactionId, status, Number(blockNumber));
			sinon.assert.notCalled(listener.unregister);
		});

		it('should unregister if registration.unregister is set', async () => {
			const blockNumber = '10';
			const transactionId = 'transactionId';
			const status = 'VALID';
			listener._registration.unregister = true;
			await listener._onEvent(transactionId, status, blockNumber);
			sinon.assert.calledWith(listener.eventCallback, null, transactionId, status, 10);
			sinon.assert.called(listener.unregister);
		});

		it('should not fail if eventCallback throws', async () => {
			const blockNumber = '10';
			const transactionId = 'transactionId';
			const status = 'VALID';
			listener.eventCallback.throws(new Error('forced error'));
			await listener._onEvent(transactionId, status, blockNumber);
		});
	});

	describe('#_onError', () => {
		beforeEach(() => {
			eventHubStub._peer = 'peer';
			listener._registration = {};
			sandbox.spy(listener, 'unregister');
			sandbox.stub(listener, 'eventCallback');
		});
		it('should call eventCallback', () => {
			listener.eventHub = eventHubStub;
			const error = new Error();
			listener._onError(error);
			sinon.assert.calledWith(listener.eventCallback, error);
		});
	});

	describe('#setEventHub', () => {
		it('should set the eventhub', () => {
			listener.setEventHub('new event hub');
			expect(listener.eventHub).to.equal('new event hub');
		});

		it('should set options.fixedEventHub', () => {
			listener.setEventHub('new event hub', true);
			expect(listener.options.fixedEventHub).to.be.true;
		});
	});

	describe('#_registerWithNewEventHub', () => {
		beforeEach(() => {
			listener._registration = {};
			sandbox.spy(listener, 'unregister');
			sandbox.stub(listener, 'eventCallback');
			eventHubManagerStub.getReplayEventHub.returns(eventHubStub);
			sinon.stub(listener, 'register');
		});

		it('should call the correct methods', async () => {
			await listener._registerWithNewEventHub();
			sinon.assert.called(eventHubManagerStub.getReplayEventHub);
			expect(listener.eventHub).to.equal(eventHubStub);
			expect(listener.options.disconnect).to.be.true;
			sinon.assert.called(listener.register);
		});

		it('should call EventHubManager.getFixedEventHub if options.fixedEventHub', async () => {
			eventHubStub._peer = 'peer';
			listener.eventHub = eventHubStub;
			listener.options.fixedEventHub = true;
			await listener._registerWithNewEventHub();
			sinon.assert.calledWith(eventHubManagerStub.getFixedEventHub, eventHubStub._peer);
		});

		it('should unregister if the listener is already registered', async () => {
			listener._registered = true;
			await listener._registerWithNewEventHub();
			sinon.assert.called(listener.unregister);
		});

		it('should throw if options.fixedEventHub is set and no event hub is given', () => {
			listener.options.fixedEventHub = true;
			return expect(listener._registerWithNewEventHub()).to.be.rejectedWith();
		});
	});

	describe('#_isAlreadyRegistered', () => {
		it('should throw if no event hub is given', () => {
			expect(() => listener._isAlreadyRegistered()).to.throw(/Event hub not given/);
		});

		it('should return false if no registration exists', () => {
			expect(listener._isAlreadyRegistered(eventHubStub)).to.be.false;
		});

		it('should return true if registration exists', () => {
			eventHubStub._transactionRegistrations = {transactionId: 'registration'};
			expect(listener._isAlreadyRegistered(eventHubStub)).to.be.true;
		});
	});
});
