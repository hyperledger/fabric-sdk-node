/**
 * SPDX-License-Identifier: Apache-2.0
 */

const bundle = require('./bundle');
const grpc = require('grpc');
const protobuf = require('protobufjs');

// This is a modified version of the grpc.loadObject function. The modifications
// ensure that it works with the JSON output by pbjs, which incorrectly encodes
// namespaces with a class name of "Message". We have no way to tell if a "Message"
// is a "Message" or actually a "Namespace", so we need to treat it as both.
function loadObject(value, options) {
	if (!value) {
		return value;
	} else if (value.hasOwnProperty('ns')) {
		return loadObject(value.ns, options);
	} else if (value.className === 'Namespace') {
		const result = {};
		for (const child of value.children) {
			result[child.name] = loadObject(child, options);
		}
		return result;
	} else if (value.className === 'Service') {
		return grpc.loadObject(value, {protobufjsVersion: 5});
	} else if (value.className === 'Message' || value.className === 'Enum') {
		const result = value.build();
		if (value.className === 'Message') {
			for (const child of value.children) {
				result[child.name] = loadObject(child, options);
			}
		}
		return result;
	} else {
		return value;
	}
}

// We have to set the top level syntax to "proto3" to force protobufjs to treat
// the whole JSON output from pbjs as "proto3", otherwise it generates it as if
// it was "proto2", which causes incorrect parsing behaviour.
bundle.syntax = 'proto3';

// This generates an export tree with all the namespaces and types under it, for
// example:
// const fabprotos = require('fabric-protos');
// const block = fabprotos.common.Block.decode(...);
// const gossipClient = new fabprotos.gossip.Gossip(...);
const builder = protobuf.loadJson(bundle);
const root = loadObject(builder.ns, {protobufjsVersion: 5});
module.exports = root;
