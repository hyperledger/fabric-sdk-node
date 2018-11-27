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

		// Connected event hub
		stubEventHub1 = sinon.createStubInstance(ChannelEventHub);
		stubEventHub1._stubInfo = 'eventHub1';
		stubEventHub1.getName.returns('eventHub1');

		// Unconnected event hub that will successfully connect
		stubEventHub2 = sinon.createStubInstance(ChannelEventHub);
		stubEventHub2._stubInfo = 'eventHub2';
		stubEventHub2.getName.returns('eventHub2');

		stubChannel = sinon.createStubInstance(Channel);
		stubChannel.getName.returns('channel');
		stubChannel.getChannelEventHub.withArgs(stubPeer1.getName()).returns(stubEventHub1);
		stubChannel.getChannelEventHub.withArgs(stubPeer2.getName()).returns(stubEventHub2);
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

		it('returns empty array for no peer arguments', () => {
			const results = factory.getEventHubs([]);
			expect(results).to.be.an('Array').that.is.empty;
		});

		it('returns eventHub for peer1', () => {
			const results = factory.getEventHubs([stubPeer1]);
			expect(results).to.have.members([stubEventHub1]);
		});

		it('returns eventHubs for peer1 and peer2', () => {
			const results = factory.getEventHubs([stubPeer1, stubPeer2]);
			expect(results).to.have.members([stubEventHub1, stubEventHub2]);
		});
	});
});
