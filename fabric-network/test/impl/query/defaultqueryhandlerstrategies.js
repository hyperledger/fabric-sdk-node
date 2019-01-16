/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

const Network = require('fabric-network/lib/network');
const Channel = require('fabric-client').Channel;
const SingleQueryHandler = require('fabric-network/lib/impl/query/singlequeryhandler');
const RoundRobinQueryHandler = require('fabric-network/lib/impl/query/roundrobinqueryhandler');

const QueryStrategies = require('fabric-network/lib/impl/query/defaultqueryhandlerstrategies');

describe('DefaultQueryHandlerStrategies', () => {
	const expectedStrategyTypes = {
		'MSPID_SCOPE_SINGLE': SingleQueryHandler,
		'MSPID_SCOPE_ROUND_ROBIN': RoundRobinQueryHandler
	};
	const strategyNames = Object.keys(expectedStrategyTypes);

	let stubNetwork;

	beforeEach(() => {
		const org1QueryPeer = {
			getName: () => 'org1',
			isInRole: () => true
		};
		const org2QueryPeer = {
			getName: () => 'org2',
			isInRole: () => true
		};
		const nonQueryPeer = {
			getName: () => 'non-query',
			isInRole: () => false
		};

		const channel = sinon.createStubInstance(Channel);
		channel.getPeers.returns([org1QueryPeer, org2QueryPeer, nonQueryPeer]);
		channel.getPeersForOrg.returns([org1QueryPeer, nonQueryPeer]);

		stubNetwork = sinon.createStubInstance(Network);
		stubNetwork.getChannel.returns(channel);
	});

	afterEach(() => {
		sinon.restore();
	});

	strategyNames.forEach((strategyName) => describe(strategyName, () => {
		const createQueryStrategy = QueryStrategies[strategyName];

		let queryStrategy;

		beforeEach(() => {
			queryStrategy = createQueryStrategy(stubNetwork);
		});

		it('returns correct strategy implementation', () => {
			const expectedType = expectedStrategyTypes[strategyName];
			expect(queryStrategy).to.be.an.instanceOf(expectedType);
		});
	}));
});
