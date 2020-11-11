/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
/* eslint-disable no-useless-call */

const rewire = require('rewire');
const EndorserRewire = rewire('../lib/Endorser');
const Endorser = require('../lib/Endorser');
const Client = require('../lib/Client');

const chai = require('chai');
const should = chai.should();
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const sinon = require('sinon');

describe('Endorser', () => {
	const client = new Client('myclient');
	let endorser;
	let endpoint;

	beforeEach(async () => {
		endorser = new EndorserRewire('myendorser', client, 'msp1');
		endpoint = client.newEndpoint({url: 'grpc://host:2700'});
		endorser.endpoint = endpoint;
		endorser.connected = true;
		endorser.options = {};
		endorser.service = sinon.stub();
	});

	describe('#constructor', () => {
		it('should require name', () => {
			(() => {
				new Endorser();
			}).should.throw('Missing name parameter');
		});
		it('should require client', () => {
			(() => {
				new Endorser('name');
			}).should.throw('Missing client parameter');
		});
	});

	describe('#addChaincode', () => {
		const defaultChaincodes = ['cscc', 'qscc', 'lscc', 'vscc', 'escc'];
		it('should run without name', () => {
			endorser.addChaincode();
			endorser.chaincodes.should.be.deep.equal(defaultChaincodes);
		});
		it('should run with name', () => {
			endorser.addChaincode('chaincode');
			endorser.chaincodes.should.be.deep.equal(defaultChaincodes.concat(['chaincode']));
		});
		it('should run with same name', () => {
			endorser.addChaincode('chaincode');
			endorser.addChaincode('chaincode');
			endorser.chaincodes.should.be.deep.equal(defaultChaincodes.concat(['chaincode']));
		});
		it('should run with different name', () => {
			endorser.addChaincode('chaincode');
			endorser.addChaincode('other');
			endorser.chaincodes.should.be.deep.equal(defaultChaincodes.concat(['chaincode', 'other']));
		});
	});

	describe('#hasChaincode', () => {
		it('should be false without name and not discovered', () => {
			const result = endorser.hasChaincode();
			result.should.be.false;
		});
		it('should be false without name and discovered', () => {
			endorser.discovered = true;
			const result = endorser.hasChaincode();
			result.should.be.false;
		});
		it('should be true with name and not discovered', () => {
			const result = endorser.hasChaincode('chaincode');
			result.should.be.true;
		});
		it('should be false with name and no chaincodes discovered', () => {
			endorser.discovered = true;
			const result = endorser.hasChaincode('chaincode');
			result.should.be.false;
		});
		it('should be true with name and found and not discovered', () => {
			endorser.chaincodes = ['chaincode'];
			const result = endorser.hasChaincode('chaincode');
			result.should.be.true;
		});
		it('should be true with name and found and discovered', () => {
			endorser.discovered = true;
			endorser.addChaincode('chaincode');
			const result = endorser.hasChaincode('chaincode');
			result.should.be.true;
		});
		it('should be true with name and found using "maybe" and not discovered', () => {
			endorser.addChaincode('chaincode');
			const result = endorser.hasChaincode('chaincode', false);
			result.should.be.true;
		});
		it('should be true with name and found using "maybe" and discovered', () => {
			endorser.discovered = true;
			endorser.addChaincode('chaincode');
			const result = endorser.hasChaincode('chaincode', false);
			result.should.be.true;
		});
	});

	describe('#sendProposal', () => {
		it('should reject if no proposal', async () => {
			await endorser.sendProposal().should.be.rejectedWith(/Missing signedProposal parameter/);
		});

		it('should reject if not connected', async () => {
			endorser.connected = false;
			await endorser.sendProposal('send').should.be.rejectedWith(/is not connected/);
		});
		it('should reject on timeout', async () => {
			function Fake(params, callback) {
				setTimeout(() => {
					callback.call(null, 'timeout not honoured');
				}, 10);
			}
			endorser.service.processProposal = sinon.stub().callsFake(Fake);

			await endorser.sendProposal('send', 0).should.be.rejectedWith(/REQUEST TIMEOUT/);

		});
		it('should reject Error object on proposal response error string', async () => {
			function Fake(params, callback) {
				callback.call(null, 'i_am_an_error', null);
			}
			endorser.service.processProposal = sinon.stub().callsFake(Fake);

			await endorser.sendProposal('send').should.be.rejectedWith(/i_am_an_error/);
		});
		it('should reject Error object on send response error object', async () => {
			function Fake(params, callback) {
				callback.call(null, new Error('FORCED_ERROR'), null);
			}
			endorser.service.processProposal = sinon.stub().callsFake(Fake);

			await endorser.sendProposal('send').should.be.rejectedWith(/FORCED_ERROR/);
		});

		it('should eject on undefined proposal response', async () => {
			function Fake(params, callback) {
				callback.call(null, null, null);
			}
			endorser.service.processProposal = sinon.stub().callsFake(Fake);

			await endorser.sendProposal('send').should.be.rejectedWith(/GRPC service got a null or undefined response from the peer/);
		});

		it('should log and reject on invalid proposal response', async () => {
			function Fake(params, callback) {
				callback.call(null, null, {data: 'invalid'});
			}
			endorser.service.processProposal = sinon.stub().callsFake(Fake);

			await endorser.sendProposal('send').should.be.rejectedWith(/GRPC service failed to get a proper response from the peer/);
		});

		it('should reject on proposal response error status greater than or equal to 400', async () => {
			function Fake(params, callback) {
				callback.call(null, null, {response: {status: 400, message: 'fail_string'}});
			}
			endorser.service.processProposal = sinon.stub().callsFake(Fake);

			const results = await endorser.sendProposal('send');
			results.response.status.should.equal(400);
			results.response.message.should.equal('fail_string');
			results.connection.name.should.equal('myendorser');
			results.connection.url.should.equal('grpc://host:2700');
		});

		it('should resolve on valid proposal response', async () => {
			const myResponse = {response: {status: 399, message: 'passed_values'}};
			function Fake(params, callback) {
				callback.call(null, null, myResponse);
			}
			endorser.service.processProposal = sinon.stub().callsFake(Fake);

			const response = await endorser.sendProposal('send');
			response.should.deep.equal(myResponse);
			response.connection.name.should.equal('myendorser');
			response.connection.url.should.equal('grpc://host:2700');
		});

		it('should mark errors from chaincode as proposal response', async () => {
			const myResponse = {response: {status: 500, message: 'some error'}};
			function Fake(params, callback) {
				callback.call(null, null, myResponse);
			}

			endorser.service.processProposal = sinon.stub().callsFake(Fake);

			try {
				const results = await endorser.sendProposal('send');
				results.response.status.should.equal(500);
				results.response.message.should.equal('some error');
				results.connection.name.should.equal('myendorser');
				results.connection.url.should.equal('grpc://host:2700');
			} catch (err) {
				should.fail();
			}
		});

		it('should not mark errors as proposal response if not a proposal response', async () => {
			function Fake(params, callback) {
				setTimeout(() => {
					callback.call(null, 'timeout not honoured');
				}, 10);
			}
			endorser.service.processProposal = sinon.stub().callsFake(Fake);

			try {
				await endorser.sendProposal('send', 0);
				should.fail();
			} catch (error) {
				should.equal(error.isProposalResponse, undefined);
			}
		});
	});
});
