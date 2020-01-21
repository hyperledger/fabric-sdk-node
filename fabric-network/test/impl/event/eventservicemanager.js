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
const rewire = require('rewire');

const {Channel, Client, EventService, Endorser, Eventer} = require('fabric-common');
const Network = require('fabric-network/lib/network');
const Gateway = require('fabric-network/lib/gateway');
const EventServiceManager = require('fabric-network/lib/impl/event/eventservicemanager');
const EventServiceManagerRewire = rewire('fabric-network/lib/impl/event/eventservicemanager');
const EventServiceStrategies = require('fabric-network/lib/impl/event/defaulteventhandlerstrategies');
const QueryHandlerStrategies = require('fabric-network/lib/impl/query/queryhandlerstrategies');

describe('EventServiceManager', () => {
	let sandbox;
	let network;
	let gateway;
	let channel;
	let client;
	let endorser;
	let eventer;
	let eventService;

	const endpoint = {
		url: 'grpcs://peer1.com'
	};

	let eventServiceManager;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		channel = sandbox.createStubInstance(Channel);
		network = sandbox.createStubInstance(Network);
		network.bret = 'bret';
		gateway = sandbox.createStubInstance(Gateway);
		client = sandbox.createStubInstance(Client);
		endorser = sandbox.createStubInstance(Endorser);
		eventer = sandbox.createStubInstance(Eventer);
		eventService = sandbox.createStubInstance(EventService);
		eventService.name = 'peer1';

		gateway.identityContext = 'idx';
		gateway.getOptions.returns({
			query: {
				timeout: 3, // 3 seconds
				strategy: QueryHandlerStrategies.MSPID_SCOPE_SINGLE
			},
			transaction: {
				endorseTimeout: 30, // 30 seconds
				commitTimeout: 300, // 5 minutes
				strategy: EventServiceStrategies.MSPID_SCOPE_ALLFORTX
			},
			discovery: {
				enabled: false,
				asLocalhost: false
			}
		});

		channel.client = client;
		network.channel = channel;
		network.gateway = gateway;
		client.newEventer.returns(eventer);
		channel.newEventService.returns(eventService);
		channel.getEndorsers.returns([endorser]);
		endorser.endpoint = endpoint;
		endorser.name = 'peer1';
		eventer.endpoint = endpoint;

		eventServiceManager = new EventServiceManager(network);
		eventServiceManager.eventServicesFull = sinon.createStubInstance(Map);
		eventServiceManager.eventServicesPrivate = sinon.createStubInstance(Map);
		eventServiceManager.eventServicesFiltered = sinon.createStubInstance(Map);
		eventServiceManager.eventServicesReplay = sinon.createStubInstance(Map);
	});

	afterEach(() => {
		sandbox.reset();
	});

	describe('#constructor', () => {
		it('should set the right parameters', () => {
			const em = new EventServiceManager(network);
			expect(em.network).to.equal(network);
		});
	});

	describe('#getEventService', () => {
		it('should return an existing event service from filtered', () => {
			eventServiceManager.eventServicesFiltered.get.returns(eventService);

			let result = eventServiceManager.getEventService('filtered');
			expect(result).to.equal(eventService);
			result = eventServiceManager.getEventService('filtered');
			expect(result).to.equal(eventService);
		});
		it('should return an existing event service from full', () => {
			eventServiceManager.eventServicesFull.get.returns(eventService);

			const result = eventServiceManager.getEventService('full');
			expect(result).to.equal(eventService);
		});
		it('should return an existing event service from private', () => {
			eventServiceManager.eventServicesPrivate.get.returns(eventService);

			const result = eventServiceManager.getEventService('private');
			expect(result).to.equal(eventService);
		});
		it('should return an new event service from filtered', () => {
			eventServiceManager.newEventService = sinon.stub().returns(eventService);

			const result = eventServiceManager.getEventService('filtered');
			expect(result).to.equal(eventService);
			sinon.assert.calledWith(eventServiceManager.newEventService, [endorser], 'peer1');
		});
		it('should return an new event service from full', () => {
			eventServiceManager.newEventService = sinon.stub().returns(eventService);

			const result = eventServiceManager.getEventService('full');
			expect(result).to.equal(eventService);
			sinon.assert.calledWith(eventServiceManager.newEventService, [endorser], 'peer1');
		});
		it('should return an new event service from private', () => {
			eventServiceManager.newEventService = sinon.stub().returns(eventService);

			const result = eventServiceManager.getEventService('private');
			expect(result).to.equal(eventService);
			sinon.assert.calledWith(eventServiceManager.newEventService, [endorser], 'peer1');
		});
	});

	describe('#getEventServices', () => {
		it('should return an existing event service from existing peer', () => {
			eventServiceManager.eventServicesFiltered.get.returns(eventService);

			let result = eventServiceManager.getEventServices([endorser]);
			expect(result[0]).to.equal(eventService);
			result = eventServiceManager.getEventServices([endorser]);
			expect(result[0]).to.equal(eventService);
		});
		it('should return an existing event service from selected peer', () => {
			eventServiceManager.eventServicesFull.get.returns(eventService);

			let result = eventServiceManager.getEventServices();
			expect(result[0]).to.equal(eventService);
			result = eventServiceManager.getEventServices();
			expect(result[0]).to.equal(eventService);
		});
		it('should return an new event service from existing peer', () => {
			eventServiceManager.newEventService = sinon.stub().returns(eventService);

			const result = eventServiceManager.getEventServices([endorser]);
			expect(result[0]).to.equal(eventService);
		});
		it('should return an new event service from selected peer', () => {
			eventServiceManager.newEventService = sinon.stub().returns(eventService);

			const result = eventServiceManager.getEventServices();
			expect(result[0]).to.equal(eventService);
		});
	});

	describe('#getReplayEventService', () => {
		it('should return an existing event service from existing peer', () => {
			eventServiceManager.eventServicesReplay.get.returns(eventService);

			let result = eventServiceManager.getReplayEventService(endorser);
			expect(result).to.equal(eventService);
			result = eventServiceManager.getReplayEventService(endorser);
			expect(result).to.equal(eventService);
		});
		it('should return an existing event service from selected peers', () => {
			eventServiceManager.eventServicesFull.get.returns(eventService);

			let result = eventServiceManager.getReplayEventService();
			expect(result).to.equal(eventService);
			result = eventServiceManager.getReplayEventService();
			expect(result).to.equal(eventService);
		});
		it('should return an new event service from existing peer', () => {
			eventServiceManager.newEventService = sinon.stub().returns(eventService);

			const result = eventServiceManager.getReplayEventService(endorser);
			expect(result).to.equal(eventService);
			sinon.assert.calledWith(eventServiceManager.newEventService, [endorser], 'peer1');
		});
		it('should return an new event service from selected peers', () => {
			eventServiceManager.newEventService = sinon.stub().returns(eventService);

			const result = eventServiceManager.getReplayEventService();
			expect(result).to.equal(eventService);
			sinon.assert.calledWith(eventServiceManager.newEventService, [endorser], 'peer1');
		});
	});

	describe('#newEventService', () => {
		it('should return an new event service from existing peers with no name', () => {
			eventServiceManager.eventServicesReplay.get.returns(eventService);

			const result = eventServiceManager.newEventService([endorser]);
			expect(result).to.equal(eventService);
		});
		it('should return an new event service from existing peers with name', () => {
			eventServiceManager.eventServicesReplay.get.returns(eventService);

			const result = eventServiceManager.newEventService([endorser], 'somename');
			expect(result).to.equal(eventService);
			sinon.assert.calledWith(eventService.setTargets, [eventer]);
		});
	});

	describe('#startEventService', () => {
		it('should start a started event service', async () => {
			eventService.isStarted.returns(true);

			await eventServiceManager.startEventService(eventService);
			sinon.assert.notCalled(eventService.send);
		});
		it('should start a started event service with options', async () => {
			eventService.isStarted.returns(true);
			const options = {nothing: 'nothing'};

			await eventServiceManager.startEventService(eventService, options);
			sinon.assert.notCalled(eventService.send);
		});
		it('should start a non started event service', async () => {
			eventService.isStarted.returns(false);
			eventService.send.resolves();

			await eventServiceManager.startEventService(eventService);
			sinon.assert.called(eventService.send);
		});
		it('should start a non started event service with options', async () => {
			eventService.isStarted.returns(false);
			eventService.send.resolves();
			const options = {nothing: 'nothing'};

			await eventServiceManager.startEventService(eventService, options);
			sinon.assert.calledWith(eventService.send, options);
		});
		it('should throw error to started event service with options replay', async () => {
			eventService.isStarted.returns(true);
			eventService.send.resolves();
			const options = {replay: true};

			try {
				await eventServiceManager.startEventService(eventService, options);
				expect(1), 'should have thrown an error'.to.be.false;
			} catch (error) {
				expect(error.message).to.contain('EventService is started and not usable for replay');
			}
			sinon.assert.notCalled(eventService.send);
		});
		it('should throw error to started event service with options wrong blockType', async () => {
			eventService.isStarted.returns(true);
			eventService.send.resolves();
			eventService.blockType = 'filtered';
			const options = {blockType: 'full'};

			try {
				await eventServiceManager.startEventService(eventService, options);
				expect(1), 'should have thrown an error'.to.be.false;
			} catch (error) {
				expect(error.message).to.contain('EventService is not receiving the correct blockType');
			}
			sinon.assert.notCalled(eventService.send);
		});
	});

	describe('#dispose', () => {
		it('should run', () => {
			eventServiceManager.dispose();
			sinon.assert.called(eventServiceManager.eventServicesFiltered.clear);
			sinon.assert.called(eventServiceManager.eventServicesFull.clear);
			sinon.assert.called(eventServiceManager.eventServicesPrivate.clear);
			sinon.assert.called(eventServiceManager.eventServicesReplay.clear);
		});
		it('should run with event services assigned', () => {
			const esm = new EventServiceManager(network);
			esm.eventServicesFiltered.set(eventService.name, eventService);
			esm.eventServicesFull.set(eventService.name, eventService);
			esm.eventServicesPrivate.set(eventService.name, eventService);
			esm.eventServicesReplay.set(eventService.name, eventService);

			esm.dispose();
		});
	});

	describe('RoundRobinPeerPool', () => {
		let peer1, peer2;
		let pool;
		const RoundRobinPeerPool = EventServiceManagerRewire.__get__('RoundRobinPeerPool');

		beforeEach(() => {
			peer1 = sandbox.createStubInstance(Endorser);
			peer1.name = 'peer1';
			peer2 = sandbox.createStubInstance(Endorser);
			peer2.name = 'peer2';
			channel.getEndorsers.returns([peer1, peer2]);
			pool = new RoundRobinPeerPool(network);
		});

		describe('#constructor', () => {
			it('should create an of peers', () => {
				expect(pool.peers).to.be.instanceOf(Array);
				expect(pool.peers).to.deep.equal([peer1, peer2]);
				expect(pool.lastPeerIndex).to.be.equal(-1);
			});

			it('should throw error when no peers found', () => {
				try {
					const network2 = sinon.stub();
					network2.channel = sinon.stub();
					network2.channel.getEndorsers = sinon.stub().returns([]);
					new RoundRobinPeerPool(network2);
					expect(1, 'should have throw error').to.be.false;
				} catch (error) {
					expect(error.message).to.contain('No peers available');
				}
			});
			it('should throw error when no peers found', () => {
				try {
					const network2 = sinon.stub();
					network2.channel = sinon.stub();
					network2.channel.getEndorsers = sinon.stub().returns();
					new RoundRobinPeerPool(network2);
					expect(1, 'should have throw error').to.be.false;
				} catch (error) {
					expect(error.message).to.contain('No peers available');
				}
			});
		});

		describe('#getNextPeer', () => {
			it('should run ', () => {
				expect(pool.getNextPeer()).to.deep.equal(peer1);
				expect(pool.getNextPeer()).to.deep.equal(peer2);
				expect(pool.getNextPeer()).to.deep.equal(peer1);
			});
		});

		describe('#getNextPeers', () => {
			it('should run', () => {
				expect(pool.getNextPeers()).to.deep.equal([peer1, peer2]);
				expect(pool.getNextPeers()).to.deep.equal([peer2, peer1]);
				expect(pool.getNextPeers()).to.deep.equal([peer1, peer2]);
			});
		});

		describe('#getPeers', () => {
			it('should run', () => {
				expect(pool.getPeers()).to.deep.equal([peer1, peer2]);
			});
		});
	});
});
