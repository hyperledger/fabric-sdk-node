/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

'use strict';

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var Organization = require('fabric-client/lib/Organization.js');
var User = require('fabric-client/lib/User.js');
var utils = require('fabric-client/lib/utils.js');
var testutil = require('./util.js');


test('\n\n ** Organization - constructor set get tests **\n\n', function (t) {
	testutil.resetDefaults();

	t.throws(()=> {
		new Organization();
	},
	/Missing name parameter/,
	'Test Missing name parameter');

	t.throws(()=>{
		new Organization('name');
	},
	/Missing mspid parameter/,
	'Test Missing mspid parameter');

	t.doesNotThrow(()=>{
		new Organization('name', 'mspid');
	},
	null,
	'Test good construction');

	var organization = new Organization('name','mspid');
	t.equals('name',organization.getName(),'test method getName');
	t.equals('mspid',organization.getMspid(),'test method getMspid');

	t.equals(0,organization.getPeers().length,'test getting peers before add');
	organization.addPeer('peer1');
	t.equals(1,organization.getPeers().length,'test getting peers after add');

	t.equals(0,organization.getCertificateAuthorities().length,'test getting CertificateAuthorities before add');
	organization.addCertificateAuthority('ca1');
	t.equals(1,organization.getCertificateAuthorities().length,'test getting CertificateAuthorities after add');

	t.equals(null,organization.getAdminPrivateKey(),'test getting getAdminPrivateKey');
	organization.setAdminPrivateKey('privateKey');
	t.equals('privateKey',organization.getAdminPrivateKey(),'test getting getAdminPrivateKey');

	t.equals(null,organization.getAdminCert(),'test getting getAdminCert');
	organization.setAdminCert('cert');
	t.equals('cert',organization.getAdminCert(),'test getting getAdminCert');

	let s = organization.toString();
	t.comment(s);
	if(s.indexOf('Organization : {name : name')) {
		t.pass('Successfully tested toString');
	} else {
		t.fail('failed test of toString ');
	}

	t.end();
});