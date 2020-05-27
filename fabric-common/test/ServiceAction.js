/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const rewire = require('rewire');
const ServiceActionRewire = rewire('../lib/ServiceAction');
const ServiceAction = require('../lib/ServiceAction');
const Client = require('../lib/Client');

const chai = require('chai');
const should = chai.should();
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const User = require('../lib/User');
const TestUtils = require('./TestUtils');

describe('ServiceAction', () => {
	TestUtils.setCryptoConfigSettings();

	const client = new Client('myclient');
	client._tls_mutual.clientCertHash = Buffer.from('clientCertHash');

	const user = User.createUser('user', 'password', 'mspid', TestUtils.certificateAsPEM, TestUtils.keyAsPEM);
	const idx = client.newIdentityContext(user);
	let serviceAction;

	beforeEach(async () => {
		serviceAction = new ServiceActionRewire('myserviceAction', client, 'msp1');
	});

	describe('#constructor', () => {
		it('should require name', () => {
			(() => {
				new ServiceAction();
			}).should.throw('Missing name parameter');
		});
		it('should create a new instance', () => {
			const s2 = new ServiceAction('name');
			s2.name.should.be.equal('name');
			s2.type.should.be.equal('ServiceAction');
		});
	});

	describe('#_reset', () => {
		it('should reset', () => {
			should.equal(serviceAction._action, undefined);
			serviceAction._reset();
			serviceAction._action.should.be.deep.equal({init: false});
		});
	});

	describe('#build', () => {
		it('should indicate that needs to be implemented', () => {
			(() => {
				serviceAction.build();
			}).should.throw('"build" method must be implemented');
		});
	});

	describe('#sign', () => {
		it('should require param', () => {
			(() => {
				serviceAction.sign();
			}).should.throw('Missing param parameter');
		});
		it('should require a payload', () => {
			(() => {
				serviceAction.sign(idx);
			}).should.throw('The send payload has not been built');
		});
		it('should require a signature or identityContext', () => {
			(() => {
				serviceAction._payload = Buffer.from('payload');
				serviceAction.sign({});
			}).should.throw('param is an unknown signer or signature type');
		});
		it('should sign if identity context provided', () => {
			serviceAction._payload = Buffer.from('payload');
			serviceAction.sign(idx);
			should.exist(serviceAction._signature);
		});
		it('should sign if signature (byte array) provided', () => {
			serviceAction._payload = Buffer.from('payload');
			serviceAction.sign(Buffer.from('signature'));
			should.exist(serviceAction._signature);
		});
	});

	describe('#send', () => {
		it('should indicate that needs to be implemented', () => {
			(() => {
				serviceAction.send();
			}).should.throw('"send" method must be implemented');
		});
	});

	describe('#getSignedProposal', () => {
		it('should get signed proposal', () => {
			serviceAction._payload = Buffer.from('payload');
			serviceAction._signature = Buffer.from('signature');
			const signedProposal = serviceAction.getSignedProposal();
			should.equal(signedProposal.proposal_bytes.toString('hex'), serviceAction._payload.toString('hex'));
			should.equal(signedProposal.signature.toString('hex'), serviceAction._signature.toString('hex'));
		});
	});

	describe('#getSignedEnvelope', () => {
		it('should get signed envelope', () => {
			serviceAction._payload = Buffer.from('payload');
			serviceAction._signature = Buffer.from('signature');
			const signedEnvelope = serviceAction.getSignedEnvelope();
			should.equal(signedEnvelope.payload.toString('hex'), serviceAction._payload.toString('hex'));
			should.equal(signedEnvelope.signature.toString('hex'), serviceAction._signature.toString('hex'));
		});
	});

	describe('#_checkPayloadAndSignature', () => {
		it('should require a payload', () => {
			(() => {
				serviceAction._checkPayloadAndSignature();
			}).should.throw('The send payload has not been built');
		});
		it('should require a signature', () => {
			(() => {
				serviceAction._payload = Buffer.from('payload');
				serviceAction._checkPayloadAndSignature();
			}).should.throw('The send payload has not been signed');
		});
	});

	describe('#toString', () => {
		it('should indicate that needs to be implemented', () => {
			(() => {
				serviceAction.toString();
			}).should.throw('"toString" method must be implemented');
		});
	});
});
