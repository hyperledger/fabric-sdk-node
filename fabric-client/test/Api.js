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
const Api = rewire('../lib/api');

const chai = require('chai');
const sinon = require('sinon');
const should = chai.should();

describe('KeyValueStore', () => {
	let keyValueStore;

	beforeEach(() => {
		keyValueStore = new Api.KeyValueStore();
	});

	describe('#getName', () => {
		it('should return undefined', () => {
			const value1 = keyValueStore.getValue('name');
			const value2 = keyValueStore.getValue();
			should.equal(value1, undefined);
			should.equal(value2, undefined);
		});
	});

	describe('#setValue', () => {
		it('should return undefined', () => {
			should.equal(keyValueStore.setValue(), undefined);
			should.equal(keyValueStore.setValue('name'), undefined);
			should.equal(keyValueStore.setValue(null, 'value'), undefined);
		});
	});
});

describe('CryptoSuite', () => {
	let cryptoSuite;

	beforeEach(() => {
		cryptoSuite = new Api.CryptoSuite();
	});

	describe('#generateKey', () => {
		it('should return undefined', () => {
			should.equal(cryptoSuite.generateKey(), undefined);
			should.equal(cryptoSuite.generateKey({}), undefined);
		});
	});

	describe('#generateEphemeralKey', () => {
		it('should return undefined', () => {
			should.equal(cryptoSuite.generateEphemeralKey(), undefined);
		});
	});

	describe('#deriveKey', () => {
		it('should return undefined', () => {
			should.equal(cryptoSuite.deriveKey(), undefined);
			should.equal(cryptoSuite.deriveKey('name'), undefined);
			should.equal(cryptoSuite.deriveKey('name', {}), undefined);
		});
	});

	describe('#importKey', () => {
		it('should return undefined', () => {
			should.equal(cryptoSuite.importKey(), undefined);
			should.equal(cryptoSuite.importKey('name'), undefined);
			should.equal(cryptoSuite.importKey('name', {}), undefined);
		});
	});

	describe('#getKey', () => {
		it('should return undefined', () => {
			should.equal(cryptoSuite.getKey(), undefined);
			should.equal(cryptoSuite.getKey('name'), undefined);
		});
	});

	describe('#hash', () => {
		it('should return undefined', () => {
			should.equal(cryptoSuite.hash(), undefined);
			should.equal(cryptoSuite.hash('name'), undefined);
			should.equal(cryptoSuite.hash('name', {}), undefined);
		});
	});

	describe('#sign', () => {
		it('should return undefined', () => {
			should.equal(cryptoSuite.sign(), undefined);
			should.equal(cryptoSuite.sign('name'), undefined);
			should.equal(cryptoSuite.sign('name', {}), undefined);
		});
	});

	describe('#verify', () => {
		it('should return undefined', () => {
			should.equal(cryptoSuite.verify(), undefined);
			should.equal(cryptoSuite.verify('key'), undefined);
			should.equal(cryptoSuite.verify('key', 'signature'), undefined);
			should.equal(cryptoSuite.verify('key', 'signature', 'digest'), undefined);
		});
	});

	describe('#encrypt', () => {
		it('should return undefined', () => {
			should.equal(cryptoSuite.encrypt(), undefined);
			should.equal(cryptoSuite.encrypt('name'), undefined);
			should.equal(cryptoSuite.encrypt('name', 'name'), undefined);
			should.equal(cryptoSuite.encrypt('name', {}), undefined);
		});
	});

	describe('#decrypt', () => {
		it('should return undefined', () => {
			should.equal(cryptoSuite.decrypt(), undefined);
			should.equal(cryptoSuite.decrypt('name'), undefined);
			should.equal(cryptoSuite.decrypt('name', 'name'), undefined);
			should.equal(cryptoSuite.decrypt('name', {}), undefined);
		});
	});

	describe('#setCryptoKeyStore', () => {
		it('should throw an error if cryptoKeyStore not set', () => {
			(() => {
				cryptoSuite.setCryptoKeyStore();
			}).should.throw(Error, 'Can\'t call abstract method, must be implemented by sub-class!');
		});

		it('should throw an error if cryptoKeyStore is set', () => {
			(() => {
				cryptoSuite.setCryptoKeyStore('keystore');
			}).should.throw(Error, 'Can\'t call abstract method, must be implemented by sub-class!');
		});
	});
});

