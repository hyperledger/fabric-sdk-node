/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const Query = require('fabric-common/lib/Query');
const Endorser = require('fabric-common/lib/Endorser');
const SingleQueryHandler = require('fabric-network/lib/impl/query/singlequeryhandler');
const RoundRobinQueryHandler = require('fabric-network/lib/impl/query/roundrobinqueryhandler');

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-as-promised'));

describe('QueryHandlers', () => {
	const querySuccessResult = Buffer.from('SUCCESS_QUERY_RESULT');
	const queryErrorResult = new Error('ERROR_QUERY_RESULT');
	const queryFailMessage = 'QUERY_FAILED';
	const peerInfo = {name: 'peer1', url: 'grpc://fakehost:9999'};
	const validProposalResponse = {
		endorsement: {},
		response: {
			status: 200,
			payload: querySuccessResult
		},
		connection: peerInfo
	};
	const invalidProposalResponse = {
		response: {
			status: 500,
			message: queryFailMessage
		},
		connection: peerInfo
	};

	const validProposalResponses = {responses: [validProposalResponse], errors: [], queryResponses: [querySuccessResult]};
	const invalidProposalResponses = {responses: [invalidProposalResponse], errors: []};
	const errorProposalResponses = {responses: [], errors: [queryErrorResult]};

	let endorser1;
	let endorser2;
	let query;

	beforeEach(() => {
		query = sinon.createStubInstance(Query);
		endorser1 = sinon.createStubInstance(Endorser);
		endorser1.name = 'peer1';
		endorser2 = sinon.createStubInstance(Endorser);
		endorser2.name = 'peer2';
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('SingleQueryHandler', () => {
		let handler;

		beforeEach(() => {
			handler = new SingleQueryHandler([endorser1, endorser2]);
		});

		it('returns peer valid results', async () => {
			query.send.resolves(validProposalResponses);
			handler._options = {timeout: 1};

			const result = await handler.evaluate(query);
			expect(result).to.be.equal(querySuccessResult);
		});

		it('returns an error with the peer invalid results', async () => {
			query.send.resolves(invalidProposalResponses);

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain(queryFailMessage);
			}
		});

		it('returns an error with the grpc sending error', async () => {
			query.send.resolves(errorProposalResponses);

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('ERROR_QUERY_RESULT');
			}
		});

		it('returns an error with internal sending error', async () => {
			query.send.rejects(new Error('Send failed'));

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('Send failed');
			}
		});
	});

	describe('RoundRobinQueryHandler', () => {
		let handler;

		beforeEach(() => {
			handler = new RoundRobinQueryHandler([endorser1, endorser2]);
		});

		it('returns peer valid results', async () => {
			query.send.resolves(validProposalResponses);
			handler._options = {timeout: 1};

			const result = await handler.evaluate(query);
			expect(result).to.be.equal(querySuccessResult);
		});

		it('returns an error with the peer invalid results', async () => {
			query.send.resolves(invalidProposalResponses);

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain(queryFailMessage);
			}
		});

		it('returns an error with the grpc sending error', async () => {
			query.send.resolves(errorProposalResponses);

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('ERROR_QUERY_RESULT');
			}
		});

		it('returns an error with internal sending error', async () => {
			query.send.rejects(new Error('Send failed'));

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('Send failed');
			}
		});
	});
});
