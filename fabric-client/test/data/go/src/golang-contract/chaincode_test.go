/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

package main

import (
	"testing"

	"github.com/hyperledger/fabric/core/chaincode/shim"
)

func TestInit(t *testing.T) {
	cc := new(Chaincode)
	stub := shim.NewMockStub("chaincode", cc)
	res := stub.MockInit("1", [][]byte{[]byte("initFunc")})
	if res.Status != shim.OK {
		t.Error("Init failed", res.Status, res.Message)
	}
}

func TestInvoke(t *testing.T) {
	cc := new(Chaincode)
	stub := shim.NewMockStub("chaincode", cc)
	res := stub.MockInit("1", [][]byte{[]byte("initFunc")})
	if res.Status != shim.OK {
		t.Error("Init failed", res.Status, res.Message)
	}
	res = stub.MockInvoke("1", [][]byte{[]byte("invokeFunc")})
	if res.Status != shim.OK {
		t.Error("Invoke failed", res.Status, res.Message)
	}
}
