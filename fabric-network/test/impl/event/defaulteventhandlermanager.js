/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const sinon = require('sinon');
const rewire = require('rewire');

const ChannelEventHub = require('fabric-client').ChannelEventHub;

const DefaultEventHandlerManager = require('../../../lib/impl/event/defaulteventhandlermanager');
const EventHandlerStrategies = require('../../../lib/impl/event/defaulteventhandlerstrategies');
const Network = require('../../../lib/network');

const InternalChannel = rewire('fabric-client/lib/Channel');
const Peer = InternalChannel.__get__('ChannelPeer');

describe('DefaultEventHandlerManager', () => {
	let stubEventHub;
	let stubStrategy;
	let stubEventHandlerManager;
	let stubNetwork;

	beforeEach(() => {
		// Include _stubInfo property on stubs to enable easier equality comparison in tests

		stubEventHub = sinon.createStubInstance(ChannelEventHub);
		stubEventHub._stubInfo = 'eventHub';
		stubEventHub.getName.returns('eventHub');
		stubEventHub.getPeerAddr.returns('eventHubAddress');
		stubEventHub.registerTxEvent.callsFake((transactionId, onEventFn, onErrorFn) => {
			stubEventHub._transactionId = transactionId;
			stubEventHub._onEventFn = onEventFn;
			stubEventHub._onErrorFn = onErrorFn;
		});

		stubStrategy = {
			getConnectedEventHubs: async () => {
				return [stubEventHub];
			},
			eventReceived: sinon.stub(),
			errorReceived: sinon.stub()
		};

		stubEventHandlerManager = sinon.createStubInstance(DefaultEventHandlerManager);
		stubEventHandlerManager.getEventHubs.returns([stubEventHub]);

		stubNetwork = sinon.createStubInstance(Network);
	});

	describe('#constructor', () => {
		it('has a default strategy if no options supplied', () => {
			const handler = new DefaultEventHandlerManager(stubNetwork, 'MSP_ID', {commitTimeout: 300});
			expect(handler.options.strategy).to.equal(EventHandlerStrategies.MSPID_SCOPE_ALLFORTX);
		});

		it('allows a timeout option to be specified', () => {
			const handler = new DefaultEventHandlerManager(stubNetwork, 'MSP_ID', {commitTimeout: 300, strategy: EventHandlerStrategies.MSPID_SCOPE_ANYFORTX});
			expect(handler.options.strategy).to.equal(EventHandlerStrategies.MSPID_SCOPE_ANYFORTX);
		});
	});

	describe('#initialize', () => {
		let mockChannel;

		beforeEach(() => {
			mockChannel = sinon.createStubInstance(InternalChannel);
			mockChannel.getChannelEventHub.returns({isconnected: () => true, getName: () => 'myeventhub'});
		});

		it('no-op if already initialized', async () => {
			const handler = new DefaultEventHandlerManager(stubNetwork, 'MSP_ID', {commitTimeout: 300});
			handler.initialized = true;
			await handler.initialize();
		});

		it('initialise with full blocks option', async () => {
			const mspId = 'MSP_ID';
			const handler = new DefaultEventHandlerManager(stubNetwork, mspId, {commitTimeout: 300, useFullBlocks: true});
			const mockPeerMap = new Map();
			const mockPeer1 = sinon.createStubInstance(Peer);
			mockPeer1.index = 1; // add these so that the mockPeers can be distinguished when used in WithArgs().
			mockPeer1.getName.returns('Peer1');
			mockPeer1.getMspid.returns(mspId);

			mockPeerMap.set(mspId, [mockPeer1]);
			stubNetwork.getPeerMap.returns(mockPeerMap);
			handler.channel = mockChannel;
			await handler.initialize();
			handler.initialized.should.equal(true);
			handler.useFullBlocks.should.equal(true);
		});
	});

	describe('#dispose', () => {
		it('disconnects event hubs and empties array', () => {
			const handler = new DefaultEventHandlerManager(stubNetwork, 'MSP_ID', {commitTimeout: 300});
			handler.initialized = true;
			handler.availableEventHubs = [ { disconnect: () => {} }];
			handler.dispose();
			handler.availableEventHubs.length.should.equal(0);
			handler.initialized.should.equal(false);
		});
	});

});
