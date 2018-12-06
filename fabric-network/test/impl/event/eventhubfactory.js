/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');

const Channel = require('fabric-client').Channel;
const ChannelEventHub = require('fabric-client').ChannelEventHub;

const EventHubFactory = require('fabric-network/lib/impl/event/eventhubfactory');

describe('EventHubFactory', () => {
	let stubChannel;
	let stubPeer1;
	let stubPeer2;
	let stubEventHub1;
	let stubEventHub2;

	beforeEach(() => {
		// Include _stubInfo property on stubs to enable easier equality comparison in tests

		stubPeer1 = {
			_stubInfo: 'peer1',
			getName: function() {
				return 'peer1';
			}
		};
		stubPeer2 = {
			_stubInfo: 'peer2',
			getName: function() {
				return 'peer2';
			}
		};

		let eventHubCount = 0;
		function newStubEventHub(peerName) {
			const stubEventHub = sinon.createStubInstance(ChannelEventHub);
			stubEventHub._stubInfo = `${peerName}-eventHub${++eventHubCount}`;
			stubEventHub.getName.returns(peerName);

			return stubEventHub;
		}

		stubEventHub1 = newStubEventHub(stubPeer1.getName());
		stubEventHub2 = newStubEventHub(stubPeer2.getName());

		stubChannel = sinon.createStubInstance(Channel);
		stubChannel.getName.returns('channel');
		stubChannel.getChannelEventHub.withArgs(stubPeer1.getName()).returns(stubEventHub1);
		stubChannel.getChannelEventHub.withArgs(stubPeer2.getName()).returns(stubEventHub2);
		stubChannel.newChannelEventHub.callsFake((peer) => newStubEventHub(peer.getName()));
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('#constructor', () => {
		it('takes a Channel argument', () => {
			new EventHubFactory(stubChannel);
		});

		it('throws if no channel argument is supplied', () => {
			expect(() => new EventHubFactory()).to.throw();
		});
	});

	describe('#getEventHubs', () => {
		let factory;

		beforeEach(() => {
			factory = new EventHubFactory(stubChannel);
		});

		function assertEventHubsMatchPeers(eventHubs, peers) {
			expect(eventHubs).to.be.an('Array').with.lengthOf(peers.length);
			const eventHubNames = eventHubs.map((eventHub) => eventHub.getName());
			const peerNames = peers.map((peer) => peer.getName());
			expect(eventHubNames).to.have.ordered.members(peerNames);
		}

		it('returns empty array for no peer arguments', () => {
			const results = factory.getEventHubs([]);
			expect(results).to.be.an('Array').that.is.empty;
		});

		it('returns eventHub for peer1', () => {
			const peers = [stubPeer1];
			const eventHubs = factory.getEventHubs(peers);
			assertEventHubsMatchPeers(eventHubs, peers);
		});

		it('returns eventHubs for peer1 and peer2', () => {
			const peers = [stubPeer1, stubPeer2];
			const eventHubs = factory.getEventHubs(peers);
			assertEventHubsMatchPeers(eventHubs, peers);
		});

		it('does not return same eventHub as channel.getChannelEventHub()', () => {
			const eventHubs = factory.getEventHubs([stubPeer1]);
			expect(eventHubs).to.not.deep.equal(stubEventHub1);
		});

		it('returns the same eventHub on subsequent calls', () => {
			const peers = [stubPeer1, stubPeer2];
			const eventHubs1 = factory.getEventHubs(peers);
			const eventHubs2 = factory.getEventHubs(peers);
			expect(eventHubs1).to.have.deep.ordered.members(eventHubs2);
		});

		it('client code can\'t close event hubs', () => {
			stubChannel.newChannelEventHub.returns(stubEventHub1);
			const close = stubEventHub1.close;

			const eventHub = factory.getEventHubs([stubPeer1])[0];
			eventHub.close();

			sinon.assert.notCalled(close);
		});

		it('client code can\'t disconnect event hubs', () => {
			stubChannel.newChannelEventHub.returns(stubEventHub1);
			const disconnect = stubEventHub1.disconnect;

			const eventHub = factory.getEventHubs([stubPeer1])[0];
			eventHub.disconnect();

			sinon.assert.notCalled(disconnect);
		});
	});

	describe('#dispose', () => {
		it('disconnects created event hubs', () => {
			stubChannel.newChannelEventHub.returns(stubEventHub1);
			const disconnect = stubEventHub1.disconnect;
			const factory = new EventHubFactory(stubChannel);
			factory.getEventHubs([stubPeer1]);

			factory.dispose();

			sinon.assert.called(disconnect);
		});
	});
});
