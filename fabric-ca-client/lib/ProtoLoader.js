/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const grpc = require('grpc');
const protobuf = require('protobufjs');

/**
 * A class for easily loading service descriptors and client stub definitions from
 * .proto files at runtime.
 */
class ProtoLoader {

	/**
	 * Load service descriptors and client stub definitions from a .proto file.
	 * @param {string} filename The filename of the .proto file.
	 * @param {Object} [options]  The options used to load the .proto file.
	 * @returns {*} The loaded service descriptors and client stub definitions.
	 */
	static load(filename) {
		const builder = protobuf.loadProtoFile(filename);
		return grpc.loadObject(builder, {protobufjsVersion: 5});
	}

}

module.exports = ProtoLoader;
