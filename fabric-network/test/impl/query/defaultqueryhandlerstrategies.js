/*
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

const {Gateway} = require('fabric-network/lib/gateway');
const {NetworkImpl: Network} = require('../../../lib/network');
const Channel = require('fabric-common').Channel;
const {SingleQueryHandler} = require('fabric-network/lib/impl/query/singlequeryhandler');
const {RoundRobinQueryHandler} = require('fabric-network/lib/impl/query/roundrobinqueryhandler');
const QueryStrategies = require('fabric-network/lib/impl/query/defaultqueryhandlerstrategies');

describe('DefaultQueryHandlerStrategies', () => {
	const expectedStrategyTypes = {
		'MSPID_SCOPE_SINGLE': SingleQueryHandler,
		'MSPID_SCOPE_ROUND_ROBIN': RoundRobinQueryHandler,
		'PREFER_MSPID_SCOPE_SINGLE': SingleQueryHandler,
		'PREFER_MSPID_SCOPE_ROUND_ROBIN': RoundRobinQueryHandler
	};
	const strategyNames = Object.keys(expectedStrategyTypes);

	let gateway;
	let network;
	let orgPeers;
	let networkPeers;

	const mspId = 'MSP_ID';
	const otherMspId = 'OTHER_MSP_ID';


	beforeEach(() => {
		const org1QueryPeer = {
			name: 'peer1',
			mspid: 'org1'
		};
		const org2QueryPeer = {
			name: 'peer1',
			mspid: 'org2'
		};
		orgPeers = [org1QueryPeer];
		networkPeers = [org1QueryPeer, org2QueryPeer];

		const channel = sinon.createStubInstance(Channel);
		channel.getEndorsers.withArgs().returns(networkPeers);
		channel.getEndorsers.withArgs(mspId).returns(orgPeers);
		channel.getEndorsers.withArgs(otherMspId).returns([]);

		gateway = sinon.createStubInstance(Gateway);
		gateway.getIdentity.returns({
			mspId
		});
		network = sinon.createStubInstance(Network);
		network.getChannel.returns(channel);
		network.getGateway.returns(gateway);
	});

	afterEach(() => {
		sinon.restore();
	});

	strategyNames.forEach((strategyName) => describe(strategyName, () => {
		const createQueryStrategy = QueryStrategies[strategyName];

		let queryStrategy;

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
	strategyNames.filter((strategyName) => strategyName.startsWith('PREFER_')).forEach((strategyName) => describe(strategyName, () => {
		const createQueryStrategy = QueryStrategies[strategyName];

		let queryStrategy;

		beforeEach(() => {
			queryStrategy = createQueryStrategy(network);
		});

		it('Sets correct peers', () => {
			expect(queryStrategy.peers).to.equal(orgPeers);
		});
	}));
	strategyNames.filter((strategyName) => strategyName.startsWith('PREFER_')).forEach((strategyName) => describe(`${strategyName} (no peers in organization)`, () => {
		const createQueryStrategy = QueryStrategies[strategyName];

		let queryStrategy;

		beforeEach(() => {
			gateway.getIdentity.returns({
				mspId: otherMspId
			});
			queryStrategy = createQueryStrategy(network);
		});

		it('Sets correct peers', () => {
			expect(queryStrategy.peers).to.equal(networkPeers);
		});
	}));
});
