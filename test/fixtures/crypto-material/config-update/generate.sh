#
# SPDX-License-Identifier: Apache-2.0
#

echo 'Generating new channel update tx....'
export FABRIC_CFG_PATH=$PWD
configtxgen -profile TwoOrgsChannel -outputAnchorPeersUpdate ../channel-config/mychannel-org1anchor.tx -channelID mychannel -asOrg Org1MSP
configtxgen -profile TwoOrgsChannel -outputAnchorPeersUpdate ../channel-config/discovery_anchor.tx -channelID discovery -asOrg Org1MSP

