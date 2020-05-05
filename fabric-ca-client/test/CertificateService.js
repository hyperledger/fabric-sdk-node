/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const rewire = require('rewire');
const CertificateServiceRewire = rewire('../lib/CertificateService');
const FabricCAClient = require('../lib/FabricCAClient');
const {User} = require('fabric-common');

require('chai').should();
const sinon = require('sinon');

describe('IdentityService', () => {
	describe('#constructor', () => {

		it('should throw if no client passed as argument', () => {
			(() => {
				new CertificateServiceRewire();
			}).should.throw(/Missing Required Argument client<FabricCAClient>/);
		});

		it('should set the client as passed in the argument', () => {
			const client = {name: 'bob'};
			const service = new CertificateServiceRewire(client);
			service.client.should.deep.equal(client);
		});
	});

	describe('#getCertificates', () => {

		let clientStub;
		let service;
		let debugStub;
		let errorStub;
		let checkRegistrarStub;

		beforeEach(() => {
			clientStub = sinon.createStubInstance(FabricCAClient);
			service = new CertificateServiceRewire(clientStub);

			const FakeLogger = {
				debug: () => {
				},
				error: () => {
				}
			};

			debugStub = sinon.stub(FakeLogger, 'debug');
			errorStub = sinon.stub(FakeLogger, 'error');
			checkRegistrarStub = sinon.stub();

			CertificateServiceRewire.__set__('logger', FakeLogger);
			CertificateServiceRewire.__set__('checkRegistrar', checkRegistrarStub);
		});

		it('should call "checkRegistrar"', async () => {
			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await service.getCertificates('theTest', registrar);
			sinon.assert.calledOnce(checkRegistrarStub);
		});

		it('should provide debug logging', async () => {
			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';
			await service.getCertificates('testGetCerts', registrar);

			debugStub.callCount.should.equal(2);
			debugStub.getCall(0).args.should.deep.equal(['getCertificates by %j', 'testGetCerts']);
			debugStub.getCall(1).args.should.deep.equal(['getCertificates with url:%s', 'certificates']);
		});

		it('should provide error logging on failure', async () => {
			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			const error = new Error('forced error');
			clientStub.get.throws(error);
			await service.getCertificates('testGetCerts', registrar).should.be.rejectedWith('forced error');

			errorStub.callCount.should.equal(1);
			errorStub.getCall(0).args.should.deep.equal(['getCertificates error by %j', error]);
		});

		it('should call get with the correct url and signing identity if no request', async () => {
			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await service.getCertificates(null, registrar);

			const callArgs = clientStub.get.getCall(0).args;
			callArgs[0].should.equal('certificates');
			callArgs[1].should.deep.equal('myID');
		});

		it('should call get with the correctly mapped request', async () => {
			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			const request = {
				id: 'testId',
				aki: 'testAKI',
				serial: 'testSerial',
				revoked_start: 'test_r_start',
				revoked_end: 'test_r_end',
				expired_start: 'test_e_start',
				expired_end: 'test_e_end',
				notrevoked: true,
				notexpired: true,
				ca: 'testCA'
			};

			await service.getCertificates(request, registrar);

			const callArgs = clientStub.get.getCall(0).args;
			callArgs[0].should.equal('certificates?id=testId&aki=testAKI&serial=testSerial&revoked_start=test_r_start&revoked_end=test_r_end&expired_start=test_e_start&expired_end=test_e_end&notrevoked=true&notexpired=true&ca=testCA');
			callArgs[1].should.deep.equal('myID');
		});
	});

});
