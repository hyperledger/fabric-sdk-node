/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

/**
 * This is the main module for the "fabric-ca-client" package. It communicates with the
 * "fabric-ca" server to manage user certificates lifecycle including register, enroll,
 * renew and revoke, so that the application can use the properly signed certificates to
 * authenticate with the fabric.
 *
 * @deprecated As of Fabric v2.5.
 */
module.exports = require('./lib/FabricCAServices.js');
