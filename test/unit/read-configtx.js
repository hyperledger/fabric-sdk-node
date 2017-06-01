/**
 * Copyright 2016 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
'use strict';

if (global && global.hfc) global.hfc.config = undefined;
require('nconf').reset();

var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('E2E create-channel');
var util = require('util');
var fs = require('fs');
var path = require('path');
var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var Channel = require('fabric-client/lib/Channel.js');

var grpc = require('grpc');
var _commonProto   = grpc.load(__dirname + '/../../fabric-client/lib/protos/common/common.proto').common;
var _configtxProto = grpc.load(__dirname + '/../../fabric-client/lib/protos/common/configtx.proto').common;

var testUtil = require('../unit/util.js');

test('\n\n***** READ in the genesis block *****\n\n', function(t) {
	testUtil.resetDefaults();

	// readin the envelope to send to the orderer
	let normalPath = path.normalize(path.join(__dirname, '../fixtures/channel/twoorgs.genesis.block'));
	var data = fs.readFileSync(normalPath);

	var channel = new Channel('test', 'fake');

	var block = _commonProto.Block.decode(data);
	var envelope = _commonProto.Envelope.decode(block.data.data[0]);
	var payload = _commonProto.Payload.decode(envelope.payload);
	var channel_header = _commonProto.ChannelHeader.decode(payload.header.channel_header);
	if(channel_header.type != _commonProto.HeaderType.CONFIG) {
		logger.error('Block must be of type "CONFIG"');
	}

	var config_envelope = _configtxProto.ConfigEnvelope.decode(payload.data);
	channel.loadConfigEnvelope(config_envelope);
	t.pass(' Loaded the geneisis block from the configtx tool');
	t.end();
});


test('\n\n***** READ in the configtx *****\n\n', function(t) {
	// readin the envelope to send to the orderer
	let normalPath = path.normalize(path.join(__dirname, '../fixtures/channel/mychannel.tx'));
	var data = fs.readFileSync(normalPath);

	var channel = new Channel('test', 'fake');

	channel.loadConfigUpdateEnvelope(data);
	t.pass(' Loaded the channel config from the configtx tool');
	t.end();
});