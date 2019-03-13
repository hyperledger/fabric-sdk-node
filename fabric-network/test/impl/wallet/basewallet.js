/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
const chai = require('chai');
chai.use(require('chai-as-promised'));
const should = chai.should();

const BaseWallet = require('../../../lib/impl/wallet/basewallet');
const X509WalletMixin = require('../../../lib/impl/wallet/x509walletmixin');


describe('BaseWallet', () => {
	describe('#constructor', () => {
		it('should default to X509 wallet mixin', () => {
			const wallet = new BaseWallet();
			wallet.walletMixin.should.be.an.instanceof(X509WalletMixin);
		});

		it('should accept a mixin parameter', () => {
			const wallet = new BaseWallet('my_mixin');
			wallet.walletMixin.should.equal('my_mixin');
		});
	});

	describe('Unimplemented methods', () => {
		let wallet;
		beforeEach(() => {
			wallet = new BaseWallet();
		});

		it('throws exception calling import()', () => {
			return wallet.import(null, null).should.be.rejectedWith('Not implemented');
		});

		it('throws exception calling export()', () => {
			return wallet.export(null).should.be.rejectedWith('Not implemented');
		});

		it('throws exception calling delete()', () => {
			return wallet.delete(null).should.be.rejectedWith('Not implemented');
		});

		it('throws exception calling exists()', () => {
			return wallet.exists(null).should.be.rejectedWith('Not implemented');
		});

		it('throws exception calling getCryptoSuite()', () => {
			return wallet.getCryptoSuite(null).should.be.rejectedWith('Not implemented');
		});

		it('throws exception calling getAllLabels()', async () => {
			const labels = await wallet.getAllLabels();
			should.equal(labels, null);
		});

	});
});
