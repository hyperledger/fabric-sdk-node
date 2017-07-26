/**
 * Copyright 2017 IBM All Rights Reserved.
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

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var fs = require('fs');
var path = require('path');

var grpc = require('grpc');
var configtxProto = grpc.load(path.join(__dirname, '../../fabric-client/lib/protos/common/configtx.proto')).common;
var policiesProto = grpc.load(path.join(__dirname, '../../fabric-client/lib/protos/common/policies.proto')).common;
var commonProto = grpc.load(path.join(__dirname, '../../fabric-client/lib/protos/common/common.proto')).common;
var kv_query_resultProto = grpc.load(path.join(__dirname, '../../fabric-client/lib/protos/ledger/queryresult/kv_query_result.proto')).queryresult;
var rwsetProto = grpc.load(path.join(__dirname, '../../fabric-client/lib/protos/ledger/rwset/rwset.proto')).rwset;
var kvrwsetProto = grpc.load(path.join(__dirname, '../../fabric-client/lib/protos/ledger/rwset/kvrwset/kv_rwset.proto')).kvrwset;
var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('BlockDecoder');

var rewire = require('rewire');
var BlockDecoder = rewire('fabric-client/lib/BlockDecoder.js');

test('\n\n*** BlockDecoder test for readwrite sets', (t) => {

	var kv_read_proto = new kvrwsetProto.KVRead();
	var version_proto = new kvrwsetProto.Version();
	version_proto.setBlockNum(12);
	version_proto.setTxNum(21);
	kv_read_proto.setVersion(version_proto);
	kv_read_proto.setKey('read key');
	var reads_array = [];
	reads_array.push(kv_read_proto);

	var range_query_info_proto = new kvrwsetProto.RangeQueryInfo();
	range_query_info_proto.setStartKey('start');
	range_query_info_proto.setEndKey('end');
	range_query_info_proto.setItrExhausted(false);
	var range_query_info_array = [];
	range_query_info_array.push(range_query_info_proto);

	var kv_write_proto = new kvrwsetProto.KVWrite();
	kv_write_proto.setKey('write key');
	kv_write_proto.setIsDelete(false);
	kv_write_proto.setValue(Buffer.from('this is the value'));
	var writes_array = [];
	writes_array.push(kv_write_proto);

	var kvrwset_proto = new kvrwsetProto.KVRWSet();
	kvrwset_proto.setReads(reads_array);
	kvrwset_proto.setRangeQueriesInfo(range_query_info_array);
	kvrwset_proto.setWrites(writes_array);

	var results_proto = new rwsetProto.TxReadWriteSet();
	results_proto.setDataModel(rwsetProto.TxReadWriteSet.DataModel.KV);
	var ns_rwset_array = [];
	var ns_rwset_proto = new rwsetProto.NsReadWriteSet();
	ns_rwset_proto.setNamespace('test1');
	ns_rwset_proto.setRwset(kvrwset_proto.toBuffer());
	ns_rwset_array.push(ns_rwset_proto);
	results_proto.setNsRwset(ns_rwset_array);

	t.pass('Successfully build a results proto with read and write sets');

	var decodeReadWriteSets = BlockDecoder.__get__('decodeReadWriteSets');
	var results_json = decodeReadWriteSets(results_proto.toBuffer());

	logger.info('results test1 %j',results_json);

	t.equal('test1',results_json.ns_rwset[0].namespace, ' check results_json.ns_rwset[0].namespace');
	t.equal('read key',results_json.ns_rwset[0].rwset.reads[0].key, ' check results_json.ns_rwset[0].rwset.reads[0].key');
	t.equal(12,results_json.ns_rwset[0].rwset.reads[0].version.block_num.low, ' check results_json.ns_rwset[0].rwset.reads[0].version.block_num');
	t.equal(21,results_json.ns_rwset[0].rwset.reads[0].version.tx_num.low, ' check results_json.ns_rwset[0].rwset.reads[0].version.tx_num');

	t.equal('start',results_json.ns_rwset[0].rwset.range_queries_info[0].start_key, ' check results_json.ns_rwset[0].rwset.range_queries_info[0].start_key');
	t.equal('end',results_json.ns_rwset[0].rwset.range_queries_info[0].end_key, ' check results_json.ns_rwset[0].rwset.range_queries_info[0].end_key');
	t.equal(false,results_json.ns_rwset[0].rwset.range_queries_info[0].itr_exhausted, ' check results_json.ns_rwset[0].rwset.range_queries_info[0].itr_exhausted');

	t.equal('write key',results_json.ns_rwset[0].rwset.writes[0].key, ' check results_json.ns_rwset[0].rwset.writes[0].key');
	t.equal(false,results_json.ns_rwset[0].rwset.writes[0].is_delete, ' check results_json.ns_rwset[0].rwset.writes[0].version.is_delete');
	t.equal('this is the value',results_json.ns_rwset[0].rwset.writes[0].value, ' check results_json.ns_rwset[0].rwset.writes[0].value');

  //now add in range query with query reads
	var rqi_version_proto = new kvrwsetProto.Version();
	rqi_version_proto.setBlockNum(13);
	rqi_version_proto.setTxNum(31);
	var rqi_kv_read_proto = new kvrwsetProto.KVRead();
	rqi_kv_read_proto.setVersion(rqi_version_proto);
	rqi_kv_read_proto.setKey('range query key');
	var kv_read_array = [];
	kv_read_array.push(rqi_kv_read_proto);
	var reads_info_proto = new kvrwsetProto.QueryReads();
	reads_info_proto.setKvReads(kv_read_array);
	range_query_info_proto.setRawReads(reads_info_proto);

	ns_rwset_array = [];
	ns_rwset_proto = new rwsetProto.NsReadWriteSet();
	ns_rwset_proto.setNamespace('test2');
	ns_rwset_proto.setRwset(kvrwset_proto.toBuffer());
	ns_rwset_array.push(ns_rwset_proto);
	results_proto.setNsRwset(ns_rwset_array);

	results_json = decodeReadWriteSets(results_proto.toBuffer());

	logger.debug('results test2 %j',results_json);

	t.equal('test2',results_json.ns_rwset[0].namespace, ' check results_json.ns_rwset[0].namespace');
	t.equal('read key',results_json.ns_rwset[0].rwset.reads[0].key, ' check results_json.ns_rwset[0].rwset.reads[0].key');
	t.equal(12,results_json.ns_rwset[0].rwset.reads[0].version.block_num.low, ' check results_json.ns_rwset[0].rwset.reads[0].version.block_num');
	t.equal(21,results_json.ns_rwset[0].rwset.reads[0].version.tx_num.low, ' check results_json.ns_rwset[0].rwset.reads[0].version.tx_num');
	t.equal('range query key',results_json.ns_rwset[0].rwset.range_queries_info[0].reads_info.kv_reads[0].key,' check results_json.ns_rwset[0].rwset.reads[0].range_queries_info[0].reads_info.kv_reads[0].key');
	t.equal(13,results_json.ns_rwset[0].rwset.range_queries_info[0].reads_info.kv_reads[0].version.block_num.low, ' check results_json.ns_rwset[0].rwset.reads[0].range_queries_info[0].reads_info.kv_reads[0].version.tx_num');
	t.equal(31,results_json.ns_rwset[0].rwset.range_queries_info[0].reads_info.kv_reads[0].version.tx_num.low, ' check results_json.ns_rwset[0].rwset.reads[0].range_queries_info[0].reads_info.kv_reads[0].version.tx_num.');

	// take range query with query reads out and add range query with QueryReadsMerkleSummary
	range_query_info_proto.setRawReads(null);
	var reads_merkle_summary = new kvrwsetProto.QueryReadsMerkleSummary();
	reads_merkle_summary.setMaxDegree(44);
	reads_merkle_summary.setMaxLevel(33);
	var max_level_hashes_array = [];
	max_level_hashes_array.push(Buffer.from('some hash'));
	reads_merkle_summary.setMaxLevelHashes(max_level_hashes_array);
	range_query_info_proto.setReadsMerkleHashes(reads_merkle_summary);

	ns_rwset_array = [];
	ns_rwset_proto = new rwsetProto.NsReadWriteSet();
	ns_rwset_proto.setNamespace('test3');
	ns_rwset_proto.setRwset(kvrwset_proto.toBuffer());
	ns_rwset_array.push(ns_rwset_proto);
	results_proto.setNsRwset(ns_rwset_array);

	results_json = decodeReadWriteSets(results_proto.toBuffer());

	logger.debug('results test3 %j',results_json);

	t.equal('test3',results_json.ns_rwset[0].namespace, ' check results_json.ns_rwset[0].namespace');
	t.equal('read key',results_json.ns_rwset[0].rwset.reads[0].key, ' check results_json.ns_rwset[0].rwset.reads[0].key');
	t.equal(12,results_json.ns_rwset[0].rwset.reads[0].version.block_num.low, ' check results_json.ns_rwset[0].rwset.reads[0].version.block_num');
	t.equal(21,results_json.ns_rwset[0].rwset.reads[0].version.tx_num.low, ' check results_json.ns_rwset[0].rwset.reads[0].version.tx_num');
	t.equal(44,results_json.ns_rwset[0].rwset.range_queries_info[0].reads_merkle_hashes.max_degree,' check results_json.ns_rwset[0].rwset.range_queries_info[0].reads_merkle_hashes.max_degree');
	t.equal(33,results_json.ns_rwset[0].rwset.range_queries_info[0].reads_merkle_hashes.max_level,' check results_json.ns_rwset[0].rwset.range_queries_info[0].reads_merkle_hashes.max_level');
	t.equal('some hash',results_json.ns_rwset[0].rwset.range_queries_info[0].reads_merkle_hashes.max_level_hashes[0].toString('utf8'),' check results_json.ns_rwset[0].rwset.range_queries_info[0].reads_merkle_hashes.max_level_hashes[0]');

	t.end();

});

test('\n\n*** BlockDecoder.js tests ***\n\n', (t) => {
	t.throws(
		() => {
			BlockDecoder.decode(new Uint8Array(2));
		},
		/Block input data is not a byte buffer/,
		'Check input is a Buffer object'
	);

	// use the genesis block as input to test the decoders
	var data = fs.readFileSync(path.join(__dirname, '../fixtures/channel/twoorgs.genesis.block'));

	var block = BlockDecoder.decode(data);
	t.pass('Genesis block parsed without error');

	t.equal(
		block.data.data[0].payload.data.config.channel_group.policies.Writers.policy.type,
		'IMPLICIT_META',
		'Test parsing of channel\'s Writers policy is of IMPLICIT_META type');

	var decodeConfigPolicy = BlockDecoder.__get__('decodeConfigPolicy');
	var mockPolicy = new policiesProto.Policy();
	mockPolicy.setType(policiesProto.Policy.PolicyType.SIGNATURE);
	decodeConfigPolicy({
		value: {
			getVersion: function() { return 0; },
			getModPolicy: function() { return {}; },
			policy: {
				type: policiesProto.Policy.PolicyType.MSP,
				policy: mockPolicy.toBuffer()
			}
		}
	});

	var mockPolicy = new policiesProto.Policy();
	mockPolicy.setType(policiesProto.Policy.PolicyType.SIGNATURE);
	t.throws(
		() => {
			decodeConfigPolicy({
				value: {
					getVersion: function() { return 0; },
					getModPolicy: function() { return {}; },
					policy: {
						type: policiesProto.Policy.PolicyType.MSB, // setting to an invalid type
						policy: mockPolicy.toBuffer()
					}
				}
			});
		},
		/Unknown Policy type/,
		'Test throwing an error on unknown policy type'
	);

	t.end();
});
