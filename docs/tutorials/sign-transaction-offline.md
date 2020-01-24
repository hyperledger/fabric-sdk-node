This tutorial illustrates how to work with an offline private key with the
Hyperledger Fabric Node.js SDK (fabric-common and fabric-ca-client) APIs.

For more information on:
* getting started with Hyperledger Fabric see
[Building your first network](http://hyperledger-fabric.readthedocs.io/en/latest/build_network.html).
* The transactional mechanics that take place during a standard asset exchange.
[transacton flow in fabric](https://hyperledger-fabric.readthedocs.io/en/latest/txflow.html).
* The Certificate Signing Request (CSR) in a PKI system.
[CSR](https://en.wikipedia.org/wiki/Certificate_signing_request)

The following assumes an understanding of the Hyperledger Fabric network
(orderers and peers),
and of Node application development, including the use of the
Javascript `promise` and `async await`.

## Overview

In most use cases an application will persist the user's credentials including
the private key and sign transactions for the user. However some business
scenarios may require higher level of privacy. What if the user wants to
keep their private key secret and does not trust another system or backend
server to securely store it and use it?

The `fabric-common` package comes with the ability to sign a transaction outside
of the application. The application may choose to include the signature when
calling the `send` method of the service instead of the identity context
that would be used to create the signature.

The Fabric-ca comes with the ability to enroll with a PKCS#10 standard CSR,
which means the user can use an existing key pairs to generate the CSR and
send this CSR to Fabric-ca to get the signed certificate.\
The `fabric-ca-client` also accepts a CSR at the API `enroll()`.

## How to sign a transaction by an identity's private key

There might be several digital signature algorithms. If we set the user's
identity at the fabric client, the fabric client would use ECDSA with
algorithm 'EC' by default.

The process is the same for all Service of `Endorsement`, `Commit`, `Query`,
and `Discovery`, using first the `build()` method getting the bytes to be
signed. Signing those bytes, then providing the signagure on the `sign()`
method before calling the `send()`.

1. generate proposal bytes with the identity's certificate
    ```javascript
    const idx = client.newIdentityContext(user);
    const endorsement = channel.newEndorsement(chaincode_name);

    const build_options = {fcn: 'move', args: ['a', 'b', '100']};
    const proposalBytes = endorsement.build(idx, build_options);
    ```

2. calculate the hash

    A hash algorithm should be picked and calculate the hash of the transaction
    proposal bytes.

    There exists multiple hash functions (such as SHA2/3). by default,
    the fabric client will use 'SHA2' with key size 256.

    The user may use an alternative implementation

    ```javascript
    const hashFunction = xxxx; // A hash function by the user's desire

    const digest = hashFunction(proposalBytes); // calculate the hash of the proposal bytes
    ```

3. calculate the signature

    We may have a series of choices for the signature algorithm. Including
    asymmetric keys (such as ECDSA or RSA), symmetric keys (such as AES).

    By default the the fabric client will use ECDSA with algorithm 'EC'.

    ```javascript
    // This is a sample code for signing the digest from step 2 with EC.
    // Different signature algorithm may have different interfaces

    const elliptic = require('elliptic');
    const { KEYUTIL } = require('jsrsasign');

    const privateKeyPEM = '<The PEM encoded private key>';
    const { prvKeyHex } = KEYUTIL.getKey(privateKeyPEM); // convert the pem encoded key to hex encoded private key

    const EC = elliptic.ec;
    const ecdsaCurve = elliptic.curves['p256'];

    const ecdsa = new EC(ecdsaCurve);
    const signKey = ecdsa.keyFromPrivate(prvKeyHex, 'hex');
    const sig = ecdsa.sign(Buffer.from(digest, 'hex'), signKey);

    // now we have the signature, next we should send the signed transaction proposal to the peer
    const signature = Buffer.from(sig.toDER());
    ```

4. use the signature for transaction proposal to peer(s)
    ```javascript

    endorsement.sign(signature);
    const proposalResponses = await endorsement.send();
    ```



## How to enroll with a CSR

The `fabric-ca-client` provides the API `enroll()` that accepts an optional param 'CSR'.
If the params does not contains CSR, `fabric-ca-client` will first generate a key pair,
then use the user's enrollmentID as the common name to create a CSR which is signed with
the new generated private key. The response will contain the private key object if no 'CSR'
in enroll params.

To enroll with a CSR, first we should call `fabric-ca-client` API `register` to register
a new identity at Fabric-ca. After a successfully register, we have the `enrollmentID`
and `enrollmentSecret`.

Then we should create the CSR. A common way is using the `openssl` command.
> Notice the CSR must contain the information "common name" and the "common name" must be
> same as the "enrollmentID" at the register step.

Here is an example of how to create a CSR with the key algorithm rsa and key size 2048 bits

```
openssl req -nodes -newkey rsa:2048 -keyout test.key -out test.csr
```

The `test.csr` from the above command is represented as a Base64 encoded PKCS#10.

Here is how we call enroll with a CSR

```javascript
const fs = require('fs');
const csr = fs.readFileSync('the path to test.csr', 'utf8');
const req = {
    enrollmentID: enrollmentID,
    enrollmentSecret: enrollmentSecret,
    csr: csr,
};

const enrollment = await caService.enroll(req);
// the enrollment.certificate contains the signed certificate from Fabric-ca
```