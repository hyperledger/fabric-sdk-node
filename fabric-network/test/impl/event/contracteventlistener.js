/**
 * Copyright 2019 Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const Long = require('long');
const rewire = require('rewire');
const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
chai.use(require('chai-as-promised'));

const EventService = require('fabric-common/lib/EventService');
const Network = require('./../../../lib/network');
const Contract = require('./../../../lib/contract');
const EventServiceManager = require('./../../../lib/impl/event/eventservicemanager');
const ContractEventListener = rewire('fabric-network/lib/impl/event/contracteventlistener');
const FileSystemCheckpointer = require('./../../../lib/impl/event/filesystemcheckpointer');

describe('ContractEventListener', () => {
	let sandbox;
	let FakeLogger;
	let eventService;
	let checkpointer;
	let network;
	let contract;
	let eventServiceManager;
	let baseListener;
	let revert;

	let listener;

	beforeEach(() => {
		revert = [];
		sandbox = sinon.createSandbox();
		FakeLogger = {
			debug: () => {
			},
			error: () => {
			},
			warn: () => {
			}
		};
		sandbox.stub(FakeLogger);
		revert.push(ContractEventListener.__set__('logger', FakeLogger));
		baseListener = sinon.stub();
		checkpointer = sandbox.createStubInstance(FileSystemCheckpointer);
		checkpointer.check.returns(false);
		checkpointer.save.resolves();
		eventServiceManager = sandbox.createStubInstance(EventServiceManager);
		eventServiceManager.startEventService.resolves();
		eventService = sandbox.createStubInstance(EventService);
		eventService.registerChaincodeListener = sinon.stub().returns(baseListener);
		eventServiceManager.getEventService = sinon.stub().returns(eventService);
		eventServiceManager.getReplayEventService = sinon.stub().returns(eventService);
		network = sandbox.createStubInstance(Network);
		network.eventServiceManager = eventServiceManager;
		contract = sandbox.createStubInstance(Contract);
		contract.network = network;

		listener = new ContractEventListener(contract, 'event', () => {}, {replay: true});
		listener.eventService = eventService;
		listener.checkpointer = checkpointer;
	});

	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sandbox.restore();
	});

	describe('#_registerListener', () => {
		it('should register a chaincode event', () => {
			listener._registerListener();
			expect(listener.registration).to.be.equal(baseListener);
		});
	});


	describe('#onEvent', () => {
		const chaincodeEvents = [];
		const blockNumber = Long.fromValue(10);

		beforeEach(() => {
			listener.registration = baseListener;
			sandbox.stub(listener, 'eventCallback');
		});

		it('should handle the endblockReceived', async () => {
			listener.eventServiceOptions = {
				endBlock: Long.fromValue(10)
			};
			const event = {
				endBlockReceived: true,
				blockNumber
			};

			await listener.onEvent(null, event);
			sinon.assert.notCalled(listener.eventCallback);
			sinon.assert.notCalled(checkpointer.save);
		});

		it('should handle the endblockReceived received too soon', async () => {
			listener.eventServiceOptions = {
				endBlock: Long.fromValue(11)
			};
			const event = {
				endBlockReceived: true,
				blockNumber
			};

			await listener.onEvent(null, event);
			sinon.assert.called(listener.eventCallback);
		});

		it('should handle the endblockReceived when not defined', async () => {
			listener.eventServiceOptions = {};
			const event = {
				endBlockReceived: true,
				blockNumber
			};

			await listener.onEvent(null, event);
			sinon.assert.called(listener.eventCallback);
		});

		it('should call the event callback', async () => {
			const event = {
				blockNumber,
				chaincodeEvents
			};

			await listener.onEvent(null, event);
			sinon.assert.calledWith(listener.eventCallback, null, blockNumber.toString(), chaincodeEvents);
			sinon.assert.calledWith(checkpointer.check, '10');
			sinon.assert.calledWith(checkpointer.save, '10');
		});

		it('should call the event callback with no checkpointer', async () => {
			listener.checkpointer = null;
			const event = {
				blockNumber,
				chaincodeEvents
			};

			await listener.onEvent(null, event);
			sinon.assert.calledWith(listener.eventCallback, null, blockNumber.toString(), chaincodeEvents);
		});

		it('should call the event callback with error', async () => {
			const error = new Error('SOMETHING BAD');

			await listener.onEvent(error);
			sinon.assert.calledWith(listener.eventCallback, error);
		});

		it('should not call the event callback when checkpoint has seen', async () => {
			checkpointer.check.returns(true);
			const event = {
				blockNumber,
				chaincodeEvents
			};

			await listener.onEvent(null, event);
			sinon.assert.notCalled(listener.eventCallback);
			sinon.assert.calledWith(checkpointer.check, '10');
			sinon.assert.calledWith(checkpointer.save, '10');
		});

		it('should call the event callback and have an error', async () => {
			listener.eventCallback = sinon.stub().rejects(new Error('CALLBACK ERROR'));

			const event = {
				blockNumber,
				chaincodeEvents
			};
			await listener.onEvent(null, event);
			sinon.assert.calledWith(checkpointer.check, '10');
			sinon.assert.calledWith(checkpointer.save, '10');
			sinon.assert.calledWith(FakeLogger.error, '%s - Error executing callback: %s');
		});
	});
});
