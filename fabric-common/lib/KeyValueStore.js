/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

/**
 * Abstract class for a Key-Value store.
 *
 * @class
 */
class KeyValueStore {

	/**
	 * Initialize the store
	 *
	 * @async
	 */
	initialize() {
	}

	/**
	 * Get the value associated with <code>name</code>.
	 *
	 * @param {string} name Name of the key
	 * @returns {Promise} Promise for the value corresponding to the key. If the value does not exist in the
	 * store, returns null without rejecting the promise
	 */
	getValue(name) {
	}

	/**
	 * Set the value associated with <code>name</code>.
	 * @param {string} name Name of the key to save
	 * @param {string} value The Value to save
	 * @returns {Promise} Promise for the 'value' object upon successful write operation
	 */
	setValue(name, value) {
	}

}

module.exports = KeyValueStore;
