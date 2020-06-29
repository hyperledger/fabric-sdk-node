#!/bin/bash
#
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#
set -euo pipefail

version=${FABRIC_VERSION:-2.2}
artifactory_url=hyperledger-fabric.jfrog.io

for image in peer orderer ccenv baseos nodeenv javaenv tools; do
    artifactory_image="${artifactory_url}/fabric-${image}:amd64-${version}-stable"
    docker pull -q "${artifactory_image}"
    docker tag "${artifactory_image}" "hyperledger/fabric-${image}"
    docker rmi -f "${artifactory_image}" >/dev/null
done

docker pull -q couchdb:3.1
docker pull -q hyperledger/fabric-ca:1.4
docker tag hyperledger/fabric-ca:1.4 hyperledger/fabric-ca
docker rmi hyperledger/fabric-ca:1.4 >/dev/null
