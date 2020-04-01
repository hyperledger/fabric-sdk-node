#!/bin/bash
#
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#
set -o pipefail

echo "======== PULL DOCKER IMAGES ========"

##########################################################
# Pull and Tag the fabric and fabric-ca images from Artifactory
##########################################################
echo "Fetching images from Artifactory"
ARTIFACTORY_URL=hyperledger-fabric.jfrog.io

ARCH=amd64
STABLE_VERSION=2.1-stable
STABLE_TAG="${ARCH}-${STABLE_VERSION}"
VERSION_TAG="${STABLE_VERSION%%-*}"
echo "---------> STABLE_VERSION: ${STABLE_VERSION}"

dockerTag() {
    for IMAGE in ca peer orderer ccenv baseos nodeenv javaenv tools; do
        ARTIFACTORY_IMAGE="${ARTIFACTORY_URL}/fabric-${IMAGE}:${STABLE_TAG}"
        IMAGE_NAME="fabric-${IMAGE}"
        docker pull "${ARTIFACTORY_IMAGE}"
        docker tag "${ARTIFACTORY_IMAGE}" "hyperledger/${IMAGE_NAME}"
        docker tag "${ARTIFACTORY_IMAGE}" "hyperledger/${IMAGE_NAME}:${VERSION_TAG}"
        docker rmi -f "${ARTIFACTORY_IMAGE}"
    done
}

dockerTag

echo
docker images | grep "hyperledger*"
echo
