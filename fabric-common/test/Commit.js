/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const rewire = require('rewire');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const should = chai.should();
chai.use(chaiAsPromised);
const sinon = require('sinon');

const Commit = rewire('../lib/Commit');
const Committer = require('../lib/Committer');
const Client = require('../lib/Client');
const User = rewire('../lib/User');
const TestUtils = require('./TestUtils');

describe('Commit', () => {
	TestUtils.setCryptoConfigSettings();
	const proposalResponse = TestUtils.createProposalResponse('something', 200);

	const client = new Client('myclient');
	client._tls_mutual.clientCertHash = Buffer.from('clientCertHash');
	const channel = client.newChannel('mychannel');

	const user = User.createUser('user', 'password', 'mspid', TestUtils.certificateAsPEM, TestUtils.keyAsPEM);
	const idx = client.newIdentityContext(user);
	const endorsement = channel.newEndorsement('chaincode');
	endorsement.build(idx);

	let commit;

	const fakeHandler = {
		commit: () => {
			return {status: 'SUCCESS'};
		}
	};
	const committer_results = {status: 'SUCCESS'};
	const fakeCommitter = sinon.createStubInstance(Committer);
	fakeCommitter.sendBroadcast.resolves(committer_results);
	fakeCommitter.checkConnection.resolves(true);
	fakeCommitter.type = 'Committer';
	fakeCommitter.name = 'mycommitter';

	beforeEach(() => {
		commit = endorsement.newCommit();
	});

	describe('#constructor', () => {
		it('should require a chaincodeId', () => {
			(() => {
				new Commit();
			}).should.throw('Missing chaincodeId parameter');
		});
		it('should require a Channel', () => {
			(() => {
				new Commit('chaincode');
			}).should.throw('Missing channel parameter');
		});
		it('should create', () => {
			const commit2 = new Commit('chaincode', channel);
			commit2.type.should.equal('Commit');
		});
	});

	describe('#build', () => {
		it('should require a idContext', () => {
			(() => {
				commit.build();
			}).should.throw('Missing idContext parameter');
		});
		it('should require a endorsement', () => {
			(() => {
				commit.build();
			}).should.throw('Missing idContext parameter');
		});
		it('should require a endorsement proposal', () => {
			(() => {
				commit._endorsement = null;
				commit.build(idx);
			}).should.throw('Missing endorsement parameter');
		});
		it('should require a endorsement proposal', () => {
			(() => {
				commit.build(idx);
			}).should.throw('Proposal has not been endorsed');
		});
		it('should require a endorsement proposal', () => {
			(() => {
				commit.build(idx, {endorsement: endorsement});
			}).should.throw('Proposal has not been endorsed');
		});
		it('should require a endorsement proposal', () => {
			(() => {
				endorsement._proposalResponses = [{}];
				commit.build(idx);
			}).should.throw('No valid endorsements found');
		});
		it('should build', () => {
			endorsement._proposalResponses = [];
			endorsement._proposalResponses.push(proposalResponse);
			commit.build(idx);
		});
	});

	describe('#send', () => {
		it('throws if targets is missing', async () => {
			endorsement._proposalResponses = [];
			endorsement._proposalResponses.push(proposalResponse);
			commit.build(idx);
			commit.sign(idx);
			await commit.send().should.be.rejectedWith('Missing targets parameter');
		});
		it('uses a handler', async () => {
			endorsement._proposalResponses = [];
			endorsement._proposalResponses.push(proposalResponse);
			commit.build(idx);
			commit.sign(idx);
			const request = {
				handler: fakeHandler
			};
			const results = await commit.send(request);
			should.equal(results.status, 'SUCCESS');
		});
		it('uses a target with good status', async () => {
			endorsement._proposalResponses = [];
			endorsement._proposalResponses.push(proposalResponse);
			commit.build(idx);
			commit.sign(idx);
			const request = {
				targets: [fakeCommitter]
			};
			const results = await commit.send(request);
			should.equal(results.status, 'SUCCESS');
		});
		it('uses a target with bad status', async () => {
			endorsement._proposalResponses = [];
			endorsement._proposalResponses.push(proposalResponse);
			commit.build(idx);
			commit.sign(idx);
			const request = {
				targets: [fakeCommitter]
			};
			committer_results.status = 'FAILED';
			const results = await commit.send(request);
			should.equal(results.status, 'FAILED');
		});
		it('uses a target with connection', async () => {
			endorsement._proposalResponses = [];
			endorsement._proposalResponses.push(proposalResponse);
			commit.build(idx);
			commit.sign(idx);
			fakeCommitter.checkConnection.resolves(false);
			const request = {
				targets: [fakeCommitter]
			};
			await commit.send(request).should.be.rejectedWith(/Committer mycommitter is not connected/);
		});
	});

	describe('#toString', () => {
		it('should return string', () => {
			const string = commit.toString();
			should.equal(string, 'Commit: {chaincodeId: chaincode, channel: mychannel}');
		});
	});
});
