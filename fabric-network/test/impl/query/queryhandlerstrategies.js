/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

const Gateway = require('fabric-network/lib/gateway');
const Network = require('fabric-network/lib/network');
const Channel = require('fabric-common').Channel;
const SingleQueryHandler = require('fabric-network/lib/impl/query/singlequeryhandler');
const RoundRobinQueryHandler = require('fabric-network/lib/impl/query/roundrobinqueryhandler');
const QueryStrategies = require('fabric-network/lib/impl/query/queryhandlerstrategies');

describe('QueryHandlerStrategies', () => {
	const expectedStrategyTypes = {
		'MSPID_SCOPE_SINGLE': SingleQueryHandler,
		'MSPID_SCOPE_ROUND_ROBIN': RoundRobinQueryHandler
	};
	const strategyNames = Object.keys(expectedStrategyTypes);

	let network;

	beforeEach(() => {
		const org1QueryPeer = {
			name: 'peer1',
			mspid: 'org1'
		};

		const channel = sinon.createStubInstance(Channel);
		channel.getEndorsers.returns([org1QueryPeer]);

		network = sinon.createStubInstance(Network);
		network.channel = channel;
	});

	afterEach(() => {
		sinon.restore();
	});

	strategyNames.forEach((strategyName) => describe(strategyName, () => {
		const createQueryStrategy = QueryStrategies[strategyName];

		let queryStrategy;
		let gateway;

		beforeEach(() => {
			gateway = sinon.createStubInstance(Gateway);
			gateway.getOptions.returns({
				query: {
					timeout: 3
				}
			});
			network.gateway = gateway;

			queryStrategy = createQueryStrategy(network);
		});

		it('returns correct strategy implementation', () => {
			const expectedType = expectedStrategyTypes[strategyName];
			expect(queryStrategy).to.be.an.instanceOf(expectedType);
		});
	}));
	strategyNames.forEach((strategyName) => describe(strategyName, () => {
		const createQueryStrategy = QueryStrategies[strategyName];

		let queryStrategy;
		let gateway;

		beforeEach(() => {
			gateway = sinon.createStubInstance(Gateway);
			gateway.getOptions.returns({
				query: {
					timeout: 'A'
				}
			});
			network.gateway = gateway;
			queryStrategy = createQueryStrategy(network);
		});

		it('returns correct strategy implementation with default timeout', () => {
			const expectedType = expectedStrategyTypes[strategyName];
			expect(queryStrategy).to.be.an.instanceOf(expectedType);
		});
	}));
});
