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
 * Key represents a cryptographic key. It can be symmetric or asymmetric. In the case of an
 * asymmetric key, the key can be public or private. In the case of a private asymmetric
 * key, the getPublicKey() method allows to retrieve the corresponding public-key.
 * A key can be referenced via the Subject Key Identifier (SKI) and resolvable by the
 * appropriate {@link CryptoSuite} implementation
 *
 * @class
 */
class Key {

	/**
	 * Returns the subject key identifier of this key
	 *
	 * @returns {string} The subject key identifier of this key as a hexidecial encoded string
	 */
	getSKI() {}

	/**
	 * Returns true if this key is a symmetric key, false is this key is asymmetric
	 *
	 * @returns {boolean} if this key is a symmetric key
	 */
	isSymmetric() {}

	/**
	 * Returns true if this key is an asymmetric private key, false otherwise.
	 *
	 * @returns {boolean} if this key is an asymmetric private key
	 */
	isPrivate() {}

	/**
	 * Returns the corresponding public key if this key is an asymmetric private key.
	 * If this key is already public, returns this key itself.
	 *
	 * @returns {module:api.Key} the corresponding public key if this key is an asymmetric private key.
	 * If this key is already public, returns this key itself.
	 */
	getPublicKey() {}

	/**
	 * Converts this key to its PEM representation, if this operation is allowed.
	 *
	 * @returns {string} the PEM string representation of the key
	 */
	toBytes() {}
}

module.exports = Key;
