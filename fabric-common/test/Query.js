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

const TestUtils = require('./TestUtils');

describe('Query', () => {

	TestUtils.setCryptoConfigSettings();

	const client = new Client('myclient');
	const channel = client.newChannel('mychannel');

	let endorsement;

	beforeEach(async () => {
		endorsement = channel.newQuery('chaincode');
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

	describe('#toString', () => {
		it('should return string', () => {
			const string = endorsement.toString();
			should.equal(string, 'Query: {chaincodeId: chaincode, channel: mychannel}');
		});
	});
});
