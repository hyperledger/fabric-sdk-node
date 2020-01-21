/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-as-promised'));

const BaseCheckpointer = require('./../../../lib/impl/event/basecheckpointer');

describe('BaseCheckpointer', () => {
	describe('#constructor', () => {
		it('options should be set', () => {
			const checkpointer = new BaseCheckpointer();
			expect(checkpointer.options).to.deep.equal({});
		});

		it('options should be set to an object', () => {
			const checkpointer = new BaseCheckpointer({option: 'anoption'});
			expect(checkpointer.options).to.deep.equal({option: 'anoption'});
		});
	});

	describe('#initialize', () => {
		it('should throw an exception', () => {
			const checkpointer = new BaseCheckpointer();
			expect(checkpointer.initialize()).to.be.rejectedWith('Method has not been implemented');
		});
	});

	describe('#prune', () => {
		it('should throw an exception', () => {
			const checkpointer = new BaseCheckpointer();
			expect(checkpointer.prune()).to.be.rejectedWith('Method has not been implemented');
		});
	});

	describe('#save', () => {
		it('should throw an exception', () => {
			const checkpointer = new BaseCheckpointer();
			expect(checkpointer.save()).to.be.rejectedWith('Method has not been implemented');
		});
	});

	describe('#check', () => {
		it('should throw an exception', () => {
			const checkpointer = new BaseCheckpointer();
			expect(checkpointer.check()).to.be.rejectedWith('Method has not been implemented');
		});
	});

	describe('#getStartBlock', () => {
		it('should throw an exception', () => {
			const checkpointer = new BaseCheckpointer();
			expect(checkpointer.getStartBlock()).to.be.rejectedWith('Method has not been implemented');
		});
	});
});
