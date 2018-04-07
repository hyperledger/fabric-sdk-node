/*
 Copyright 2017, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

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
