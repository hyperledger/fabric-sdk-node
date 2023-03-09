#!/bin/bash
#
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#
set -euo pipefail

FABRIC_VERSION=${FABRIC_VERSION:-2.2}
COUCHDB_VERSION=${COUCHDB_VERSION:-3.2}
CA_VERSION=${CA_VERSION:-1.5}

for image in peer orderer ccenv baseos nodeenv javaenv tools; do
    docker pull -q "hyperledger/fabric-${image}:${FABRIC_VERSION}"
    docker tag "hyperledger/fabric-${image}:${FABRIC_VERSION}" "hyperledger/fabric-${image}"
done

docker pull -q "couchdb:${COUCHDB_VERSION}"
docker tag "couchdb:${COUCHDB_VERSION}" couchdb

docker pull -q "hyperledger/fabric-ca:${CA_VERSION}"
docker tag "hyperledger/fabric-ca:${CA_VERSION}" hyperledger/fabric-ca
