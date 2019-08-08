/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Shim } = require('fabric-shim');
const { Chaincode } = require('..');

const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

chai.should();
chai.use(sinonChai);

describe('start', () => {

    afterEach(() => {
        sinon.restore();
        delete require.cache[require.resolve('../lib/start')];
    });

    it('should work', () => {
        const startStub = sinon.stub(Shim, 'start');
        require('../lib/start');
        startStub.should.have.been.calledOnceWithExactly(sinon.match.instanceOf(Chaincode));
    });

});
