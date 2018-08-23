/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */


'use strict';
const chai = require('chai');
chai.use(require('chai-as-promised'));

const QueryHandler = require('../../lib/api/queryhandler');


describe('QueryHandler', () => {
	const queryHandler = new QueryHandler();

	it('just returns calling initialize', () => {
		return queryHandler.initialize();
	});

	it('just returns calling dispose', () => {
		return queryHandler.dispose();
	});

	it('throws exception calling queryChaincode()', () => {
		return queryHandler.queryChaincode(null, null, null, null).should.be.rejectedWith('Not implemented');
	});
});
