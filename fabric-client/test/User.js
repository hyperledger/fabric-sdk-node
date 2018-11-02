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
const UserRewire = rewire('../lib/User');
const User = require('../lib/User');

const chai = require('chai');
const should = chai.should();
const sinon = require('sinon');

describe('User', () => {

	describe('#constructor', () => {

		const sandbox = sinon.createSandbox();

		afterEach(() => {
			sandbox.restore();
		});

		it('should conditionally initialise parameters if cfg is a string', () => {

			const myUser = new User('my_cfg');
			myUser._name.should.equal('my_cfg');
			myUser._affiliation.should.equal('');
			should.not.exist(myUser._roles);
			myUser._enrollmentSecret.should.equal('');
			myUser._mspId.should.equal('');
			should.not.exist(myUser._identity);
			should.not.exist(myUser._signingIdentity);
			should.not.exist(myUser._cryptoSuite);
		});

		it('should conditionally initialise parameters if cfg is an object with an enrollmentID and roles', () => {
			const obj = new Object({enrollmentID: 'user_enrollmentID', name: 'user_name', roles: ['role_1', 'role_2'], affiliation: 'user_affiliation'});
			const myUser = new User(obj);
			myUser._name.should.equal(obj.enrollmentID);
			myUser._roles.should.equal(obj.roles);
			myUser._affiliation.should.equal(obj.affiliation);
			myUser._enrollmentSecret.should.equal('');
			myUser._mspId.should.equal('');
			should.not.exist(myUser._identity);
			should.not.exist(myUser._signingIdentity);
			should.not.exist(myUser._cryptoSuite);
		});

		it('should conditionally initialise parameters if cfg is an object without an enrollmentID or roles', () => {
			const obj = new Object({name: 'user_name', affiliation: 'user_affiliation'});
			const myUser = new User(obj);
			myUser._name.should.equal(obj.name);
			myUser._roles.should.deep.equal(['fabric.user']);
			myUser._affiliation.should.equal(obj.affiliation);
			myUser._enrollmentSecret.should.equal('');
			myUser._mspId.should.equal('');
			should.not.exist(myUser._identity);
			should.not.exist(myUser._signingIdentity);
			should.not.exist(myUser._cryptoSuite);
		});
	});

	describe('#getName', () => {
		it('should get the user name', () => {
			const myUser = new User('my_cfg');
			myUser.getName().should.equal('my_cfg');
		});
	});

	describe('#getRoles', () => {
		it('should get the users roles', () => {
			const obj = new Object({enrollmentID: 'user_enrollmentID', name: 'user_name', roles: ['role_1', 'role_2'], affiliation: 'user_affiliation'});
			const myUser = new User(obj);
			myUser.getRoles().should.equal(obj.roles);
		});
	});

	describe('#setRoles', () => {
		it('should set the users roles', () => {
			const myUser = new User({enrollmentID: 'user_enrollmentID', name: 'user_name', roles: ['role_1', 'role_2'], affiliation: 'user_affiliation'});
			myUser.setRoles(['new_role_1', 'new_role_2']);
			myUser._roles.should.deep.equal(['new_role_1', 'new_role_2']);
		});
	});

	describe('#getAffiliation', () => {
		it('should get the users affiliation', () => {
			const obj = new Object({enrollmentID: 'user_enrollmentID', name: 'user_name', roles: ['role_1', 'role_2'], affiliation: 'user_affiliation'});
			const myUser = new User(obj);
			myUser.getAffiliation().should.equal(obj.affiliation);
		});
	});

	describe('#setAffiliation', () => {
		it('should set the users affiliation', () => {
			const myUser = new User({enrollmentID: 'user_enrollmentID', name: 'user_name', roles: ['role_1', 'role_2'], affiliation: 'user_affiliation'});
			myUser.setAffiliation('new_affiliation');
			myUser._affiliation.should.equal('new_affiliation');
		});
	});

	describe('#getIdentity', () => {
		it('should get the users identity', () => {
			const myUser = new User('cfg');
			myUser._identity = 'test_identity';
			myUser.getIdentity().should.equal('test_identity');
		});
	});

	describe('#getSigningIdentity', () => {
		it('should get the users signing identity', () => {
			const myUser = new User('cfg');
			myUser._signingIdentity = 'test_signingIdentity';
			myUser.getSigningIdentity().should.equal('test_signingIdentity');
		});
	});

	describe('#getCryptoSuite', () => {
		it('should get the users crypto suite', () => {
			const myUser = new User('my_cfg');
			myUser._cryptoSuite = 'test_cryptoSuite';
			myUser.getCryptoSuite().should.equal('test_cryptoSuite');
		});
	});

	describe('#setCryptoSuite', () => {
		it('should set the users crypto suite', () => {
			const myUser = new User('my_cfg');
			myUser.setCryptoSuite('test_cryptoSuite');
			myUser._cryptoSuite.should.equal('test_cryptoSuite');
		});
	});

	describe('#setEnrollment', () => {
		it('should throw error if no privateKey parameter', async() => {
			const myUser = new User('my_cfg');
			await myUser.setEnrollment(null, 'test_certificate', 'test_mspId', true)
				.should.be.rejectedWith(/Invalid parameter. Must have a valid private key./);
		});

		it('should throw error if the privateKey parameter is an empty string', async() => {
			const myUser = new User('my_cfg');
			await myUser.setEnrollment('', 'test_certificate', 'test_mspId', true)
				.should.be.rejectedWith(/Invalid parameter. Must have a valid private key./);
		});

		it('should throw error if no certificate parameter', async() => {
			const myUser = new User('my_cfg');
			await myUser.setEnrollment('test_privateKey', null, 'test_mspId', true)
				.should.be.rejectedWith(/Invalid parameter. Must have a valid certificate./);
		});

		it('should throw error if certificate parameter is an empty string', async() => {
			const myUser = new User('my_cfg');
			await myUser.setEnrollment('test_privateKey', '', 'test_mspId', true)
				.should.be.rejectedWith(/Invalid parameter. Must have a valid certificate./);
		});

		it('should throw error if no mspId parameter', async() => {
			const myUser = new User('my_cfg');
			await myUser.setEnrollment('test_privateKey', 'test_certificate', null, true)
				.should.be.rejectedWith(/Invalid parameter. Must have a valid mspId./);
		});

		it('should throw error if mspId parameter is an empty string', async() => {
			const myUser = new User('my_cfg');
			await myUser.setEnrollment('test_privateKey', 'test_certificate', '', true)
				.should.be.rejectedWith(/Invalid parameter. Must have a valid mspId./);
		});

		it('should set the cryptoSuite if its not already set', async() => {
			const sandbox = sinon.createSandbox();
			const FakeSdkUtils = {
				newCryptoSuite: () => {},
			};

			const FakeIdentity = sandbox.stub();
			const FakeSigningIdentity = sandbox.stub();

			const returnStub = sandbox.stub({setCryptoKeyStore: () => {}, importKey: () => {}});
			const newCryptoSuiteStub = sandbox.stub(FakeSdkUtils, 'newCryptoSuite').returns(returnStub);

			UserRewire.__set__('sdkUtils', FakeSdkUtils);
			UserRewire.__set__('Identity', FakeIdentity);
			UserRewire.__set__('SigningIdentity', FakeSigningIdentity);

			const obj = new UserRewire('my_cfg');
			await obj.setEnrollment('test_privateKey', 'test_certificate', 'test_mspId', true);

			sinon.assert.calledOnce(newCryptoSuiteStub);
			obj._cryptoSuite.should.equal(returnStub);
		});

		it('should set users crypto key store if skipPersistance is false', async() => {
			const sandbox = sinon.createSandbox();
			const FakeSdkUtils = {
				newCryptoSuite: () => {},
				newCryptoKeyStore: () => {},
			};

			const FakeIdentity = sandbox.stub();
			const FakeSigningIdentity = sandbox.stub();

			const cryptoSuite = {
				setCryptoKeyStore: () => {},
				importKey: () => {},
			};

			const FakeSetCryptoKeyStore = sandbox.stub(cryptoSuite, 'setCryptoKeyStore');

			sandbox.stub(FakeSdkUtils, 'newCryptoSuite').returns(cryptoSuite);
			sandbox.stub(FakeSdkUtils, 'newCryptoKeyStore').returns('test_cryptoKeyStore');


			UserRewire.__set__('sdkUtils', FakeSdkUtils);
			UserRewire.__set__('Identity', FakeIdentity);
			UserRewire.__set__('SigningIdentity', FakeSigningIdentity);

			const obj = new UserRewire('my_cfg');
			await obj.setEnrollment('test_privateKey', 'test_certificate', 'test_mspId', false);

			sinon.assert.calledOnce(FakeSetCryptoKeyStore);
			sinon.assert.calledWith(FakeSetCryptoKeyStore, 'test_cryptoKeyStore');
		});

		it('should create and set a pubKey variable if the cryptoKeyStore is set and skipPersistence is false', async() => {
			const sandbox = sinon.createSandbox();
			const FakeSdkUtils = {
				newCryptoSuite: () => {},
				newCryptoKeyStore: () => {},
			};

			const FakeIdentity = sandbox.stub();
			const FakeSigningIdentity = sandbox.stub();

			const cryptoSuite = {
				setCryptoKeyStore: () => {},
				importKey: () => {},
				_cryptoKeyStore: 'cryptoKeyStore',
			};

			const FakeImportKey = sandbox.stub(cryptoSuite, 'importKey');

			sandbox.stub(FakeSdkUtils, 'newCryptoSuite').returns(cryptoSuite);
			sandbox.stub(FakeSdkUtils, 'newCryptoKeyStore').returns('test_cryptoKeyStore');


			UserRewire.__set__('sdkUtils', FakeSdkUtils);
			UserRewire.__set__('Identity', FakeIdentity);
			UserRewire.__set__('SigningIdentity', FakeSigningIdentity);

			const obj = new UserRewire('my_cfg');
			await obj.setEnrollment('test_privateKey', 'test_certificate', 'test_mspId', false);

			sinon.assert.calledOnce(FakeImportKey);
			sinon.assert.calledWith(FakeImportKey, 'test_certificate');
		});

		it('should create and set a pubKey variable if the either the cryptoKeyStore is not set or skipPersitence is true', async() => {
			const sandbox = sinon.createSandbox();
			const FakeSdkUtils = {
				newCryptoSuite: () => {},
				newCryptoKeyStore: () => {},
			};

			const FakeIdentity = sandbox.stub();
			const FakeSigningIdentity = sandbox.stub();

			const cryptoSuite = {
				setCryptoKeyStore: () => {},
				importKey: () => {},
			};

			const FakeImportKey = sandbox.stub(cryptoSuite, 'importKey');

			sandbox.stub(FakeSdkUtils, 'newCryptoSuite').returns(cryptoSuite);
			sandbox.stub(FakeSdkUtils, 'newCryptoKeyStore').returns('test_cryptoKeyStore');


			UserRewire.__set__('sdkUtils', FakeSdkUtils);
			UserRewire.__set__('Identity', FakeIdentity);
			UserRewire.__set__('SigningIdentity', FakeSigningIdentity);

			const obj = new UserRewire('my_cfg');
			await obj.setEnrollment('test_privateKey', 'test_certificate', 'test_mspId', true);

			sinon.assert.calledOnce(FakeImportKey);
			sinon.assert.calledWith(FakeImportKey, 'test_certificate', {ephemeral: true});
		});

		it('should set the users identity', async() => {
			const sandbox = sinon.createSandbox();
			const FakeSdkUtils = {
				newCryptoSuite: () => {},
				newCryptoKeyStore: () => {},
			};

			const FakeIdentity = sandbox.stub();
			const FakeSigningIdentity = sandbox.stub();

			const FakeCryptoSuite = {
				setCryptoKeyStore: () => {},
				importKey: () => {},
			};

			sandbox.stub(FakeSdkUtils, 'newCryptoSuite').returns(FakeCryptoSuite);
			sandbox.stub(FakeSdkUtils, 'newCryptoKeyStore').returns('test_cryptoKeyStore');
			sandbox.stub(FakeCryptoSuite, 'importKey').returns('test_key');


			UserRewire.__set__('sdkUtils', FakeSdkUtils);
			UserRewire.__set__('Identity', FakeIdentity);
			UserRewire.__set__('SigningIdentity', FakeSigningIdentity);

			const obj = new UserRewire('my_cfg');
			await obj.setEnrollment('test_privateKey', 'test_certificate', 'test_mspId', false);

			sinon.assert.calledOnce(FakeIdentity);
			sinon.assert.calledWith(FakeIdentity, 'test_certificate', 'test_key', 'test_mspId', FakeCryptoSuite);
		});

		it('should set the users signingIdentity', async() => {
			const sandbox = sinon.createSandbox();
			const FakeSdkUtils = {
				newCryptoSuite: () => {},
				newCryptoKeyStore: () => {},
			};

			const FakeIdentity = sandbox.stub();
			const FakeSigningIdentity = sandbox.stub();

			const FakeCryptoSuite = {
				setCryptoKeyStore: () => {},
				importKey: () => {},
			};

			sandbox.stub(FakeSdkUtils, 'newCryptoSuite').returns(FakeCryptoSuite);
			sandbox.stub(FakeSdkUtils, 'newCryptoKeyStore').returns('test_cryptoKeyStore');
			sandbox.stub(FakeCryptoSuite, 'importKey').returns('test_key');


			UserRewire.__set__('sdkUtils', FakeSdkUtils);
			UserRewire.__set__('Identity', FakeIdentity);
			UserRewire.__set__('SigningIdentity', FakeSigningIdentity);

			const obj = new UserRewire('my_cfg');
			await obj.setEnrollment('test_privateKey', 'test_certificate', 'test_mspId', false);

			sinon.assert.calledOnce(FakeSigningIdentity);
			sinon.assert.calledWith(FakeIdentity, 'test_certificate', 'test_key', 'test_mspId', FakeCryptoSuite);
		});
	});

	describe('#isEnrolled', () => {
		it('should return true if user has both an identity and a signing identity', () => {
			const myUser = new User('my_cfg');
			myUser._identity = 'test_identity';
			myUser._signingIdentity = 'test_signingIdentity';
			myUser.isEnrolled().should.equal(true);
		});

		it('should return false if user has no identity', () => {
			const myUser = new User('my_cfg');
			myUser._signingIdentity = 'test_signingIdentity';
			myUser.isEnrolled().should.equal(false);
		});

		it('should return false if user has no signing identity', () => {
			const myUser = new User('my_cfg');
			myUser._identity = 'test_identity';
			myUser.isEnrolled().should.equal(false);
		});

		it('should return false if user has no identity or signing identity', () => {
			const myUser = new User('cfg');
			myUser.isEnrolled().should.equal(false);
		});
	});

	describe('#fromString', () => {
		const sandbox = sinon.createSandbox();

		afterEach(() => {
			sandbox.restore();
		});

		it('should log and set the users state, name, roles, afilliation and enrollmentSecret', () => {
			const FakeLogger = {
				debug: () => {}
			};

			const FakeSdkUtils = {
				newCryptoSuite: () => {},
				newCryptoKeyStore: () => {},
			};

			const FakeCryptoSuite = {
				setCryptoKeyStore: () => {},
				importKey: () => {},
				getKey: () => {}
			};

			const debugStub = sandbox.stub(FakeLogger, 'debug');
			const FakeIdentity = sandbox.stub();
			const promise = new Promise(() => {});

			sandbox.stub(FakeSdkUtils, 'newCryptoSuite').returns(FakeCryptoSuite);
			sandbox.stub(FakeSdkUtils, 'newCryptoKeyStore').returns('test_cryptoKeyStore');
			sandbox.stub(FakeCryptoSuite, 'importKey').returns(promise);

			UserRewire.__set__('logger', FakeLogger);
			UserRewire.__set__('sdkUtils', FakeSdkUtils);
			UserRewire.__set__('Identity', FakeIdentity);

			const obj = new UserRewire('cfg');
			obj.fromString('{ "name":"cfg", "roles":"test_role", "affiliation":"test_affiliation", "enrollmentSecret":"test_enrollmentSecret", "mspid":"test_mspId", "enrollment":{"identity":{"certificate":"test_certificate"}}}', false);

			sinon.assert.calledOnce(debugStub);
			sinon.assert.calledWith(debugStub, 'fromString --start');
			obj._name.should.equal('cfg');
			obj._roles.should.equal('test_role');
			obj._affiliation.should.equal('test_affiliation');
			obj._enrollmentSecret.should.equal('test_enrollmentSecret');
		});

		it('should throw error if state name is not the same as user name', () => {
			(() => {
				const FakeLogger = {
					debug: () => {}
				};

				sandbox.stub(FakeLogger, 'debug');

				UserRewire.__set__('logger', FakeLogger);

				const obj = new UserRewire('cfg');
				obj.fromString('{ "name":"wrong_name", "roles":"test_role", "affiliation":"test_affiliation", "enrollmentSecret":"test_enrollmentSecret", "mspid":"test_mspid", "enrollment":{"identity":{"certificate":"test_certificate"}}}', false);
			}).should.throw(/name mismatch: 'wrong_name' does not equal 'cfg'/);
		});

		it('should throw error if the state has no mspid', () => {
			(() => {
				const FakeLogger = {
					debug: () => {}
				};

				sandbox.stub(FakeLogger, 'debug');

				UserRewire.__set__('logger', FakeLogger);

				const obj = new UserRewire('cfg');
				obj.fromString('{ "name":"cfg", "roles":"test_role", "affiliation":"test_affiliation", "enrollmentSecret":"test_enrollmentSecret", "mspid":"", "enrollment":{"identity":{"certificate":"test_certificate"}}}', false);
			}).should.throw(/Failed to find "mspid" in the deserialized state object for the user. Likely due to an outdated state store./);
		});

		it('should set the users mspid to the state mspid', () => {
			const FakeLogger = {
				debug: () => {}
			};

			const FakeSdkUtils = {
				newCryptoSuite: () => {},
				newCryptoKeyStore: () => {},
			};

			const FakeCryptoSuite = {
				setCryptoKeyStore: () => {},
				importKey: () => {},
				getKey: () => {}
			};

			const FakeIdentity = sandbox.stub();
			const promise = new Promise(() => {});

			sandbox.stub(FakeSdkUtils, 'newCryptoSuite').returns(FakeCryptoSuite);
			sandbox.stub(FakeSdkUtils, 'newCryptoKeyStore').returns('test_cryptoKeyStore');
			sandbox.stub(FakeCryptoSuite, 'importKey').returns(promise);

			UserRewire.__set__('logger', FakeLogger);
			UserRewire.__set__('sdkUtils', FakeSdkUtils);
			UserRewire.__set__('Identity', FakeIdentity);

			const obj = new UserRewire('cfg');
			obj.fromString('{ "name":"cfg", "roles":"test_role", "affiliation":"test_affiliation", "enrollmentSecret":"test_enrollmentSecret", "mspid":"test_mspId", "enrollment":{"identity":{"certificate":"test_certificate"}}}', true);

			obj._mspId.should.equal('test_mspId');
		});

		it('should set import_promise if no_save is true', async () => {
			const FakeLogger = {
				debug: () => {}
			};

			const FakeSdkUtils = {
				newCryptoSuite: () => {},
				newCryptoKeyStore: () => {},
			};

			const FakeCryptoSuite = {
				setCryptoKeyStore: () => {},
				importKey: () => {},
				getKey: () => {}
			};

			const FakeApi = {
				CryptoAlgorithms: {
					X509Certificate: 'X509Certificate',
				}
			};

			const FakeIdentity = sandbox.stub();
			const FakeImportKey = sandbox.stub(FakeCryptoSuite, 'importKey').returns('key');
			const promise = new Promise((resolve) => {
				resolve({isPrivate() {
					return true;
				}});
			});

			sandbox.stub(FakeSdkUtils, 'newCryptoSuite').returns(FakeCryptoSuite);
			sandbox.stub(FakeSdkUtils, 'newCryptoKeyStore').returns('test_cryptoKeyStore');
			sandbox.stub(FakeCryptoSuite, 'getKey').returns(promise);

			UserRewire.__set__('logger', FakeLogger);
			UserRewire.__set__('sdkUtils', FakeSdkUtils);
			UserRewire.__set__('Identity', FakeIdentity);
			UserRewire.__set__('api', FakeApi);

			const obj = new UserRewire('cfg');
			await obj.fromString('{ "name":"cfg", "roles":"test_role", "affiliation":"test_affiliation", "enrollmentSecret":"test_enrollmentSecret", "mspid":"test_mspId", "enrollment":{"identity":{"certificate":"test_certificate"}}}', true);

			sinon.assert.calledOnce(FakeImportKey);
			sinon.assert.calledWith(FakeImportKey, 'test_certificate', {algorithm: 'X509Certificate', ephemeral: true});
		});

		it('should throw an error if key is not set if no_save is true', async () => {
			const FakeLogger = {
				debug: () => {}
			};

			const FakeSdkUtils = {
				newCryptoSuite: () => {},
				newCryptoKeyStore: () => {},
			};

			const FakeCryptoSuite = {
				setCryptoKeyStore: () => {},
				importKey: () => {},
				getKey: () => {}
			};

			const FakeApi = {
				CryptoAlgorithms: {
					X509Certificate: 'X509Certificate',
				}
			};

			const FakeIdentity = sandbox.stub();
			sandbox.stub(FakeCryptoSuite, 'importKey').returns(null);
			const promise = new Promise((resolve) => {
				resolve({isPrivate() {
					return true;
				}});
			});

			sandbox.stub(FakeSdkUtils, 'newCryptoSuite').returns(FakeCryptoSuite);
			sandbox.stub(FakeSdkUtils, 'newCryptoKeyStore').returns('test_cryptoKeyStore');
			sandbox.stub(FakeCryptoSuite, 'getKey').returns(promise);

			UserRewire.__set__('logger', FakeLogger);
			UserRewire.__set__('sdkUtils', FakeSdkUtils);
			UserRewire.__set__('Identity', FakeIdentity);
			UserRewire.__set__('api', FakeApi);

			const obj = new UserRewire('cfg');
			await obj.fromString('{ "name":"cfg", "roles":"test_role", "affiliation":"test_affiliation", "enrollmentSecret":"test_enrollmentSecret", "mspid":"test_mspId", "enrollment":{"identity":{"certificate":"test_certificate"}}}', true).should.be.rejectedWith(/Import of saved user has failed/);
		});

		it('should set import_promise if no_save is false', async () => {
			const FakeLogger = {
				debug: () => {}
			};

			const FakeSdkUtils = {
				newCryptoSuite: () => {},
				newCryptoKeyStore: () => {},
			};

			const FakeCryptoSuite = {
				setCryptoKeyStore: () => {},
				importKey: () => {},
				getKey: () => {}
			};

			const FakeApi = {
				CryptoAlgorithms: {
					X509Certificate: 'X509Certificate',
				}
			};

			const FakeIdentity = sandbox.stub();
			const promise = new Promise((resolve) => {
				resolve({isPrivate() {
					return true;
				}});
			});
			const FakeImportKey = sandbox.stub(FakeCryptoSuite, 'importKey').returns(promise);

			sandbox.stub(FakeSdkUtils, 'newCryptoSuite').returns(FakeCryptoSuite);
			sandbox.stub(FakeSdkUtils, 'newCryptoKeyStore').returns('test_cryptoKeyStore');
			sandbox.stub(FakeCryptoSuite, 'getKey').returns(promise);

			UserRewire.__set__('logger', FakeLogger);
			UserRewire.__set__('sdkUtils', FakeSdkUtils);
			UserRewire.__set__('Identity', FakeIdentity);
			UserRewire.__set__('api', FakeApi);

			const obj = new UserRewire('cfg');
			await obj.fromString('{ "name":"cfg", "roles":"test_role", "affiliation":"test_affiliation", "enrollmentSecret":"test_enrollmentSecret", "mspid":"test_mspId", "enrollment":{"identity":{"certificate":"test_certificate"}}}', false);

			sinon.assert.calledOnce(FakeImportKey);
			sinon.assert.calledWith(FakeImportKey, 'test_certificate', {algorithm: 'X509Certificate'});
		});

		it('should return the _cryptoSuite key', async () => {
			const FakeLogger = {
				debug: () => {}
			};

			const FakeSdkUtils = {
				newCryptoSuite: () => {},
				newCryptoKeyStore: () => {},
			};

			const FakeCryptoSuite = {
				setCryptoKeyStore: () => {},
				importKey: () => {},
				getKey: () => {}
			};

			const FakeApi = {
				CryptoAlgorithms: {
					X509Certificate: 'X509Certificate',
				}
			};

			const FakeKey = {
				isPrivate: () => {
					return true;
				}
			};

			const FakeIdentity = sandbox.stub();
			sandbox.stub(FakeCryptoSuite, 'importKey').resolves(FakeKey);
			sandbox.stub(FakeSdkUtils, 'newCryptoSuite').returns(FakeCryptoSuite);
			sandbox.stub(FakeSdkUtils, 'newCryptoKeyStore').returns('test_cryptoKeyStore');
			const FakeGetKey = sandbox.stub(FakeCryptoSuite, 'getKey').resolves(FakeKey);

			UserRewire.__set__('logger', FakeLogger);
			UserRewire.__set__('sdkUtils', FakeSdkUtils);
			UserRewire.__set__('Identity', FakeIdentity);
			UserRewire.__set__('api', FakeApi);

			const obj = new UserRewire('cfg');
			await obj.fromString('{ "name":"cfg", "roles":"test_role", "affiliation":"test_affiliation", "enrollmentSecret":"test_enrollmentSecret", "mspid":"test_mspId", "enrollment":{"identity":{"certificate":"test_certificate"}, "signingIdentity":"test_signingIdentity"}}', false);

			sinon.assert.calledOnce(FakeIdentity);
			sinon.assert.calledOnce(FakeGetKey);
			sinon.assert.calledWith(FakeIdentity, 'test_certificate', FakeKey, 'test_mspId', FakeCryptoSuite);
			sinon.assert.calledWith(FakeGetKey, 'test_signingIdentity');
		});

		it('should assign the self variable with a signing identity if the privateKey is private', async () => {
			const FakeLogger = {
				debug: () => {}
			};

			const FakeSdkUtils = {
				newCryptoSuite: () => {},
				newCryptoKeyStore: () => {},
			};

			const FakeCryptoSuite = {
				setCryptoKeyStore: () => {},
				importKey: () => {},
				getKey: () => {}
			};

			const FakeKey = {
				isPrivate: () => {
					return true;
				}
			};

			const FakeIdentity = sandbox.stub();
			const FakeSigningIdentity = sandbox.stub();
			sandbox.stub(FakeCryptoSuite, 'importKey').resolves(FakeKey);
			const FakeSigner = sandbox.stub();

			sandbox.stub(FakeSdkUtils, 'newCryptoSuite').returns(FakeCryptoSuite);
			sandbox.stub(FakeSdkUtils, 'newCryptoKeyStore').returns('test_cryptoKeyStore');
			sandbox.stub(FakeCryptoSuite, 'getKey').resolves(FakeKey);

			UserRewire.__set__('logger', FakeLogger);
			UserRewire.__set__('sdkUtils', FakeSdkUtils);
			UserRewire.__set__('Identity', FakeIdentity);
			UserRewire.__set__('SigningIdentity', FakeSigningIdentity);
			UserRewire.__set__('Signer', FakeSigner);

			const obj = new UserRewire('cfg');
			await obj.fromString('{ "name":"cfg", "roles":"test_role", "affiliation":"test_affiliation", "enrollmentSecret":"test_enrollmentSecret", "mspid":"test_mspId", "enrollment":{"identity":{"certificate":"test_certificate"}, "signingIdentity":"test_signingIdentity"}}', false);

			sinon.assert.calledWith(FakeSigningIdentity, 'test_certificate', FakeKey, 'test_mspId', FakeCryptoSuite, sinon.match.instanceOf(FakeSigner));
			sinon.assert.calledWith(FakeSigner, FakeCryptoSuite, FakeKey);
			sinon.assert.calledOnce(FakeSigningIdentity);
			sinon.assert.calledOnce(FakeSigner);
		});

		it('should throw error if private key is missing', async () => {
			const FakeLogger = {
				debug: () => {}
			};

			const FakeSdkUtils = {
				newCryptoSuite: () => {},
				newCryptoKeyStore: () => {},
			};

			const FakeCryptoSuite = {
				setCryptoKeyStore: () => {},
				importKey: () => {},
				getKey: () => {}
			};

			const FakeIdentity = sandbox.stub();
			const promise = new Promise(((resolve) => {
				resolve({isPrivate() {
					return false;
				}});
			}));
			sandbox.stub(FakeCryptoSuite, 'importKey').returns(promise);

			sandbox.stub(FakeSdkUtils, 'newCryptoSuite').returns(FakeCryptoSuite);
			sandbox.stub(FakeSdkUtils, 'newCryptoKeyStore').returns('test_cryptoKeyStore');
			sandbox.stub(FakeCryptoSuite, 'getKey').returns(promise);

			UserRewire.__set__('logger', FakeLogger);
			UserRewire.__set__('sdkUtils', FakeSdkUtils);
			UserRewire.__set__('Identity', FakeIdentity);

			const obj = new UserRewire('cfg');
			await obj.fromString('{ "name":"cfg", "roles":"test_role", "affiliation":"test_affiliation", "enrollmentSecret":"test_enrollmentSecret", "mspid":"test_mspId", "enrollment":{"identity":{"certificate":"test_certificate"}, "signingIdentity":"test_signingIdentity"}}', false).should.be.rejectedWith(/Private key missing from key store. Can not establish the signing identity for user cfg/);
		});
	});

	describe('#toString', () => {
		it('should create a state and return it when the user has no signingIdentity or identity', () => {
			const user = new User({enrollmentID: 'cfg', name: 'cfg', roles: 'test_role', affiliation: 'test_affiliation'});

			user.toString().should.equal('{"name":"cfg","mspid":"","roles":"test_role","affiliation":"test_affiliation","enrollmentSecret":"","enrollment":{}}');
		});

		it('should set serializedEnrollment.signingIdentity if the user has a signingIdentity', () => {
			const user = new User({enrollmentID: 'cfg', name: 'cfg', roles: 'test_role', affiliation: 'test_affiliation'});
			user._signingIdentity = {_signer: {_key: {getSKI() {
				return 'test_signingIdentity';
			}}}};

			user.toString().should.equal('{"name":"cfg","mspid":"","roles":"test_role","affiliation":"test_affiliation","enrollmentSecret":"","enrollment":{"signingIdentity":"test_signingIdentity"}}');
		});

		it('should set serializedEnrollment.identity.certificate if the user has an identity.certificate', () => {
			const user = new User({enrollmentID: 'cfg', name: 'cfg', roles: 'test_role', affiliation: 'test_affiliation'});
			user._identity = {_certificate: 'test_certificate'};

			user.toString().should.equal('{"name":"cfg","mspid":"","roles":"test_role","affiliation":"test_affiliation","enrollmentSecret":"","enrollment":{"identity":{"certificate":"test_certificate"}}}');
		});
	});

	describe('#User.isInstance', () => {
		it('should return true if every user parameter is defined', () => {
			const user = new User({enrollmentID: 'cfg', name: 'cfg', roles: 'test_role', affiliation: 'test_affiliation'});
			user._enrollmentSecret = 'test_enrollmentSecret';
			user._identity = 'test_identity';
			user._signingIdentity = 'test_signingIdentity';
			user._mspId = 'test_mspId';
			user.cryptoSuite = 'test_cryptoSuite';

			User.isInstance(user).should.equal(true);
		});

		it('should return false if user._name is undefined', () => {
			const user = new User({enrollmentID: 'cfg', name: 'cfg', roles: 'test_role', affiliation: 'test_affiliation'});
			user._enrollmentSecret = 'test_enrollmentSecret';
			user._identity = 'test_identity';
			user._signingIdentity = 'test_signingIdentity';
			user._mspId = 'test_mspId';
			user.cryptoSuite = 'test_cryptoSuite';
			user._name = undefined;

			User.isInstance(user).should.equal(false);
		});

		it('should return false if user._roles is undefined', () => {
			const user = new User({enrollmentID: 'cfg', name: 'cfg', roles: 'test_role', affiliation: 'test_affiliation'});
			user._enrollmentSecret = 'test_enrollmentSecret';
			user._identity = 'test_identity';
			user._signingIdentity = 'test_signingIdentity';
			user._mspId = 'test_mspId';
			user.cryptoSuite = 'test_cryptoSuite';
			user._roles = undefined;

			User.isInstance(user).should.equal(false);
		});

		it('should return false if user._affiliation is undefined', () => {
			const user = new User({enrollmentID: 'cfg', name: 'cfg', roles: 'test_role', affiliation: 'test_affiliation'});
			user._enrollmentSecret = 'test_enrollmentSecret';
			user._identity = 'test_identity';
			user._signingIdentity = 'test_signingIdentity';
			user._mspId = 'test_mspId';
			user.cryptoSuite = 'test_cryptoSuite';
			user._affiliation = undefined;

			User.isInstance(user).should.equal(false);
		});

		it('should return false if user._enrollmentSecret is undefined', () => {
			const user = new User({enrollmentID: 'cfg', name: 'cfg', roles: 'test_role', affiliation: 'test_affiliation'});
			user._enrollmentSecret = undefined;
			user._identity = 'test_identity';
			user._signingIdentity = 'test_signingIdentity';
			user._mspId = 'test_mspId';
			user.cryptoSuite = 'test_cryptoSuite';

			User.isInstance(user).should.equal(false);
		});

		it('should return false if user._identity is undefined', () => {
			const user = new User({enrollmentID: 'cfg', name: 'cfg', roles: 'test_role', affiliation: 'test_affiliation'});
			user._enrollmentSecret = 'test_enrollmentSecret';
			user._identity = undefined;
			user._signingIdentity = 'test_signingIdentity';
			user._mspId = 'test_mspId';
			user.cryptoSuite = 'test_cryptoSuite';

			User.isInstance(user).should.equal(false);
		});

		it('should return false if user._signingIdentity is undefined', () => {
			const user = new User({enrollmentID: 'cfg', name: 'cfg', roles: 'test_role', affiliation: 'test_affiliation'});
			user._enrollmentSecret = 'test_enrollmentSecret';
			user._identity = 'test_identity';
			user._signingIdentity = undefined;
			user._mspId = 'test_mspId';
			user.cryptoSuite = 'test_cryptoSuite';

			User.isInstance(user).should.equal(false);
		});

		it('should return false if user._mspId is undefined', () => {
			const user = new User({enrollmentID: 'cfg', name: 'cfg', roles: 'test_role', affiliation: 'test_affiliation'});
			user._enrollmentSecret = 'test_enrollmentSecret';
			user._identity = 'test_identity';
			user._signingIdentity = 'test_signingIdentity';
			user._mspId = undefined;
			user.cryptoSuite = 'test_cryptoSuite';

			User.isInstance(user).should.equal(false);
		});

		it('should return false if user._cryptoSuite is undefined', () => {
			const user = new User({enrollmentID: 'cfg', name: 'cfg', roles: 'test_role', affiliation: 'test_affiliation'});
			user._enrollmentSecret = 'test_enrollmentSecret';
			user._identity = 'test_identity';
			user._signingIdentity = 'test_signingIdentity';
			user._mspId = 'test_mspId';
			user._cryptoSuite = undefined;

			User.isInstance(user).should.equal(false);
		});
	});
});
