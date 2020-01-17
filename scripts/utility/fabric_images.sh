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

ARCH=$1
: ${STABLE_VERSION:=$2}
STABLE_TAG="${ARCH}-${STABLE_VERSION}"
VERSION_TAG="${STABLE_VERSION%%-*}"
echo "---------> STABLE_VERSION: ${STABLE_VERSION}"

dockerTag() {
  for IMAGE in ca peer orderer ccenv baseos nodeenv javaenv tools; do
    echo
    echo "Pulling Image: ${ARTIFACTORY_URL}/fabric-${IMAGE}:${STABLE_TAG}"
    echo
	ARTIFACTORY_IMAGE="${ARTIFACTORY_URL}/fabric-${IMAGE}:${STABLE_TAG}"
    docker pull "${ARTIFACTORY_IMAGE}"
          if [ $? != 0 ]; then
             echo  "FAILED: Docker Pull Failed on ${IMAGE}"
             exit 1
          fi
	IMAGE_NAME="fabric-${IMAGE}"
    docker tag "${ARTIFACTORY_IMAGE}" "hyperledger/${IMAGE_NAME}"
    docker tag "${ARTIFACTORY_IMAGE}" "hyperledger/${IMAGE_NAME}:${VERSION_TAG}"
    echo "${IMAGE_NAME}:${VERSION_TAG}"
    echo "Deleting Artifactory docker images: $IMAGE"
    docker rmi -f "${ARTIFACTORY_IMAGE}"
  done
}

dockerTag

echo
docker images | grep "hyperledger*"
echo
