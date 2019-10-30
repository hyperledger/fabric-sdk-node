#!/bin/bash
#
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#
set -o pipefail

echo "======== PULL DOCKER IMAGES ========"

##########################################################
# Pull and Tag the fabric and fabric-ca images from Nexus
##########################################################
echo "Fetching images from Nexus"
NEXUS_URL=nexus3.hyperledger.org:10001
ORG_NAME="hyperledger/fabric"
ARCH=$1
: ${STABLE_VERSION:=$2}
STABLE_TAG="${ARCH}-${STABLE_VERSION}"
VERSION_TAG="${STABLE_VERSION%%-*}"
echo "---------> STABLE_VERSION: ${STABLE_VERSION}"

dockerTag() {
  for IMAGES in ca peer orderer ccenv baseos nodeenv javaenv tools; do
    echo "Images: ${IMAGES}"
    echo
	NEXUS_IMAGE="${NEXUS_URL}/${ORG_NAME}-${IMAGES}:${STABLE_TAG}"
    docker pull "${NEXUS_IMAGE}"
          if [ $? != 0 ]; then
             echo  "FAILED: Docker Pull Failed on ${IMAGES}"
             exit 1
          fi
	IMAGE_NAME="${ORG_NAME}-${IMAGES}"
    docker tag "${NEXUS_IMAGE}" "${IMAGE_NAME}"
    docker tag "${NEXUS_IMAGE}" "${IMAGE_NAME}:${VERSION_TAG}"
    echo "${IMAGE_NAME}:${VERSION_TAG}"
    echo "Deleting Nexus docker images: $IMAGES"
    docker rmi -f "${NEXUS_IMAGE}"
  done
}

dockerTag

echo
docker images | grep "hyperledger*"
echo
