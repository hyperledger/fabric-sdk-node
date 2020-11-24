
This tutorial illustrates the common connection profile. A common connection
profile describes the Hyperledger Fabric network to the Hyperledger
Fabric Node.js client.

### Overview
A connection profile contain entries that describe the Hyperledger Fabric network.
The application will load a configuration file and then it will be used by
fabric-network to simplify the steps needed to setup and use the network.
The connection profile has specific addresses and settings of the network endpoints.

### Loading connection profile configurations
The application may build a Javascript object from a yaml or a json
formatted file.
The application will then pass this to the `Gateway.connect`
which provides the network configuration.

The following examples will create a new instance of the `Gateway` using a
common connection profile. The common connection profile object may be created
by reading a json or a yaml formatted file.

#### YAML
```
// read a common connection profile in yaml format
const data = fs.readFileSync(path);
const yaml = require('js-yaml');
const connectionProfile = yaml.safeLoad(data);

// use the loaded connection profile
const gateway = new Gateway();
await gateway.connect(connectionProfile, gatewayOptions);

const network = await gateway.getNetwork('mychannel');
```

#### JSON
```
// read a common connection profile in json format
const data = fs.readFileSync(path);
const connectionProfile = JSON.parse(data);

// or
const connectionProfile = require(path);

// use the loaded connection profile
const gateway = new Gateway();
await gateway.connect(connectionProfile, gatewayOptions);

const network = await gateway.getNetwork('mychannel');
```
### A common connection profile in YAML
```
name: "Network"
version: "1.1"

channels:
  mychannel:
    orderers:
      - orderer.example.com
    peers:
      - peer0.org1.example.com
      - peer0.org2.example.com

organizations:
  Org1:
    mspid: Org1MSP
    peers:
      - peer0.org1.example.com

  Org2:
    mspid: Org2MSP
    peers:
      - peer0.org2.example.com

orderers:
  orderer.example.com:
    url: grpcs://localhost:7050
    grpcOptions:
      ssl-target-name-override: orderer.example.com
    tlsCACerts:
      path: test/ordererOrganizations/example.com/orderers/orderer.example.com/tlscacerts/example.com-cert.pem

peers:
  peer0.org1.example.com:
    url: grpcs://localhost:7051
    grpcOptions:
      ssl-target-name-override: peer0.org1.example.com
    tlsCACerts:
      path: test/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tlscacerts/org1.example.com-cert.pem

  peer0.org2.example.com:
    url: grpcs://localhost:8051
    grpcOptions:
      ssl-target-name-override: peer0.org2.example.com
    tlsCACerts:
      path: test/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tlscacerts/org2.example.com-cert.pem
```

### A common connection profile in JSON

```
{
  "name": "Network",
  "version": "1.1",
  "channels": {
    "mychannel": {
      "orderers": [
        "orderer.example.com"
      ],
      "peers": [
        "peer0.org1.example.com",
        "peer0.org2.example.com"
      ]
    }
  },
  "organizations": {
    "Org1": {
      "mspid": "Org1MSP",
      "peers": [
        "peer0.org1.example.com"
      ]
    },
    "Org2": {
      "mspid": "Org2MSP",
      "peers": [
        "peer0.org2.example.com"
      ]
    }
  },
  "orderers": {
    "orderer.example.com": {
      "url": "grpcs://localhost:7050",
      "grpcOptions": {
        "ssl-target-name-override": "orderer.example.com"
      },
      "tlsCACerts": {
        "path": "test/ordererOrganizations/example.com/orderers/orderer.example.com/tlscacerts/example.com-cert.pem"
      }
    }
  },
  "peers": {
    "peer0.org1.example.com": {
      "url": "grpcs://localhost:7051",
      "grpcOptions": {
        "ssl-target-name-override": "peer0.org1.example.com"
      },
      "tlsCACerts": {
        "path": "test/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tlscacerts/org1.example.com-cert.pem"
      }
    },
    "peer0.org2.example.com": {
      "url": "grpcs://localhost:8051",
      "grpcOptions": {
        "ssl-target-name-override": "peer0.org2.example.com"
      },
      "tlsCACerts": {
        "path": "test/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tlscacerts/org2.example.com-cert.pem"
      }
    }
  }
}
```


