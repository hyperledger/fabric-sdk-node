#!/bin/bash
#
# SPDX-License-Identifier: Apache-2.0
#
CRYPTOGEN=$1
echo ''
echo "Crypto-gen scripts running based on binaries location ${CRYPTOGEN}"

BASEDIR=$(dirname $(realpath $0))
${BASEDIR}/config-base/generate.sh ${CRYPTOGEN}
${BASEDIR}/config-update/generate.sh ${CRYPTOGEN}

echo ''
