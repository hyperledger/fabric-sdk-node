/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');

const EventService = require('fabric-common/lib/EventService');
const Network = require('./../../../lib/network');
const EventServiceManager = require('./../../../lib/impl/event/eventservicemanager');
const BaseEventListener = require('./../../../lib/impl/event/baseeventlistener');
const FileSystemCheckpointer = require('./../../../lib/impl/event/filesystemcheckpointer');

describe('BaseEventListener', () => {
	let sandbox;
	let network;
	let checkpointer;
	let eventServiceManager;
	let eventService;

	let testListener;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		checkpointer = sandbox.createStubInstance(FileSystemCheckpointer);
		checkpointer.getStartBlock.resolves(3);
		eventServiceManager = sandbox.createStubInstance(EventServiceManager);
		eventServiceManager.startEventService.resolves();
		eventService = sandbox.createStubInstance(EventService);
		eventServiceManager.getEventService = sinon.stub().returns(eventService);
		eventServiceManager.getReplayEventService = sinon.stub().returns(eventService);
		network = sandbox.createStubInstance(Network);
		network.eventServiceManager = eventServiceManager;

		testListener = new BaseEventListener(network, 'testListener', (err) => {});
		testListener._registerListener = sinon.stub();

	});

	afterEach(() => {
		sandbox.reset();
	});

	describe('#constructor', () => {
		it('should set the correct properties on instantiation', () => {
			const callback = (err) => {};
			const listener = new BaseEventListener(network, callback, {option: 'anoption'});
			expect(listener.network).to.equal(network);
			expect(listener.eventCallback).to.equal(callback);
			expect(listener.checkpointer).to.be.null;
			expect(listener.replay).to.be.false;
			expect(listener.registration).to.be.null;
			expect(listener.eventServiceOptions.blockType).to.be.equal('filtered');
			expect(listener.eventServiceOptions.unregister).to.be.equal(false);
		});

		it('should options.filtered=false', () => {
			const listener = new BaseEventListener(network, () => {}, {filtered: false});
			expect(listener.eventServiceOptions.blockType).to.be.equal('full');
		});

		it('should options.filtered=false and private=true', () => {
			const listener = new BaseEventListener(network, () => {}, {filtered: false, privateData: true});
			expect(listener.eventServiceOptions.blockType).to.be.equal('private');
		});

		it('should options.unregister=true', () => {
			const listener = new BaseEventListener(network, () => {}, {unregister: true});
			expect(listener.eventServiceOptions.unregister).to.be.equal(true);
		});

		it('should set startBlock 0 endblock 2', () => {
			const callback = (err) => {};
			const listener = new BaseEventListener(network, callback, {startBlock: 0, endBlock: 2});
			expect(listener.eventServiceOptions.startBlock.low).to.equal(0);
			expect(listener.eventServiceOptions.endBlock.low).to.equal(2);
			expect(listener.checkpointer).to.be.equal(null);
			expect(listener.replay).to.be.true;
		});

		it('should set startBlock 2 endblock 0', () => {
			const callback = (err) => {};
			const listener = new BaseEventListener(network, callback, {startBlock: 2, endBlock: 0});
			expect(listener.eventServiceOptions.startBlock.low).to.equal(2);
			expect(listener.eventServiceOptions.endBlock.low).to.equal(0);
			expect(listener.checkpointer).to.be.equal(null);
			expect(listener.replay).to.be.true;
		});

		it('should set replay false', () => {
			const callback = (err) => {};
			const listener = new BaseEventListener(network, callback, {checkpointer});
			expect(listener.checkpointer).to.be.equal(checkpointer);
			expect(listener.replay).to.be.false;
		});
		it('should set replay true', () => {
			const callback = (err) => {};
			const listener = new BaseEventListener(network, callback, {checkpointer, replay: true});
			expect(listener.checkpointer).to.be.equal(checkpointer);
			expect(listener.replay).to.be.true;
		});
		it('should get an error when setting privatedata and filtered', () => {
			const callback = (err) => {};
			try {
				new BaseEventListener(network, callback, {filtered: true, privateData: true});
				expect(1, 'should have gotten an error').to.be.false;
			} catch (error) {
				expect(error.message).to.contain('Private data only available when receiving full blocks');
			}
		});
	});

	describe('#register', () => {
		it('should throw if the listener is already registered', async () => {
			testListener.registration = true;
			try {
				await testListener.register();
				expect(1, 'should have gotten an error').to.be.false;
			} catch (error) {
				expect(error.message).to.contain('Listener already registered');
			}
		});

		it('should get new replay event service', async () => {
			testListener.registration = false;
			testListener.eventService = null;
			testListener.replay = true;
			await testListener.register();
			expect(testListener.eventService).to.be.equal(eventService);
			sinon.assert.calledOnce(eventServiceManager.getReplayEventService);
		});

		it('should get non replay event service', async () => {
			testListener.registration = false;
			testListener.eventService = null;
			testListener.replay = false;
			await testListener.register();
			expect(testListener.eventService).to.be.equal(eventService);
			sinon.assert.calledOnce(eventServiceManager.getEventService);
			sinon.assert.calledOnce(eventServiceManager.startEventService);
		});

		it('should throw if no event services available', async () => {
			testListener.eventService = null;
			testListener.replay = false;
			eventServiceManager.getEventService = sinon.stub().returns(null);
			try {
				await testListener.register();
				expect(1, 'should have gotten an error').to.be.false;
			} catch (error) {
				expect(error.message).to.contain('No event service available');
			}
		});

		it('should get startblock from checkpointer', async () => {
			testListener.registration = false;
			testListener.eventService = null;
			testListener.replay = true;
			testListener.checkpointer = checkpointer;
			testListener.eventServiceOptions.startBlock = undefined;
			await testListener.register();
			expect(testListener.eventServiceOptions.startBlock).to.equal(3);
		});

		it('should throw if event services does not start', async () => {
			testListener.eventService = eventService;
			eventServiceManager.startEventService.rejects(Error('FAILED'));
			try {
				await testListener.register();
				expect(1, 'should have gotten an error').to.be.false;
			} catch (error) {
				expect(error.message).to.contain('FAILED');
			}
		});
	});

	describe('#unregister', () => {
		it('should unregister', () => {
			testListener.registration = sinon.stub();
			testListener.registration.eventService = sinon.stub();
			testListener.registration.eventService.unregisterEventListener = sinon.stub();
			network.listeners = new Map();
			network.listeners.set(testListener, testListener);
			testListener.unregister();
			expect(network.listeners.has(testListener)).to.be.false;
		});
		it('should unregister with no registration', () => {
			testListener.registration = null;
			network.listeners = new Map();
			network.listeners.set(testListener, testListener);
			testListener.unregister();
			expect(network.listeners.has(testListener)).to.be.false;
		});
		it('should unregister with listener on the network', () => {
			testListener.registration = sinon.stub();
			testListener.registration.eventService = sinon.stub();
			testListener.registration.eventService.unregisterEventListener = sinon.stub();
			network.listeners = new Map();
			network.listeners.set(testListener, testListener);
			testListener.unregister();
			expect(testListener.registration).to.be.null;
		});
		it('should unregister with listener not on the network', () => {
			testListener.registration = sinon.stub();
			testListener.registration.eventService = sinon.stub();
			testListener.registration.eventService.unregisterEventListener = sinon.stub();
			network.listeners = new Map();
			testListener.unregister();
			expect(testListener.registration).to.be.null;
		});
	});
});
