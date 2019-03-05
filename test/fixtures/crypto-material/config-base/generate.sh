#
# SPDX-License-Identifier: Apache-2.0
#

echo 'Deleting old *.tx items....'
rm -rf ../crypto-config
rm -rf ../channel-config
mkdir ../channel-config
mkdir ../crypto-config

echo 'Generating base crypto-material and channel tx files....'
export FABRIC_CFG_PATH=$PWD
/Users/nkl/fabric/fabric-samples/bin/cryptogen generate --config=./crypto-config.yaml --output=../crypto-config
/Users/nkl/fabric/fabric-samples/bin/configtxgen -profile TwoOrgsOrdererGenesis -outputBlock ./twoorgs.genesis.block
/Users/nkl/fabric/fabric-samples/bin/configtxgen -profile TwoOrgsChannel -outputCreateChannelTx ../channel-config/mychannel.tx -channelID mychannel
/Users/nkl/fabric/fabric-samples/bin/configtxgen -profile TwoOrgsChannel -outputCreateChannelTx ../channel-config/mychannel2.tx -channelID mychannel2 #test/integration memory.js, network-config.js,
/Users/nkl/fabric/fabric-samples/bin/configtxgen -profile TwoOrgsChannel -outputCreateChannelTx ../channel-config/mychanneltx.tx -channelID mychanneltx #test/intergration/create-config-channel.js
/Users/nkl/fabric/fabric-samples/bin/configtxgen -profile TwoOrgsChannel -outputCreateChannelTx ../channel-config/mychannelts.tx -channelID mychannelts #test/typescript
/Users/nkl/fabric/fabric-samples/bin/configtxgen -profile TwoOrgsChannel -outputCreateChannelTx ../channel-config/adminconfig.tx -channelID adminconfig #test/integration/only-admin.js
/Users/nkl/fabric/fabric-samples/bin/configtxgen -profile TwoOrgsChannel -outputCreateChannelTx ../channel-config/discovery.tx -channelID discovery #test/integration/discovery.js, network-e2e

echo 'Generating crypto-material complete, now renaming keys...'
# Rename the key files we use to be key.pem instead of a uuid
for KEY in $(find ../crypto-config -type f -name "*_sk"); do
    KEY_DIR=$(dirname ${KEY})
    mv ${KEY} ${KEY_DIR}/key.pem
done
echo 'Renaming keys complete'
