/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { ChaincodeInterface, Shim } = require('fabric-shim');

class Chaincode extends ChaincodeInterface {

    async Init(stub) {
        const { fcn, params } = stub.getFunctionAndParameters();
        console.info('Init()', fcn, params);
        return Shim.success();
    }

    async Invoke(stub) {
        const { fcn, params } = stub.getFunctionAndParameters();
        console.info('Invoke()', fcn, params);
        return Shim.success();
    }

}

module.exports = Chaincode;
