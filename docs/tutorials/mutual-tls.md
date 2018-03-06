This tutorial illustrates how to use the node SDK APIs to connect to an
orderer or peer which has TLS client authentication enabled (aka "mutual TLS").

An orderer has TLS client authentication enabled if the 
`ORDERER_GENERAL_TLS_CLIENTAUTHREQUIRED` environment variable is set to `true`.

A peer has TLS client authentication enabled if the 
`CORE_PEER_TLS_CLIENTAUTHREQUIRED` environment variable is set to `true`.

### Connecting to an orderer or peer with TLS client authentication enabled

When creating an orderer, specify the `clientKey` and `clientCert` options with
a value equal to the PEM-encoded private key and certificate, respectively.

For example, the following demonstrates how to connect to an orderer which has TLS
client authentication enabled.  This assumes that the client's PEM-encoded TLS key
and certificate are at `somepath/tls/client.key` and `somepath/tls/client.crt`, respectively.

```
let serverCert = fs.readFileSync(path.join(__dirname, 'somepath/msp/tlscacerts/example.com-cert.pem'));
let clientKey = fs.readFileSync(path.join(__dirname, 'somepath/tls/client.key'));
let clientCert = fs.readFileSync(path.join(__dirname, 'somepath/tls/client.crt'));

orderer = client.newOrderer(
              'grpcs://localhost:7050',
              {
                'pem': Buffer.from(serverCert).toString(),
                'clientKey': Buffer.from(clientKey).toString(),
                'clientCert': Buffer.from(clientCert).toString(),
              });
```

Similarly, the following demonstrates how to connect to a peer which has TLS
client authentication enabled.  This assumes that the client's PEM-encoded TLS key
and certificate are at `somepath/tls/client.key` and `somepath/tls/client.crt`, respectively.

```
let serverCert = fs.readFileSync(path.join(__dirname, 'somepath/msp/tlscacerts/org1.example.com-cert.pem'));
let clientKey = fs.readFileSync(path.join(__dirname, 'somepath/tls/client.key'));
let clientCert = fs.readFileSync(path.join(__dirname, 'somepath/tls/client.crt'));
let peer = client.newPeer(
        'grpcs://localhost:7051',
        {
          'pem': Buffer.from(serverCert).toString(),
          'clientKey': Buffer.from(clientKey).toString(),
          'clientCert': Buffer.from(clientCert).toString(),
        }
);
```
