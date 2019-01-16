/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const SingleQueryHandler = require('fabric-network/lib/impl/query/singlequeryhandler');
const RoundRobinQueryHandler = require('fabric-network/lib/impl/query/roundrobinqueryhandler');

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-as-promised'));

describe('QueryHandlers', () => {
	const queryResult = Buffer.from('QUERY_RESULT');
	const queryFailMessage = 'QUERY_FAILED';

	let failedPeers;
	let fakeEvaluate;
	let stubQuery;
	let stubPeer1;
	let stubPeer2;

	beforeEach(() => {
		failedPeers = [];
		fakeEvaluate = sinon.fake(async (peers) => {
			const results = [];
			for (const peer of peers) {
				const peerName = peer.getName();
				if (failedPeers.includes(peer)) {
					results[peerName] = new Error(`${queryFailMessage}: ${peerName}`);
				} else {
					results[peerName] = queryResult;
				}
			}
			return results;
		});
		stubQuery = {
			evaluate: fakeEvaluate
		};
		stubPeer1 = {
			getName: () => 'peer1'
		};
		stubPeer2 = {
			getName: () => 'peer2'
		};

	});

	afterEach(() => {
		sinon.restore();
	});

	describe('SingleQueryHandler', () => {
		let strategy;

		beforeEach(() => {
			strategy = new SingleQueryHandler([stubPeer1, stubPeer2]);
		});

		it('only queries first peer if successful', async () => {
			await strategy.evaluate(stubQuery);

			sinon.assert.calledOnce(fakeEvaluate);
			sinon.assert.calledWith(fakeEvaluate, [stubPeer1]);
		});

		it('continues to query first peer if successful', async () => {
			await strategy.evaluate(stubQuery);
			await strategy.evaluate(stubQuery);

			sinon.assert.calledTwice(fakeEvaluate);
			sinon.assert.alwaysCalledWith(fakeEvaluate, [stubPeer1]);
		});

		it('returns query result', async () => {
			const result = await strategy.evaluate(stubQuery);
			expect(result).to.equal(queryResult);
		});

		it('queries second peer if first fails', async () => {
			failedPeers = [stubPeer1];

			await strategy.evaluate(stubQuery);

			sinon.assert.calledTwice(fakeEvaluate);
			sinon.assert.calledWith(fakeEvaluate.getCall(0), [stubPeer1]);
			sinon.assert.calledWith(fakeEvaluate.getCall(1), [stubPeer2]);
		});

		it('continues to query second peer if first fails', async () => {
			failedPeers = [stubPeer1];

			await strategy.evaluate(stubQuery);
			await strategy.evaluate(stubQuery);

			sinon.assert.calledThrice(fakeEvaluate);
			sinon.assert.calledWith(fakeEvaluate.lastCall, [stubPeer2]);
		});

		it('queries first peer again if second fails', async () => {
			failedPeers = [stubPeer1];
			await strategy.evaluate(stubQuery);
			failedPeers = [stubPeer2];
			await strategy.evaluate(stubQuery);

			sinon.assert.callCount(fakeEvaluate, 4);
			sinon.assert.calledWith(fakeEvaluate.lastCall, [stubPeer1]);
		});

		it('returns query result if first peer fails', async () => {
			failedPeers = [stubPeer1];

			const result = await strategy.evaluate(stubQuery);

			expect(result).equals(queryResult);
		});

		it('throws if all peers fail', () => {
			failedPeers = [stubPeer1, stubPeer2];

			return expect(strategy.evaluate(stubQuery))
				.to.be.rejectedWith(queryFailMessage);
		});
	});

	describe('RoundRobinQueryHandler', () => {
		let strategy;

		beforeEach(() => {
			strategy = new RoundRobinQueryHandler([stubPeer1, stubPeer2]);
		});

		it('queries first peer on first call', async () => {
			await strategy.evaluate(stubQuery);

			sinon.assert.callCount(fakeEvaluate, 1);
			sinon.assert.calledWith(fakeEvaluate.lastCall, [stubPeer1]);
		});

		it('queries second peer on second call', async () => {
			await strategy.evaluate(stubQuery);
			await strategy.evaluate(stubQuery);

			sinon.assert.callCount(fakeEvaluate, 2);
			sinon.assert.calledWith(fakeEvaluate.lastCall, [stubPeer2]);
		});

		it('queries third peer on third call', async () => {
			await strategy.evaluate(stubQuery);
			await strategy.evaluate(stubQuery);
			await strategy.evaluate(stubQuery);

			sinon.assert.callCount(fakeEvaluate, 3);
			sinon.assert.calledWith(fakeEvaluate.lastCall, [stubPeer1]);
		});

		it('returns query result', async () => {
			const result = await strategy.evaluate(stubQuery);
			expect(result).to.equal(queryResult);
		});

		it('queries second peer if first fails', async () => {
			failedPeers = [stubPeer1];

			await strategy.evaluate(stubQuery);

			sinon.assert.callCount(fakeEvaluate, 2);
			sinon.assert.calledWith(fakeEvaluate.getCall(0), [stubPeer1]);
			sinon.assert.calledWith(fakeEvaluate.getCall(1), [stubPeer2]);
		});

		it('queries first peer again if second fails', async () => {
			await strategy.evaluate(stubQuery);
			failedPeers = [stubPeer2];
			await strategy.evaluate(stubQuery);

			sinon.assert.callCount(fakeEvaluate, 3);
			sinon.assert.calledWith(fakeEvaluate.lastCall, [stubPeer1]);
		});

		it('returns query result if first peer fails', async () => {
			failedPeers = [stubPeer1];

			const result = await strategy.evaluate(stubQuery);

			expect(result).equals(queryResult);
		});

		it('throws if all peers fail', () => {
			failedPeers = [stubPeer1, stubPeer2];

			return expect(strategy.evaluate(stubQuery))
				.to.be.rejectedWith(queryFailMessage);
		});
	});
});
