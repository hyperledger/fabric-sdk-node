/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const chai = require('chai');
const expect = chai.expect;

const CheckpointFactories = require('fabric-network/lib/impl/event/checkpointfactories');
const FileSystemCheckpointer = require('fabric-network/lib/impl/event/filesystemcheckpointer');

describe('CheckpointFactories', () => {
	describe('#FILE_SYSTEM_CHECKPOINTER', () => {
		it('should return an instance of the file system checkpointer', () => {
			const checkpointer = CheckpointFactories.FILE_SYSTEM_CHECKPOINTER('channelName', 'listnerName');
			expect(checkpointer).to.be.instanceof(FileSystemCheckpointer);
		});
	});
});
