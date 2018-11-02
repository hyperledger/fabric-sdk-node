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
const FabricCAServicesRewire = rewire('../lib/FabricCAServices');
const FabricCAClient = rewire('../lib/FabricCAClient');

const CryptoSuite = require('../lib/impl/CryptoSuite_ECDSA_AES.js');
const ECDSAKey = require('../lib/impl/ecdsa/key');
const User = require('../lib/User');

const chai = require('chai');
const should = chai.should();
const sinon = require('sinon');

describe('FabricCAServices', () => {
	let revert;

	const parseURLStub = sinon.stub();
	parseURLStub.returns({
		protocol: 'http',
		hostname: 'hyperledger',
		port: 4000
	});

	const checkRegistrarStub = sinon.stub();
	const getSubjectCommonNameStub = sinon.stub();
	const normalizeX509Stub = sinon.stub();
	const cryptoPrimitives = sinon.createStubInstance(CryptoSuite);
	cryptoPrimitives.name = 'testCrypto';

	beforeEach(() => {
		revert = [];
		revert.push(FabricCAServicesRewire.__set__('parseURL', parseURLStub));
		revert.push(FabricCAServicesRewire.__set__('checkRegistrar', checkRegistrarStub));
		revert.push(FabricCAServicesRewire.__set__('getSubjectCommonName', getSubjectCommonNameStub));
		revert.push(FabricCAServicesRewire.__set__('normalizeX509', normalizeX509Stub));
	});

	afterEach(() => {
		parseURLStub.resetHistory();
		checkRegistrarStub.resetHistory();
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
	});

	describe('#constructor', () => {

		it('should call "parseURL" with information extracted from the URL object', () => {
			const url = {
				url: 'https://hyperledger.com',
				caName: 'my_ca',
				cryptoSuite: cryptoPrimitives
			};
			new FabricCAServicesRewire(url);

			// Should be called
			sinon.assert.calledOnce(parseURLStub);

			// Should be called with known
			const callArgs = parseURLStub.getCall(0).args;
			callArgs.length.should.be.equal(1);
			callArgs[0].should.deep.equal(url.url);
		});

		it('should call "parseURL" with information from additional parameters id passed URL is a string', () => {
			new FabricCAServicesRewire('http://penguin.com', null, 'ca_name', cryptoPrimitives);

			// Should be called
			sinon.assert.calledOnce(parseURLStub);

			// Should be called with known
			const callArgs = parseURLStub.getCall(0).args;
			callArgs.length.should.be.equal(1);
			callArgs[0].should.deep.equal('http://penguin.com');
		});

		it('should set the crypto suite if passed', () => {
			const setCryptoSuiteStub = sinon.stub();
			const getCryptoSuiteStub = sinon.stub();
			const newSuite = sinon.createStubInstance(CryptoSuite);
			getCryptoSuiteStub.returns(newSuite);

			revert.push(FabricCAServicesRewire.__set__('FabricCAServices.prototype.setCryptoSuite', setCryptoSuiteStub));
			revert.push(FabricCAServicesRewire.__set__('FabricCAServices.prototype.getCryptoSuite', getCryptoSuiteStub));

			new FabricCAServicesRewire('http://penguin.com', null, 'ca_name', cryptoPrimitives);

			// Should be called
			sinon.assert.calledOnce(setCryptoSuiteStub);

			// Should be called with known
			const callArgs = setCryptoSuiteStub.getCall(0).args;
			callArgs[0].should.be.deep.equal(cryptoPrimitives);
		});

		it('should create a new crypto suite and store if none passed', () => {
			const setCryptoSuiteStub = sinon.stub();
			const getCryptoSuiteStub = sinon.stub();
			const newSuite = sinon.createStubInstance(CryptoSuite);
			getCryptoSuiteStub.returns(newSuite);

			revert.push(FabricCAServicesRewire.__set__('FabricCAServices.prototype.setCryptoSuite', setCryptoSuiteStub));
			revert.push(FabricCAServicesRewire.__set__('FabricCAServices.prototype.getCryptoSuite', getCryptoSuiteStub));

			new FabricCAServicesRewire('http://penguin.com', null, 'ca_name');

			// Should be called
			sinon.assert.calledOnce(setCryptoSuiteStub);
			sinon.assert.calledTwice(getCryptoSuiteStub);
			sinon.assert.calledOnce(newSuite.setCryptoKeyStore);
		});

		it('should create a new FabricCAClient and store within the FabricCAServices object', () => {
			const service = new FabricCAServicesRewire('http://penguin.com', null, 'ca_name', cryptoPrimitives);

			// Should set things correctly
			service.caName.should.be.equal('ca_name');
			service._fabricCAClient.should.exist;
		});
	});

	describe('#getCaName', () => {

		it('should return the caName', () => {
			const service = new FabricCAServicesRewire('http://penguin.com', null, 'ca_name', cryptoPrimitives);
			service.getCaName().should.equal('ca_name');
		});
	});

	describe('#register', () => {

		let service;
		let clientMock;

		beforeEach(() => {
			service = new FabricCAServicesRewire('http://penguin.com', null, 'ca_name', cryptoPrimitives);
			clientMock = sinon.createStubInstance(FabricCAClient);
			service._fabricCAClient = clientMock;
		});

		it('should throw if missing required argument "request"', () => {
			(() => {
				service.register();
			}).should.throw(/Missing required argument "request"/);
		});

		it('should throw if required argument "request" is null', () => {
			(() => {
				service.register(null);
			}).should.throw(/Missing required argument "request"/);
		});

		it('should throw if missing required argument "request.enrollmentID"', () => {
			(() => {
				service.register({name: 'bob'});
			}).should.throw(/Missing required argument "request.enrollmentID"/);
		});

		it('should set max enrollments to "1" if req.maxEnrollments is undefined', () => {
			service.register({enrollmentID: 'bob'}, new User('bob'));
			sinon.assert.calledOnce(clientMock.register);
			clientMock.register.getCall(0).args[4].should.equal(1);
		});

		it('should set max enrollments to "1" if req.maxEnrollments is null', () => {
			service.register({enrollmentID: 'bob', maxEnrollments: null}, new User('bob'));
			sinon.assert.calledOnce(clientMock.register);
			clientMock.register.getCall(0).args[4].should.equal(1);
		});

		it('should call "checkRegistrar"', () => {
			service.register({enrollmentID: 'bob', maxEnrollments: null}, new User('bob'));
			sinon.assert.calledOnce(checkRegistrarStub);
		});

		it('should call the register function on the FabricCAClient object with mapped values', () => {

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			service.register({enrollmentID: 'bob', enrollmentSecret: 'shhh!', maxEnrollments: 7, role: 'test_role', affiliation: 'test_affiliation', attrs: 'test_atts'}, registrar);
			sinon.assert.calledOnce(clientMock.register);

			// should be called with test values
			sinon.assert.calledOnce(clientMock.register);
			const callArgs = clientMock.register.getCall(0);

			callArgs.args[0].should.equal('bob');
			callArgs.args[1].should.equal('shhh!');
			callArgs.args[2].should.equal('test_role');
			callArgs.args[3].should.equal('test_affiliation');
			callArgs.args[4].should.equal(7);
			callArgs.args[5].should.equal('test_atts');
			callArgs.args[6].should.equal('myID');
		});
	});

	describe('#enroll', () => {

		let service;
		let clientMock;

		beforeEach(() => {
			service = new FabricCAServicesRewire('http://penguin.com', null, 'ca_name', cryptoPrimitives);
			clientMock = sinon.createStubInstance(FabricCAClient);
			service._fabricCAClient = clientMock;
		});

		it('should throw if missing required argument "request"', async () => {
			await service.enroll().should.be.rejectedWith(/Missing required argument "request"/);
		});

		it('should throw if required argument "request" is null', async () => {
			await service.enroll(null).should.be.rejectedWith(/Missing required argument "request"/);
		});

		it('should throw if missing required argument "request.enrollmentID"', async () => {
			await service.enroll({not: 'desired'}).should.be.rejectedWith(/req.enrollmentID is not set/);
		});

		it('should throw if missing required argument "request.enrollmentSecret"', async () => {
			await service.enroll({enrollmentID: 'isSet'}).should.be.rejectedWith(/req.enrollmentSecret is not set/);
		});

		it('should throw if request attributes is specified but not an array', async () => {
			await service.enroll({enrollmentID: 'isSet', enrollmentSecret: 'shhhh!', attr_reqs: 'incorrect'}).should.be.rejectedWith(/req.attr_reqs is not an array/);
		});

		it('should throw if any request attributes are missing a name', async () => {
			await service.enroll({enrollmentID: 'isSet', enrollmentSecret: 'shhhh!', attr_reqs: [{name: 'pingu'}, {missing: 'name'}]}).should.be.rejectedWith(/req.att_regs is missing the attribute name/);
		});

		it('should reject on enroll failure', async () => {

			getSubjectCommonNameStub.returns('mr_penguin');
			normalizeX509Stub.returns('normal');

			const keyStub = sinon.createStubInstance(ECDSAKey);
			keyStub.generateCSR.returns('CN=penguin');
			cryptoPrimitives.generateKey.resolves(keyStub);

			// Take control of the enroll
			clientMock.enroll.rejects(new Error('enroll error'));

			const atts = [{name: 'penguin'}, {name: 'power'}];
			const req = {enrollmentID: 'enrollmentID', enrollmentSecret: 'enrollmentSecret', profile: 'profile', attr_reqs: atts};

			await service.enroll(req).should.be.rejectedWith(/enroll error/);
		});

		it('should reject in generate CSR failure', async () => {

			getSubjectCommonNameStub.returns('mr_penguin');
			normalizeX509Stub.returns('normal');

			const keyStub = sinon.createStubInstance(ECDSAKey);
			keyStub.generateCSR.throws(new Error('CSR error'));
			cryptoPrimitives.generateKey.resolves(keyStub);

			const atts = [{name: 'penguin'}, {name: 'power'}];
			const req = {enrollmentID: 'enrollmentID', enrollmentSecret: 'enrollmentSecret', profile: 'profile', attr_reqs: atts};

			await service.enroll(req).should.be.rejectedWith(/Failed to generate CSR for enrollmemnt due to error \[Error: CSR error\]/);
		});

		it('should reject in generate key failure', async () => {

			getSubjectCommonNameStub.returns('mr_penguin');
			normalizeX509Stub.returns('normal');

			cryptoPrimitives.generateKey.rejects(new Error('Key error'));

			const atts = [{name: 'penguin'}, {name: 'power'}];
			const req = {enrollmentID: 'enrollmentID', enrollmentSecret: 'enrollmentSecret', profile: 'profile', attr_reqs: atts};

			await service.enroll(req).should.be.rejectedWith(/Failed to generate key for enrollment due to error \[Error: Key error\]/);
		});

		it('should set ephemeral option to false if `getCryptoSuite()._cryptoKeyStore` exists', async () => {

			const getCryptoSuiteStub = sinon.stub();
			const newSuite = sinon.createStubInstance(CryptoSuite);
			newSuite._cryptoKeyStore = true;
			getCryptoSuiteStub.returns(newSuite);

			revert.push(FabricCAServicesRewire.__set__('FabricCAServices.prototype.getCryptoSuite', getCryptoSuiteStub));
			service = new FabricCAServicesRewire('http://penguin.com', null, 'ca_name', cryptoPrimitives);

			service._fabricCAClient = clientMock;

			getSubjectCommonNameStub.returns('mr_penguin');
			normalizeX509Stub.returns('normal');

			const keyStub = sinon.createStubInstance(ECDSAKey);
			keyStub.generateCSR.returns('CN=penguin');
			newSuite.generateKey.resolves(keyStub);

			// Take control of the enroll
			clientMock.enroll.resolves({
				result: {enrollmentCert: 'mycert', caCertChain: 'mychain'}
			});

			const atts = [{name: 'penguin'}, {name: 'power'}];
			const req = {enrollmentID: 'enrollmentID', enrollmentSecret: 'enrollmentSecret', profile: 'profile', attr_reqs: atts};
			await service.enroll(req);

			// Opts should contain false
			const callArgs = newSuite.generateKey.getCall(0);
			callArgs.args[0].should.deep.equal({ephemeral: false});

		});

		it('should call the enroll function on the FabricCAClient object ', async () => {

			getSubjectCommonNameStub.returns('mr_penguin');
			normalizeX509Stub.returns('normal');

			const keyStub = sinon.createStubInstance(ECDSAKey);
			keyStub.generateCSR.returns('CN=penguin');
			cryptoPrimitives.generateKey.resolves(keyStub);

			// Take control of the enroll
			clientMock.enroll.resolves({
				result: {enrollmentCert: 'mycert', caCertChain: 'mychain'}
			});

			const atts = [{name: 'penguin'}, {name: 'power'}];
			const req = {enrollmentID: 'enrollmentID', enrollmentSecret: 'enrollmentSecret', profile: 'profile', attr_reqs: atts};
			await service.enroll(req);

			// generateKey should be called with ephmereal set to true
			const genKeyArgs = cryptoPrimitives.generateKey.getCall(0);
			genKeyArgs.args[0].should.deep.equal({ephemeral: true});

			// Enrol should be called with test values
			sinon.assert.calledOnce(clientMock.enroll);
			const callArgs = clientMock.enroll.getCall(0);

			// Called with known
			callArgs.args[0].should.equal('enrollmentID');
			callArgs.args[1].should.equal('enrollmentSecret');
			callArgs.args[2].should.equal('CN=penguin');
			callArgs.args[3].should.equal('profile');
			callArgs.args[4].should.deep.equal(atts);
		});

		it('should return a known object on success', async () => {

			getSubjectCommonNameStub.returns('mr_penguin');
			normalizeX509Stub.returns('normal');

			const keyStub = sinon.createStubInstance(ECDSAKey);
			keyStub.generateCSR.returns('CN=penguin');
			cryptoPrimitives.generateKey.resolves(keyStub);

			// Take control of the enroll
			clientMock.enroll.resolves({
				enrollmentCert: 'mycert', caCertChain: 'mychain'
			});

			const req = {enrollmentID: 'enrollmentID', enrollmentSecret: 'enrollmentSecret', profile: 'profile'};

			const result = await service.enroll(req);

			result.should.deep.equal({
				key: {},
				certificate: 'mycert',
				rootCertificate: 'mychain'
			});
		});
	});

	describe('#reenroll', () => {

		let service;
		let clientMock;

		beforeEach(() => {
			service = new FabricCAServicesRewire('http://penguin.com', null, 'ca_name', cryptoPrimitives);
			clientMock = sinon.createStubInstance(FabricCAClient);
			service._fabricCAClient = clientMock;
		});

		it('should throw if missing required argument "currentUser"', () => {
			(() => {
				service.reenroll();
			}).should.throw(/Invalid re-enroll request, missing argument "currentUser"/);
		});

		it('should throw if required argument "currentUser" is not a valid User object', () => {
			(() => {
				service.reenroll({bob: 'the_builder'});
			}).should.throw(/Invalid re-enroll request, "currentUser" is not a valid User object/);
		});

		it('should throw if request attributes is specified but not an array', () => {
			(() => {
				const user = new User('bob');
				service.reenroll(user, true);
			}).should.throw(/Invalid re-enroll request, attr_reqs must be an array of AttributeRequest objects/);
		});

		it('should throw if any request attributes are missing a name', () => {
			(() => {
				const user = new User('bob');
				service.reenroll(user, [{name: 'penguin'}, {noname: 'revenge'}]);
			}).should.throw(/Invalid re-enroll request, attr_reqs object is missing the name of the attribute/);
		});

		it('should throw if unable to parse enrollment certificate', async () => {
			(() => {
				const user = sinon.createStubInstance(User);
				user.getIdentity.resolves({_certificate: null});
				getSubjectCommonNameStub.throws(new Error('forced error'));
				service.reenroll(user, [{name: 'penguin'}, {name: 'power'}]);
			}).should.throw(/Failed to parse the enrollment certificate of the current user for its subject/);
		});

		it('should reject if unable to generate key', async () => {
			const user = sinon.createStubInstance(User);
			user.getSigningIdentity.returns('myID');
			user.getIdentity.returns({_certificate: 'my_cert'});
			getSubjectCommonNameStub.returns('mr_penguin');
			normalizeX509Stub.returns('normal');

			cryptoPrimitives.generateKey.rejects(new Error('Key Error'));

			const atts = [{name: 'penguin'}, {name: 'power'}];
			await service.reenroll(user, atts).should.be.rejectedWith('Failed to generate key for enrollment due to error [Error: Key Error]');
		});

		it('should reject if unable to generate CSR', async () => {
			const user = sinon.createStubInstance(User);
			user.getSigningIdentity.returns('myID');
			user.getIdentity.returns({_certificate: 'my_cert'});
			getSubjectCommonNameStub.returns('mr_penguin');
			normalizeX509Stub.returns('normal');

			const keyStub = sinon.createStubInstance(ECDSAKey);
			keyStub.generateCSR.throws(new Error('CSR Error'));
			cryptoPrimitives.generateKey.resolves(keyStub);

			const atts = [{name: 'penguin'}, {name: 'power'}];
			await service.reenroll(user, atts).should.be.rejectedWith('Failed to generate CSR for enrollmemnt due to error [Error: CSR Error]');
		});

		it('should rejected if reenroll fails', async () => {
			const user = sinon.createStubInstance(User);
			user.getSigningIdentity.returns('myID');
			user.getIdentity.returns({_certificate: 'my_cert'});
			getSubjectCommonNameStub.returns('mr_penguin');
			normalizeX509Stub.returns('normal');

			const keyStub = sinon.createStubInstance(ECDSAKey);
			keyStub.generateCSR.returns('CN=penguin');
			cryptoPrimitives.generateKey.resolves(keyStub);

			// Take control of the renroll
			clientMock.reenroll.rejects(new Error('forced error'));

			const atts = [{name: 'penguin'}, {name: 'power'}];
			await service.reenroll(user, atts).should.be.rejectedWith('forced error');
		});

		it('should call the reenroll function on the FabricCAClient object with mapped parameters', async () => {
			const user = sinon.createStubInstance(User);
			user.getSigningIdentity.returns('myID');
			user.getIdentity.returns({_certificate: 'my_cert'});
			getSubjectCommonNameStub.returns('mr_penguin');
			normalizeX509Stub.returns('normal');

			const keyStub = sinon.createStubInstance(ECDSAKey);
			keyStub.generateCSR.returns('CN=penguin');
			cryptoPrimitives.generateKey.resolves(keyStub);

			// Take control of the renroll
			clientMock.reenroll.resolves({
				result: {Cert: 'mycert', ServerInfo: {CAChain: 'mychain'}}
			});

			const atts = [{name: 'penguin'}, {name: 'power'}];
			await service.reenroll(user, atts);

			// should be called with test values
			sinon.assert.calledOnce(clientMock.reenroll);
			const callArgs = clientMock.reenroll.getCall(0);

			// Called with known
			callArgs.args[0].should.equal('CN=penguin');
			callArgs.args[1].should.equal('myID');
			callArgs.args[2].should.deep.equal(atts);
		});

		it('should return the correct object on success', async () => {
			const user = sinon.createStubInstance(User);
			user.getSigningIdentity.returns('myID');
			user.getIdentity.returns({_certificate: 'test_cert'});
			getSubjectCommonNameStub.returns('mr_penguin');
			normalizeX509Stub.returns('normal');

			const keyStub = sinon.createStubInstance(ECDSAKey);
			keyStub.generateCSR.returns('CN=penguin');
			cryptoPrimitives.generateKey.resolves(keyStub);

			// Take control of the renroll
			clientMock.reenroll.resolves({
				result: {Cert: 'mycert', ServerInfo: {CAChain: 'mychain'}}
			});

			const result = await service.reenroll(user);

			should.exist(result.key);
			should.exist(result.certificate);
			should.exist(result.rootCertificate);
		});
	});

	describe('#revoke', () => {

		let service;
		let clientMock;

		beforeEach(() => {
			service = new FabricCAServicesRewire('http://penguin.com', null, 'ca_name', cryptoPrimitives);
			clientMock = sinon.createStubInstance(FabricCAClient);
			service._fabricCAClient = clientMock;
		});

		it('should throw if missing required argument "request"', () => {
			(() => {
				service.revoke();
			}).should.throw(/Missing required argument "request"/);
		});

		it('should throw if required argument "request" is null', () => {
			(() => {
				service.revoke(null);
			}).should.throw(/Missing required argument "request"/);
		});

		it('should throw if no enrollmentID and missing aki', () => {
			(() => {
				service.revoke({something: true});
			}).should.throw(/Enrollment ID is empty, thus both "aki" and "serial" must have non-empty values/);
		});

		it('should throw if no enrollmentID and aki is an empty string', () => {
			(() => {
				service.revoke({aki: ''});
			}).should.throw(/Enrollment ID is empty, thus both "aki" and "serial" must have non-empty values/);
		});

		it('should throw if no enrollmentID and missing serial', () => {
			(() => {
				service.revoke({aki: 'aki'});
			}).should.throw(/Enrollment ID is empty, thus both "aki" and "serial" must have non-empty values/);
		});

		it('should throw if no enrollmentID and serial is an empty string', () => {
			(() => {
				service.revoke({aki: 'aki', serial: ''});
			}).should.throw(/Enrollment ID is empty, thus both "aki" and "serial" must have non-empty values/);
		});

		it('should call "checkRegistrar"', () => {
			service.revoke({enrollmentID: 'bob', aki: 'aki', serial: 'serial'}, new User('bob'));
			sinon.assert.calledOnce(checkRegistrarStub);
		});

		it('should call the revoke function on the FabricCAClient object with mapped parameters', () => {
			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			service.revoke({enrollmentID: 'bob', aki: 'aki', serial: 'serial', reason: 'de-friended'}, registrar);

			// Should call
			sinon.assert.calledOnce(clientMock.revoke);

			// should be called with test values
			sinon.assert.calledOnce(clientMock.revoke);
			const callArgs = clientMock.revoke.getCall(0);

			callArgs.args[0].should.equal('bob');
			callArgs.args[1].should.equal('aki');
			callArgs.args[2].should.equal('serial');
			callArgs.args[3].should.equal('de-friended');
			callArgs.args[4].should.equal('myID');
		});

		it('should call the revoke function on the FabricCAClient object with conditional reasoning', () => {
			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			service.revoke({aki: 'aki', serial: 'serial'}, registrar);

			// Should call
			sinon.assert.calledOnce(clientMock.revoke);

			// should be called with test values
			sinon.assert.calledOnce(clientMock.revoke);
			const callArgs = clientMock.revoke.getCall(0);

			should.not.exist(callArgs.args[0]);
			callArgs.args[1].should.equal('aki');
			callArgs.args[2].should.equal('serial');
			should.not.exist(callArgs.args[3]);
			callArgs.args[4].should.equal('myID');
		});
	});

	describe('#generateCRL', () => {

		let service;
		let clientMock;

		beforeEach(() => {
			service = new FabricCAServicesRewire('http://penguin.com', null, 'ca_name', cryptoPrimitives);
			clientMock = sinon.createStubInstance(FabricCAClient);
			service._fabricCAClient = clientMock;
		});

		it('should throw if missing required argument "request"', () => {
			(() => {
				service.generateCRL();
			}).should.throw(/Missing required argument "request"/);
		});

		it('should throw if required argument "request" is null', () => {
			(() => {
				service.generateCRL(null);
			}).should.throw(/Missing required argument "request"/);
		});

		it('should call "checkRegistrar"', () => {
			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			service.generateCRL({}, registrar);
			sinon.assert.calledOnce(checkRegistrarStub);
		});

		it('should call the generateCRL function on the FabricCAClient object with the mapped parameters', () => {

			const testDate = new Date('August 19, 1975 13:15:30');
			const req = {
				revokedBefore: testDate,
				revokedAfter: testDate,
				expireBefore: testDate,
				expireAfter: testDate
			};

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			service.generateCRL(req, registrar);

			sinon.assert.calledOnce(clientMock.generateCRL);
			const callArgs = clientMock.generateCRL.getCall(0);

			callArgs.args[0].should.equal(testDate.toISOString());
			callArgs.args[1].should.equal(testDate.toISOString());
			callArgs.args[2].should.equal(testDate.toISOString());
			callArgs.args[3].should.equal(testDate.toISOString());
			callArgs.args[4].should.equal('myID');
		});
	});

	describe('#newCertificateService', () => {

		it('should call the newCertificateService function on the FabricCAClient object ', () => {
			const service = new FabricCAServicesRewire('http://penguin.com', null, 'ca_name', cryptoPrimitives);
			const clientMock = sinon.createStubInstance(FabricCAClient);
			service._fabricCAClient = clientMock;

			service.newCertificateService();
			sinon.assert.calledOnce(clientMock.newCertificateService);
		});
	});

	describe('#newIdentityService', () => {

		it('should call the newIdentityService function on the FabricCAClient object ', () => {
			const service = new FabricCAServicesRewire('http://penguin.com', null, 'ca_name', cryptoPrimitives);
			const clientMock = sinon.createStubInstance(FabricCAClient);
			service._fabricCAClient = clientMock;

			service.newIdentityService();
			sinon.assert.calledOnce(clientMock.newIdentityService);
		});
	});

	describe('#newAffiliationService', () => {

		it('should call the newAffiliationService function on the FabricCAClient object ', () => {
			const service = new FabricCAServicesRewire('http://penguin.com', null, 'ca_name', cryptoPrimitives);
			const clientMock = sinon.createStubInstance(FabricCAClient);
			service._fabricCAClient = clientMock;

			service.newAffiliationService();
			sinon.assert.calledOnce(clientMock.newAffiliationService);
		});
	});

	describe('#toString', () => {

		it('should provide a String object showing the hostname and port', () => {
			const service = new FabricCAServicesRewire('http://penguin.com', null, 'ca_name', cryptoPrimitives);
			service._fabricCAClient = {_hostname: 'host', _port: 1234};

			service.toString().should.equal('FabricCAServices : {hostname: host, port: 1234}');
		});
	});

	describe('#_parseURL', () => {

		it('should call the helper parseURL() method via static call', () => {
			FabricCAServicesRewire._parseURL('http://hyperledger.com:4200');
			sinon.assert.calledOnce(parseURLStub);
		});
	});

});
