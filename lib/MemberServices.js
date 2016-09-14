/*
 Copyright 2016 IBM All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

var api = require('./api.js');
var utils = require('./utils');
var jsrsa = require('jsrsasign');
var asn1 = jsrsa.asn1;
var X509Certificate = require('./X509Certificate.js');

var CryptoSuite = utils.getCryptoSuite();

var grpc = require('grpc');
var _caProto = grpc.load(__dirname + "/protos/ca.proto").protos;


/**
 * MemberServicesImpl is the default implementation of a member services client.
 */
var MemberServices = api.MemberServices.extend({

    _ecaaClient: null,
    _ecapClient: null,
    _tcapClient: null,
    _tlscapClient: null,
    cryptoPrimitives: null,

    /**
     * MemberServicesImpl constructor
     * @param config The config information required by this member services implementation.
     * @returns {MemberServices} A MemberServices object.
     */
    constructor: function(url /*string*/, pem /*string*/) {
        var ep = new utils.Endpoint(url,pem);
        var options = {
              'grpc.ssl_target_name_override' : 'tlsca',
              'grpc.default_authority': 'tlsca'
        };
        this._ecaaClient = new _caProto.ECAA(ep.addr, ep.creds, options);
        this._ecapClient = new _caProto.ECAP(ep.addr, ep.creds, options);
        this._tcapClient = new _caProto.TCAP(ep.addr, ep.creds, options);
        this._tlscapClient = new _caProto.TLSCAP(ep.addr, ep.creds, options);
        this.cryptoPrimitives = new CryptoSuite();
    },

    /**
     * Get the security level
     * @returns The security level
     */
    getSecurityLevel: function() {
        return this.cryptoPrimitives.getSecurityLevel();
    },

    /**
     * Set the security level
     * @params securityLevel The security level
     */
    setSecurityLevel: function(securityLevel) {
        this.cryptoPrimitives.setSecurityLevel(securityLevel);
    },

    /**
     * Get the hash algorithm
     * @returns {string} The hash algorithm
     */
    getHashAlgorithm: function() {
        return this.cryptoPrimitives.getHashAlgorithm();
    },

    /**
     * Set the hash algorithm
     * @params hashAlgorithm The hash algorithm ('SHA2' or 'SHA3')
     */
    setHashAlgorithm: function(hashAlgorithm) {
        this.cryptoPrimitives.setHashAlgorithm(hashAlgorithm);
    },

    getCrypto: function() {
        return this.cryptoPrimitives;
    },

    /**
     * Register the member and return an enrollment secret.
     * @param req Registration request with the following fields: name, role
     * @param registrar The identity of the registrar (i.e. who is performing the registration)
     * @returns Promise for the enrollmentSecret
     */
    register: function(req, registrar /*Member*/) {
        var self = this;

        return new Promise(function(resolve, reject) {
            if (!req.enrollmentID) {
                reject(new Error("missing req.enrollmentID"));
                return;
            }

            if (!registrar) {
                reject(new Error("chain registrar is not set"));
                return;
            }

            var protoReq = new _caProto.RegisterUserReq();
            protoReq.setId({id:req.enrollmentID});
            protoReq.setRole(rolesToMask(req.roles));
            protoReq.setAffiliation(req.affiliation);

            // Create registrar info
            var protoRegistrar = new _caProto.Registrar();
            protoRegistrar.setId({id:registrar.getName()});
            if (req.registrar) {
                if (req.registrar.roles) {
                   protoRegistrar.setRoles(req.registrar.roles);
                }
                if (req.registrar.delegateRoles) {
                   protoRegistrar.setDelegateRoles(req.registrar.delegateRoles);
                }
            }

            protoReq.setRegistrar(protoRegistrar);

            // Sign the registration request
            var buf = protoReq.toBuffer();
            var signKey = self.cryptoPrimitives.ecdsaKeyFromPrivate(registrar.getEnrollment().key, 'hex');
            var sig = self.cryptoPrimitives.ecdsaSign(signKey, buf);
            protoReq.setSig( new _caProto.Signature(
                {
                    type: _caProto.CryptoType.ECDSA,
                    r: new Buffer(sig.r.toString()),
                    s: new Buffer(sig.s.toString())
                }
            ));

            // Send the registration request
            self._ecaaClient.registerUser(protoReq, function (err, token) {
                if (err) {
                    reject(err);
                } else {
                    return resolve(token ? token.tok.toString() : null);
                }
            });
        });
    },

    /**
     * Enroll the member and return an opaque member object
     * @param req Enrollment request with the following fields: name, enrollmentSecret
     * @returns Promise for {key,cert,chainKey}
     */
    enroll: function(req) {
        var self = this;

        return new Promise(function(resolve, reject) {
            if (!req.enrollmentID) {
                reject(new Error("req.enrollmentID is not set"));
                return;
            }

            if (!req.enrollmentSecret) {
                reject(new Error("req.enrollmentSecret is not set"));
                return;
            }

            // generate ECDSA keys: signing and encryption keys
            // 1) signing key
            var signingKeyPair = self.cryptoPrimitives.ecdsaKeyGen();
            var spki = new asn1.x509.SubjectPublicKeyInfo(signingKeyPair.pubKeyObj);
            // 2) encryption key
            var encryptionKeyPair = self.cryptoPrimitives.ecdsaKeyGen();
            var spki2 = new asn1.x509.SubjectPublicKeyInfo(encryptionKeyPair.pubKeyObj);

            // create the proto message
            var eCertCreateRequest = new _caProto.ECertCreateReq();
            var timestamp = utils.GenerateTimestamp();
            eCertCreateRequest.setTs(timestamp);
            eCertCreateRequest.setId({id: req.enrollmentID});
            eCertCreateRequest.setTok({tok: new Buffer(req.enrollmentSecret)});

            // public signing key (ecdsa)
            var signPubKey = new _caProto.PublicKey(
                {
                    type: _caProto.CryptoType.ECDSA,
                    key: new Buffer(spki.getASN1Object().getEncodedHex(), 'hex')
                });
            eCertCreateRequest.setSign(signPubKey);

            // public encryption key (ecdsa)
            var encPubKey = new _caProto.PublicKey(
                {
                    type: _caProto.CryptoType.ECDSA,
                    key: new Buffer(spki2.getASN1Object().getEncodedHex(), 'hex')
                });
            eCertCreateRequest.setEnc(encPubKey);

            self._ecapClient.createCertificatePair(eCertCreateRequest, function (err, eCertCreateResp) {
                if (err) {
                    reject(err);
                    return;
                }

                var cipherText = eCertCreateResp.tok.tok;
                var decryptedTokBytes = self.cryptoPrimitives.eciesDecrypt(encryptionKeyPair.prvKeyObj, cipherText);

                //debug(decryptedTokBytes);
                // debug(decryptedTokBytes.toString());
                // debug('decryptedTokBytes [%s]', decryptedTokBytes.toString());
                eCertCreateRequest.setTok({tok: decryptedTokBytes});
                eCertCreateRequest.setSig(null);

                var buf = eCertCreateRequest.toBuffer();

                var signKey = self.cryptoPrimitives.ecdsaKeyFromPrivate(signingKeyPair.prvKeyObj.prvKeyHex, 'hex');
                //debug(new Buffer(sha3_384(buf),'hex'));
                var sig = self.cryptoPrimitives.ecdsaSign(signKey, buf);

                eCertCreateRequest.setSig(new _caProto.Signature(
                    {
                        type: _caProto.CryptoType.ECDSA,
                        r: new Buffer(sig.r.toString()),
                        s: new Buffer(sig.s.toString())
                    }
                ));
                self._ecapClient.createCertificatePair(eCertCreateRequest, function (err, eCertCreateResp) {
                    if (err) {
                        reject(err);
                        return;
                    }

                    var enrollment = {
                        key: signingKeyPair.prvKeyObj.prvKeyHex,
                        cert: eCertCreateResp.certs.sign.toString('hex'),
                        chainKey: eCertCreateResp.pkchain.toString('hex')
                    };
                    // debug('cert:\n\n',enrollment.cert)
                    return resolve(enrollment);
                });
            });
        });
    }
});

// Convert a list of member type names to the role mask currently used by the peer
function rolesToMask(roles /*string[]*/) {
    var mask = 0;

    if (roles) {
        for (var role in roles) {
            switch (roles[role]) {
                case 'client':
                    mask |= 1;
                    break;       // Client mask
                case 'peer':
                    mask |= 2;
                    break;       // Peer mask
                case 'validator':
                    mask |= 4;
                    break;  // Validator mask
                case 'auditor':
                    mask |= 8;
                    break;    // Auditor mask
            }
        }
    }
    if (mask === 0) 
        mask = 1;  // Client

    return mask;
}

module.exports = MemberServices;


