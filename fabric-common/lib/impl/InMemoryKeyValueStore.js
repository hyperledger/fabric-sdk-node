/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const KeyValueStore = require('../KeyValueStore');

/**
 * This is a default implementation of the [KeyValueStore]{@link module:api.KeyValueStore} API.
 * It uses an in-memory map to store data.
 *
 * @class
 * @extends module:api.KeyValueStore
 */
class InMemoryKeyValueStore extends KeyValueStore {

	constructor() {
		super();
		this.map = new Map();
	}

	async getValue(name) {
		const value = this.map.get(name);
		return value !== undefined ? value : null;
	}

	async setValue(name, value) {
		this.map.set(name, value);
		return value;
	}
}

module.exports = InMemoryKeyValueStore;
