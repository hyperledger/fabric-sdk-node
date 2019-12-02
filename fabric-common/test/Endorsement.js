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

const Endorsement = rewire('../lib/Endorsement');
const Client = require('../lib/Client');

const TestUtils = require('./TestUtils');

describe('Endorsement', () => {

	TestUtils.setCryptoConfigSettings();

	const client = new Client('myclient');
	const channel = client.newChannel('mychannel');

	let endorsement;

	beforeEach(async () => {
		endorsement = channel.newEndorsement('chaincode');
	});

	describe('#constructor', () => {
		it('should require a name', () => {
			(() => {
				new Endorsement();
			}).should.throw('Missing chaincodeId parameter');
		});
		it('should require a Channel', () => {
			(() => {
				new Endorsement('chaincode');
			}).should.throw('Missing channel parameter');
		});
		it('should create', () => {
			const p2 = new Endorsement('chaincode', channel);
			p2.type.should.equal('Endorsement');
		});
	});

	describe('#newCommit', () => {
		it('should return string', () => {
			const commit = endorsement.newCommit();
			should.equal(commit.type, 'Commit');
		});
	});

	describe('#toString', () => {
		it('should return string', () => {
			const string = endorsement.toString();
			should.equal(string, 'Endorsement: {chaincodeId: chaincode, channel: mychannel}');
		});
	});
});
