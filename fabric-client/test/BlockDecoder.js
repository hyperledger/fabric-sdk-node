/*
 Copyright 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

const rewire = require('rewire');
const BlockDecoderRewire = rewire('../lib/BlockDecoder');
require('chai').should();

describe('BlockDecoder', () => {
	describe('timeStampToDate()', () => {
		const timeStampToDate = BlockDecoderRewire.__get__('timeStampToDate');

		it('should return null for empty timestamp', () => {
			const res = timeStampToDate();
			res.should.eql('null');
		});

		it('should return ISO8601 string for a valid timestamp', () => {
			const now = new Date();
			const timestamp = {
				seconds: Math.floor(now.getTime()/1000),
				nanos: now.getMilliseconds() * 1000000
			};
			const res = timeStampToDate(timestamp);
			res.should.have.string(now.getMilliseconds().toString());
		});
	});
});