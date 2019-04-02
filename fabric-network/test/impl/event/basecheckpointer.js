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

	describe('#save', () => {
		it('should throw an exception', () => {
			const checkpointer = new BaseCheckpointer();
			expect(checkpointer.save()).to.be.rejectedWith('Method has not been implemented');
		});
	});

	describe('#load', () => {
		it('should throw an exception', () => {
			const checkpointer = new BaseCheckpointer();
			expect(checkpointer.load()).to.be.rejectedWith('Method has not been implemented');
		});
	});

	describe('#setChaincodeId', () => {
		it('should set the chaincodeId', () => {
			const checkpointer = new BaseCheckpointer();
			checkpointer.setChaincodeId('CHAINCODE_ID');
			expect(checkpointer._chaincodeId).to.equal('CHAINCODE_ID');
		});
	});
});
