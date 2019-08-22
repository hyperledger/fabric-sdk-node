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

# Start generating
echo "Creating new crypto material and tx blocks from within directory ${BASEDIR}"
rm -rf "${BASEDIR}/../crypto-config"
rm -rf "${BASEDIR}/../channel-config"
mkdir "${BASEDIR}/../crypto-config"
mkdir "${BASEDIR}/../channel-config"

echo 'Generating base crypto-material and channel tx files....'
export FABRIC_CFG_PATH="${BASEDIR}"
cryptogen generate --config="${BASEDIR}/crypto-config.yaml" --output="${BASEDIR}/../crypto-config"
configtxgen -profile TwoOrgsOrdererGenesis -outputBlock "${BASEDIR}/twoorgs.genesis.block"
configtxgen -profile TwoOrgsChannel -outputCreateChannelTx "${BASEDIR}/../channel-config/mychannel.tx" -channelID mychannel
configtxgen -profile TwoOrgsChannel -outputCreateChannelTx "${BASEDIR}/../channel-config/mychannel2.tx" -channelID mychannel2 #test/integration/network-config.js
configtxgen -profile TwoOrgsChannel -outputCreateChannelTx "${BASEDIR}/../channel-config/mychanneltx.tx" -channelID mychanneltx #test/integration/create-configtx-channel.js
configtxgen -profile TwoOrgsChannel -outputCreateChannelTx "${BASEDIR}/../channel-config/mychannelts.tx" -channelID mychannelts #test/typescript
configtxgen -profile TwoOrgsChannel -outputCreateChannelTx "${BASEDIR}/../channel-config/adminconfig.tx" -channelID adminconfig #test/only-admin.js
configtxgen -profile TwoOrgsChannel -outputCreateChannelTx "${BASEDIR}/../channel-config/discovery.tx" -channelID discovery #test/integration/discovery.js

echo 'Generating crypto-material complete, now renaming keys...'
# Rename the key files we use to be key.pem instead of a uuid
for KEY in $(find "${BASEDIR}/../crypto-config" -type f -name "*_sk"); do
    KEY_DIR="$(dirname ${KEY})"
    mv ${KEY} "${KEY_DIR}/key.pem"
done
echo 'Renaming keys complete'
