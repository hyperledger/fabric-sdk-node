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

const fabproto6 = require('fabric-protos');

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
			should.equal(result, true);
		});
		it('should be true if not connected and have endpoint assigned', () => {
			serviceEndpoint.connected = false;
			serviceEndpoint.endpoint = endpoint;
			serviceEndpoint.serviceClass = sinon.stub();
			const result = serviceEndpoint.isConnectable();
			should.equal(result, true);
		});
		it('should be false if not connected and no endpoint assigned', () => {
			serviceEndpoint.connected = false;
			serviceEndpoint.endpoint = undefined;
			const result = serviceEndpoint.isConnectable();
			should.equal(result, false);
		});
		it('should be false if not connected and no service class assigned', () => {
			serviceEndpoint.connected = false;
			serviceEndpoint.endpoint = endpoint;
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
			serviceEndpoint.serviceClass = fabproto6.services.protos.Endorser;
			endpoint.options['grpc-wait-for-ready-timeout'] = 100;
			await serviceEndpoint.connect(endpoint).should.be.rejectedWith(/Failed to connect/);
		});
		it('should run if connected', async () => {
			serviceEndpoint.endpoint = null;
			serviceEndpoint.connected = false;
			serviceEndpoint.service = null;
			serviceEndpoint.serviceClass = fabproto6.services.protos.Endorser;
			sinon.stub(serviceEndpoint, 'waitForReady').resolves(true);
			await serviceEndpoint.connect(endpoint);
			should.ok;
		});
	});

	describe('#checkConnection', () => {
		it('should resolve false if not connected', async () => {
			serviceEndpoint.connected = false;
			sinon.stub(serviceEndpoint, 'waitForReady').resolves(true);
			sinon.stub(serviceEndpoint, 'resetConnection').resolves(true);
			sinon.stub(serviceEndpoint, 'isConnectable').resolves(true);

			const result = await serviceEndpoint.checkConnection(false);
			should.equal(result, false);
			sinon.assert.notCalled(serviceEndpoint.waitForReady);
			sinon.assert.notCalled(serviceEndpoint.resetConnection);
			sinon.assert.notCalled(serviceEndpoint.isConnectable);
		});
		it('should resolve true if connected', async () => {
			serviceEndpoint.connected = true;
			sinon.stub(serviceEndpoint, 'waitForReady').resolves(true);
			sinon.stub(serviceEndpoint, 'resetConnection').resolves(true);
			sinon.stub(serviceEndpoint, 'isConnectable').resolves(true);

			const result = await serviceEndpoint.checkConnection();
			should.equal(result, true);
		});
		it('should resolve false if not connected and not able to reset', async () => {
			serviceEndpoint.connected = false;
			sinon.stub(serviceEndpoint, 'resetConnection').resolves(false);
			sinon.stub(serviceEndpoint, 'isConnectable').resolves(true);

			const result = await serviceEndpoint.checkConnection();
			should.equal(result, false);
			sinon.assert.calledOnce(serviceEndpoint.resetConnection);
		});
		it('should resolve true if not connected and able to reset', async () => {
			serviceEndpoint.connected = false;
			serviceEndpoint.resetConnection = () => {
				return new Promise((resolve, reject) => {
					serviceEndpoint.connected = true;
					resolve(true);
				});
			};
			sinon.stub(serviceEndpoint, 'isConnectable').resolves((true));

			const result = await serviceEndpoint.checkConnection();
			should.equal(result, true);
		});
		it('should resolve true if connection fails, but able to reset', async () => {
			serviceEndpoint.connected = true;
			sinon.stub(serviceEndpoint, 'waitForReady').resolves(false);
			sinon.stub(serviceEndpoint, 'resetConnection').resolves(true);
			sinon.stub(serviceEndpoint, 'isConnectable').resolves(true);

			const result = await serviceEndpoint.checkConnection();
			should.equal(result, true);
		});
		it('should resolve false if not connectable', async () => {
			serviceEndpoint.connected = false;
			sinon.stub(serviceEndpoint, 'waitForReady').resolves(false);
			sinon.stub(serviceEndpoint, 'resetConnection').resolves(false);
			sinon.stub(serviceEndpoint, 'isConnectable').resolves(false);

			const result = await serviceEndpoint.checkConnection();
			should.equal(result, false);
			sinon.assert.notCalled(serviceEndpoint.waitForReady);
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

	describe('#resetConnection', () => {
		it('should run', async () => {
			sinon.stub(serviceEndpoint, 'disconnect').returns(true);
			sinon.stub(serviceEndpoint, 'waitForReady').resolves(true);
			serviceEndpoint.endpoint = sinon.stub();
			serviceEndpoint.serviceClass = sinon.stub();
			await serviceEndpoint.resetConnection();
		});
		it('should fail', async () => {
			sinon.stub(serviceEndpoint, 'disconnect').returns(true);
			sinon.stub(serviceEndpoint, 'waitForReady').resolves(true);
			await serviceEndpoint.resetConnection().should.be.rejectedWith(/is missing endpoint information/);
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
			results.should.be.equal('ServiceEndpoint- name: myserviceEndpoint, url:grpc://host:2700, connected:true, connectAttempted:false');
		});
		it('should get a string result', async () => {
			serviceEndpoint.endpoint = null;
			const results = serviceEndpoint.toString();
			results.should.be.equal('ServiceEndpoint- name: myserviceEndpoint, url:<not connected>, connected:true, connectAttempted:false');
		});
	});
});
