/*
 Copyright 2016 IBM All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

	  http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

'use strict';

/**
 * This module defines the implementations for the [Member]{@link module:api.Member} class
 * plus auxiliary classes for handling TCert downloads from the member services
 *
 * @module Member
 */

var api = require('./api.js');
var util = require('util');
var stats = require('./stats.js');

/**
 * Represents an authenticated user of the application or an entity used by a Peer node.
 * A member can be in any of these following states:
 *
 * - unregistered: the user has successfully authenticated to the application but has not been
 * added to the user registry maintained by the member services
 *
 * - registered but un-enrolled: the use has been added to the user registry and assigned a member ID
 * with a one-time password, but it has not been enrolled
 *
 * - enrolled: the user has used the one-time password to exchange for an Enrollment Certificate (ECert)
 * which can be used to identify him/herself to the member services        
 *
 * @class Member
 * @memberof module:Member
 */
module.exports = class extends api.Member {

	/**
	 * Constructor for a member.
	 * @param cfg {string | RegistrationRequest} The member name or registration request.
	 * @returns {Member} A member who is neither registered nor enrolled.
	 */
	constructor(cfg, chain) {
		super();

		if (util.isString(cfg)) {
			this._name = cfg;
			this._roles = null; //string[]
			this._affiliation = '';
		} else if (util.isObject(cfg)) {
			var req = cfg;
			this._name = req.enrollmentID || req.name;
			this._roles = req.roles || ['fabric.user'];
			this._affiliation = req.affiliation;
		}

		this._chain = chain;
		this._memberServices = chain.getMemberServices();
		this._keyValStore = chain.getKeyValueStore();
		this._keyValStoreName = toKeyValueStoreName(this._name);
		this._tcertBatchSize = chain.getTCertBatchSize();

		this._enrollmentSecret = '';
		this._enrollment = null;
		this._tcertGetterMap = {}; //{[s:string]:TCertGetter}
	}

	/**
	 * Get the member name.
	 * @returns {string} The member name.
	 */
	getName() {
		return this._name;
	}

	/**
	 * Get the chain.
	 * @returns {Chain} The chain.
	 */
	getChain() {
		return this._chain;
	}

	/**
	 * Get the member services.
	 * @returns {MemberServices} The member services.
	 */
	getMemberServices() {
		return this._memberServices;
	}

	/**
	 * Get the roles.
	 * @returns {string[]} The roles.
	 */
	getRoles() {
		return this._roles;
	}

	/**
	 * Set the roles.
	 * @param roles {string[]} The roles.
	 */
	setRoles(roles) {
		this._roles = roles;
	}

	/**
	 * Get the affiliation.
	 * @returns {string} The affiliation.
	 */
	getAffiliation() {
		return this._affiliation;
	}

	/**
	 * Set the affiliation.
	 * @param affiliation The affiliation.
	 */
	setAffiliation(affiliation) {
		this._affiliation = affiliation;
	}

	/**
	 * Get the transaction certificate (tcert) batch size, which is the number of tcerts retrieved
	 * from member services each time (i.e. in a single batch).
	 * @returns The tcert batch size.
	 */
	getTCertBatchSize() {
		if (this._tcertBatchSize === undefined) {
			return this._chain.getTCertBatchSize();
		} else {
			return this._tcertBatchSize;
		}
	}

	/**
	 * Set the transaction certificate (tcert) batch size.
	 * @param batchSize
	 */
	setTCertBatchSize(batchSize) {
		this._tcertBatchSize = batchSize;
	}

	/**
	 * Get the enrollment info.
	 * @returns {Enrollment} The enrollment.
	 */
	getEnrollment() {
		return this._enrollment;
	}

	/**
	 * Determine if this name has been registered.
	 * @returns {boolean} True if registered; otherwise, false.
	 */
	isRegistered() {
		return this._enrollmentSecret !== '';
	}

	/**
	 * Determine if this name has been enrolled.
	 * @returns {boolean} True if enrolled; otherwise, false.
	 */
	isEnrolled() {
		return this._enrollment !== null;
	}

	/**
	 * Register the member.
	 * @param {Object} registrationRequest
	 */
	register(registrationRequest) {
		var self = this;

		return new Promise(function(resolve, reject) {
			if (registrationRequest.enrollmentID !== self.getName()) {
				reject(new Error('registration enrollment ID and member name are not equal'));
			}

			var enrollmentSecret = self._enrollmentSecret;
			if (enrollmentSecret) {
				return resolve(enrollmentSecret);
			} else {
				self._memberServices.register(registrationRequest, self._chain.getRegistrar())
				.then(
					function(enrollmentSecret) {

						self._enrollmentSecret = enrollmentSecret;
						return self.saveState();
					}
				).then(
					function(data) {
						return resolve(self._enrollmentSecret);
					}
				).catch(
					function(err) {
						reject(err);
					}
				);
			}
		});
	}

	/**
	 * Enroll the member and return the enrollment results.
	 * @param enrollmentSecret The password or enrollment secret as returned by register.
	 */
	enroll(enrollmentSecret) {
		var self = this;

		return new Promise(function(resolve, reject) {
			var enrollment = self._enrollment;
			if (enrollment) {
				return resolve(enrollment);
			} else {
				var req = {
					enrollmentID: self.getName(),
					enrollmentSecret: enrollmentSecret
				};

				self._memberServices.enroll(req)
					.then(
						function(enrollment) {

							self._enrollment = enrollment;
							// Generate queryStateKey
							self._enrollment.queryStateKey = self._chain.cryptoPrimitives.generateNonce();

							// Save state
							return self.saveState();
						}
					).then(
						function(data) {
							// Unmarshall chain key
							// TODO: during restore, unmarshall enrollment.chainKey
							var ecdsaChainKey = self._chain.cryptoPrimitives.ecdsaPEMToPublicKey(self._enrollment.chainKey);
							self._enrollment.enrollChainKey = ecdsaChainKey;

							return resolve(enrollment);
						}
					).catch(
						function(err) {
							reject(err);
						}
					);
			}
		});
	}

	/**
	 * Perform both registration and enrollment.
	 * @param {Object} registrationRequest
	 */
	registerAndEnroll(registrationRequest) {
		var self = this;

		return new Promise(function(resolve, reject) {
			var enrollment = self._enrollment;
			if (enrollment) {
				return resolve(enrollment);
			} else {
				self.register(registrationRequest)
					.then(
						function(enrollmentSecret) {
							return self.enroll(enrollmentSecret);
						}
					).then(
						function(enrollment) {
							return resolve(enrollment);
						}
					).catch(
						function(err) {
							reject(err);
						}
					);
			}
		});
	}

	/**
	 * Save the state of this member to the key value store.
	 * @returns Promise for a "true" upon successful save
	 */
	saveState() {
		return this._keyValStore.setValue(this._keyValStoreName, this.toString());
	}

	/**
	 * Restore the state of this member from the key value store (if found).  If not found, do nothing.
	 * @returns Promise for a "true" upon successful restore
	 */
	restoreState() {
		var self = this;

		return new Promise(function(resolve, reject) {
			self._keyValStore.getValue(self._keyValStoreName)
			.then(
				function(memberStr) {
					if (memberStr) {
						// The member was found in the key value store, so restore the state.
						self.fromString(memberStr);
					}
					return resolve(true);
				}
			).catch(
				function(err) {
					reject(err);
				}
			);
		});
	}

	/**
	 * Get the current state of this member as a string
	 * @return {string} The state of this member as a string
	 */
	fromString(str) {
		var state = JSON.parse(str);

		if (state.name !== this.getName()) {
			throw new Error('name mismatch: \'' + state.name + '\' does not equal \'' + this.getName() + '\'');
		}

		this._name = state.name;
		this._roles = state.roles;
		this._affiliation = state.affiliation;
		this._enrollmentSecret = state.enrollmentSecret;
		this._enrollment = state.enrollment;
	}

	/**
	 * Save the current state of this member as a string
	 * @return {string} The state of this member as a string
	 */
	toString() {
		var state = {
			name: this._name,
			roles: this._roles,
			affiliation: this._affiliation,
			enrollmentSecret: this._enrollmentSecret,
			enrollment: this._enrollment
		};

		return JSON.stringify(state);
	}
};

function toKeyValueStoreName(name) {
	return 'member.' + name;
}

