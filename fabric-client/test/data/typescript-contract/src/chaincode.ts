/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChaincodeInterface, ChaincodeStub, Shim } from 'fabric-shim';

export class Chaincode implements ChaincodeInterface {

    public async Init(stub: ChaincodeStub): Promise<any> {
        const { fcn, params } = stub.getFunctionAndParameters();
        console.info('Init()', fcn, params);
        return Shim.success();
    }

    public async Invoke(stub: ChaincodeStub): Promise<any> {
        const { fcn, params } = stub.getFunctionAndParameters();
        console.info('Invoke()', fcn, params);
        return Shim.success();
    }

}
