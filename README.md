# P2Ptrading-sc

## Description
p2p cec smart contract

## Badges
On some READMEs, you may see small images that convey metadata, such as whether or not all the tests are passing for the project. You can use Shields to add some to your README. Many services also have instructions for adding a badge.

## Usage

If you didn't already, install the [Hyperledger Fabric](https://hyperledger-fabric.readthedocs.io/en/release-2.2/install.html) and [Hyperledger Fabric Samples](https://hyperledger-fabric.readthedocs.io/en/release-2.2/install.html) on your machine.

First step is runnin the `startCecContract` transaction. This will create the cec contract and it's private data

The following transaction arguments are required:
```json
{
    "arg0": "079",
    "arg1": "atos.com",
    "arg2": "2020-12-22T00:00Z",
    "arg3": "2030-12-22T00:00Z",
    "arg4": "trading",
    "arg5": "equality",
    "arg6": "1"
}
```
and the associated transient data

```json
{
    "contractedByEmail": "ross.little@atos.net",
    "cecTradingParams":"[{\"smartmeterId\":\"AAAe4567-e89b-12d3-a456-426614174555\",\"algParams\":\"x\"},{\"smartmeterId\":\"BBBe4567-e89b-12d3-a456-426614174555\",\"algParams\":\"x\"},{\"smartmeterId\":\"CCC4567-e89b-12d3-a456-426614174555\",\"algParams\":\"x\"}]"
}
```

After this you are able to use `readCecContract` to read the contract data and `readCecContractPrivateData` to read the private data.

The next step is to run the `calculateCECtrading` transaction. This will calculate the cec contract and it's private data.

Use the following transaction arguments:

```json
{
  "arg0": "079"
}
```
and as transient data use:

```json
{
  "tradingPeriod":"2020-12-01T00:00:00",
  "smartmeterData":"[{\"smartmeterId\":\"AAAe4567-e89b-12d3-a456-426614174555\",\"c\":[0,150,10,13.1,10.4,11.8,10,13.1,10.4,11.8,10,13.1,10.4,11.8,10,13.1,10.4,11.8,10,13.1,10.4,11.8,10,13.1],\"p\":[163,50,10,13.1,22.4,10.8,10,13.1,22.4,10.8,10,13.1,22.4,10.8,10,13.1,22.4,10.8,10,13.1,22.4,10.8,10,13.1]},{\"smartmeterId\":\"BBBe4567-e89b-12d3-a456-426614174555\",\"c\":[200,100,10,13.1,10.4,11.8,10,13.1,10.4,11.8,10,13.1,10.4,11.8,10,13.1,10.4,11.8,10,13.1,10.4,11.8,10,13.1],\"p\":[100,200,10,13.1,22.4,10.8,10,13.1,22.4,10.8,10,13.1,22.4,10.8,10,13.1,22.4,10.8,10,13.1,22.4,10.8,10,13.1]},{\"smartmeterId\":\"CCC4567-e89b-12d3-a456-426614174555\",\"c\":[10.4,11.8,10,13.1,10.4,11.8,10,13.1,10.4,11.8,10,13.1,10.4,11.8,10,13.1,10.4,11.8,10,13.1,10.4,11.8,10,13.1],\"p\":[10.4,10.8,10,13.1,22.4,10.8,10,13.1,22.4,10.8,10,13.1,22.4,10.8,10,13.1,22.4,10.8,10,13.1,22.4,10.8,10,13.1]}]"
}
```

To get trading results use the `getCECtradingResults` transaction. This will read the trading results of the trading data

Transaction arguments:

```json
{
  "arg0": "079",
  "arg1": "2020-01-22T00:00Z"
}
```

For the results of a full year trading pediod use the `readCecYearMonth` transaction. This will read the trading results of the trading data

Transaction arguments:

This transaction works differently than the others. the `index` argument is `cecContractId` + `year`(e.g. `0792020`) and the `year` argument is obtained from system date.

