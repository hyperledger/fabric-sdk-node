/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
// end to end using a configtx built configuration

'use strict';

// create done in it's own file so that it can be a live test setting
// environment settings

delete require.cache[require.resolve('./e2e/join-channel.js')];
require('./e2e/join-channel.js');
// no need to install... code is already installed from last run
//delete require.cache[require.resolve('./e2e/install-chaincode.js')];
//require('./e2e/install-chaincode.js');
//delete require.cache[require.resolve('./e2e/instantiate-chaincode.js')];
//require('./e2e/instantiate-chaincode.js');
//delete require.cache[require.resolve('./e2e/invoke-transaction.js')];
//require('./e2e/invoke-transaction.js');
//delete require.cache[require.resolve('./e2e/query.js')];
//require('./e2e/query.js');
//delete require.cache[require.resolve('./e2e/upgrade.js')];
//require('./e2e/upgrade.js');
