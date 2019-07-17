# EVM HTLC

This repository contains contracts written in Solidity(which can be compiled to EVM bytecode) to create HTLCs for Ether using the sha256 hash function.

## Getting started

First of all, install the dev dependencies using npm:
```
npm install --only=dev
```
To run the unit tests, first run a test rpc server by running the `testrpc` task of npm:
```
npm run testrpc
```
and then run the tests using Truffle by invoking the `test` task of npm:
```
npm run test
```