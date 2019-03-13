/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');

const Channel = require('fabric-client/lib/Channel');
const Network = require('fabric-network/lib/network');
const RoundRobinEventSelectionStrategy = require('fabric-network/lib/impl/event/roundrobineventhubselectionstrategy');
const DefaultEventHubSelectionStrategies = require('fabric-network/lib/impl/event/defaulteventhubselectionstrategies');

describe('DefaultEventHubSelectionStrategies', () => {
	describe('#MSPID_SCOPE_ROUND_ROBIN', () => {
		let network;
		let channel;
		let peer1, peer2, peer3;
		beforeEach(() => {
			network = sinon.createStubInstance(Network);
			channel = sinon.createStubInstance(Channel);
			network.getChannel.returns(channel);
			peer1 = sinon.stub({isInRole() {}});
			peer2 = sinon.stub({isInRole() {}});
			peer3 = sinon.stub({isInRole() {}});
			channel.getPeersForOrg.returns([peer1, peer2, peer3]);
		});

		it('should get organization peers and filter by those that are in the correct roles', () => {
			peer1.isInRole.returns(true);
			peer2.isInRole.returns(false);
			peer3.isInRole.returns(true);

			const strategy = DefaultEventHubSelectionStrategies.MSPID_SCOPE_ROUND_ROBIN(network);
			expect(strategy).to.be.instanceof(RoundRobinEventSelectionStrategy);
		});
	});
});
