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
const CertificateAuthorityRewire = rewire('../lib/CertificateAuthority');
const CertificateAuthority = require('../lib/CertificateAuthority');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const sinon = require('sinon');
const should = chai.should();

describe('CertificateAuthority', () => {

	describe('#constructor', () => {

		const sandbox = sinon.createSandbox();

		afterEach(() => {
			sandbox.restore();
		});

		it('should throw error if no name parameter', () => {
			(() => {
				new CertificateAuthority();
			}).should.throw(/Missing name parameter/);
		});

		it('should throw error if name parameter is null', () => {
			(() => {
				new CertificateAuthority(null);
			}).should.throw(/Missing name parameter/);
		});

		it('should throw error if no url parameter', () => {
			(() => {
				new CertificateAuthority('name');
			}).should.throw(/Missing url parameter/);
		});

		it('should throw error if url parameter is null', () => {
			(() => {
				new CertificateAuthority('name', null, null);
			}).should.throw(/Missing url parameter/);
		});

		it('should log and consditionally initialize all internal parameters if caname', () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const debugStub = sandbox.stub(FakeLogger, 'debug');

			CertificateAuthorityRewire.__set__('logger', FakeLogger);

			const obj = new CertificateAuthorityRewire('name', 'caname', 'url', 'connection_options', 'tlsCACerts', 'registrar');

			obj._name.should.equal('name');
			obj._caname.should.equal('caname');
			obj._url.should.equal('url');
			obj._connection_options.should.equal('connection_options');
			obj._tlsCACerts.should.equal('tlsCACerts');
			obj._registrar.should.equal('registrar');
			should.not.exist(obj.fabricCAServices);

			sinon.assert.called(debugStub);
			sinon.assert.calledWith(debugStub, 'CertificateAuthority.const');
		});

		it('should log and consditionally initialize all internal parameters if no caname', () => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};

			const debugStub = sandbox.stub(FakeLogger, 'debug');

			CertificateAuthorityRewire.__set__('logger', FakeLogger);

			const obj = new CertificateAuthorityRewire('name', null, 'url', 'connection_options', 'tlsCACerts', 'registrar');

			obj._name.should.equal('name');
			obj._caname.should.equal('name');
			obj._url.should.equal('url');
			obj._connection_options.should.equal('connection_options');
			obj._tlsCACerts.should.equal('tlsCACerts');
			obj._registrar.should.equal('registrar');
			should.not.exist(obj.fabricCAServices);

			sinon.assert.called(debugStub);
			sinon.assert.calledWith(debugStub, 'CertificateAuthority.const');
		});
	});

	describe('#getName', () => {

		it('should return the object name', () => {
			const obj = new CertificateAuthority('name', 'caname', 'url', 'connection_options', 'tlsCACerts', 'registrar');
			obj.getName().should.equal('name');
		});
	});

	describe('#getCaName', () => {

		it('should return the object caname', () => {
			const obj = new CertificateAuthority('name', 'caname', 'url', 'connection_options', 'tlsCACerts', 'registrar');
			obj.getCaName().should.equal('caname');
		});
	});

	describe('#getUrl', () => {
		it('should return the object url', () => {
			const obj = new CertificateAuthority('name', 'caname', 'url', 'connection_options', 'tlsCACerts', 'registrar');
			obj.getUrl().should.equal('url');
		});
	});

	describe('#getConnectionOptions', () => {
		it('should return the object connection_options', () => {
			const obj = new CertificateAuthority('name', 'caname', 'url', 'connection_options', 'tlsCACerts', 'registrar');
			obj.getConnectionOptions().should.equal('connection_options');
		});
	});

	describe('#getTlsCACerts', () => {
		it('should return the object tlsCACerts', () => {
			const obj = new CertificateAuthority('name', 'caname', 'url', 'connection_options', 'tlsCACerts', 'registrar');
			obj.getTlsCACerts().should.equal('tlsCACerts');
		});
	});

	describe('#getRegistrar', () => {
		it('should return the object registrar', () => {
			const obj = new CertificateAuthority('name', 'caname', 'url', 'connection_options', 'tlsCACerts', 'registrar');
			obj.getRegistrar().should.equal('registrar');
		});
	});

	describe('#setFabricCAServices', () => {
		it('should set the object FabricCAServices', () => {
			const obj = new CertificateAuthority('name', 'caname', 'url', 'connection_options', 'tlsCACerts', 'registrar');

			obj.setFabricCAServices('FabricCAServices');
			obj.fabricCAServices.should.equal('FabricCAServices');
		});
	});

	describe('#getFabricCAServices', () => {
		it('should return the object FabricCAServices', () => {
			const obj = new CertificateAuthority('name', 'caname', 'url', 'connection_options', 'tlsCACerts', 'registrar');
			obj.fabricCAServices = 'FabricCAServices';
			obj.getFabricCAServices().should.equal('FabricCAServices');
		});
	});

	describe('#register', () => {

		it('should call register on the `FabricCAServices`', () => {

			const registerStub = sinon.stub();
			const fabServicesStub = sinon.stub();
			fabServicesStub.register = registerStub;

			const obj = new CertificateAuthority('name', 'caname', 'url', 'connection_options', 'tlsCACerts', 'registrar');
			obj.fabricCAServices = fabServicesStub;

			obj.register('myReq', 'myRegistrar');
			sinon.assert.calledWith(registerStub, 'myReq', 'myRegistrar');
		});
	});

	describe('#enroll', () => {
		it('should call enroll on the `FabricCAServices`', () => {

			const enrollStub = sinon.stub();
			const fabServicesStub = sinon.stub();
			fabServicesStub.enroll = enrollStub;

			const obj = new CertificateAuthority('name', 'caname', 'url', 'connection_options', 'tlsCACerts', 'registrar');
			obj.fabricCAServices = fabServicesStub;

			obj.enroll('myReq');
			sinon.assert.calledWith(enrollStub, 'myReq');
		});
	});

	describe('#reenroll', () => {
		it('should call reenroll on the `FabricCAServices`', () => {

			const reenrolStub = sinon.stub();
			const fabServicesStub = sinon.stub();
			fabServicesStub.reenroll = reenrolStub;

			const obj = new CertificateAuthority('name', 'caname', 'url', 'connection_options', 'tlsCACerts', 'registrar');
			obj.fabricCAServices = fabServicesStub;

			obj.reenroll('myUser', 'reqs');
			sinon.assert.calledWith(reenrolStub, 'myUser', 'reqs');
		});
	});

	describe('#revoke', () => {
		it('should call revoke on the `FabricCAServices`', () => {

			const revokeStub = sinon.stub();
			const fabServicesStub = sinon.stub();
			fabServicesStub.revoke = revokeStub;

			const obj = new CertificateAuthority('name', 'caname', 'url', 'connection_options', 'tlsCACerts', 'registrar');
			obj.fabricCAServices = fabServicesStub;

			obj.revoke('req', 'registrar');
			sinon.assert.calledWith(revokeStub, 'req', 'registrar');
		});
	});

	describe('#generateCRL', () => {
		it('should call generateCRL on the `FabricCAServices`', () => {

			const generateCRLStub = sinon.stub();
			const fabServicesStub = sinon.stub();
			fabServicesStub.generateCRL = generateCRLStub;

			const obj = new CertificateAuthority('name', 'caname', 'url', 'connection_options', 'tlsCACerts', 'registrar');
			obj.fabricCAServices = fabServicesStub;

			obj.generateCRL('req', 'registrar');
			sinon.assert.calledWith(generateCRLStub, 'req', 'registrar');
		});
	});

	describe('#newCertificateService', () => {
		it('should call newCertificateService on the `FabricCAServices`', () => {

			const newCertificateServiceStub = sinon.stub();
			const fabServicesStub = sinon.stub();
			fabServicesStub.newCertificateService = newCertificateServiceStub;

			const obj = new CertificateAuthority('name', 'caname', 'url', 'connection_options', 'tlsCACerts', 'registrar');
			obj.fabricCAServices = fabServicesStub;

			obj.newCertificateService();
			sinon.assert.calledOnce(newCertificateServiceStub);
		});
	});

	describe('#newIdentityService', () => {
		it('should call newIdentityService on the `FabricCAServices`', () => {

			const newIdentityServiceStub = sinon.stub();
			const fabServicesStub = sinon.stub();
			fabServicesStub.newIdentityService = newIdentityServiceStub;

			const obj = new CertificateAuthority('name', 'caname', 'url', 'connection_options', 'tlsCACerts', 'registrar');
			obj.fabricCAServices = fabServicesStub;

			obj.newIdentityService();
			sinon.assert.calledOnce(newIdentityServiceStub);
		});
	});

	describe('#newAffiliationService', () => {
		it('should call newAffiliationService on the `FabricCAServices`', () => {

			const newAffiliationServiceStub = sinon.stub();
			const fabServicesStub = sinon.stub();
			fabServicesStub.newAffiliationService = newAffiliationServiceStub;

			const obj = new CertificateAuthority('name', 'caname', 'url', 'connection_options', 'tlsCACerts', 'registrar');
			obj.fabricCAServices = fabServicesStub;

			obj.newAffiliationService();
			sinon.assert.calledOnce(newAffiliationServiceStub);
		});
	});

	describe('#toString', () => {

		it('should return a string representatino of the object', () => {
			const obj = new CertificateAuthority('test_name', 'caname', 'test_url', 'connection_options', 'tlsCACerts', 'registrar');
			obj.toString().should.equal('CertificateAuthority : {name : test_name, url : test_url}');
		});
	});

});