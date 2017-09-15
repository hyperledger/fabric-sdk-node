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

// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);
var e2eUtils = require('./e2eUtils.js');
var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('query');
e2eUtils.queryChaincode('org2', 'v0', '2')
    .then((result) => {

        if (result) {
            for (let i = 0; i < result.length; i++) {
                logger.info(result[i].toString('utf8'));
            }
            logger.info('Successfully query chaincode on the channel');

        }
        else {
            logger.info('Failed to query chaincode ');

        }
    }, (err) => {
        logger.info('Failed to query chaincode on the channel. ' + err.stack ? err.stack : err);

    }).catch((err) => {
    logger.info('Test failed due to unexpected reasons. ' + err.stack ? err.stack : err);

});

