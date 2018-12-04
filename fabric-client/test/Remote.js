/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const rewire = require('rewire');
const Remote = rewire('../lib/Remote');
const Endpoint = Remote.Endpoint;
const should = require('chai').should();
const sinon = require('sinon');


describe('Remote', () => {
	let revert;

	const sandbox = sinon.createSandbox();
	let FakeLogger;
	let FakeUtils;
	let MockEndpoint;

	let MAX_SEND;
	let MAX_RECEIVE;
	let MAX_SEND_V10;
	let MAX_RECEIVE_V10;

	beforeEach(() => {
		revert = [];
		FakeLogger = {
			debug : () => {},
			error: () => {},
			warn: () => {}
		};
		sandbox.stub(FakeLogger, 'debug');
		sandbox.stub(FakeLogger, 'error');
		sandbox.stub(FakeLogger, 'warn');
		revert.push(Remote.__set__('logger', FakeLogger));

		FakeUtils = {
			getConfigSetting: () => {},
			checkIntegerConfig: () => {},
			pemToDER: () => {}
		};
		sandbox.stub(FakeUtils);
		revert.push(Remote.__set__('utils', FakeUtils));

		MockEndpoint = sandbox.stub();
		revert.push(Remote.__set__('Endpoint', MockEndpoint));

		MAX_SEND = Remote.__get__('MAX_SEND');
		MAX_RECEIVE = Remote.__get__('MAX_RECEIVE');
		MAX_SEND_V10 = Remote.__get__('MAX_SEND_V10');
		MAX_RECEIVE_V10 = Remote.__get__('MAX_RECEIVE_V10');
	});

	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sandbox.restore();
	});

	describe('#constructor', () => {
		it('should create a valid instance without any opts', () => {
			let remote;
			(() => {
				remote = new Remote('grpc://someurl');
			}).should.not.throw();
			should.equal(remote.clientCert, undefined);
			sinon.assert.calledWith(FakeUtils.getConfigSetting, MAX_RECEIVE_V10);
			sinon.assert.calledWith(FakeUtils.getConfigSetting, MAX_RECEIVE);
			should.equal(remote[MAX_RECEIVE], undefined);
			sinon.assert.calledWith(FakeUtils.getConfigSetting, MAX_SEND_V10);
			sinon.assert.calledWith(FakeUtils.getConfigSetting, MAX_SEND);
			sinon.assert.calledWith(MockEndpoint, remote._url, undefined, undefined, undefined);
			remote._name.should.equal('someurl');
			sinon.assert.calledWith(FakeUtils.checkIntegerConfig, {}, 'request-timeout');
			sinon.assert.calledWith(FakeUtils.getConfigSetting, 'request-timeout', 30000);

			sinon.assert.calledWith(FakeUtils.checkIntegerConfig, {}, 'grpc-wait-for-ready-timeout');
			sinon.assert.calledWith(FakeUtils.getConfigSetting, 'grpc-wait-for-ready-timeout', 3000);
		});

		it('should create a valid instance without any opts but with defaults given', () => {
			FakeUtils.getConfigSetting.withArgs(MAX_RECEIVE_V10).returns(1);
			FakeUtils.getConfigSetting.withArgs(MAX_SEND_V10).returns(2);
			let remote;
			(() => {
				remote = new Remote('grpc://someurl');
			}).should.not.throw();
			remote._options[MAX_RECEIVE].should.equal(1);
			remote._options[MAX_SEND].should.equal(2);
		});

		it('should throw error if opts value is not an integer or a string', () => {
			const opts = {'key1': {}};
			(() => {
				new Remote('grpc://someurl', opts);
			}).should.throw(Error, /invalid grpc option value:key1->/);
		});

		it('should ignore pem and ssl-target-name-override opts', () => {
			const opts = {pem: 'pem', 'ssl-target-name-override': 'ssl-target-name-override'};
			const remote = new Remote('grpc://someurl', opts);
			should.not.exist(remote.pem);
			should.not.exist(remote['ssl-target-name-override']);

			remote._options['grpc.ssl_target_name_override'].should.equal('ssl-target-name-override');
			remote._options['grpc.default_authority'].should.equal('ssl-target-name-override');
		});

		it('should create a valid remote instance when given minimum parameters', () => {
			const opts = {name: 'remote', clientCert: 'cert'};
			FakeUtils.checkIntegerConfig.withArgs(opts, 'request-timeout').returns(false);
			FakeUtils.getConfigSetting.withArgs('request-timeout', 30000).returns(10);
			FakeUtils.checkIntegerConfig.withArgs(opts, 'grpc-wait-for-ready-timeout').returns(false);
			FakeUtils.getConfigSetting.withArgs('grpc-wait-for-ready-timeout', 3000).returns(10);

			const remote = new Remote('grpc://someurl', opts);
			remote._options.clientCert.should.equal('cert');
			remote._options[MAX_RECEIVE].should.equal(-1);
			remote._options[MAX_SEND].should.equal(-1);
			remote._options.name.should.equal('remote');
			remote._request_timeout.should.equal(10);
			remote._grpc_wait_for_ready_timeout.should.equal(10);
		});

		it('should create a valid remote instance when given all v10 parameters', () => {
			const opts = {[MAX_RECEIVE_V10]: 1, [MAX_SEND_V10]: 2, 'request-timeout': 3, 'grpc-wait-for-ready-timeout': 4};
			FakeUtils.checkIntegerConfig.withArgs(opts, 'request-timeout').returns(true);
			FakeUtils.checkIntegerConfig.withArgs(opts, 'grpc-wait-for-ready-timeout').returns(true);
			const remote = new Remote('grpc://someurl', opts);
			remote._options[MAX_RECEIVE_V10].should.equal(1);
			remote._options[MAX_SEND_V10].should.equal(2);
			remote._options['request-timeout'].should.equal(3);
			remote._options['grpc-wait-for-ready-timeout'].should.equal(4);
		});

		it('should create a valid remote instance when given all non-v10 parameters', () => {
			const opts = {[MAX_RECEIVE]: 1, [MAX_SEND]: 2, 'request-timeout': 3, 'grpc-wait-for-ready-timeout': 4};
			FakeUtils.checkIntegerConfig.withArgs(opts, 'request-timeout').returns(true);
			FakeUtils.checkIntegerConfig.withArgs(opts, 'grpc-wait-for-ready-timeout').returns(true);
			const remote = new Remote('grpc://someurl', opts);
			remote._options[MAX_RECEIVE].should.equal(1);
			remote._options[MAX_SEND].should.equal(2);
			remote._options['request-timeout'].should.equal(3);
			remote._options['grpc-wait-for-ready-timeout'].should.equal(4);
		});

	});

	describe('#waitForReady', () => {
		let remote;

		let dateStub;
		let mockClient;

		beforeEach(() => {
			remote = new Remote('grpc://someurl');
			dateStub = sandbox.stub().returns({
				getTime: () => 1000
			});
			revert.push(Remote.__set__('Date', dateStub));
			mockClient = {waitForReady: (timeout, callback) => {
				callback('value');
			}};
		});

		it('should throw if client is not given', () => {
			(() => {
				remote.waitForReady();
			}).should.throw(Error, /Missing required gRPC client/);
		});

		it('should return a rejected promise after calling client.waitForReady logging the error', () => {
			const error = new Error('Error');
			mockClient = {waitForReady: (timeout, callback) => {
				callback(error);
			}};
			return remote.waitForReady(mockClient)
				.catch((err) => {
					err.should.exist;
					err.should.be.instanceOf(Error);
					error.message = 'Error: URL:grpc://someurl';
					sinon.assert.calledWith(FakeLogger.error, error);
				});
		});

		it('should return a rejected promise after calling client.waitForReady logging the error', () => {
			const error = new Error();
			mockClient = {waitForReady: (timeout, callback) => {
				callback(error);
			}};
			return remote.waitForReady(mockClient)
				.then(() => {
					true.should.be.false; // will throw an error if promise resolves
				})
				.catch((err) => {
					err.should.exist;
					err.should.be.instanceOf(Error);
					error.message = 'Error: URL:grpc://someurl';
					sinon.assert.calledWith(FakeLogger.error, error);
				});
		});

		it('should return a resolved promise after calling client.waitForReady', () => {
			mockClient = {waitForReady: (timeout, callback) => {
				callback();
			}};
			return remote.waitForReady(mockClient)
				.then(() => {
					sinon.assert.calledWith(FakeLogger.debug, 'Successfully connected to remote gRPC server');
				});
		});
	});

	describe('#getName', () => {
		let remote;

		beforeEach(() => {
			remote = new Remote('grpc://someurl');
		});

		it('should return the _name property', () => {
			const expectedName = 'name';
			remote._name = expectedName;
			remote.getName().should.equal(expectedName);
		});
	});

	describe('#setName', () => {
		let remote;

		beforeEach(() => {
			remote = new Remote('grpc://someurl');
		});

		it('should set the _name property', () => {
			const expectedName = 'name';
			remote.setName(expectedName);
			remote._name.should.equal(expectedName);
		});
	});

	describe('#getUrl', () => {
		let remote;

		beforeEach(() => {
			remote = new Remote('grpc://someurl');
		});

		it('should set the _name property', () => {
			const expectedUrl = 'url';
			remote._url = expectedUrl;
			remote.getUrl().should.equal(expectedUrl);
			sinon.assert.calledWith(FakeLogger.debug, `getUrl::${expectedUrl}`);
		});
	});

	describe('#getClientCertHash', () => {
		let remote;
		let hashStub;
		let updateStub;
		let finalizeStub;
		beforeEach(() => {
			remote = new Remote('grpc://someurl');
			updateStub = sandbox.stub();
			finalizeStub = sandbox.stub();
			hashStub = sandbox.stub().returns({
				reset: () => {
					return {
						update: updateStub.returns({finalize: finalizeStub})
					};
				}
			});
			revert.push(Remote.__set__('hash_sha2_256', hashStub));
		});

		it('should return the hashed client certificate', () => {
			FakeUtils.pemToDER.returns('der-cert');
			finalizeStub.returns('cert-hash');
			remote.clientCert = 'clientCert';
			const certHash = remote.getClientCertHash();
			sinon.assert.calledWith(FakeUtils.pemToDER, remote.clientCert);
			sinon.assert.called(hashStub);
			sinon.assert.calledWith(updateStub, 'der-cert');
			sinon.assert.called(finalizeStub);
			certHash.should.equal('cert-hash');
		});

		it('should return null when no client certificate is given', () => {
			const hash = remote.getClientCertHash();
			should.equal(hash, null);
		});
	});

	describe('#getCharacteristics', () => {
		let remote;
		const name = 'someurl';
		const url = 'grpc://' + name;
		const options = {
			GRPC_VALUE: '999'
		};

		beforeEach(() => {
			remote = new Remote(url, options);
		});

		it('should get the url characteristics', () => {
			remote.getCharacteristics().url.should.equal(url);
		});

		it('should get the name characteristics', () => {
			remote.getCharacteristics().name.should.equal(name);
		});

		it('should get the options characteristics', () => {
			remote.getCharacteristics().options.GRPC_VALUE.should.equal(options.GRPC_VALUE);
		});
	});

	describe('#toString', () => {
		let remote;

		beforeEach(() => {
			remote = new Remote('grpc://someurl');
		});

		it('should return a string representation of the object', () => {
			const string = remote.toString();
			string.should.equal(' Remote : {url:grpc://someurl}');
		});
	});
});

