/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const protobuf = require('protobufjs');
// The static bundle built by protobufjs (see fabric-proto/package.json npm run command)
// 'bundle.js' and typescript defs must be manually built when there is a change to the
// proto files and pushed to the repository
// The bundle.js has the full package hierarchy, however we will only be using the
// messages which have create, decode, and encode. The services do not have a backing
// implementation
module.exports = require('./bundle.js');

// Allow client code to translate the obscure uint64 field format to/from a number
module.exports.numberToUint64 = protobuf.util.longToHash;
module.exports.uint64ToNumber = (uint64Value) => {
	const value = protobuf.util.longFromHash(uint64Value, true);
	return typeof value === 'number' ? value : value.toInt();
}

// Build the services
// fabric.proto file must have an import for every needed proto files
const protoPath = path.resolve(__dirname, 'fabric.proto');
const options = {
	keepCase: true,
	defaults: true,
	oneofs: true,
	includeDirs: [
		path.resolve(__dirname, 'google-protos'),
		path.resolve(__dirname, 'protos')
	]
};

// The protoDescriptor object has the full package hierarchy, however
// we will only be using the services which may be used as classes
// (ie. new Service()) that have the service implementation that will
// send and receive messages.
const packageDefinitions = protoLoader.loadSync(protoPath, options);
const protoDescriptor = grpc.loadPackageDefinition(packageDefinitions);
module.exports.services = protoDescriptor;
