This tutorial describes how to use wallets to manage identities used to connect to a Hyperledger Fabric
network.

## Overview

A wallet provides an interface for storing and accessing identity information, backed by a persistent (or
non-persistent) store of your choice. Identity information stored in a wallet can be used to connect to a Hyperledger
Fabric network.

## Creating a wallet

A wallet is backed by a wallet store, which is responsible only for storing and retrieving data. Several different
store implementations are provided for convenience:
* **In-memory**: Non-persistent store. Useful for testing.
* **File system**: Stores identity information in a directory on the local file system.
* **CouchDB**: Stores identity information in a CouchDB database.

Wallets using default store implementations are created using static factory functions on the `Wallets` class, for
example:
```javascript
const wallet = await Wallets.newFileSystemWallet('/path/to/wallet/directory');
```

You can write your own custom wallet store to suit your deployment environment by implementing the `WalletStore`
interface. A wallet backed by a custom wallet store implementation is created as follows:
```javascript
const walletStore = new MyCustomWalletStore();
const wallet = new Wallet(walletStore);
```

## Storing identity information in a wallet

An identity is a set of information and credentials required to connect to a Hyperledger Fabric network. This
information is described as a simple JavaScript object using a well-defined format, including the Member Services
Provider associated with the user and a type identifier that indicates the type of credentials contained in the
identity. Two identity types are supported by default:
* **X.509**: X.509 certificate and private key in PEM format.
* **HSM-X.509**: X.509 certificate in PEM format, with the private key stored in a Hardware Security Module.

Once an identity object has been created from credentials supplied to you by your administrator or certificate
authority, it can be stored and retreived from a wallet using an arbitrary label to locate the identity within the
wallet, for example:
```javascript
const identity: X509Identity = {
    credentials: {
        certificate: 'PEM format certificate string',
        privateKey: 'PEM format private key string',
    },
    mspId: 'wonderland',
    type: 'X.509',
};
await wallet.put('alice', identity);
```

Note that a wallet may contain identities of varying types so, in TypeScript, indentity information retrieved from the
wallet is typed as `Identity` (or `undefined` if the identity does not exist in the wallet) and will need to be cast to
its specific subtype to access type-specific information, for example:
```javascript
const identity = await wallet.get('alice');
if (identity && identity.type === 'X.509') {
	const privateKey = (identity as X509Identity).credentials.privateKey;
}
```

## Using a Hardware Security Module

The SDK uses the [PKCS #11](https://en.wikipedia.org/wiki/PKCS_11) interface to
make use of Hardware Security Module (HSM) devices for key management. Identities
using an HSM-managed private key are similar to an X.509 identity but with the
private key omitted. The certificate is used to generate an SKI from the public key
to locate HSM managed keys. HSM managed keys need to have their label or ID set to
this SKI in order for the object to be located in the HSM.
In order to use HSM-managed identities the containing wallet must be configured
with details of the HSM that holds the private key. This is achieved by registering
an `IdentityProvider` with the wallet, for example:
```javascript
const hsmProvider = new HsmX509Provider({
    lib: '/path/to/hsm-specific/pkcs11/library',
    pin: '1234567890',
    label: 'tokenLabel',
});
wallet.getProviderRegistry().addProvider(hsmProvider);
```

Once the wallet has been confgured with details of the HSM, the crypto suite being
used by the provider may be assigned to a new fabric certificate authority instance.
The crypto suite will have been initialized with the `hsmProvider` option values
( lib, pin, label ) and it has opened a session with the HSM.

```
const hsmCAClient = new FabricCAClient(
    'http://localhost:7054',
    {trustedRoots: [], verify: false};,
    'ca-org1', hsmProvider.getCryptoSuite()
);
const enrollmentResults = await hsmCAClient.enroll(options);
```

HSM-managed identities can be stored and retreived from the wallet. When storing
an indentity, use the actual key returned in the enrollment. This key will contain
all the information needed for the identity's credentials to be access on the HSM
for signing requests.

```javascript
const identity: HsmX509Identity = {
    credentials: {
       certificate: enrollmentResults.certificate,
          // PEM format certificate string
    },
    mspId: 'org1',
    type: 'HSM-X.509',
};
await wallet.put('bob', identity);
```

### slot configuration option
The HsmX509Provider still supports the use of the `slot` configuration option as follows
```javascript
const hsmProvider = new HsmX509Provider({
    lib: '/path/to/hsm-specific/pkcs11/library',
    pin: '1234567890',
    slot: 0,
});
wallet.getProviderRegistry().addProvider(hsmProvider);
```

however this mechanism has problems in that if you initialise multiple slots then some HSM providers
do not guarantee the order of the slot list and the slot value is just an index into this slot list
which could result in unexpected behaviour.

slot remains available for backward compatibility only but it's recommended that you use the label
mechanism instead
