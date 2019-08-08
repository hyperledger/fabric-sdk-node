/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

package org.example;

import org.junit.Test;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

import java.util.ArrayList;

import org.hyperledger.fabric.shim.ChaincodeStub;
import org.hyperledger.fabric.shim.Chaincode.Response;
import org.hyperledger.fabric.shim.Chaincode.Response.Status;

public class ChaincodeTest {

    @Test
    public void testInit() {
        Chaincode cc = new Chaincode();
        ChaincodeStub stub = mock(ChaincodeStub.class);
        when(stub.getFunction()).thenReturn("initFunc");
        when(stub.getParameters()).thenReturn(new ArrayList<String>());
        Response res = cc.init(stub);
        assertEquals(Status.SUCCESS, res.getStatus());
    }

    @Test
    public void testInvoke() {
        Chaincode cc = new Chaincode();
        ChaincodeStub stub = mock(ChaincodeStub.class);
        when(stub.getFunction()).thenReturn("initFunc");
        when(stub.getParameters()).thenReturn(new ArrayList<String>());
        Response res = cc.init(stub);
        assertEquals(Status.SUCCESS, res.getStatus());
        when(stub.getFunction()).thenReturn("invokeFunc");
        when(stub.getParameters()).thenReturn(new ArrayList<String>());
        res = cc.invoke(stub);
        assertEquals(Status.SUCCESS, res.getStatus());
    }

}
