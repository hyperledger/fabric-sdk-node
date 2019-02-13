/**
 * SPDX-License-Identifier: Apache-2.0
 */

class StateStore {

	static set(name, data) {
		if (! StateStore.instance) {
			this._data = new Map();
			StateStore.instance = this;
		}
		this._data.set(name, data);
	}

	static get(name) {
		if (! StateStore.instance) {
			this._data = new Map();
			StateStore.instance = this;
		}
		return this._data.get(name);
	}
}
module.exports.StateStore = StateStore;