describe('Key', () => {
	let key;

	beforeEach(() => {
		key = new Api.Key();
	});

	describe('#getSKI', () => {
		it('should return undefined', () => {
			should.equal(key.getSKI(), undefined);
		});
	});

	describe('#isSymmetric', () => {
		it('should return undefined', () => {
			should.equal(key.isSymmetric(), undefined);
		});
	});

	describe('#isPrivate', () => {
		it('should return undefined', () => {
			should.equal(key.isPrivate(), undefined);
		});
	});

	describe('#getPublicKey', () => {
		it('should return undefined', () => {
			should.equal(key.getPublicKey(), undefined);
		});
	});

	describe('#toBytes', () => {
		it('should return undefined', () => {
			should.equal(key.toBytes(), undefined);
		});
	});
});

describe('Hash', () => {
	let sandbox;
	let revert;
	let hash;

	beforeEach(() => {
		revert = [];
		sandbox = sinon.createSandbox();
	});

	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sandbox.restore();
	});

	describe('#constructor', () => {
		it('should set the _blockSize and call reset()', () => {
			const hashResetStub = sandbox.stub();
			revert.push(Api.__set__('module.exports.Hash.prototype.reset', hashResetStub));
			hash = new Api.Hash(5);
			hash._blockSize.should.equal(5);
			sinon.assert.called(hashResetStub);
		});
	});

	describe('#hash', () => {
		it('should return the correct function', () => {
			const hashFinalizeStub = sandbox.stub();
			const hashUpdateStub = sandbox.stub().returns({
				finalize: hashFinalizeStub
			});
			const hashResetStub = sandbox.stub().returns({
				update: hashUpdateStub,
			});
			revert.push(Api.__set__('module.exports.Hash.prototype.reset', hashResetStub));
			hash = new Api.Hash(5);
			hash.hash('data');
			sinon.assert.calledTwice(hashResetStub);
			sinon.assert.calledWith(hashUpdateStub, 'data');
			sinon.assert.calledOnce(hashFinalizeStub);
		});
	});

	describe('#reset', () => {
		it('should return an instance of itself', () => {
			hash = new Api.Hash(5);
			hash.reset().should.equal(hash);
		});
	});

	describe('#update', () => {
		it('should call _hash.update and return an instance of itself', () => {
			hash = new Api.Hash(5);
			const hashUpdateStub = sandbox.stub();
			hash._hash = {update: hashUpdateStub};
			hash.update('data').should.equal(hash);
			sinon.assert.calledWith(hashUpdateStub, 'data');
		});
	});

	describe('#finalize', () => {
		it('should not throw', () => {
			hash = new Api.Hash(5);
			(() => {
				hash.finalize();
			}).should.not.throw();
		});
	});
});

describe('EndorsementHandler', () => {
	let endorsementHandler;

	beforeEach(() => {
		endorsementHandler = new Api.EndorsementHandler();
	});

	describe('#endorse', () => {

		it('should throw when params are given', () => {
			(() => {
				endorsementHandler.endorse('params');
			}).should.throw('The "endorse" method must be implemented');
		});

		it('should throw when params are not given', () => {
			(() => {
				endorsementHandler.endorse();
			}).should.throw('The "endorse" method must be implemented');
		});
	});

	describe('#endorse', () => {
		it('should throw', () => {
			(() => {
				endorsementHandler.initialize();
			}).should.throw('The "initialize" method must be implemented');
		});
	});

	describe('create', () => {
		it('should throw when params are given', () => {
			(() => {
				Api.EndorsementHandler.create('channel');
			}).should.throw('The "create" method must be implemented');
		});

		it('should throw when params are not given', () => {
			(() => {
				Api.EndorsementHandler.create();
			}).should.throw('The "create" method must be implemented');
		});
	});
});

describe('CommitHandler', () => {
	let commitHandler;

	beforeEach(() => {
		commitHandler = new Api.CommitHandler();
	});

	describe('#commit', () => {
		it('should throw when params are given', () => {
			(() => {
				commitHandler.commit('prams');
			}).should.throw('The "commit" method must be implemented');
		});

		it('should throw when params are not given', () => {
			(() => {
				commitHandler.commit();
			}).should.throw('The "commit" method must be implemented');
		});
	});

	describe('#initialize', () => {
		it('should throw when params are given', () => {
			(() => {
				commitHandler.initialize();
			}).should.throw('The "initialize" method must be implemented');
		});
	});

	describe('create', () => {
		it('should throw when params are given', () => {
			(() => {
				Api.CommitHandler.create('params');
			}).should.throw('The "create" method must be implemented');
		});

		it('should throw when params are not given', () => {
			(() => {
				Api.CommitHandler.create();
			}).should.throw('The "create" method must be implemented');
		});
	});
});
