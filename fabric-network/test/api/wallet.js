/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */


'use strict';
const chai = require('chai');
chai.use(require('chai-as-promised'));

const Wallet = require('../../lib/api/wallet');


describe('Wallet', () => {
	const wallet = new Wallet();

	it('throws exception calling setUserContext()', () => {
		return wallet.setUserContext(null, null).should.be.rejectedWith('Not implemented');
	});

	it('throws exception calling configureClientStores()', () => {
		return wallet.configureClientStores(null, null).should.be.rejectedWith('Not implemented');
	});

	it('throws exception calling import()', () => {
		return wallet.import(null, null).should.be.rejectedWith('Not implemented');
	});

	it('throws exception calling export()', () => {
		return wallet.export(null).should.be.rejectedWith('Not implemented');
	});

	it('throws exception calling list()', () => {
		return wallet.list().should.be.rejectedWith('Not implemented');
	});

	it('throws exception calling delete()', () => {
		return wallet.delete(null).should.be.rejectedWith('Not implemented');
	});

	it('throws exception calling exists()', () => {
		return wallet.exists(null).should.be.rejectedWith('Not implemented');
	});


});