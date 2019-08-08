/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChaincodeStub } from 'fabric-shim';
import { Chaincode } from '.';

import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

chai.should();
chai.use(sinonChai);

describe('Chaincode', () => {

    describe('#Init', () => {

        it('should work', async () => {
            const cc = new Chaincode();
            const stub = sinon.createStubInstance(ChaincodeStub);
            stub.getFunctionAndParameters.returns({ fcn: 'initFunc', params: [] });
            const res = await cc.Init(stub);
            res.status.should.equal(ChaincodeStub.RESPONSE_CODE.OK);
        });

    });

    describe('#Invoke', async () => {

        it('should work', async () => {
            const cc = new Chaincode();
            const stub = sinon.createStubInstance(ChaincodeStub);
            stub.getFunctionAndParameters.returns({ fcn: 'initFunc', params: [] });
            let res = await cc.Init(stub);
            res.status.should.equal(ChaincodeStub.RESPONSE_CODE.OK);
            stub.getFunctionAndParameters.returns({ fcn: 'invokeFunc', params: [] });
            res = await cc.Invoke(stub);
            res.status.should.equal(ChaincodeStub.RESPONSE_CODE.OK);
        });

    });

});
