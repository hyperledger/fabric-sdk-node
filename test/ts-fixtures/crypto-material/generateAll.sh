#!/bin/bash
#
# SPDX-License-Identifier: Apache-2.0
#
set -e
CRYPTOGEN=$1
echo ''
echo "Crypto-gen scripts running based on binaries location ${CRYPTOGEN}"

BASEDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
"${BASEDIR}/config-base/generate.sh" ${CRYPTOGEN}
"${BASEDIR}/config-v2/generate.sh" ${CRYPTOGEN}
"${BASEDIR}/config-update/generate.sh" ${CRYPTOGEN}

echo ''
