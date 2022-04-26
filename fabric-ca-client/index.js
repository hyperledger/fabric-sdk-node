/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

/**
 * This is the main module for the "fabric-ca-client" package. It communicates with the
 * "fabric-ca" server to manage user certificates lifecycle including register, enroll,
 * renew and revoke, so that the application can use the properly signed certificates to
 * authenticate with the fabric
 */
module.exports = require('./lib/FabricCAServices.js');
