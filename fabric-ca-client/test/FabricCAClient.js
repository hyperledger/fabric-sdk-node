/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const rewire = require('rewire');
const FabricCAClientRewire = rewire('../lib/FabricCAClient.js');
const CryptoSuite = require('fabric-common/lib/impl/CryptoSuite_ECDSA_AES.js');

const http = require('http');
const https = require('https');
const events = require('events');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const should = chai.should();
const sinon = require('sinon');

describe('FabricCAClient', () => {
	const cryptoPrimitives = sinon.createStubInstance(CryptoSuite);
	cryptoPrimitives.name = 'testCrypto';

	describe('#constructor', () => {

		let revert;

		beforeEach(() => {
			revert = null;
		});

		afterEach(() => {
			if (revert) {
				revert();
			}
		});

		it('should call "_validateConnectionOpts"', async () => {
			const validateStub = sinon.stub();
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype._validateConnectionOpts', validateStub);

			new FabricCAClientRewire({}, {});
			sinon.assert.calledOnce(validateStub);
		});

		it('should throw if called with invalid connection options', async () => {
			(() => {
				new FabricCAClientRewire({}, {});
			}).should.throw(/Invalid connection options/);
		});

		it('should set all base properties of the client', () => {
			const validateStub = sinon.stub();
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype._validateConnectionOpts', validateStub);

			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);

			client._port.should.equal(7054);
			client._tlsOptions.should.deep.equal({trustedRoots: [], verify: false});
			client._caName.should.equal('test-ca-name');
			client._httpClient.should.deep.equal(https);
			client._hostname.should.equal('testHost');
			client._baseAPI.should.equal('/api/v1/');
			client._cryptoPrimitives.should.equal(cryptoPrimitives);
		});

		it('should set http if provided', () => {
			const validateStub = sinon.stub();
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype._validateConnectionOpts', validateStub);

			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'http',
				hostname: 'testHost'
			};

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);

			client._httpClient.should.deep.equal(http);
		});

		it('should set port if provided', () => {
			const validateStub = sinon.stub();
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype._validateConnectionOpts', validateStub);

			const connect_opts = {
				caname: 'test-ca-name',
				hostname: 'testHost',
				port: 42
			};

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);

			client._port.should.equal(42);
		});

		it('should set _tlsOptions if provided', () => {
			const validateStub = sinon.stub();
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype._validateConnectionOpts', validateStub);

			const opts = {trustedRoots: 'much root', verify: false};
			const connect_opts = {
				caname: 'test-ca-name',
				hostname: 'testHost',
				tlsOptions: opts
			};

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);

			client._tlsOptions.should.deep.equal(opts);
		});

		it('should default _tlsOptions.verify if not provided in opts', () => {
			const validateStub = sinon.stub();
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype._validateConnectionOpts', validateStub);

			const opts = {trustedRoots: 'much root'};
			const connect_opts = {
				caname: 'test-ca-name',
				hostname: 'testHost',
				tlsOptions: opts
			};

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);

			client._tlsOptions.should.deep.equal({trustedRoots: 'much root', verify: true});
		});

		it('should default _tlsOptions.trustedRoots if not provided in opts', () => {
			const validateStub = sinon.stub();
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype._validateConnectionOpts', validateStub);

			const opts = {verify: false};
			const connect_opts = {
				caname: 'test-ca-name',
				hostname: 'testHost',
				tlsOptions: opts
			};

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);

			client._tlsOptions.should.deep.equal({trustedRoots: [], verify: false});
		});
	});

	describe('#register', () => {

		let revert;

		beforeEach(() => {
			revert = null;
		});

		afterEach(() => {
			if (revert) {
				revert();
			}
		});

		it('should throw if called with too few parameters', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.register('one', 'too', 'few', 'parameters', 'for', 'this_function_call').should.be.rejectedWith(/Missing required parameters/);
		});

		it('should throw if called with maxEnrollements that is not a number', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.register(null, null, null, null, 'string_num', null, null).should.be.rejectedWith(/Parameter 'maxEnrollments' must be a number/);
		});

		it('should call POST with the correct method, request, and signing identity', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const postStub = sinon.stub();
			postStub.resolves({result: {secret: 'shhh!'}});
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.post', postStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.register('enrollmentID', 'enrollmentSecret', 'role', 'affiliation', 2, 'atts', 'signingIdentity');

			// should call post
			sinon.assert.calledOnce(postStub);

			// should call with known
			const callArgs = postStub.getCall(0).args;
			callArgs[0].should.equal('register');
			callArgs[1].should.deep.equal({
				affiliation: 'affiliation',
				attrs: 'atts',
				id: 'enrollmentID',
				max_enrollments: 2,
				secret: 'enrollmentSecret',
				type: 'role'
			});
			callArgs[2].should.equal('signingIdentity');
		});

		it('should call POST without the type in the request if no role provided', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const postStub = sinon.stub();
			postStub.resolves({result: {secret: 'shhh!'}});
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.post', postStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.register('enrollmentID', 'enrollmentSecret', null, 'affiliation', 2, 'atts', 'signingIdentity');

			// should call post
			sinon.assert.calledOnce(postStub);

			// should call with known
			const callArgs = postStub.getCall(0).args;
			callArgs[1].should.deep.equal({
				affiliation: 'affiliation',
				attrs: 'atts',
				id: 'enrollmentID',
				max_enrollments: 2,
				secret: 'enrollmentSecret'
			});
		});

		it('should call POST without the secret in the request if no enrollmentSecret provided', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const postStub = sinon.stub();
			postStub.resolves({result: {secret: 'shhh!'}});
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.post', postStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.register('enrollmentID', null, 'role', 'affiliation', 2, 'atts', 'signingIdentity');

			// should call post
			sinon.assert.calledOnce(postStub);

			// should call with known
			const callArgs = postStub.getCall(0).args;
			callArgs[1].should.deep.equal({
				affiliation: 'affiliation',
				attrs: 'atts',
				id: 'enrollmentID',
				max_enrollments: 2,
				type: 'role'
			});
		});

		it('should reject on POST failure', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const postStub = sinon.stub();
			postStub.rejects(new Error('forced error'));
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.post', postStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.register('enrollmentID', 'enrollmentSecret', 'role', 'affiliation', 2, null, 'signingIdentity').should.be.rejectedWith('forced error');

		});
	});

	describe('#revoke', () => {

		let revert;

		beforeEach(() => {
			revert = null;
		});

		afterEach(() => {
			if (revert) {
				revert();
			}
		});

		it('should throw if not called with the correct number of parameters', async () => {

			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.revoke('one_too', 'few', 'parameters_for', 'this_function_call').should.be.rejectedWith(/Missing required parameters/);
		});

		it('should call POST with the correct method, request, and signing identity', () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const postStub = sinon.stub();
			postStub.resolves({result: {secret: 'shhh!'}});
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.post', postStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			client.revoke('enrollmentID', 'aki', 'serial', 'reason', false, 'signingIdentity');

			// should call post
			sinon.assert.calledOnce(postStub);

			// should call with known
			const callArgs = postStub.getCall(0).args;
			callArgs[0].should.equal('revoke');
			callArgs[1].should.deep.equal({
				id: 'enrollmentID',
				aki: 'aki',
				serial: 'serial',
				reason: 'reason',
				gencrl: false
			});
			callArgs[2].should.equal('signingIdentity');
		});

		it('should reject on POST failure', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const postStub = sinon.stub();
			postStub.rejects(new Error('forced error'));
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.post', postStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.revoke('enrollmentID', 'aki', 'serial', 'reason', 'signingIdentity').should.be.rejectedWith('forced error');
		});
	});

	describe('#reenroll', () => {

		let revert;

		beforeEach(() => {
			revert = null;
		});

		afterEach(() => {
			if (revert) {
				revert();
			}
		});

		it('should throw if not called with the correct number of parameters', async () => {

			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.reenroll('one_too_few_parameters_for_this_function_call').should.be.rejectedWith(/Missing required parameters/);
		});

		it('should call POST with the correct method, request, and signing identity', () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const postStub = sinon.stub();
			postStub.resolves({result: {secret: 'shhh!'}});
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.post', postStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			client.reenroll('csr', 'signingIdentity', 'attr_reqs');

			// should call post
			sinon.assert.calledOnce(postStub);

			// should call with known
			const callArgs = postStub.getCall(0).args;
			callArgs[0].should.equal('reenroll');
			callArgs[1].should.deep.equal({
				certificate_request: 'csr',
				attr_reqs: 'attr_reqs'
			});
			callArgs[2].should.equal('signingIdentity');
		});

		it('should call POST without attributes if not provided', () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const postStub = sinon.stub();
			postStub.resolves({result: {secret: 'shhh!'}});
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.post', postStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			client.reenroll('csr', 'signingIdentity');

			// should call post
			sinon.assert.calledOnce(postStub);

			// should call with known
			const callArgs = postStub.getCall(0).args;
			callArgs[1].should.deep.equal({
				certificate_request: 'csr'
			});
		});

		it('should reject on POST failure', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const postStub = sinon.stub();
			postStub.rejects(new Error('forced error'));
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.post', postStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.reenroll('csr', 'signingIdentity', 'attr_reqs').should.be.rejectedWith('forced error');
		});
	});

	describe('#newIdentityService', () => {

		let revert;

		beforeEach(() => {
			revert = null;
		});

		afterEach(() => {
			if (revert) {
				revert();
			}
		});

		it('should return a new instance of IdentityService', () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const postStub = sinon.stub();
			postStub.resolves({result: {secret: 'shhh!'}});
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.post', postStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			const result = client.newIdentityService();
			result.constructor.name.should.equal('IdentityService');
		});
	});

	describe('#newAffiliationService', () => {

		let revert;

		beforeEach(() => {
			revert = null;
		});

		afterEach(() => {
			if (revert) {
				revert();
			}
		});

		it('should return a new instance of AffiliationService', () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const postStub = sinon.stub();
			postStub.resolves({result: {secret: 'shhh!'}});
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.post', postStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			const result = client.newAffiliationService();
			result.constructor.name.should.equal('AffiliationService');
		});
	});

	describe('#newCertificateService', () => {

		let revert;

		beforeEach(() => {
			revert = null;
		});

		afterEach(() => {
			if (revert) {
				revert();
			}
		});

		it('should return a new instance of CertificateService', () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const postStub = sinon.stub();
			postStub.resolves({result: {secret: 'shhh!'}});
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.post', postStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			const result = client.newCertificateService();
			result.constructor.name.should.equal('CertificateService');
		});
	});

	describe('#post', () => {

		let revert;

		beforeEach(() => {
			revert = null;
		});

		afterEach(() => {
			if (revert) {
				revert();
			}
		});

		it('should call a POST request with the passed parameters', () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const requestStub = sinon.stub();
			requestStub.resolves();
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.request', requestStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			client.post('api_method', 'requestObj', 'signingIdentity');

			// should call post
			sinon.assert.calledOnce(requestStub);

			// should call with known
			const callArgs = requestStub.getCall(0).args;
			callArgs[0].should.equal('POST');
			callArgs[1].should.equal('api_method');
			callArgs[2].should.equal('signingIdentity');
			callArgs[3].should.equal('requestObj');
		});
	});

	describe('#delete', () => {

		let revert;

		beforeEach(() => {
			revert = null;
		});

		afterEach(() => {
			if (revert) {
				revert();
			}
		});

		it('should call a DELETE request with the passed parameters', () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const requestStub = sinon.stub();
			requestStub.resolves();
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.request', requestStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			client.delete('api_method', 'signingIdentity');

			// should call post
			sinon.assert.calledOnce(requestStub);

			// should call with known
			const callArgs = requestStub.getCall(0).args;
			callArgs[0].should.equal('DELETE');
			callArgs[1].should.equal('api_method');
			callArgs[2].should.equal('signingIdentity');
		});
	});

	describe('#get', () => {

		let revert;

		beforeEach(() => {
			revert = null;
		});

		afterEach(() => {
			if (revert) {
				revert();
			}
		});

		it('should call a GET request with the passed parameters', () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const requestStub = sinon.stub();
			requestStub.resolves();
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.request', requestStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			client.get('api_method', 'signingIdentity');

			// should call post
			sinon.assert.calledOnce(requestStub);

			// should call with known
			const callArgs = requestStub.getCall(0).args;
			callArgs[0].should.equal('GET');
			callArgs[1].should.equal('api_method');
			callArgs[2].should.equal('signingIdentity');
		});
	});

	describe('#put', () => {
		let revert;

		beforeEach(() => {
			revert = null;
		});

		afterEach(() => {
			if (revert) {
				revert();
			}
		});

		it('should call a PUT request with the passed parameters', () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const requestStub = sinon.stub();
			requestStub.resolves();
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.request', requestStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			client.put('api_method', 'requestObj', 'signingIdentity');

			// should call post
			sinon.assert.calledOnce(requestStub);

			// should call with known
			const callArgs = requestStub.getCall(0).args;
			callArgs[0].should.equal('PUT');
			callArgs[1].should.equal('api_method');
			callArgs[2].should.equal('signingIdentity');
			callArgs[3].should.equal('requestObj');
		});
	});

	describe('#request', () => {

		let revert = [];
		let requestStub;

		beforeEach(() => {
			requestStub = sinon.stub(http, 'request');
			revert = [];
		});

		afterEach(() => {
			requestStub.restore();
			if (revert.length) {
				revert.forEach(Function.prototype.call, Function.prototype.call);
			}
		});

		it('should reject if not passed the required parameters', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'http',
				hostname: 'testHost'
			};

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.request('one_too', 'few_parameters_for_this_function_call').should.be.rejectedWith(/Missing required parameters/);
		});

		it('should pass a correctly formulated request options', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'http',
				hostname: 'testHost'
			};

			requestStub.callsFake((options, callback) => {

				// Create a mock response object...
				const res = new events.EventEmitter();
				res.setEncoding = function () {
				};
				callback(res);

				// ...and then respond with our predefined data.
				res.emit('data', '{"my_data": "test_data", "success": "true", "result" : {"Cert" : "dGVzdF9jZXJ0", "ServerInfo": {"CAChain": "dGVzdF9jaGFpbg=="}}}');
				res.emit('end');
				return new events.EventEmitter();
			});

			revert.push(FabricCAClientRewire.__set__('FabricCAClient.prototype.http', requestStub));

			const generateAuthTokenStub = sinon.stub();
			generateAuthTokenStub.returns('test_authToken');
			revert.push(FabricCAClientRewire.__set__('FabricCAClient.prototype.generateAuthToken', generateAuthTokenStub));

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.request('test_http_method', 'test_api_method', 'signingIdentity', {});

			// Should be called once
			sinon.assert.calledOnce(requestStub);

			// should call with known
			const expected = {
				hostname: 'testHost',
				port: 7054,
				path: '/api/v1/test_api_method',
				method: 'test_http_method',
				headers: {
					Authorization: 'test_authToken'
				},
				ca: [],
				rejectUnauthorized: false,
				timeout: 3000
			};
			const callArgs = requestStub.getCall(0).args;
			callArgs.length.should.be.equal(2);
			callArgs[0].should.deep.equal(expected);
		});

		it('should return the response data on success', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'http',
				hostname: 'testHost'
			};

			requestStub.callsFake((options, callback) => {

				// Create a mock response object...
				const res = new events.EventEmitter();
				res.setEncoding = function () {
				};
				callback(res);

				// ...and then respond with our predefined data.
				res.emit('data', '{"my_data": "test_data", "success": true}');
				res.emit('end');
				return new events.EventEmitter();
			});

			revert.push(FabricCAClientRewire.__set__('FabricCAClient.prototype.http', requestStub));

			const generateAuthTokenStub = sinon.stub();
			generateAuthTokenStub.returns('test_authToken');
			revert.push(FabricCAClientRewire.__set__('FabricCAClient.prototype.generateAuthToken', generateAuthTokenStub));

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			const result = await client.request('test_http_method', 'test_api_method', 'signingIdentity', {});
			result.should.deep.equal({my_data: 'test_data', success: true});
		});

		it('should reject if no success message', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'http',
				hostname: 'testHost'
			};

			requestStub.callsFake((options, callback) => {

				// Create a mock response object...
				const res = new events.EventEmitter();
				res.setEncoding = function () {
				};
				callback(res);

				// ...and then respond with our predefined data.
				res.emit('data', '{"errors": "forced_errors"}');
				res.emit('end');
				return new events.EventEmitter();
			});

			revert.push(FabricCAClientRewire.__set__('FabricCAClient.prototype.http', requestStub));

			const generateAuthTokenStub = sinon.stub();
			generateAuthTokenStub.returns('test_authToken');
			revert.push(FabricCAClientRewire.__set__('FabricCAClient.prototype.generateAuthToken', generateAuthTokenStub));

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.request('test_http_method', 'test_api_method', 'signingIdentity', {}).should.be.rejectedWith(/fabric-ca request test_api_method failed with errors \['forced_errors']/);
		});

		it('should reject if invalid jason recieved', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'http',
				hostname: 'testHost'
			};

			requestStub.callsFake((options, callback) => {

				// Create a mock response object...
				const res = new events.EventEmitter();
				res.setEncoding = function () {
				};
				callback(res);

				// ...and then respond with our predefined data.
				res.emit('data', '{"my_data": "test_data');
				res.emit('end');
				return new events.EventEmitter();
			});

			revert.push(FabricCAClientRewire.__set__('FabricCAClient.prototype.http', requestStub));

			const generateAuthTokenStub = sinon.stub();
			generateAuthTokenStub.returns('test_authToken');
			revert.push(FabricCAClientRewire.__set__('FabricCAClient.prototype.generateAuthToken', generateAuthTokenStub));

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.request('test_http_method', 'test_api_method', 'signingIdentity', {}).should.be.rejectedWith(/Could not parse test_api_method response/);
		});

		it('should reject if no payload returned and the end data contains an error status code', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'http',
				hostname: 'testHost'
			};

			requestStub.callsFake((options, callback) => {

				// Create a mock response object...
				const res = new events.EventEmitter();
				res.setEncoding = function () {
				};
				res.statusCode = 500;
				callback(res);

				// ...end with only status code being sent.
				res.emit('end');
				return new events.EventEmitter();
			});

			revert.push(FabricCAClientRewire.__set__('FabricCAClient.prototype.http', requestStub));

			const generateAuthTokenStub = sinon.stub();
			generateAuthTokenStub.returns('test_authToken');
			revert.push(FabricCAClientRewire.__set__('FabricCAClient.prototype.generateAuthToken', generateAuthTokenStub));
			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.request('test_http_method', 'test_api_method', 'signingIdentity').should.be.rejectedWith(/fabric-ca request test_api_method failed with HTTP status code 500/);
		});

	});

	describe('#generateAuthToken', () => {

		let revert;

		beforeEach(() => {
			revert = null;
		});

		afterEach(() => {
			if (revert) {
				revert();
			}
		});

		it('should sign the certificate if no request body provided', () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);

			const signStub = sinon.stub();
			signStub.returns('signed');
			const fake = {
				_certificate: 'test_cert',
				sign: signStub
			};
			client.generateAuthToken(null, fake, 'something/v', 'POST');

			// should call signingIdentity.sign()
			sinon.assert.calledOnce(signStub);

			// Should pass unconcat string into sign method
			const callArgs = signStub.getCall(0).args;
			callArgs[0].should.equal('POST.c29tZXRoaW5nL3Y=..dGVzdF9jZXJ0');
		});

		it('should sign the certificate if a request body, path and method are provided', () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);

			const signStub = sinon.stub();
			signStub.returns('signed');
			const fake = {
				_certificate: 'test_cert',
				sign: signStub
			};
			client.generateAuthToken('test_body', fake, 'something/v', 'POST');

			// should call signingIdentity.sign()
			sinon.assert.calledOnce(signStub);

			// Should pass concatenation into sign method
			const callArgs = signStub.getCall(0).args;
			callArgs[0].should.equal('POST.c29tZXRoaW5nL3Y=.InRlc3RfYm9keSI=.dGVzdF9jZXJ0');
		});

		it('should sign the certificate if only request body is provided', () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);

			const signStub = sinon.stub();
			signStub.returns('signed');
			const fake = {
				_certificate: 'test_cert',
				sign: signStub
			};
			client.generateAuthToken('test_body', fake);

			// should call signingIdentity.sign()
			sinon.assert.calledOnce(signStub);

			// Should pass concatenation into sign method
			const callArgs = signStub.getCall(0).args;
			callArgs[0].should.equal('InRlc3RfYm9keSI=.dGVzdF9jZXJ0');
		});

		it('should return a concatenation of the cert and signing in base64 string', () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);

			const signStub = sinon.stub();
			signStub.returns('signed');
			const fake = {
				_certificate: 'test_cert',
				sign: signStub
			};

			client.generateAuthToken('test_body', fake).should.equal('dGVzdF9jZXJ0.');
		});
	});

	describe('#enroll', () => {

		let revert;
		let requestStub;

		beforeEach(() => {
			requestStub = sinon.stub(http, 'request');
			revert = null;
		});

		afterEach(() => {
			if (requestStub) {
				requestStub.restore();
			}
			if (revert) {
				revert();
			}
		});

		it('should throw if not provided the required number of arguments', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'http',
				hostname: 'testHost'
			};

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.enroll('one_too', 'few_parameters_for_this_function_call').should.be.rejectedWith(/Missing required parameters/);
		});

		it('should pass a correctly formulated request options', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'http',
				hostname: 'testHost'
			};

			requestStub.callsFake((options, callback) => {

				// Create a mock response object...
				const res = new events.EventEmitter();
				res.setEncoding = function () {
				};
				callback(res);

				// ...and then respond with our predefined data.
				res.emit('data', '{"my_data": "test_data", "success": "true", "result" : {"Cert" : "dGVzdF9jZXJ0", "ServerInfo": {"CAChain": "dGVzdF9jaGFpbg=="}}}');
				res.emit('end');
				return new events.EventEmitter();
			});

			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.http', requestStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.enroll('enrollmentID', 'enrollmentSecret', 'csr', 'profile', ['my', 'attributes']);

			// Should be called once
			sinon.assert.calledOnce(requestStub);

			const expected = {
				hostname: 'testHost',
				port: 7054,
				path: '/api/v1/enroll',
				method: 'POST',
				auth: 'enrollmentID:enrollmentSecret',
				ca: [],
				rejectUnauthorized: false,
				timeout: 3000,
			};

			const callArgs = requestStub.getCall(0).args;
			callArgs.length.should.be.equal(2);
			callArgs[0].should.deep.equal(expected);
		});

		it('should return the enrollmentCert and caCertChain on success', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'http',
				hostname: 'testHost'
			};

			requestStub.callsFake((options, callback) => {

				// Create a mock response object...
				const res = new events.EventEmitter();
				res.setEncoding = function () {
				};
				callback(res);

				// ...and then respond with our predefined data.
				res.emit('data', '{"my_data": "test_data", "success": "true", "result" : {"Cert" : "dGVzdF9jZXJ0", "ServerInfo": {"CAChain": "dGVzdF9jaGFpbg=="}}}');
				res.emit('end');
				return new events.EventEmitter();
			});

			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.http', requestStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			const result = await client.enroll('enough', 'parameters', 'for_this_function_call');
			result.enrollmentCert.toString('ascii').should.equal('test_cert');
			result.caCertChain.toString('utf8').should.equal('test_chain');
		});

		it('should reject if no payload returned and the end data contains an error status code', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'http',
				hostname: 'testHost'
			};

			requestStub.callsFake((options, callback) => {

				// Create a mock response object...
				const res = new events.EventEmitter();
				res.setEncoding = function () {
				};
				res.statusCode = 500;
				callback(res);

				// ...end with only status code being sent.
				res.emit('data');
				res.emit('end');
				return new events.EventEmitter();
			});

			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.http', requestStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.enroll('enough', 'parameters', 'for_this_function_call').should.be.rejectedWith(/fabric-ca request enroll failed with HTTP status code 500/);
		});

		it('should reject if no success message', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'http',
				hostname: 'testHost'
			};

			requestStub.callsFake((options, callback) => {

				// Create a mock response object...
				const res = new events.EventEmitter();
				res.setEncoding = function () {
				};
				callback(res);

				// ...end with no required data being sent.
				res.emit('data', '{"my_data": "test_data", "errors" : "forced errors"}');
				res.emit('end');
				return new events.EventEmitter();
			});

			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.http', requestStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.enroll('enough', 'parameters', 'for_this_function_call').should.be.rejectedWith(/fabric-ca request enroll failed with errors \['forced errors']/);
		});

		it('should reject if invalid json received', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'http',
				hostname: 'testHost'
			};

			requestStub.callsFake((options, callback) => {

				// Create a mock response object...
				const res = new events.EventEmitter();
				res.setEncoding = function () {
				};
				callback(res);

				// ...end with no required data being sent.
				res.emit('data', '{"my_data": "test_data", rors"}');
				res.emit('end');
				return new events.EventEmitter();
			});

			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.http', requestStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.enroll('enough', 'parameters', 'for_this_function_call').should.be.rejectedWith(/Could not parse enroll response/);
		});

		it('should reject on end point error', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'http',
				hostname: 'testHost'
			};

			requestStub.callsFake((options, callback) => {

				// Create a mock response object...
				const res = new events.EventEmitter();
				res.setEncoding = function () {
				};
				callback(res);

				// ...end with no required data being sent.
				res.emit('error', 'such_error');
				return new events.EventEmitter();
			});

			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.http', requestStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.enroll('enough', 'parameters', 'for_this_function_call').should.be.rejectedWith(/Calling enroll endpoint failed with error \[such_error]/);
		});
	});

	describe('#generateCRL', () => {

		let revert;

		beforeEach(() => {
			revert = null;
		});

		afterEach(() => {
			if (revert) {
				revert();
			}
		});

		it('should reject if not provided the required number of arguments', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.generateCRL('one_too', 'few_parameters', 'for_this', 'function_call').should.be.rejectedWith(/Missing required parameters/);
		});

		it('should call POST with the correct method, request, and signing identity', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const postStub = sinon.stub();
			postStub.resolves({result: {CRL: 'bazinga'}, success: true});
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.post', postStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			const testCRL = await client.generateCRL('revokedBefore', 'revokedAfter', 'expireBefore', 'expireAfter', 'signingIdentity');

			// should call post
			sinon.assert.calledOnce(postStub);

			// Should call with known arguments
			const callArgs = postStub.getCall(0).args;
			callArgs[0].should.equal('gencrl');
			callArgs[1].should.deep.equal({
				caname: 'test-ca-name',
				expireAfter: 'expireAfter',
				expireBefore: 'expireBefore',
				revokedAfter: 'revokedAfter',
				revokedBefore: 'revokedBefore'
			});
			callArgs[2].should.equal('signingIdentity');

			// should have a result
			testCRL.should.be.equal('bazinga');
		});

		it('should reject if POST does not return result in the response body', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const postStub = sinon.stub();
			postStub.resolves({errors: 'test_fail'});
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.post', postStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.generateCRL('revokedBefore', 'revokedAfter', 'expireBefore', 'expireAfter', 'signingIdentity').should.be.rejected;
		});

		it('should reject if POST throws an error', async () => {
			const connect_opts = {
				caname: 'test-ca-name',
				protocol: 'https',
				hostname: 'testHost'
			};

			const postStub = sinon.stub();
			postStub.rejects(new Error('forced error'));
			revert = FabricCAClientRewire.__set__('FabricCAClient.prototype.post', postStub);

			const client = new FabricCAClientRewire(connect_opts, cryptoPrimitives);
			await client.generateCRL('revokedBefore', 'revokedAfter', 'expireBefore', 'expireAfter', 'signingIdentity').should.be.rejectedWith('forced error');
		});
	});

	describe('#_validateConnectionOpts', () => {

		const validateFunc = FabricCAClientRewire.__get__('FabricCAClient.prototype._validateConnectionOpts');

		it('should throw if no protocol', () => {
			(() => {
				validateFunc({});
			}).should.throw(/Protocol must be set to 'http' or 'https'/);
		});

		it('should throw if protocol is not set to http or https', () => {
			(() => {
				validateFunc({protocol: 'bad'});
			}).should.throw(/Protocol must be set to 'http' or 'https'/);
		});

		it('should throw if no hostname', () => {
			(() => {
				validateFunc({protocol: 'http'});
			}).should.throw(/Hostname must be set/);
		});

		it('should throw if provided port is not an integer', () => {
			(() => {
				validateFunc({protocol: 'http', hostname: 'frank', port: '4200'});
			}).should.throw(/Port must be an integer/);
		});

		it('should pass with a valid input', () => {
			should.not.exist(validateFunc({protocol: 'http', hostname: 'frank', port: 4200}));
		});
	});
});
