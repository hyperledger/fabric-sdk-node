/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const rewire = require('rewire');
const ServiceEndpointRewire = rewire('../lib/ServiceEndpoint');
const ServiceEndpoint = require('../lib/ServiceEndpoint');
const Client = require('../lib/Client');

const chai = require('chai');
const should = chai.should();
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const sinon = require('sinon');

const fabprotos = require('fabric-protos');

describe('ServiceEndpoint', () => {
	const client = new Client('myclient');
	let serviceEndpoint;
	let endpoint;

	beforeEach(async () => {
		serviceEndpoint = new ServiceEndpointRewire('myserviceEndpoint', client, 'msp1');
		endpoint = client.newEndpoint({url: 'grpc://host:2700'});
		serviceEndpoint.endpoint = endpoint;
		serviceEndpoint.connected = true;
		serviceEndpoint.options = {};
		serviceEndpoint.service = sinon.stub();
	});

	describe('#constructor', () => {
		it('should require name', () => {
			(() => {
				new ServiceEndpoint();
			}).should.throw('Missing name parameter');
		});
		it('should require client', () => {
			(() => {
				new ServiceEndpoint('name');
			}).should.throw('Missing client parameter');
		});
	});

	describe('#setEndpoint', () => {
		it('should run', () => {
			serviceEndpoint.endpoint = undefined;
			serviceEndpoint.setEndpoint(endpoint, {key1: 'value1'});
			should.equal(serviceEndpoint.endpoint, endpoint);
			should.equal(serviceEndpoint.options.key1, 'value1');
		});
		it('should throw', () => {
			(() => {
				serviceEndpoint.setEndpoint(endpoint, {key1: 'value1'});
			}).should.throw('This service endpoint myserviceEndpoint-grpc://host:2700 is connected');
		});
	});

	describe('#isConnectable', () => {
		it('should be true if connected', () => {
			serviceEndpoint.connected = true;
			const result = serviceEndpoint.isConnectable();
			should.equal(result, false);
		});
		it('should be true if not connected and have endpoint assigned', () => {
			serviceEndpoint.connected = false;
			serviceEndpoint.endpoint = endpoint;
			const result = serviceEndpoint.isConnectable();
			should.equal(result, true);
		});
		it('should be false if not connected and have endpoint assigned but already tried to connect', () => {
			serviceEndpoint.connected = false;
			serviceEndpoint.endpoint = endpoint;
			serviceEndpoint.connectAttempted = true;
			const result = serviceEndpoint.isConnectable();
			should.equal(result, false);
		});
		it('should be false if not connected and no endpoint assigned', () => {
			serviceEndpoint.connected = false;
			serviceEndpoint.endpoint = undefined;
			const result = serviceEndpoint.isConnectable();
			should.equal(result, false);
		});
	});

	describe('#connect', () => {
		it('should reject if no endpoint', async () => {
			serviceEndpoint.connected = false;
			serviceEndpoint.service = null;
			serviceEndpoint.endpoint = null;
			await serviceEndpoint.connect().should.be.rejectedWith('Missing endpoint parameter');
		});

		it('should reject if connected', async () => {

			await serviceEndpoint.connect('send').should.be.rejectedWith(/is connected/);
		});
		it('should reject if service exist', async () => {
			serviceEndpoint.connected = false;
			await serviceEndpoint.connect('send').should.be.rejectedWith('This service endpoint myserviceEndpoint-grpc://host:2700 has an active grpc service connection');
		});
		it('should reject if timeout', async () => {
			serviceEndpoint.endpoint = null;
			serviceEndpoint.connected = false;
			serviceEndpoint.service = null;
			serviceEndpoint.serviceClass = fabprotos.protos.Endorser;
			endpoint.options['grpc-wait-for-ready-timeout'] = 100;
			await serviceEndpoint.connect(endpoint).should.be.rejectedWith(/Failed to connect/);
		});
		it('should run if connected', async () => {
			serviceEndpoint.endpoint = null;
			serviceEndpoint.connected = false;
			serviceEndpoint.service = null;
			serviceEndpoint.serviceClass = fabprotos.protos.Endorser;
			sinon.stub(serviceEndpoint, 'waitForReady').resolves(true);
			await serviceEndpoint.connect(endpoint);
			should.ok;
		});
	});

	describe('#disconnect', () => {
		it('should run if no service', () => {
			serviceEndpoint.service = null;
			serviceEndpoint.disconnect();
			serviceEndpoint.connected.should.be.true;
		});
		it('should run if service exist', () => {
			serviceEndpoint.service.close = sinon.stub().returns(true);
			serviceEndpoint.disconnect();
			serviceEndpoint.connected.should.be.false;
			should.equal(serviceEndpoint.service, null);
		});
	});

	describe('#checkConnection', () => {
		it('should run if connected', async () => {
			serviceEndpoint.connected = false;
			const results = await serviceEndpoint.checkConnection();
			results.should.be.false;
		});
		it('should run if connected', async () => {
			sinon.stub(serviceEndpoint, 'waitForReady').resolves(true);
			const results = await serviceEndpoint.checkConnection();
			results.should.be.true;
		});
		it('should get false if waitForReady fails', async () => {
			sinon.stub(serviceEndpoint, 'waitForReady').rejects(new Error('Failed to connect'));
			const results = await serviceEndpoint.checkConnection();
			results.should.be.false;
		});
	});

	describe('#waitForReady', () => {
		it('should reject if service does not exist', async () => {
			serviceEndpoint.service = null;
			await serviceEndpoint.waitForReady().should.be.rejectedWith(/grpc service has not been started/);
		});
		it('should reject service.waitForReady returns error.message', async () => {
			serviceEndpoint.service.waitForReady = function(timeout, callback) {
				const error = new Error('Fake fail');
				callback(error);
			};
			await serviceEndpoint.waitForReady().should.be.rejectedWith(/Fake fail on ServiceEndpoint/);
		});
		it('should reject service.waitForReady returns error as string', async () => {
			serviceEndpoint.service.waitForReady = function(timeout, callback) {
				const error = 'Fake fail';
				callback(error);
			};
			await serviceEndpoint.waitForReady().should.be.rejectedWith(/Fake fail/);
		});
		it('should resolve if service.waitForReady does not return an error', async () => {
			serviceEndpoint.service.waitForReady = function(timeout, callback) {
				const error = null;
				callback(error);
			};
			await serviceEndpoint.waitForReady();
			should.ok;
		});
	});

	describe('#getCharacteristics', () => {
		it('should get a good characteristics object', async () => {
			const something = sinon.stub();
			serviceEndpoint.getCharacteristics(something);
			something.connection.type.should.be.equal('ServiceEndpoint');
			something.connection.name.should.be.equal('myserviceEndpoint');
			something.connection.url.should.be.equal('grpc://host:2700');
			something.peer.should.be.equal('myserviceEndpoint');
		});
		it('should get a good characteristics object without endpoint', async () => {
			serviceEndpoint.endpoint = null;
			const something = sinon.stub();
			serviceEndpoint.getCharacteristics(something);
			something.connection.type.should.be.equal('ServiceEndpoint');
			something.connection.name.should.be.equal('myserviceEndpoint');
			something.connection.url.should.be.equal('');
			something.connection.options.should.be.deep.equal({});
			something.peer.should.be.equal('myserviceEndpoint');
		});
		it('should get a good characteristics object without clientKey', async () => {
			serviceEndpoint.endpoint.options.clientKey = 'clientKey';
			serviceEndpoint.endpoint.options.clientCert = 'clientCert';
			const something = sinon.stub();
			serviceEndpoint.getCharacteristics(something);
			something.connection.options.clientCert.should.be.equal('clientCert');
			should.equal(something.connection.options.clientKey, undefined);
		});
	});

	describe('#isTLS', () => {
		it('should get a false result', async () => {
			const results = serviceEndpoint.isTLS();
			results.should.be.false;
		});
		it('should get a true result', async () => {
			endpoint.protocol = 'grpcs';
			const results = serviceEndpoint.isTLS();
			results.should.be.true;
		});
		it('should get an error if not connected', () => {
			(() => {
				serviceEndpoint.endpoint = null;
				serviceEndpoint.isTLS();
			}).should.throw('ServiceEndpoint is not connected');
		});
		it('should get a true result', async () => {
			endpoint.protocol = 'grpcs';
			const results = serviceEndpoint.isTLS();
			results.should.be.true;
		});
	});

	describe('#toString', () => {
		it('should get a string url', async () => {
			const results = serviceEndpoint.toString();
			results.should.be.equal('ServiceEndpoint- name: myserviceEndpoint, url:grpc://host:2700');
		});
		it('should get a string result', async () => {
			serviceEndpoint.endpoint = null;
			const results = serviceEndpoint.toString();
			results.should.be.equal('ServiceEndpoint- name: myserviceEndpoint, url:<not connected>');
		});
	});
});
