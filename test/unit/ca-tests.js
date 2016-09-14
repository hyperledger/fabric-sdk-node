/**
 * Copyright 2016 IBM All Rights Reserved.
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

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var hfc = require('../..');
var util = require('util');
var fs = require('fs');

var keyValStorePath = "/tmp/keyValStore"
var keyValStorePath2 = keyValStorePath + "2";

//
// Run the registrar test
//
test('registrar test', function(t) {
    //
    // Create and configure the test chain
    //
    var chain = hfc.newChain("testChain");
    var expect = "";
    var found = "";
    var webUser;

    chain.setKeyValueStore(hfc.newKeyValueStore({
        path: keyValStorePath
    }));

    chain.setMemberServicesUrl("grpc://localhost:7054");

    chain.enroll("admin", "Xurw3yU9zI0l")
    .then(
        function(admin) {
            t.pass("Successfully enrolled user 'admin'");

            chain.setRegistrar(admin);

            // Register and enroll webAdmin
            return registerAndEnroll("webAdmin", "client", { roles: ['client'] }, chain);
        },
        function(err) {
            t.fail("Failed to enroll user 'admin'. " + err);
            t.end();
        }
    ).then(
        function(webAdmin) {
            t.pass("Successfully registered and enrolled 'webAdmin'");

            chain.setRegistrar(webAdmin);

            return registerAndEnroll("webUser", "client", null, chain);
        },
        function(err) {
            t.fail("Failed to enroll user 'webAdmin'. " + err);
            t.end();
        }
    ).then(
        function(_webUser) {
            t.pass("Successfully registered and enrolled 'webUser'");

            webUser = _webUser;

            return registerAndEnroll("auditor", "auditor", null, chain);
        },
        function(err) {
            t.fail("Failed to enroll user 'webUser'. " + err);
            t.end();
        }
    ).then(
        function(auditor) {
            t.fail("webAdmin is not expected to be able to register members of type 'auditor'");
            t.end();
        },
        function(err) {
            expect = "webAdmin may not register member of type auditor";
            found = (err.toString()).match(expect);

            if (!(found == expect)) {
                t.fail("Error message does not match expected message when registration failed");
            }

            t.pass("Successfully tested failed registration of auditors");

            return registerAndEnroll("validator", "validator", null, chain);
        }
    ).then(
        function(validator) {
            t.fail("webAmin is not expected to be able to register members of type 'validator'");
            t.end();
        },
        function(err) {
            expect = "webAdmin may not register member of type validator";
            found = (err.toString()).match(expect);

            if (!(found == expect)) {
                t.fail("Error message does not match expected message when registration failed");
                t.end();
            }

            t.pass("Successfully tested failed registration of validators");
            
            chain.setRegistrar(webUser);

            return registerAndEnroll("webUser2", "client", null, chain);
        }
    ).then(
        function(webUser) {
            t.fail("webUser is not expected to be able to register members of type 'client'");
            t.end();
        },
        function(err) {
            expect = "webUser may not register member of type client";
            found = (err.toString()).match(expect);
            if (!(found == expect)) {
                t.fail("Error message does not match expected message when registration failed");
                t.end();
            }

            t.pass("Successfully tested failed registration of clients");
            t.end();
        }
    );
});


// Run the registrar test

test('enroll again', function(t) {
    //
    // Remove the file-based keyValStore
    // Create and configure testChain2 so there is no shared state with testChain
    // This is necessary to start without a local cache.
    //
    fs.renameSync(keyValStorePath, keyValStorePath2);
    var chain = hfc.newChain("testChain2");
    chain.setKeyValueStore(
        hfc.newKeyValueStore({
            path: '/tmp/keyValStore'
        }));
    chain.setMemberServicesUrl("grpc://localhost:7054");
    chain.enroll("admin", "Xurw3yU9zI0l")
    .then(
        function(admin) {
            rmdir(keyValStorePath);
            fs.renameSync(keyValStorePath2, keyValStorePath);
            t.fail(new Error("admin should not be allowed to re-enroll"));
            t.end();
        },
        function(err) {
            rmdir(keyValStorePath);
            fs.renameSync(keyValStorePath2, keyValStorePath);
            t.pass("Successfully tested failed re-enrollment on admin");
            t.end();
        }
    );
});

// Register and enroll user 'name' with role 'r' with registrar info 'registrar' for chain 'chain'
function registerAndEnroll(name, r, registrar, chain) {
    // User is not enrolled yet, so perform both registration and enrollment
    var registrationRequest = {
        roles: [r],
        enrollmentID: name,
        affiliation: "bank_a",
        registrar: registrar
    };
    return chain.registerAndEnroll(registrationRequest);
}

function rmdir(path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function(file, index) {
            var curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                rmdir(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}