## Common Connection Profile
The common connection profile has the following format:

```
#
# How a channel is defined and the peers and orderers on that channel.
#
channels:
  # name of the channel
  mychannel:
    # List of orderers designated by the application to use for transactions on this channel.
    # The values must be orderer names defined under "orderers" section
    orderers:
      - orderer.example.com

    # List of peers from participating organizations
    peers:
      # The values must be peer names defined under "peers" section
      - peer0.org1.example.com

#
# list of participating organizations in this network
#
organizations:
  Org1:
    mspid: Org1MSP

    # The peers that are known to be in this organization
    peers:
      - peer0.org1.example.com

    # The following section is only for Fabric-CA servers.
    certificateAuthorities:
      - ca-org1

    # If the application is going to make requests that are reserved to organization
    # administrators, including creating/updating channels, installing/instantiating chaincodes, it
    # must have access to the admin identity represented by the private key and signing certificate.
    # Both properties can be the PEM string or local path to the PEM file.
    #   path: <the path to a file containing the byte string>
    #    or
    #   pem: <the byte string>
    # Note that this is mainly for convenience in development mode, production systems
    # should not expose sensitive information this way.
    # The SDK should allow applications to set the org admin identity via APIs, and only use
    # this route as an alternative when it exists.
    adminPrivateKey:
      path: <path to file>
       or
      pem: <byte string>
    signedCert:
      path: <path to file>
       or
      pem: <byte string>

  # the profile will contain public information about organizations other than the one it belongs to.
  # These are necessary information to make transaction lifecycles work, including MSP IDs and
  # peers with a public URL to send transaction proposals. The file will not contain private
  # information reserved for members of the organization, such as admin key and certificate,
  # fabric-ca registrar enroll ID and secret, etc.
  Org2:
    mspid: Org2MSP
    peers:
      - peer0.org2.example.com
    certificateAuthorities:
      - ca-org2
    adminPrivateKey:
      path: <path to file>
       or
      pem: <byte string>
    signedCert:
      path: <path to file>
       or
      pem: <byte string>

#
# List of orderers to send transaction and channel create/update requests.
#
orderers:
  orderer.example.com:
    url: grpcs://localhost:7050

    # these are standard properties defined by the gRPC library
    # they will be passed in as-is to gRPC client constructor
    grpcOptions:
      ssl-target-name-override: orderer.example.com

    tlsCACerts:
      path: <path to file>
       or
      pem: <byte string>

#
# List of peers to send various requests to, including endorsement, query
# and event listener registration.
#
peers:
  peer0.org1.example.com:
    # this URL is used to send endorsement and query requests
    url: grpcs://localhost:7051

    grpcOptions:
      ssl-target-name-override: peer0.org1.example.com
      request-timeout: 120001

    tlsCACerts:
      path: <path to file>
       or
      pem: <byte string>

  peer0.org2.example.com:
    url: grpcs://localhost:8051
    grpcOptions:
      ssl-target-name-override: peer0.org2.example.com
    tlsCACerts:
      path: <path to file>
       or
      pem: <byte string>

certificateAuthorities:
  ca-org1:
    url: https://localhost:7054
    # the properties specified under this object are passed to the 'http' client verbatim when
    # making the request to the Fabric-CA server
    httpOptions:
      verify: true
    tlsCACerts:
      # Comma-Separated list of paths
      path: peerOrganizations/org1.example.com/ca/org1.example.com-cert.pem
      # Client key and cert for TLS mutual auth with Fabric CA. If the target Fabric CA server
      # does not have TLS mutual auth turned on, then this section is not needed
      client:
        keyfile: <path to file>
        certfile: <byte string>


    # Fabric-CA supports dynamic user enrollment via REST APIs. A "root" user, a.k.a registrar, is 
    # needed to enroll and invoke new users.
    registrar:
       enrollId: admin
       enrollSecret: adminpw
    # [Optional] The optional name of the CA.
    caName: caNameHere
  ca-org2:
    url: https://localhost:8054
    httpOptions:
      verify: true
    tlsCACerts:
      client:
        keyfile: <path to file>
        certfile: <byte string>
    registrar:
       enrollId: admin
       enrollSecret: adminpw
    caName: caNameHere
```


<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
