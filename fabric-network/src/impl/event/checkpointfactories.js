/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const FileSystemCheckpointer = require('./filesystemcheckpointer');

function FILE_SYSTEM_CHECKPOINTER(channelName, listenerName, options) {
	return new FileSystemCheckpointer(channelName, listenerName, options);
}

/**
 * @typedef module:fabric-network~CheckpointFactories
 * @memberof module:fabric-network
 * @property {function} FILE_SYSTEM_CHECKPOINTER Checkpoint using the file system
 */
module.exports = {
	FILE_SYSTEM_CHECKPOINTER
};
