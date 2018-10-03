/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

package org.example;

import java.util.List;

import org.hyperledger.fabric.shim.ChaincodeBase;
import org.hyperledger.fabric.shim.ChaincodeStub;
import org.json.*;

public class Chaincode extends ChaincodeBase {

    public Chaincode() {
        JSONTokener tokener = new JSONTokener("{}");
        JSONObject root = new JSONObject(tokener);
        System.out.println(root);
    }

    @Override
    public Response init(ChaincodeStub stub) {
        String fcn = stub.getFunction();
        List<String> params = stub.getParameters();
        System.out.printf("init() %s %s\n", fcn, params.toArray());

        return ChaincodeBase.newSuccessResponse();
    }

    @Override
    public Response invoke(ChaincodeStub stub) {
        String fcn = stub.getFunction();
        List<String> params = stub.getParameters();
        System.out.printf("invoke() %s %s\n", fcn, params.toArray());
        return ChaincodeBase.newSuccessResponse();
    }

}
