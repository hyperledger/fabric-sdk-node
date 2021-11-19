/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const sinon = require('sinon');
const expect = require('chai').expect;

const QueryProposal = require('fabric-common/lib/Query');
const {QueryImpl: Query} = require('fabric-network/lib/impl/query/query');
const {newEndorsementResponse} = require('../../testutils');

describe('Query', () => {
	let queryProposal;
	const peer1 = {name: 'peer1'};
	const peer2 = {name: 'peer2'};

	const error1 = new Error('peer1-error');
	const error2 = new Error('peer2-error');
	error1.connection = {name: 'peer1'};
	error2.connection = {name: 'peer2'};
	const noresulterror = new Error('No responses returned for query');
	const missingerror = new Error('Missing response from peer');
	const response200 = {status: 200, payload: Buffer.from('good'), message: undefined};
	const result200 = {status: 200, payload: Buffer.from('good'), isEndorsed: true};
	const response200_peer1 = newEndorsementResponse(response200, {
		connection: {name: 'peer1'},
	});
	const response200_peer2 = newEndorsementResponse(response200, {
		connection: {name: 'peer2'},
	});
	const response500 = {status: 500, message: 'problem500', payload: undefined};
	const result500 = {status: 500, message: 'problem500', isEndorsed: false};
	const response500_peer1 = newEndorsementResponse(response500, {
		connection: {name: 'peer1'},
		endorsement: undefined,
		payload: undefined,
	});
	const response500_peer2 = newEndorsementResponse(response500, {
		connection: {name: 'peer2'},
		endorsement: undefined,
		payload: undefined,
	});

	const valid200Resonse = {responses: [response200_peer1]};
	const valid200Resonses = {responses: [response200_peer1, response200_peer2]};
	const valid500Resonse = {responses: [response500_peer1]};
	const valid500Resonses = {responses: [response500_peer1, response500_peer2]};
	const errorResonse = {errors: [error1]};
	const errorResonses = {errors: [error1, error2]};
	const validMixResonse = {responses: [response200_peer1, response500_peer2]};
	const vallidMixError = {responses: [response200_peer1], errors: [error2]};
	const validMissingResponse = {responses: [response200_peer1, {}]};


	beforeEach(() => {
		queryProposal = sinon.createStubInstance(QueryProposal);
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('#constructor', () => {

		it('no options', async () => {
			const query = new Query({});
			expect(query).to.exist;
		});
		it('with options', async () => {
			const query = new Query({}, {something: 33});
			expect(query).to.exist;
		});
		it('with timeout options', async () => {
			const query = new Query({}, {timeout: 3});
			expect(query.requestTimeout).to.equal(3000);
		});
		it('check timeout passed to low level', async () => {
			const query = new Query(queryProposal, {timeout: 5});

			await query.evaluate([peer1]);

			const expected = {
				targets: [peer1],
				requestTimeout: 5000
			};
			sinon.assert.calledWithMatch(queryProposal.send, expected);
		});
	});

	describe('#evaluate', () => {
		let query;

		beforeEach(() => {
			query = new Query(queryProposal);
		});

		// check calls to low level
		it('calls low level with a single peer', async () => {
			await query.evaluate([peer1]);

			const expected = {
				targets: [peer1],
				requestTimeout: 3000
			};
			sinon.assert.calledWithMatch(queryProposal.send, expected);
		});

		it('calls low level with multiple peers', async () => {
			const peers = [peer1, peer2];

			await query.evaluate(peers);

			const expected = {
				targets: peers,
				requestTimeout: 3000
			};
			sinon.assert.calledWithMatch(queryProposal.send, expected);
		});

		// single peer
		it('returns query results from one peer status 200', async () => {
			queryProposal.send.resolves(valid200Resonse);

			const result = await query.evaluate([peer1]);

			expect(result).to.have.key('peer1');
			expect(result.peer1).to.deep.include(result200);
		});
		it('returns query results from one peer status 500', async () => {
			queryProposal.send.resolves(valid500Resonse);

			const result = await query.evaluate([peer1]);
			expect(result).to.have.key('peer1');
			expect(result.peer1).to.deep.include(result500);
		});
		it('returns query error result from one peer', async () => {
			queryProposal.send.resolves(errorResonse);

			const result = await query.evaluate([peer1]);

			const expected = {
				peer1: error1
			};
			expect(result).to.own.deep.equal(expected);
		});
		it('returns missing error result from one peer', async () => {
			queryProposal.send.resolves();

			const result = await query.evaluate([peer1]);

			expect(result.peer1.message).to.own.deep.equal(noresulterror.message);
		});

		// multiple peers same results
		it('returns query results from two peers status 200', async () => {
			queryProposal.send.resolves(valid200Resonses);

			const result = await query.evaluate([peer1, peer2]);

			expect(result).to.have.all.keys('peer1', 'peer2');
			expect(result.peer1).to.deep.include(result200);
			expect(result.peer2).to.deep.include(result200);
		});
		it('returns query results from two peers status 500', async () => {
			queryProposal.send.resolves(valid500Resonses);

			const result = await query.evaluate([peer1, peer2]);

			expect(result).to.have.all.keys('peer1', 'peer2');
			expect(result.peer1).to.deep.include(result500);
			expect(result.peer2).to.deep.include(result500);
		});
		it('returns query error result from two peers', async () => {
			queryProposal.send.resolves(errorResonses);

			const result = await query.evaluate([peer1, peer2]);

			const expected = {
				peer1: error1,
				peer2: error2
			};
			expect(result).to.own.deep.equal(expected);
		});
		it('returns no result error result from two peers', async () => {
			queryProposal.send.resolves();

			const result = await query.evaluate([peer1, peer2]);

			expect(result.peer1.message).to.own.deep.equal(noresulterror.message);
			expect(result.peer2.message).to.own.deep.equal(noresulterror.message);
		});

		// multiple peers missing results
		it('returns no result error result from one peer', async () => {
			queryProposal.send.resolves(valid200Resonse);

			const result = await query.evaluate([peer1, peer2]);

			expect(result.peer1).to.own.deep.include(result200);
			expect(result.peer2.message).to.own.deep.equal(missingerror.message);
		});
		it('returns empty result and valid result', async () => {
			queryProposal.send.resolves(validMissingResponse);

			const result = await query.evaluate([peer1, peer2]);

			expect(result.peer1).to.own.deep.include(result200);
			expect(result.peer2.message).to.own.deep.equal(missingerror.message);
		});
		it('returns no result error result from one peer and error from the other', async () => {
			queryProposal.send.resolves(errorResonse);

			const result = await query.evaluate([peer1, peer2]);

			expect(result.peer1.message).to.own.deep.equal(error1.message);
			expect(result.peer2.message).to.own.deep.equal(missingerror.message);
		});

		// multiple peers mixed results
		it('returns mixed valid from two peers status 200 and 500', async () => {
			queryProposal.send.resolves(validMixResonse);

			const result = await query.evaluate([peer1, peer2]);

			expect(result.peer1).to.own.deep.include(result200);
			expect(result.peer2).to.own.deep.include(result500);
		});
		it('returns mixed valid and error result from two peers', async () => {
			queryProposal.send.resolves(vallidMixError);

			const result = await query.evaluate([peer1, peer2]);

			expect(result.peer1).to.own.deep.include(result200);
			expect(result.peer2.message).to.own.deep.equal(error2.message);
		});
	});
});