```json
{
  "arg0": "0792020"
}
```

## Testing

For testing purposes use the commands below

```bash

# read CEC Contract
peer chaincode query -C mychannel -n CEC-Contract-New-Version -c '{"function":"readCecContract","Args":["e9761f31-a66e-406b-900e-772506fab295"]}'
```

```bash

# read YearMonth transaction
peer chaincode query -C mychannel -n CEC-Contract-New-Version -c '{"function":"readCecYearMonth","Args":["e9761f31-a66e-406b-900e-772506fab2952023"]}'
```

## Installation

This installation assumes that you have already installed the [Hyperledger Fabric](https://hyperledger-fabric.readthedocs.io/en/release-2.2/install.html) and [Hyperledger Fabric Samples](https://hyperledger-fabric.readthedocs.io/en/release-2.2/install.html) on your machine.

Have a running test network.

To instal the smart contract dependencies run the following command inside the root folder `aiot-publisher-smart-contract`:

```bash
npm install
```

Add the smart contract folder and smart contract name, version to the `PATH` environment variable:

```bash
export SC_PATH=${PWD}
export SC_NAME=`jq '.name' package.json`
export SC_NAME=${SC_NAME//\"}
export SC_VERSION=`jq '.version' package.json`
export SC_VERSION=${SC_VERSION//\"}
```

confirm that the installation was successful and you are able to run  by running the following command:

```bash
peer version
```

To create a package using the peer lifecycle, run the following command:

```bash
peer lifecycle chaincode package ${SC_NAME}.tar.gz --path ${SC_PATH} --lang node --label ${SC_NAME}_${SC_VERSION}
```

## Usage

You need to first have a running Hyperledger Fabric network. You can use the [AIOT Publisher Fabric Network]() to run the smart contract.

install the smart contract on the peer nodes:

```bash
peer lifecycle chaincode install ${SC_NAME}.tar.gz
```

```bash
peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --channelID mychannel --name ${SC_NAME} --version ${SC_VERSION} --package-id $CC_PACKAGE_ID --sequence 1 --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
```

```bash
peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --channelID mychannel --name ${SC_NAME} --version ${SC_VERSION} --package-id $CC_PACKAGE_ID --sequence 1 --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
```
```bash	
peer lifecycle chaincode checkcommitreadiness --channelID mychannel --name ${SC_NAME} --version ${SC_VERSION} --sequence 1 --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" --output json
```

```bash	
peer lifecycle chaincode commit -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --channelID mychannel --name ${SC_NAME} --version ${SC_VERSION} --sequence 1 --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" --peerAddresses localhost:7051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" --peerAddresses localhost:9051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt"
```

```bash
export ASSET_PROPERTIES=$(echo -n "33" | base64 | tr -d \\n)

#write asset
peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" -C mychannel -n ${SC_NAME} --peerAddresses localhost:7051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" --peerAddresses localhost:9051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" -c '{"function":"createReputation","Args":["123"]}' --transient "{\"privateValue\":\"$ASSET_PROPERTIES\"}"
```

```bash
#read asset
peer chaincode query -C mychannel -n ${SC_NAME} -c '{"function":"readReputation","Args":["123"]}'
```

## Support
Tell people where they can go to for help. It can be any combination of an issue tracker, a chat room, an email address, etc.

## Roadmap
If you have ideas for releases in the future, it is a good idea to list them in the README.

## Contributing
State if you are open to contributions and what your requirements are for accepting them.

For people who want to make changes to your project, it's helpful to have some documentation on how to get started. Perhaps there is a script that they should run or some environment variables that they need to set. Make these steps explicit. These instructions could also be useful to your future self.

You can also document commands to lint the code or run tests. These steps help to ensure high code quality and reduce the likelihood that the changes inadvertently break something. Having instructions for running tests is especially helpful if it requires external setup, such as starting a Selenium server for testing in a browser.

## License
For open source projects, say how it is licensed.
