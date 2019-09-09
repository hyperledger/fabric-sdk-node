/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const CryptoSuite = require('../lib/CryptoSuite');

const chai = require('chai');
const should = chai.should();

describe('CryptoSuite', () => {
	let cryptoSuite;

	beforeEach(() => {
		cryptoSuite = new CryptoSuite();
	});

	describe('#generateKey', () => {
		it('should throw if unimplemented', () => {
			(() => {
				cryptoSuite.generateKey();
			}).should.throw(/Unimplemented abstract method/);
		});
	});

	describe('#generateEphemeralKey', () => {
		it('should throw if unimplemented', () => {
			(() => {
				cryptoSuite.generateEphemeralKey();
			}).should.throw(/Unimplemented abstract method/);
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

		it('should throw if unimplemented', () => {
			(() => {
				cryptoSuite.importKey();
			}).should.throw(/Unimplemented abstract method/);
		});
	});

	describe('#createKeyFromRaw', () => {
		it('should throw if unimplemented', () => {
			(() => {
				cryptoSuite.createKeyFromRaw();
			}).should.throw(/Unimplemented abstract method/);
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
