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

configtxgen -profile TwoOrgsChannel -outputCreateChannelTx "${BASEDIR}/../channel-config/channelopschannelvtwo.tx" -channelID channelopschannelvtwo # V2 channel
configtxgen -profile TwoOrgsChannel -outputCreateChannelTx "${BASEDIR}/../channel-config/lifecyclechannel.tx" -channelID lifecyclechannel # V2 lifecycle
configtxgen -profile TwoOrgsChannel -outputCreateChannelTx "${BASEDIR}/../channel-config/gatewaychannel.tx" -channelID gatewaychannel # V2 lifecycle
configtxgen -profile TwoOrgsChannel -outputCreateChannelTx "${BASEDIR}/../channel-config/discoverychannel.tx" -channelID discoverychannel # V2 lifecycle
configtxgen -profile TwoOrgsChannel -outputCreateChannelTx "${BASEDIR}/../channel-config/eventschannel.tx" -channelID eventschannel # V2 lifecycle

configtxgen -profile TwoOrgsChannel -outputAnchorPeersUpdate "${BASEDIR}/../channel-config/channelopschannelvtwo-anchor.tx" -channelID channelopschannelvtwo -asOrg Org1MSP
configtxgen -profile TwoOrgsChannel -outputAnchorPeersUpdate "${BASEDIR}/../channel-config/gatewaychannel-anchor.tx" -channelID gatewaychannel -asOrg Org1MSP
configtxgen -profile TwoOrgsChannel -outputAnchorPeersUpdate "${BASEDIR}/../channel-config/discoverychannel-anchor.tx" -channelID discoverychannel -asOrg Org1MSP
configtxgen -profile TwoOrgsChannel -outputAnchorPeersUpdate "${BASEDIR}/../channel-config/eventschannel-anchor.tx" -channelID eventschannel -asOrg Org1MSP
