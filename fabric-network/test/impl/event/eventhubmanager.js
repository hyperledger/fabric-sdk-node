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

const {Channel, ChannelEventHub, Peer} = require('fabric-client');
const Network = require('fabric-network/lib/network');
const EventHubManager = require('fabric-network/lib/impl/event/eventhubmanager');
const EventHubFactory = require('fabric-network/lib/impl/event/eventhubfactory');
const AbstractEventHubSelectionStrategy = require('fabric-network/lib/impl/event/abstracteventhubselectionstrategy');


function populateEventHub(eventHub) {
	eventHub._chaincodeRegistrants = {};
	eventHub._blockRegistrations = {};
	eventHub._transactionRegistrations = {};
	return eventHub;
}

describe('EventHubManager', () => {
	let sandbox;
	let networkStub;
	let channelStub;
	let eventHubFactoryStub;
	let eventHubSelectionStrategyStub;
	let eventHubManager;
	let defaultNewEventHub;
	let anotherEventHub;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		channelStub = sandbox.createStubInstance(Channel);
		networkStub = sandbox.createStubInstance(Network);
		networkStub.getChannel.returns(channelStub);
		eventHubFactoryStub = sandbox.createStubInstance(EventHubFactory);
		eventHubFactoryStub._savedEventHubs = new Map();
		eventHubSelectionStrategyStub = sandbox.createStubInstance(AbstractEventHubSelectionStrategy);
		networkStub.getEventHubSelectionStrategy.returns(eventHubSelectionStrategyStub);
		eventHubManager = new EventHubManager(networkStub);
		eventHubManager.eventHubFactory = eventHubFactoryStub;
		defaultNewEventHub = populateEventHub(sandbox.createStubInstance(ChannelEventHub));
		defaultNewEventHub.isFiltered.returns(true);
		defaultNewEventHub.getName.returns('peer');
		anotherEventHub = populateEventHub(sandbox.createStubInstance(ChannelEventHub));
		anotherEventHub.isFiltered.returns(false);
		anotherEventHub.getName.returns('peer');
		channelStub.newChannelEventHub.returns(defaultNewEventHub);
	});

	afterEach(() => {
		sandbox.reset();
	});

	describe('#constructor', () => {
		it('should set the right parameters', () => {
			const em = new EventHubManager(networkStub);
			expect(em.channel).to.equal(channelStub);
			expect(em.eventHubFactory).to.be.instanceOf(EventHubFactory);
			expect(em.eventHubSelectionStrategy).to.equal(eventHubSelectionStrategyStub);
			expect(em.newEventHubs).to.deep.equal([]);
		});
	});

	describe('#getEventHub', () => {
		it('should return an event hub from the event hub factory given a peer', () => {
			const peer = {getPeer: () => 'peer'};
			eventHubFactoryStub._savedEventHubs.set('peer', {original: anotherEventHub, proxy: anotherEventHub});
			eventHubFactoryStub.getEventHub.returns(anotherEventHub);

			const eventHub = eventHubManager.getEventHub(peer);
			sinon.assert.calledWith(eventHubFactoryStub.getEventHub, 'peer');
			expect(eventHub).to.equal(anotherEventHub);
		});

		it('should return an event hub from the event hub factory given a peer name', () => {
			const peer = 'peer';
			eventHubFactoryStub.getEventHub.returns(anotherEventHub);

			const eventHub = eventHubManager.getEventHub(peer);
			sinon.assert.calledWith(eventHubFactoryStub.getEventHub, 'peer');
			expect(eventHub).to.equal(anotherEventHub);
		});

		it('should return an event hub from the event hub factory without a peer', () => {
			const peer = {getPeer: () => 'peer'};
			eventHubFactoryStub.getEventHub.returns(anotherEventHub);
			eventHubSelectionStrategyStub.getNextPeer.returns(peer);
			const eventHub = eventHubManager.getEventHub();
			sinon.assert.called(eventHubSelectionStrategyStub.getNextPeer);
			sinon.assert.calledWith(eventHubFactoryStub.getEventHub, 'peer');
			expect(eventHub).to.equal(anotherEventHub);
		});

		it('should not return the unfiltered event hub and request a new isntance', () => {
			eventHubFactoryStub.getEventHub.returns(anotherEventHub);
			anotherEventHub.isconnected.returns(true);
			eventHubManager.newEventHubs = [defaultNewEventHub];
			anotherEventHub.isFiltered.returns(false);
			expect(eventHubManager.getEventHub({getName: () => 'peer'}, true)).to.equal(defaultNewEventHub);
		});
	});

	describe('#getEventHubs', () => {
		it('should call the event hub factory', () => {
			const peers = ['peer1', 'peer2', 'peer3'];
			const ehs = ['eh1', 'eh2', 'eh3'];
			eventHubFactoryStub.getEventHubs.returns(ehs);
			const eventHubs = eventHubManager.getEventHubs(peers);
			sinon.assert.calledWith(eventHubFactoryStub.getEventHubs, peers);
			expect(eventHubs).to.deep.equal(eventHubs);
		});
	});

	describe('#getReplayEventHub', () => {
		it('should return an existing event hub with no registrations and no peer is given', () => {
			const newEventHub = sandbox.createStubInstance(ChannelEventHub);
			newEventHub._chaincodeRegistrants = {};
			newEventHub._blockRegistrations = {};
			newEventHub._transactionRegistrations = {};
			eventHubManager.newEventHubs = [newEventHub];
			const eventHub = eventHubManager.getReplayEventHub();
			expect(eventHub).to.be.instanceof(ChannelEventHub);
			expect(eventHubManager.newEventHubs).to.have.length(1);
		});

		it('should return an existing event hub with no registrations when the peer is given', () => {
			const newEventHub = sandbox.createStubInstance(ChannelEventHub);
			newEventHub._chaincodeRegistrants = {};
			newEventHub._blockRegistrations = {};
			newEventHub._transactionRegistrations = {};
			newEventHub.getName.returns('peer1');
			eventHubManager.newEventHubs = [newEventHub];
			const peer = sandbox.createStubInstance(Peer);
			peer.getName.returns('peer1');
			const eventHub = eventHubManager.getReplayEventHub(peer);
			expect(eventHub).to.instanceof(ChannelEventHub);
			expect(eventHubManager.newEventHubs).to.have.length(1);
		});

		it('should return a new event hub if the peer and event hub name dont match', () => {
			const newEventHub = sandbox.createStubInstance(ChannelEventHub);
			newEventHub._chaincodeRegistrants = {};
			newEventHub._blockRegistrations = {};
			newEventHub._transactionRegistrations = {};
			newEventHub.getName.returns('peer2');
			eventHubManager.newEventHubs = [newEventHub];
			const peer = sandbox.createStubInstance(Peer);
			peer.getName.returns('peer1');
			const eventHub = eventHubManager.getReplayEventHub(peer);
			expect(eventHub).to.equal(defaultNewEventHub);
			expect(eventHubManager.newEventHubs[eventHubManager.newEventHubs.length - 1]).to.equal(defaultNewEventHub);
		});

		it('should return a new event hub if the event hub isnt new', () => {
			const newEventHub = sandbox.createStubInstance(ChannelEventHub);
			newEventHub._chaincodeRegistrants = {'registration1': 'some registration'};
			newEventHub._blockRegistrations = {};
			newEventHub._transactionRegistrations = {};
			newEventHub.getName.returns('peer1');
			eventHubManager.newEventHubs = [newEventHub];
			const peer = sandbox.createStubInstance(Peer);
			peer.getName.returns('peer1');
			const eventHub = eventHubManager.getReplayEventHub(peer);
			expect(eventHub).to.equal(defaultNewEventHub);
			expect(eventHubManager.newEventHubs[eventHubManager.newEventHubs.length - 1]).to.equal(defaultNewEventHub);
		});
	});

	describe('#getFixedEventHub', () => {
		it('should get a new eventhub', () => {
			const newEventHub = sandbox.createStubInstance(ChannelEventHub);
			channelStub.newChannelEventHub.returns(newEventHub);
			const eventHub = eventHubManager.getFixedEventHub('peer');
			sinon.assert.calledWith(channelStub.newChannelEventHub, 'peer');
			expect(eventHub).to.equal(newEventHub);
		});
	});

	describe('#updateEventHubAvailability', () => {
		it('should call eventHubSelectionStratefy.updateEventHubAvailability', () => {
			eventHubManager.updateEventHubAvailability('peer');
			sinon.assert.calledWith(eventHubSelectionStrategyStub.updateEventHubAvailability, 'peer');
		});
	});

	describe('#dispose', () => {
		it('should call dispose on the eventHubFactory', () => {
			eventHubManager.dispose();
			sinon.assert.called(eventHubFactoryStub.dispose);
		});

		it('should call disconnect on the each new event hub', () => {
			const eventHub1 = sandbox.createStubInstance(ChannelEventHub);
			const eventHub2 = sandbox.createStubInstance(ChannelEventHub);
			const eventHub3 = sandbox.createStubInstance(ChannelEventHub);
			eventHubManager.newEventHubs = [eventHub1, eventHub2, eventHub3];
			eventHubManager.dispose();
			for (const eh of eventHubManager.newEventHubs) {
				sinon.assert.called(eh.disconnect);
			}
		});
	});

	describe('#getEventHubFactory', () => {
		it ('should return the event hub factory', () => {
			const eventHubFactory = eventHubManager.getEventHubFactory();
			expect(eventHubFactory).to.equal(eventHubFactoryStub);
		});
	});

	describe('#_isNewEventHub', () => {
		it('should throw if no event hub is given', () => {
			expect(() => eventHubManager._isNewEventHub()).to.throw('event hub not given');
		});

		it('should return true if there are no registrations', () => {
			const eventHub = sandbox.createStubInstance(ChannelEventHub);
			eventHub._chaincodeRegistrants = {};
			eventHub._blockRegistrations = {};
			eventHub._transactionRegistrations = {};
			const isNew = eventHubManager._isNewEventHub(eventHub);
			expect(isNew).to.be.true;
		});

		it('should return false if there is one chaincode registration', () => {
			const eventHub = sandbox.createStubInstance(ChannelEventHub);
			eventHub._chaincodeRegistrants = {someregistration: 'registration'};
			eventHub._blockRegistrations = {};
			eventHub._transactionRegistrations = {};
			const isNew = eventHubManager._isNewEventHub(eventHub);
			expect(isNew).to.be.false;
		});

		it('should return false if there is one block registration', () => {
			const eventHub = sandbox.createStubInstance(ChannelEventHub);
			eventHub._chaincodeRegistrants = {};
			eventHub._blockRegistrations = {someregistration: 'registration'};
			eventHub._transactionRegistrations = {};
			const isNew = eventHubManager._isNewEventHub(eventHub);
			expect(isNew).to.be.false;
		});

		it('should return false if there is one transaction registration', () => {
			const eventHub = sandbox.createStubInstance(ChannelEventHub);
			eventHub._chaincodeRegistrants = {};
			eventHub._blockRegistrations = {};
			eventHub._transactionRegistrations = {someregistration: 'registration'};
			const isNew = eventHubManager._isNewEventHub(eventHub);
			expect(isNew).to.be.false;
		});
	});

	describe('#getPeers', () => {
		it('should call EventHubSelectionStrategy.getPeers', () => {
			const peers = ['peer1'];
			eventHubSelectionStrategyStub.getPeers.returns(peers);
			expect(eventHubManager.getPeers()).to.equal(peers);
			sinon.assert.called(eventHubSelectionStrategyStub.getPeers);
		});
	});
});
