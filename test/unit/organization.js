/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

var tape = require('tape');
var _test = require('tape-promise').default;
var test = _test(tape);

var Organization = require('fabric-client/lib/Organization.js');
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
