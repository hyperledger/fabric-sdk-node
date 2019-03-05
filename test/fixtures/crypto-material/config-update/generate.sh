#
# SPDX-License-Identifier: Apache-2.0
#

echo 'Generating new channel update tx....'
export FABRIC_CFG_PATH=$PWD
/Users/nkl/fabric/fabric-samples/bin/configtxgen -profile TwoOrgsChannel -outputAnchorPeersUpdate ../channel-config/mychannel-org1anchor.tx -channelID mychannel -asOrg Org1MSP
/Users/nkl/fabric/fabric-samples/bin/configtxgen -profile TwoOrgsChannel -outputAnchorPeersUpdate ../channel-config/discovery_anchor.tx -channelID discovery -asOrg Org1MSP

