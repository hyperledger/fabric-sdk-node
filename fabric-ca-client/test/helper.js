/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const Helper = require('../lib/helper');
const {User} = require('fabric-common');

const chai = require('chai');
const should = chai.should();

describe('Helper', () => {

	describe('#checkRegistrar', () => {

		it('should throw if called with missing argument', () => {
			(() => {
				Helper.checkRegistrar();
			}).should.throw(/Missing required argument "registrar"/);
		});

		it('should throw if called with argument that in not an instance of the class "User"', () => {
			(() => {
				Helper.checkRegistrar({thisIs: 'the wrong class'});
			}).should.throw(/Argument "registrar" must be an instance of the class "User" but is of type:/);
		});

		it('should throw if unable to retrieve signing identity due to missing method', () => {
			(() => {
				const registrar = new User('bob');
				registrar.getSigningIdentity = null;
				Helper.checkRegistrar(registrar);
			}).should.throw(/Argument "registrar" is found to be missing a method "getSigningIdentity\(\)"/);
		});

		it('should throw if unable to retrieve signing identity', () => {
			(() => {
				const registrar = new User('bob');
				Helper.checkRegistrar(registrar);
			}).should.throw(/Can not get signingIdentity from registrar/);
		});

		it('should not throw if valid registrar', () => {
			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';
			should.equal(Helper.checkRegistrar(registrar), undefined);
		});

	});

	describe('#getSubjectCommonName', () => {

		const CERT_WITHOUT_CN = '-----BEGIN CERTIFICATE-----' +
			'MIIFjzCCA3egAwIBAgIJAOLWW2j2g36vMA0GCSqGSIb3DQEBCwUAMF4xCzAJBgNV' +
			'BAYTAlVTMRcwFQYDVQQIDA5Ob3J0aCBDYXJvbGluYTEPMA0GA1UEBwwGRHVyaGFt' +
			'MRQwEgYDVQQKDAtIeXBlcmxlZGdlcjEPMA0GA1UECwwGRmFicmljMB4XDTE3MDMy' +
			'OTA0MTc0OFoXDTE4MDMyOTA0MTc0OFowXjELMAkGA1UEBhMCVVMxFzAVBgNVBAgM' +
			'Dk5vcnRoIENhcm9saW5hMQ8wDQYDVQQHDAZEdXJoYW0xFDASBgNVBAoMC0h5cGVy' +
			'bGVkZ2VyMQ8wDQYDVQQLDAZGYWJyaWMwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAw' +
			'ggIKAoICAQC/1MwnAefSeTNtUtQSEoH/KiFR3kEWPpBdG5BwMsf5p8X67jBIZoQZ' +
			'8NG3iOjF/H3kUbOw3YdrJ7ow+Pq1q5siyYweW2NZKj6cHkkHzrohJkvDTLE7nCwf' +
			'OPp/j2Rsk44J0v2v9B5wWCSzjmwJMTIul9PYEc3OkivuwxOMu8RZ7ocWriI6nbs3' +
			'42Z1vIgDsJTOrKNfluqL6xHbQvSUPNikIqsrnIHRLsFZIahfmxA9mmRW75u76oiu' +
			'JIgbqGnItcxD0092KoBBVbB5/2SSC9tBGDdFaF3aPlRQkllN1sHDt689zZ1TbYd/' +
			'NlVC0SKJwaLyKjYpjOZMYYhoDYJoq84yF33vsn5q9zdiGhF48XHjx69QTnp8MHuo' +
			'5AyJYXHG+6MXuRrmi9YOMmTGyp6kRkJh/E8PDO+rMMSuqNFNQGGKJMnC08N2o0EO' +
			'xo11uSwdSDiguUNTLnL2lAK0U7MbpnwdP4u3E4riRUIUhjN8CfWKGKe9bR3YyIZg' +
			'ig3Y+reTI+bMnZ9E/bqghikApS+tawAy7m9EgWf1jkrsBiudd21qE+THLX2X2zh4' +
			'+kL+MhoE1+Tat8nCBhvR/adxKKmqy+tT2GAQMKf+f35sqN+twI/aiwn8jv1KxQLt' +
			'PFmHaoNJUDwnGjNk09QFkMNRulhwHXXMf/FO/dyKYb1USpYLT+SQHwIDAQABo1Aw' +
			'TjAdBgNVHQ4EFgQU3H7zu+z+t0MJ/PrnPvp/SZk20agwHwYDVR0jBBgwFoAU3H7z' +
			'u+z+t0MJ/PrnPvp/SZk20agwDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQsFAAOC' +
			'AgEAYj9VrdQlSzCVBxgEizl/H92Loov/5CPxRBqkBAWi+09NrUNnvIQcmMMbbIXe' +
			'nXo2/egPM0z8cxJH3CfVFomHfQFiquWvm25L/38PAYjoOLDEwGHl3J7q9NXiAMft' +
			'glMcef+IhVXCoayFxhMlxmN13bPYN/vLAAFasDU5ElhZTEH5DEUTV4ku9q0FsF2f' +
			'fG6TXk++fVjUA5ykYo+megb0D39uBUE1E6CHLPuFrOrjWBRIf7CP8hWEwIwvJYKh' +
			'x1iz6INS6Zu/juTTcAD1jMjnAPy2nz2VbEQc/LNtFEi0E7s9dJvYItLwk7NMYAAg' +
			'DbWcEARwRtJCbcb/53j2fQyN7XNIAo58Oioa7rsINX6oy4F0XCKToF3FpTvXF8pn' +
			'0Mu65Q7XYfeMyNBhbdrvXVwL2jeIHMM0clVz4W2k8BNpvy/KBU6fai3xwfIjqDtl' +
			'aGzPELag9dwLOERJ5rLF5hQfRpok3ntZvBFq3nONfQ/o3qK5TyE3dTEGPG1/8nY3' +
			'qYFLWCZ1XvCo1bQ+Ujm0WdWrgggAEwov07m1SnSeBactg0YKUd+KI5EkDbSMuGyG' +
			'Pe6+emu31ygH9hiCNQ9XoRJDHsZpbenyqpGRKPw+F9jqjR/Z2CjCluDqqBCyDkAB' +
			'HSiaITVCUB0ecS/2d4DyIBf/His2WR5+rEbctl8INrdFaM4=' +
			'-----END CERTIFICATE-----';

		const VALID_CERT = '-----BEGIN CERTIFICATE-----' +
			'MIICEDCCAbagAwIBAgIUXoY6X7jIpHAAgL267xHEpVr6NSgwCgYIKoZIzj0EAwIw' +
			'fzELMAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNh' +
			'biBGcmFuY2lzY28xHzAdBgNVBAoTFkludGVybmV0IFdpZGdldHMsIEluYy4xDDAK' +
			'BgNVBAsTA1dXVzEUMBIGA1UEAxMLZXhhbXBsZS5jb20wHhcNMTcwMTAzMDEyNDAw' +
			'WhcNMTgwMTAzMDEyNDAwWjAQMQ4wDAYDVQQDEwVhZG1pbjBZMBMGByqGSM49AgEG' +
			'CCqGSM49AwEHA0IABLoGEWBb+rQ/OuTBPlGVZO3jVWBcuC4+/pAq8axbtKorpORw' +
			'J/GxahKPLr+vVLPNMyeLcnyJBGgneug+ajE8srijfzB9MA4GA1UdDwEB/wQEAwIF' +
			'oDAdBgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwDAYDVR0TAQH/BAIwADAd' +
			'BgNVHQ4EFgQU9BUt7QfgDXx9g6zpzCyJGxXsNM0wHwYDVR0jBBgwFoAUF2dCPaqe' +
			'gj/ExR2fW8OZ0bWcSBAwCgYIKoZIzj0EAwIDSAAwRQIgcWQbMzluyZsmvQCvGzPg' +
			'f5B7ECxK0kdmXPXIEBiizYACIQD2x39Q4oVwO5uL6m3AVNI98C2LZWa0g2iea8wk' +
			'BAHpeA==' +
			'-----END CERTIFICATE-----';

		it('should throw if does not contain common name', () => {
			(() => {
				Helper.getSubjectCommonName(CERT_WITHOUT_CN);
			}).should.throw(/Certificate PEM does not seem to contain a valid subject with common name "CN"/);
		});

		it('should return the common name on success', () => {
			Helper.getSubjectCommonName(VALID_CERT).should.equal('admin');
		});
	});

	describe('#parseURL', () => {

		it('should throw if invalid protocol', () => {
			(() => {
				Helper.parseURL('hyperledger.com');
			}).should.throw(/InvalidURL: url must start with http or https/);
		});

		it('should throw if not http or https protocol', () => {
			(() => {
				Helper.parseURL('ftp.hyperledger.com');
			}).should.throw(/InvalidURL: url must start with http or https/);
		});

		it('should throw if not http or https protocol', () => {
			(() => {
				Helper.parseURL('httpD.hyperledger.com');
			}).should.throw(/InvalidURL: url must start with http or https/);
		});

		it('should throw if no hostname', () => {
			(() => {
				Helper.parseURL('http://');
			}).should.throw(/InvalidURL: missing hostname/);
		});

		it('should return a URL Object on success', () => {
			const result = Helper.parseURL('http://hyperledger.com:4200');
			result.should.deep.equal({protocol: 'http', port: 4200, hostname: 'hyperledger.com'});
		});

	});

});
