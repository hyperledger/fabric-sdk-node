#!/bin/bash
#
# SPDX-License-Identifier: Apache-2.0
#
set -e

# Set the path to the crypto material to ensure it may be used
CRYPTOGEN=$1
export PATH=${CRYPTOGEN}:${PATH}

# Get current location to ensure things go to the correct place
BASEDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Start generating
echo "Creating new crypto material and tx blocks from within directory ${BASEDIR}"
rm -rf "${BASEDIR}/../crypto-config"
rm -rf "${BASEDIR}/../channel-config"
mkdir "${BASEDIR}/../crypto-config"
mkdir "${BASEDIR}/../channel-config"

echo 'Generating base crypto-material and channel tx files....'
export FABRIC_CFG_PATH="${BASEDIR}"
cryptogen generate --config="${BASEDIR}/crypto-config.yaml" --output="${BASEDIR}/../crypto-config"

# Genesis block
configtxgen -profile ThreeOrgsOrdererGenesis -outputBlock "${BASEDIR}/threeorgs.genesis.block"

#  Channel tx
configtxgen -profile ThreeOrgsChannel -outputCreateChannelTx "${BASEDIR}/../channel-config/baseapichannel.tx" -channelID baseapichannel # scenario test base api
configtxgen -profile ThreeOrgsChannel -outputCreateChannelTx "${BASEDIR}/../channel-config/channelopschannel.tx" -channelID channelopschannel # scenario test channel query
configtxgen -profile ThreeOrgsChannel -outputCreateChannelTx "${BASEDIR}/../channel-config/deprecatedchannel.tx" -channelID deprecatedchannel # scenario test deprecated sdk
#configtxgen -profile ThreeOrgsChannel -outputCreateChannelTx "${BASEDIR}/../channel-config/discoverychannel.tx" -channelID discoverychannel # sceanrio test discovery feature
#configtxgen -profile ThreeOrgsChannel -outputCreateChannelTx "${BASEDIR}/../channel-config/eventschannel.tx" -channelID eventschannel # sceanrio test discovery feature
#configtxgen -profile ThreeOrgsChannel -outputCreateChannelTx "${BASEDIR}/../channel-config/gatewaychannel.tx" -channelID gatewaychannel # sceanrio test gateway feature

echo 'Generating crypto-material complete, now renaming keys...'
# Rename the key files we use to be key.pem instead of a uuid
for KEY in $(find "${BASEDIR}/../crypto-config" -type f -name "*_sk"); do
    KEY_DIR="$(dirname ${KEY})"
    mv ${KEY} "${KEY_DIR}/key.pem"
done
echo 'Renaming keys complete'
