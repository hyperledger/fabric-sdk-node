#!/usr/bin/env bash
#
# Copyright 2018 Zhao Chaoyi. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#

export FABRIC_CFG_PATH=$PWD
configtxgen -profile TwoOrgsOrdererGenesis -outputBlock ./twoorgs.genesis.block
configtxgen -profile TwoOrgsChannel -outputCreateChannelTx ./mychannel.tx -channelID mychannel
configtxgen -profile TwoOrgsChannel -outputCreateChannelTx ./mychanneltx.tx -channelID mychanneltx
configtxgen -profile TwoOrgsChannel -outputCreateChannelTx ./adminconfig.tx -channelID adminconfig
