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

const nconf = require('nconf');

//
// The class representing the hierarchy of configuration settings.
//

const Config = class {

	constructor() {
		nconf.use('memory');
		nconf.argv();
		nconf.env({parseValues: true});
		nconf.use('mapenv', {type:'memory'});
		this.mapSettings(nconf.stores.mapenv, process.env);
		this._fileStores = [];
		// reference to configuration settings
		this._config = nconf;
	}

	//
	//	 utility method to map (convert) the environment(upper case and underscores) style
	//	 names to configuration (lower case and dashes) style names
	//
	mapSettings(store, settings) {
		for (let key in settings) {
			const value = settings[key];
			key = key.toLowerCase();
			key = key.replace(/_/g, '-');
			store.set(key, value);
		}
	}

	//
	//	 utility method to reload the file based stores so
	//	 the last one added is on the top of the files hierarchy
	//	 unless the bottom flag indicates to add otherwise
	//
	reorderFileStores(path, bottom) {
		// first remove all the file stores
		for (const x in this._fileStores) {
			this._config.remove(this._fileStores[x]);
		}

		if (bottom) {
			// add to the bottom of the list
			this._fileStores.push(path);
		} else {
			// add this new file to the front of the list
			this._fileStores.unshift(path);
		}

		// now load all the file stores
		for (const x in this._fileStores) {
			const name = this._fileStores[x];
			this._config.file(name, name);
		}
	}

	//
	//    Add an additional file
	//
	file(path) {
		if (typeof path !== 'string') {
			throw new Error('The "path" parameter must be a string');
		}
		// just reuse the path name as the store name...will be unique
		this.reorderFileStores(path);
	}

	//
	//   Get the config setting with name.
	//   If the setting is not found returns the default value provided.
	//
	get(name, default_value) {
		let return_value = null;

		try {
			return_value = this._config.get(name);
		} catch (err) {
			return_value = default_value;
		}

		if (return_value === null || return_value === undefined) {
			return_value = default_value;
		}

		return return_value;
	}

	//
	//	  Set a value into the 'memory' store of config settings. This will override all other settings
	//
	set(name, value) {
		this._config.set(name, value);
	}

};

module.exports = Config;
