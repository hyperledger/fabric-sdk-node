/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

package main

import "github.com/hyperledger/fabric-chaincode-go/shim"

func main() {
	err := shim.Start(new(Chaincode))
	if err != nil {
		panic(err)
	}
}
