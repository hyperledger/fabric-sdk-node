#!/bin/bash
#
# SPDX-License-Identifier: Apache-2.0
#
set -e

# Set the path to teh crypto material to ensure it may be used
CRYPTOGEN=$1
export PATH=${CRYPTOGEN}:${PATH}

# Get current location to ensure things go to the correct place
BASEDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo
echo "Creating new channel update tx blocks from within directory ${BASEDIR}"
export FABRIC_CFG_PATH="$BASEDIR"
configtxgen -profile TwoOrgsChannel -outputAnchorPeersUpdate "${BASEDIR}/../channel-config/mychannel-org1anchor.tx" -channelID mychannel -asOrg Org1MSP
configtxgen -profile TwoOrgsChannel -outputAnchorPeersUpdate "${BASEDIR}/../channel-config/discovery_anchor.tx" -channelID discovery -asOrg Org1MSP

