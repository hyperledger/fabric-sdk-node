/*
 Copyright 2017, 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

'use strict';

function checkRegistrar(registrar) {

	if (!registrar) {
		throw new Error('Missing required argument "registrar"');
	}

	if (!registrar.constructor || registrar.constructor.name !== 'User') {
		throw new Error('Argument "registrar" must be an instance of the class "User" but is of type: ' + registrar.constructor.name);
	}

	if (typeof registrar.getSigningIdentity !== 'function') {
		throw new Error('Argument "registrar" is found to be missing a method "getSigningIdentity()"');
	}

	if (!registrar.getSigningIdentity()) {
		throw new Error('Can not get signingIdentity from registrar');
	}
}

module.exports.checkRegistrar = checkRegistrar;
