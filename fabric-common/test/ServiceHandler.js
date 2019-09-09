/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const ServiceHandler = require('../lib/ServiceHandler');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

describe('ServiceHandler', () => {
	let serviceHandler;

	beforeEach(async () => {
		serviceHandler = new ServiceHandler();
	});

	describe('#constructor', () => {
		it('should create a new instance', () => {
			new ServiceHandler();
		});
	});

	describe('#commit', () => {
		it('should indicate that needs to be implemented', () => {
			(() => {
				serviceHandler.commit();
			}).should.throw('"commit" method must be implemented');
		});
	});

	describe('#endorse', () => {
		it('should indicate that needs to be implemented', () => {
			(() => {
				serviceHandler.endorse();
			}).should.throw('"endorse" method must be implemented');
		});
	});

	describe('#query', () => {
		it('should indicate that needs to be implemented', () => {
			(() => {
				serviceHandler.query();
			}).should.throw('"query" method must be implemented');
		});
	});

	describe('#toString', () => {
		it('should indicate that needs to be implemented', () => {
			(() => {
				serviceHandler.toString();
			}).should.throw('"toString" method must be implemented');
		});
	});
});
