/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/**
 * Abstract class for a Key-Value store. The Channel class uses this store
 * to save sensitive information such as authenticated user's private keys,
 * certificates, etc.
 *
 * The SDK provides a default implementation based on files. An alternative
 * implementation can be specified using the "key-value-store" configuration
 * setting, pointing to a full require() path to package for the module.
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
