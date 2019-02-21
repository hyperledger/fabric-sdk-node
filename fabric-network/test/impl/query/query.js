/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const Channel = require('fabric-client/lib/Channel');
const Client = require('fabric-client/lib/Client');

const Query = require('fabric-network/lib/impl/query/query');

const sinon = require('sinon');
const expect = require('chai').expect;

describe('Query', () => {
	let channel;
	let fakeQueryByChaincode;
	let request;
	let stubPeer1;
	let stubPeer2;

	beforeEach(() => {
		request = {
			chaincodeId: 'chaincode-id',
			fcn: 'transaction-name',
			txId: 'transaction-id',
			args: []
		};

		const client = new Client();
		channel = new Channel('channel-name', client);

		fakeQueryByChaincode = sinon.fake(async (req) => {
			return req.targets.map((peer) => Buffer.from(peer.getName()));
		});
		sinon.replace(channel, 'queryByChaincode', fakeQueryByChaincode);

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

	describe('#evaluate', () => {
		let query;

		beforeEach(() => {
			query = new Query(channel, request);
		});

		it('queries a single peer', async () => {
			const peers = [stubPeer1];

			await query.evaluate(peers);

			const expected = {
				targets: peers
			};
			sinon.assert.calledWithMatch(fakeQueryByChaincode, expected);
		});

		it('queries multiple peers', async () => {
			const peers = [stubPeer1, stubPeer2];

			await query.evaluate(peers);

			const expected = {
				targets: peers
			};
			sinon.assert.calledWithMatch(fakeQueryByChaincode, expected);
		});

		it('uses specified request', async () => {
			const peers = [stubPeer1];

			await query.evaluate(peers);

			sinon.assert.calledWithMatch(fakeQueryByChaincode, request);
		});

		it('returns query results', async () => {
			const peers = [stubPeer1, stubPeer2];

			const result = await query.evaluate(peers);

			const expected = {
				peer1: Buffer.from('peer1'),
				peer2: Buffer.from('peer2')
			};
			expect(result).to.own.deep.equal(expected);
		});

		it('returns error results', async () => {
			const error = new Error('QUERY_FAIL');
			sinon.restore();
			sinon.replace(channel, 'queryByChaincode', sinon.fake.resolves([error]));
			const peers = [stubPeer1];

			const result = await query.evaluate(peers);

			const expected = {
				peer1: error
			};
			expect(result).to.deep.equal(expected);
		});
	});
});
