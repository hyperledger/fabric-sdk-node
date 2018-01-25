/*
 Copyright 2018 IBM All Rights Reserved.

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

function checkRegistrar(registrar) {
	if (typeof registrar === 'undefined' || registrar === null) {
		throw new Error('Missing required argument "registrar"');
	}

	if (typeof registrar.getSigningIdentity !== 'function') {
		throw new Error('Argument "registrar" must be an instance of the class "User", but is found to be missing a method "getSigningIdentity()"');
	}
}

module.exports.checkRegistrar = checkRegistrar;