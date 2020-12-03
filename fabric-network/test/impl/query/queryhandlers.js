/*
 * Copyright 2018, 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

/*
		it('should handle a successful sign by the crypto suite', async () => {
			mockCryptoSuite.sign.withArgs(mockPrivateKey, digest, opts).resolves();
			await signer.sign(digest, opts);
			mockCryptoSuite.sign.should.have.been.calledOnceWithExactly(mockPrivateKey, digest, opts);
		});

		it('should handle an unsuccessful sign by the crypto suite', async () => {
			mockCryptoSuite.sign.withArgs(mockPrivateKey, digest, opts).rejects(new Error('such error'));
			await signer.sign(digest, opts).should.be.rejectedWith(/such error/);
		});
		*/

const {Endorser} = require('fabric-common');
const {QueryImpl: Query} = require('fabric-network/lib/impl/query/query');
const {SingleQueryHandler} = require('fabric-network/lib/impl/query/singlequeryhandler');
const {RoundRobinQueryHandler} = require('fabric-network/lib/impl/query/roundrobinqueryhandler');

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-as-promised'));

describe('QueryHandlers', () => {
	const s200ProposalResponse1 = {
		'peer1': {status: 200, payload: 'peer1-200', isEndorsed: true}
	};
	const s400ProposalResponse1 = {
		'peer1': {status: 400, payload: 'payload-peer1-400', message: 'peer1-400', isEndorsed: false}
	};
	const s500ProposalResponse1 = {
		'peer1': {status: 500, payload: 'payload-peer1-500', message: 'peer1-500', isEndorsed: false}
	};
	const errorProposalResponse1 = {
		'peer1': new Error('peer1-error')
	};
	const s200ProposalResponse2 = {
		'peer2': {status: 200, payload: 'peer2-200', isEndorsed: true}
	};
	const s400ProposalResponse2 = {
		'peer2': {status: 400, payload: 'payload-peer2-400', message: 'peer2-400', isEndorsed: false}
	};
	const s500ProposalResponse2 = {
		'peer2': {status: 500, payload: 'payload-peer2-500', message: 'peer2-500', isEndorsed: false}
	};
	const errorProposalResponse2 = {
		'peer2': new Error('peer2-error')
	};

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

	describe('SingleQueryHandler with one peer', () => {
		let handler;

		beforeEach(() => {
			handler = new SingleQueryHandler([endorser1]);
		});

		it('returns valid results - all good', async () => {
			query.evaluate.resolves(s200ProposalResponse1);

			const result = await handler.evaluate(query);
			expect(result).to.be.equal('peer1-200');
		});
		it('returns an error with the peer status 400 results', async () => {
			query.evaluate.resolves(s400ProposalResponse1);

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('peer1-400');
				expect(error.payload).to.contain('payload-peer1-400');
			}
		});
		it('returns an error with the peer status 500 results', async () => {
			query.evaluate.resolves(s500ProposalResponse1);

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('peer1-500');
				expect(error.payload).to.contain('payload-peer1-500');
			}
		});
		it('returns an error with the grpc sending error', async () => {
			query.evaluate.resolves(errorProposalResponse1);

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('peer1-error');
			}
		});
		it('returns an error with internal error', async () => {
			query.evaluate.rejects(new Error('Send failed'));

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('Send failed');
			}
		});
	});

	describe('SingleQueryHandler with two peers', () => {
		let handler;

		beforeEach(() => {
			handler = new SingleQueryHandler([endorser1, endorser2]);
		});

		it('returns valid results - all 200', async () => {
			query.evaluate.withArgs([endorser1]).resolves(s200ProposalResponse1);
			query.evaluate.withArgs([endorser2]).resolves(s200ProposalResponse2);

			const result = await handler.evaluate(query);
			expect(result).to.be.equal('peer1-200');
		});
		it('returns error results - with 400 first', async () => {
			query.evaluate.withArgs([endorser2]).resolves(s200ProposalResponse2);
			query.evaluate.withArgs([endorser1]).resolves(s400ProposalResponse1);

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('peer1-400');
				expect(error.payload).to.contain('payload-peer1-400');
			}
		});
		it('returns valid results - with 500 first', async () => {
			query.evaluate.withArgs([endorser2]).resolves(s200ProposalResponse2);
			query.evaluate.withArgs([endorser1]).resolves(s500ProposalResponse1);

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('peer1-500');
				expect(error.payload).to.contain('payload-peer1-500');
			}
		});
		it('returns valid results - with error', async () => {
			query.evaluate.withArgs([endorser2]).resolves(s200ProposalResponse2);
			query.evaluate.withArgs([endorser1]).resolves(errorProposalResponse1);

			const result = await handler.evaluate(query);
			expect(result).to.be.equal('peer2-200');
		});
		it('continues to use first peer with 400 return second peer', async () => {
			query.evaluate.withArgs([endorser1]).resolves(s200ProposalResponse1);
			query.evaluate.withArgs([endorser2]).resolves(s400ProposalResponse2);

			let result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(0);
			expect(result).to.be.equal('peer1-200');

			result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(0);
			expect(result).to.be.equal('peer1-200');

			result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(0);
			expect(result).to.be.equal('peer1-200');
		});
		it('continues to use second peer', async () => {
			query.evaluate.withArgs([endorser2]).resolves(s200ProposalResponse2);
			query.evaluate.withArgs([endorser1]).resolves(errorProposalResponse1);

			let result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(1);
			expect(result).to.be.equal('peer2-200');

			result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(1);
			expect(result).to.be.equal('peer2-200');

			result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(1);
			expect(result).to.be.equal('peer2-200');
		});
		it('switches to second peer after error', async () => {
			query.evaluate.withArgs([endorser1]).resolves(s200ProposalResponse1);
			query.evaluate.withArgs([endorser2]).resolves(s200ProposalResponse2);

			let result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(0);
			expect(result).to.be.equal('peer1-200');

			result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(0);
			expect(result).to.be.equal('peer1-200');


			query.evaluate.withArgs([endorser1]).resolves(errorProposalResponse1);
			result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(1);
			expect(result).to.be.equal('peer2-200');

			result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(1);
			expect(result).to.be.equal('peer2-200');
		});
		it('returns an error with the both peers 500 results', async () => {
			query.evaluate.withArgs([endorser1]).resolves(s500ProposalResponse1);
			query.evaluate.withArgs([endorser2]).resolves(s500ProposalResponse2);

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('peer1-500');
				expect(error.payload).to.contain('payload-peer1-500');
			}
		});
		it('returns an error with the grpc sending error', async () => {
			query.evaluate.withArgs([endorser1]).resolves(errorProposalResponse1);
			query.evaluate.withArgs([endorser2]).resolves(errorProposalResponse2);

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('peer1-error');
				expect(error.message).to.contain('peer2-error');
			}
		});
		it('returns an error with internal error', async () => {
			query.evaluate.rejects(new Error('Send failed'));

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('Send failed');
			}
		});
	});

	describe('RoundRobinQueryHandler with one peer', () => {
		let handler;

		beforeEach(() => {
			handler = new RoundRobinQueryHandler([endorser1]);
		});

		it('returns  valid results - all good', async () => {
			query.evaluate.resolves(s200ProposalResponse1);

			const result = await handler.evaluate(query);
			expect(result).to.be.equal('peer1-200');
		});
		it('returns an error with the peer status 400 results', async () => {
			query.evaluate.resolves(s400ProposalResponse1);

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('peer1-400');
				expect(error.payload).to.contain('payload-peer1-400');
			}
		});
		it('returns an error with the peer status 500 results', async () => {
			query.evaluate.resolves(s500ProposalResponse1);

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('peer1-500');
				expect(error.payload).to.contain('payload-peer1-500');
			}
		});
		it('returns an error with the grpc sending error', async () => {
			query.evaluate.resolves(errorProposalResponse1);

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('peer1-error');
			}
		});
		it('returns an error with internal sending error', async () => {
			query.evaluate.rejects(new Error('Send failed'));

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('Send failed');
			}
		});
	});

	describe('RoundRobinQueryHandler with two peers', () => {
		let handler;

		beforeEach(() => {
			handler = new RoundRobinQueryHandler([endorser1, endorser2]);
		});

		it('returns valid results - all 200', async () => {
			query.evaluate.withArgs([endorser1]).resolves(s200ProposalResponse1);
			query.evaluate.withArgs([endorser2]).resolves(s200ProposalResponse2);

			const result = await handler.evaluate(query);
			expect(result).to.be.equal('peer1-200');
		});
		it('returns error results - with 400 first', async () => {
			query.evaluate.withArgs([endorser2]).resolves(s200ProposalResponse2);
			query.evaluate.withArgs([endorser1]).resolves(s400ProposalResponse1);

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('peer1-400');
				expect(error.payload).to.contain('payload-peer1-400');
			}
		});
		it('returns valid results - with 500 first', async () => {
			query.evaluate.withArgs([endorser2]).resolves(s200ProposalResponse2);
			query.evaluate.withArgs([endorser1]).resolves(s500ProposalResponse1);

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('peer1-500');
				expect(error.payload).to.contain('payload-peer1-500');
			}
		});
		it('returns valid results - with error first', async () => {
			query.evaluate.withArgs([endorser2]).resolves(s200ProposalResponse2);
			query.evaluate.withArgs([endorser1]).resolves(errorProposalResponse1);

			const result = await handler.evaluate(query);
			expect(result).to.be.equal('peer2-200');
		});
		it('switches from peer1 to peer2 with 400 and 200', async () => {
			query.evaluate.withArgs([endorser1]).resolves(s200ProposalResponse1);
			query.evaluate.withArgs([endorser2]).resolves(s400ProposalResponse2);

			let result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(1);
			expect(result).to.be.equal('peer1-200');

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('peer2-400');
				expect(error.payload).to.contain('payload-peer2-400');
			}

			result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(1);
			expect(result).to.be.equal('peer1-200');
		});
		it('switches between peers', async () => {
			query.evaluate.withArgs([endorser2]).resolves(s200ProposalResponse2);
			query.evaluate.withArgs([endorser1]).resolves(s200ProposalResponse1);

			let result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(1);
			expect(result).to.be.equal('peer1-200');

			result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(0);
			expect(result).to.be.equal('peer2-200');

			result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(1);
			expect(result).to.be.equal('peer1-200');

			result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(0);
			expect(result).to.be.equal('peer2-200');
		});
		it('continues to use second peer', async () => {
			query.evaluate.withArgs([endorser2]).resolves(s200ProposalResponse2);
			query.evaluate.withArgs([endorser1]).resolves(errorProposalResponse1);

			let result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(1);
			expect(result).to.be.equal('peer2-200');

			result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(0);
			expect(result).to.be.equal('peer2-200');

			result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(1);
			expect(result).to.be.equal('peer2-200');
		});
		it('stays with second peer after error', async () => {
			query.evaluate.withArgs([endorser1]).resolves(s200ProposalResponse1);
			query.evaluate.withArgs([endorser2]).resolves(s200ProposalResponse2);

			let result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(1);
			expect(result).to.be.equal('peer1-200');

			result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(0);
			expect(result).to.be.equal('peer2-200');


			query.evaluate.withArgs([endorser1]).resolves(errorProposalResponse1);
			result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(1);
			expect(result).to.be.equal('peer2-200');

			result = await handler.evaluate(query);
			expect(handler.currentPeerIndex).to.be.equal(0);
			expect(result).to.be.equal('peer2-200');
		});
		it('returns an error with the both peers 500 results', async () => {
			query.evaluate.withArgs([endorser1]).resolves(s500ProposalResponse1);
			query.evaluate.withArgs([endorser2]).resolves(s500ProposalResponse2);

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('peer1-500');
				expect(error.payload).to.contain('payload-peer1-500');
			}
		});
		it('returns an error with the grpc sending error', async () => {
			query.evaluate.withArgs([endorser1]).resolves(errorProposalResponse1);
			query.evaluate.withArgs([endorser2]).resolves(errorProposalResponse2);

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('peer1-error');
				expect(error.message).to.contain('peer2-error');
			}
		});
		it('returns an error with internal error', async () => {
			query.evaluate.rejects(new Error('Send failed'));

			try {
				await handler.evaluate(query);
			} catch (error) {
				expect(error.message).to.contain('Send failed');
			}
		});
	});
});
