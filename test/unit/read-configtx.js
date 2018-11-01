/**
 * Copyright 2016 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

if (global && global.hfc) {
	global.hfc.config = undefined;
}
require('nconf').reset();

const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('E2E create-channel');
const fs = require('fs');
const path = require('path');
const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const Channel = require('fabric-client/lib/Channel.js');

const ProtoLoader = require('fabric-client/lib/ProtoLoader');
const _commonProto   = ProtoLoader.load(__dirname + '/../../fabric-client/lib/protos/common/common.proto').common;
const _configtxProto = ProtoLoader.load(__dirname + '/../../fabric-client/lib/protos/common/configtx.proto').common;

const testUtil = require('../unit/util.js');

test('\n\n***** READ in the genesis block *****\n\n', (t) => {
	testUtil.resetDefaults();

	// readin the envelope to send to the orderer
	const normalPath = path.normalize(path.join(__dirname, '../fixtures/channel/twoorgs.genesis.block'));
	const data = fs.readFileSync(normalPath);

	const channel = new Channel('test', 'fake');

	const block = _commonProto.Block.decode(data);
	const envelope = _commonProto.Envelope.decode(block.data.data[0]);
	const payload = _commonProto.Payload.decode(envelope.payload);
	const channel_header = _commonProto.ChannelHeader.decode(payload.header.channel_header);
	if (channel_header.type !== _commonProto.HeaderType.CONFIG) {
		logger.error('Block must be of type "CONFIG"');
	}

	const config_envelope = _configtxProto.ConfigEnvelope.decode(payload.data);
	channel.loadConfigEnvelope(config_envelope);
	t.pass(' Loaded the geneisis block from the configtx tool');
	t.end();
});
