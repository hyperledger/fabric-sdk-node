#!/usr/bin/env bash
#
# Copyright 2018 IBM All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#
set -ex
cd $(dirname $0)
export GOPATH=$PWD/go
peer chaincode package -l golang -n my-contract -v 1.2.3 -p golang-contract golang-contract.cds
cp -rf META-INF go/src/golang-contract/
peer chaincode package -l golang -n my-contract -v 1.2.3 -p golang-contract golang-contract-metadata.cds
rm -rf go/src/golang-contract/META-INF
peer chaincode package -l node -n my-contract -v 1.2.3 -p javascript-contract javascript-contract.cds
cp -rf META-INF javascript-contract/
peer chaincode package -l node -n my-contract -v 1.2.3 -p javascript-contract javascript-contract-metadata.cds
rm -rf javascript-contract/META-INF
peer chaincode package -l node -n my-contract -v 1.2.3 -p typescript-contract typescript-contract.cds
cp -rf META-INF typescript-contract/
peer chaincode package -l node -n my-contract -v 1.2.3 -p typescript-contract typescript-contract-metadata.cds
rm -rf typescript-contract/META-INF
peer chaincode package -l java -n my-contract -v 1.2.3 -p java-contract java-contract.cds
cp -rf META-INF java-contract/
peer chaincode package -l java -n my-contract -v 1.2.3 -p java-contract java-contract-metadata.cds
rm -rf java-contract/META-INF
