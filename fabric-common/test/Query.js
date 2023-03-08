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

const Query = rewire('../lib/Query');
const Client = require('../lib/Client');
const User = rewire('../lib/User');
const TestUtils = require('./TestUtils');
const sinon = require('sinon');

describe('Query', () => {

	TestUtils.setCryptoConfigSettings();

	const client = new Client('myclient');
	const channel = client.newChannel('mychannel');

	const user = User.createUser('user', 'password', 'mspid', TestUtils.certificateAsPEM, TestUtils.keyAsPEM);
	const idx = client.newIdentityContext(user);

	let query;
	let endorser;

	beforeEach(async () => {
		query = channel.newQuery('chaincode');
		endorser = client.newEndorser('mypeer');
	});

	describe('#constructor', () => {
		it('should require a name', () => {
			(() => {
				new Query();
			}).should.throw('Missing chaincodeId parameter');
		});
		it('should require a Channel', () => {
			(() => {
				new Query('chaincode');
			}).should.throw('Missing channel parameter');
		});
		it('should create', () => {
			const p2 = new Query('chaincode', channel);
			p2.type.should.equal('Query');
		});
	});

	describe('overwrite send', () => {
		it('should have queryResults when this is a query', async () => {
			query.build(idx);
			query.sign(idx);

			sinon.stub(endorser, 'sendProposal').resolves({response: {status: 400, payload: 'query payload'}});
			const results = await query.send({targets: [endorser]});
			should.exist(results.queryResults);
			if (results.queryResults && results.queryResults[0]) {
				should.equal(results.queryResults[0], 'query payload');
			}
		});
		it('should have empty queryResults when this is a query and no good responses', async () => {
			query.build(idx);
			query.sign(idx);

			sinon.stub(endorser, 'sendProposal').resolves({response: {status: 200}});
			const results = await query.send({targets: [endorser]});
			results.queryResults.should.be.an('array').that.is.empty;
		});
		it('should have empty queryResults when this is a query and unknown responses', async () => {
			query.build(idx);
			query.sign(idx);
			sinon.stub(endorser, 'sendProposal').resolves({response: {payload: 'query payload'}});
			const results = await query.send({targets: [endorser]});
			results.queryResults.should.be.an('array').that.is.empty;
		});
	});

	describe('#toString', () => {
		it('should return string', () => {
			const string = query.toString();
			should.equal(string, 'Query: {chaincodeId: chaincode, channel: mychannel}');
		});
	});
});
