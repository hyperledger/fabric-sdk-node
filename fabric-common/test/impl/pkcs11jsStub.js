/*
 * Copyright 2021 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const pkcs11Stub = {
};

class PKCS11 {
	constructor() {
		return pkcs11Stub;
	}
}

module.exports.PKCS11 = PKCS11;
module.exports.pkcs11Stub = pkcs11Stub;
module.exports.reset = () => {
	pkcs11Stub.load = () => {};
	pkcs11Stub.C_Initialize = () => {};
	pkcs11Stub.C_GetInfo = () => 'Info';
	pkcs11Stub.C_GetSlotList = () => null;
	pkcs11Stub.C_GetTokenInfo = () => null;
	pkcs11Stub.C_GetSlotInfo = (slot) => `${slot}`;
	pkcs11Stub.C_GetMechanismList = (slot) => ['ECDSA'];
	pkcs11Stub.C_OpenSession = () => {};
	pkcs11Stub.C_GetSessionInfo = () => {};
	pkcs11Stub.C_Login = () => {};
	pkcs11Stub.C_CloseSession = () => {};
	pkcs11Stub.C_Finalize = () => {};
};
