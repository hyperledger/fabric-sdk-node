/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const rewire = require('rewire');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const should = chai.should();
chai.use(chaiAsPromised);
const sinon = require('sinon');

const Endpoint = rewire('../lib/Endpoint');

describe('Endpoint', () => {
	const pem = '-----BEGIN CERTIFICATE-----MIIB8TCC5l-----END CERTIFICATE-----';
	Endpoint.__set__('grpc.credentials.createSsl', sinon.stub().returns('ssl'));

	describe('#constructor', () => {
		it('should require an options', () => {
			(() => {
				new Endpoint();
			}).should.throw('Missing options parameter');
		});
		it('should require a url', () => {
			(() => {
				new Endpoint({});
			}).should.throw('Missing url parameter');
		});
		it('should require a valid url', () => {
			(() => {
				new Endpoint({url: 'http'});
			}).should.throw('Invalid protocol: Protocol must be grpc or grpcs');
		});
		it('should require a valid url', () => {
			(() => {
				new Endpoint({url: 'grpcs://host.com:8888'});
			}).should.throw('PEM encoded certificate is required.');
		});
		it('should work using a pem with grpcs', () => {
			const endpoint = new Endpoint({url: 'grpcs://host.com:8888', pem: pem});
			endpoint.addr.should.be.equal('host.com:8888');
		});
		it('should work using a grpc', () => {
			const endpoint = new Endpoint({url: 'grpc://host.com:8888'});
			endpoint.addr.should.be.equal('host.com:8888');
		});
		it('should work using a grpc and no port', () => {
			const endpoint = new Endpoint({url: 'grpc://host.com'});
			endpoint.addr.should.be.equal('host.com');
		});
		it('should require a valid url', () => {
			(() => {
				new Endpoint({
					url: 'grpcs://host.com:8888',
					pem: pem,
					clientKey: 'clientKey'
				});
			}).should.throw('clientKey and clientCert are both required.');
		});
		it('should require a valid url', () => {
			(() => {
				new Endpoint({
					url: 'grpcs://host.com:8888',
					pem: pem,
					clientKey: 'clientKey',
					clientCert: {}
				});
			}).should.throw('PEM encoded clientKey and clientCert are required.');
		});
		it('should work using a pem with grpcs', () => {
			const endpoint = new Endpoint({
				url: 'grpcs://host.com:8888',
				pem: pem,
				clientCert: 'clientCert',
				clientKey: 'clientKey'
			});
			endpoint.addr.should.be.equal('host.com:8888');
		});
		// it('should require an event', () => {
		// 	(() => {
		// 		new Endpoint('chaincode', {});
		// 	}).should.throw('Missing event parameter');
		// });
		// it('should default block listener', () => {
		// 	const el = new Endpoint('block', {});
		// 	el.type.should.equal('Endpoint');
		// 	el.unregister.should.be.false;
		// });
		// it('should default tx listener', () => {
		// 	const el = new Endpoint('tx', {}, {}, 'txid');
		// 	el.type.should.equal('Endpoint');
		// 	el.unregister.should.be.true;
		// });
		// it('should default chaincode listener', () => {
		// 	const el = new Endpoint('chaincode', {}, {}, 'event');
		// 	el.type.should.equal('Endpoint');
		// 	el.unregister.should.be.false;
		// });

	});

	describe('#isTLS', () => {
		it('should return false', () => {
			const endpoint = new Endpoint({url: 'grpc://host.com:8888'});
			should.equal(endpoint.isTLS(), false);
		});
		it('should return true', () => {
			const endpoint = new Endpoint({url: 'grpcs://host.com:8888', pem: pem});
			should.equal(endpoint.isTLS(), true);
		});
	});

	describe('#toString', () => {
		it('should return string', () => {
			const endpoint = new Endpoint({url: 'grpc://host.com:8888'});
			const string = endpoint.toString();
			should.equal(string,
				'Endpoint: {url: grpc://host.com:8888}');
		});
	});
});
