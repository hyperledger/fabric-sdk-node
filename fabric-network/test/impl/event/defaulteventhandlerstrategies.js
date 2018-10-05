/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

const EventHubFactory = require('fabric-network/lib/impl/event/eventhubfactory');
const ChannelEventHub = require('fabric-client').ChannelEventHub;
const Network = require('fabric-network/lib/network');
const FabricChannel = require('fabric-client').Channel;
const AllForTxStrategy = require('fabric-network/lib/impl/event/allfortxstrategy');
const AnyForTxStrategy = require('fabric-network/lib/impl/event/anyfortxstrategy');

const EventStrategies = require('fabric-network/lib/impl/event/defaulteventhandlerstrategies');

describe('DefaultEventHandlerStrategies', () => {
	const mspId = 'MSP_ID';

	let stubEventHubFactory;
	let stubEventHub;
	let stubNetwork;
	let stubPeer;

	beforeEach(() => {
		stubEventHub = sinon.createStubInstance(ChannelEventHub);
		stubEventHub.isconnected.returns(true);

		stubEventHubFactory = sinon.createStubInstance(EventHubFactory);
		stubEventHubFactory.getEventHubs.resolves([stubEventHub]);

		stubPeer = {
			_stubInfo: 'peer',
			getName: function() { return 'peer'; }
		};

		const fabricChannel = sinon.createStubInstance(FabricChannel);
		fabricChannel.getPeers.returns([stubPeer]);

		stubNetwork = sinon.createStubInstance(Network);
		const peerMap = new Map();
		peerMap.set(mspId, [stubPeer]);
		stubNetwork.getPeerMap.returns(peerMap);
		stubNetwork.getChannel.returns(fabricChannel);
	});

	afterEach(() => {
		sinon.restore();
	});

	it('MSPID_SCOPE_ALLFORTX', () => {
		const result = EventStrategies.MSPID_SCOPE_ALLFORTX(stubEventHubFactory, stubNetwork, mspId);
		expect(result).to.be.an.instanceOf(AllForTxStrategy);
	});

	it('MSPID_SCOPE_ANYFORTX', () => {
		const result = EventStrategies.MSPID_SCOPE_ANYFORTX(stubEventHubFactory, stubNetwork, mspId);
		expect(result).to.be.an.instanceOf(AnyForTxStrategy);
	});

	it('NETWORK_SCOPE_ALLFORTX', () => {
		const result = EventStrategies.NETWORK_SCOPE_ALLFORTX(stubEventHubFactory, stubNetwork, mspId);
		expect(result).to.be.an.instanceOf(AllForTxStrategy);
	});

	it('NETWORK_SCOPE_ANYFORTX', () => {
		const result = EventStrategies.NETWORK_SCOPE_ANYFORTX(stubEventHubFactory, stubNetwork, mspId);
		expect(result).to.be.an.instanceOf(AnyForTxStrategy);
	});
});
