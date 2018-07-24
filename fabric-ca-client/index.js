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
 * This is the main module for the "fabric-ca-client" package. It communicates with the
 * "fabric-ca" server to manage user certificates lifecycle including register, enroll,
 * renew and revoke, so that the application can use the properly signed certificates to
 * authenticate with the fabric
 */
module.exports = require('./lib/FabricCAServices.js');
