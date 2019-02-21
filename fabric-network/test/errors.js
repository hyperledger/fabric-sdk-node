/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const chai = require('chai');
const expect = chai.expect;

const FabricError = require('fabric-network/lib/errors/fabricerror');
const TimeoutError = require('fabric-network/lib/errors/timeouterror');

describe('Common error behaviour', () => {
	[FabricError, TimeoutError].forEach((ErrorType) => describe(ErrorType.name, () => {
		it('name property matches class name', () => {
			const error = new ErrorType();
			expect(error.name).to.equal(ErrorType.name);
		});

		it('created with error message string', () => {
			const message = 'message';
			const error = new ErrorType(message);
			expect(error.message).to.equal(message);
		});

		it('created with error message property', () => {
			const info = {message: 'message'};
			const error = new ErrorType(info);
			expect(error.message).to.equal(info.message);
		});

		it('created with cause error', () => {
			const cause = new Error('cause');
			const error = new ErrorType({cause});
			expect(error.cause).to.equal(cause);
		});

		it('associated with transaction ID', () => {
			const transactionId = 'txId';
			const error = new ErrorType({transactionId});
			expect(error.transactionId).to.equal(transactionId);
		});

		it('name property does not override error name', () => {
			const error = new ErrorType({name: 'wrong'});
			expect(error.name).to.equal(ErrorType.name);
		});
	}));
});