describe('Endpoint', () => {
	let revert;

	const sandbox = sinon.createSandbox();
	let FakeLogger;
	let FakeUtils;
	let FakeUrlParser;
	let FakeGrpc;
	let FakeBuffer;

	beforeEach(() => {
		revert = [];
		FakeLogger = {
			debug : () => {},
			error: () => {},
			warn: () => {}
		};
		sandbox.stub(FakeLogger);
		revert.push(Remote.__set__('logger', FakeLogger));

		FakeGrpc = {credentials: {createInsecure: () => {}, createSsl: () => {}}};
		sandbox.stub(FakeGrpc.credentials);
		revert.push(Remote.__set__('grpc', FakeGrpc));

		FakeUrlParser = {parse: () => {}};
		sandbox.stub(FakeUrlParser);
		revert.push(Remote.__set__('urlParser', FakeUrlParser));

		FakeUtils = {
			getConfigSetting: () => {},
			checkIntegerConfig: () => {},
			pemToDER: () => {}
		};
		sandbox.stub(FakeUtils);
		revert.push(Remote.__set__('utils', FakeUtils));

		FakeBuffer = {concat: () => {}, from: () => {}};
		sinon.stub(FakeBuffer);
		revert.push(Remote.__set__('Buffer', FakeBuffer));
	});

	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sandbox.restore();
	});

	describe('#constructor', () => {
		it('should throw an error if no protocol is returned', () => {
			FakeUrlParser.parse.withArgs('grpc://someurl', true).returns({protocol: undefined, host: 'host'});
			(() => {
				new Endpoint('grpc://someurl');
			}).should.throw(Error, 'Invalid protocol: undefined.  URLs must begin with grpc:// or grpcs:/');
		});

		it('should throw an error if neither grpc or grpcs are specified', () => {
			FakeUrlParser.parse.withArgs('grpc://someurl', true).returns({protocol: 'http:', host: 'host'});
			(() => {
				new Endpoint('grpc://someurl');
			}).should.throw(Error, 'Invalid protocol: http.  URLs must begin with grpc:// or grpcs:/');
		});

		it('should throw an error if the pem certificate is not a string when using grpcs', () => {
			FakeUrlParser.parse.withArgs('grpc://someurl', true).returns({protocol: 'grpc:', host: 'host'});
			FakeUrlParser.parse.withArgs('grpcs://someurl', true).returns({protocol: 'grpcs:', host: 'host'});
			(() => {
				new Endpoint('grpcs://someurl');
			}).should.throw('PEM encoded certificate is required.');
		});

		it('should throw an error client key and client certificate aren\'t strings', () => {
			FakeUrlParser.parse.withArgs('grpc://someurl', true).returns({protocol: 'grpc:', host: 'host'});
			FakeUrlParser.parse.withArgs('grpcs://someurl', true).returns({protocol: 'grpcs:', host: 'host'});
			(() => {
				new Endpoint('grpcs://someurl', 'pem', {}, {});
			}).should.throw('PEM encoded clientKey and clientCert are required.');
		});

		it('should throw an error if only clientKey given', () => {
			FakeGrpc.credentials.createInsecure.returns('creds');
			FakeBuffer.concat.onCall(0).returns('pembuf');
			FakeUrlParser.parse.withArgs('grpcs://someurl', true).returns({protocol: 'grpcs:', host: 'host'});
			(() => {
				new Endpoint('grpcs://someurl', 'pem', 'clientKey');
			}).should.throw(Error, 'clientKey and clientCert are both required.');
		});

		it('should throw an error if only clientCert', () => {
			FakeGrpc.credentials.createInsecure.returns('creds');
			FakeBuffer.concat.onCall(0).returns('pembuf');
			FakeUrlParser.parse.withArgs('grpcs://someurl', true).returns({protocol: 'grpcs:', host: 'host'});
			(() => {
				new Endpoint('grpcs://someurl', 'pem', null, 'clientCert');
			}).should.throw(Error, 'clientKey and clientCert are both required.');
		});

		it('should create new credentials with the client key and client certificate', () => {
			FakeUrlParser.parse.withArgs('grpcs://someurl', true).returns({protocol: 'grpcs:', host: 'host'});
			FakeBuffer.from.onCall(0).returns('pem');
			FakeBuffer.from.onCall(1).returns('\0');
			FakeBuffer.from.onCall(2).returns('clientKeyBuf');
			FakeBuffer.concat.onCall(0).returns('pembuf');
			FakeBuffer.concat.onCall(1).returns('clientCertBuf');
			FakeGrpc.credentials.createSsl.returns('creds');
			const endpoint = new Endpoint('grpcs://someurl', 'pem', 'clientKey', 'clientCert');
			FakeBuffer.from.getCall(0).args.should.deep.equal(['pem']);
			FakeBuffer.from.getCall(1).args.should.deep.equal(['\0']);
			FakeBuffer.concat.getCall(0).args.should.deep.equal([['pem', '\0']]);
			FakeBuffer.from.getCall(2).args.should.deep.equal(['clientKey']);
			FakeBuffer.from.getCall(3).args.should.deep.equal(['clientCert']);
			sinon.assert.calledWith(FakeGrpc.credentials.createSsl, 'pembuf', 'clientKeyBuf', 'clientCertBuf');
			endpoint.creds.should.equal('creds');
			endpoint.addr.should.equal('host');
		});

		it('should create a valid instance with minimum paramaters', () => {
			FakeGrpc.credentials.createInsecure.returns('creds');
			FakeUrlParser.parse.withArgs('grpc://someurl', true).returns({protocol: 'grpc:', host: 'host'});
			const endpoint = new Endpoint('grpc://someurl');
			sinon.assert.called(FakeUrlParser.parse);
			endpoint.addr.should.equal('host');
			endpoint.creds.should.equal('creds');
		});

		it('should create new credentials without the client key and client certificate', () => {
			FakeUrlParser.parse.withArgs('grpcs://someurl', true).returns({protocol: 'grpcs:', host: 'host'});
			FakeBuffer.from.onCall(0).returns('pem');
			FakeBuffer.from.onCall(1).returns('\0');
			FakeBuffer.concat.onCall(0).returns('pembuf');
			FakeGrpc.credentials.createSsl.returns('creds');
			const endpoint = new Endpoint('grpcs://someurl', 'pem');
			FakeBuffer.from.getCall(0).args.should.deep.equal(['pem']);
			FakeBuffer.from.getCall(1).args.should.deep.equal(['\0']);
			FakeBuffer.concat.getCall(0).args.should.deep.equal([['pem', '\0']]);
			sinon.assert.calledWith(FakeGrpc.credentials.createSsl, 'pembuf');
			endpoint.creds.should.equal('creds');
			endpoint.addr.should.equal('host');
		});
	});
});
