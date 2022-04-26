/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

class FakeEndorsementHandler {
	static create() {
		return INSTANCE;
	}

	initialize() { }
}

const INSTANCE = new FakeEndorsementHandler();

module.exports = FakeEndorsementHandler;
