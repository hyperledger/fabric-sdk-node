/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Shim } from 'fabric-shim';
import { Chaincode } from '.';

import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

chai.should();
chai.use(sinonChai);

describe('start', () => {

    afterEach(() => {
        sinon.restore();
        delete require.cache[require.resolve('../src/start')];
    });

    it('should work', () => {
        const startStub = sinon.stub(Shim, 'start');
        require('../src/start');
        startStub.should.have.been.calledOnceWithExactly(sinon.match.instanceOf(Chaincode));
    });

});
