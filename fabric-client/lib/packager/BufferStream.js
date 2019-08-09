/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const stream = require('stream');

class BufferStream extends stream.PassThrough {

	constructor() {
		super();
		this.buffers = [];
		this.on('data', (chunk) => {
			this.buffers.push(chunk);
		});
	}

	toBuffer() {
		return Buffer.concat(this.buffers);
	}

}

module.exports = BufferStream;