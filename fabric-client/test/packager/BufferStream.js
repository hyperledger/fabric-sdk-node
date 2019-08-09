/*
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const BufferStream = require('../../lib/packager/BufferStream');
require('chai').should();

describe('BufferStream', () => {

	describe('#toBuffer', () => {

		it('should return an empty buffer when no buffers written', () => {
			const bufferStream = new BufferStream();
			bufferStream.toBuffer().should.have.lengthOf(0);
		});

		it('should return the correct buffer when one buffer is written', () => {
			const bufferStream = new BufferStream();
			bufferStream.write(Buffer.from('hello world'));
			const buffer = bufferStream.toBuffer();
			buffer.should.have.lengthOf(11);
			buffer.toString().should.equal('hello world');
		});

		it('should return the correct buffer when multiple buffers are written', () => {
			const bufferStream = new BufferStream();
			bufferStream.write(Buffer.from('hello'));
			bufferStream.write(Buffer.from(' '));
			bufferStream.write(Buffer.from('world'));
			bufferStream.write(Buffer.from(' from '));
			bufferStream.write(Buffer.from('multiple buffers'));
			const buffer = bufferStream.toBuffer();
			buffer.should.have.lengthOf(33);
			buffer.toString().should.equal('hello world from multiple buffers');
		});

	});

});