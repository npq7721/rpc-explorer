# RPC Explorer

[![npm version][npm-ver-img]][npm-ver-url] [![NPM downloads][npm-dl-img]][npm-dl-url]


Simple, database-free Bitcoin base blockchain explorer, via RPC. Built with Node.js, express, bootstrap-v4.

This tool is intended to be a simple, self-hosted explorer for the Bitcoin base blockchain, driven by RPC calls to your own coind node. This tool is easy to run but currently lacks features compared to database-backed explorers.

Whatever reasons one might have for running a full node (trustlessness, technical curiosity, supporting the network, etc) it's helpful to appreciate the "fullness" of your node. With this explorer, you can not only explore the blockchain (in the traditional sense of the term "explorer"), but also explore the functional capabilities of your own node.

Live demo available at: [https://explorer.pigeoncoin.org/](https://explorer.pigeoncoin.org/)

# Features

* Browse blocks
* View block details
* View transaction details, with navigation "backward" via spent transaction outputs
* View JSON content used to generate most pages
* Search by transaction ID, block hash/height, and address
* Optional transaction history for addresses by querying from ElectrumX, blockchain.com, blockchair.com, or blockcypher.com
* Mempool summary, with fee, size, and age breakdowns
* RPC command browser and terminal

# Changelog / Release notes

See [CHANGELOG.md](/CHANGELOG.md).

# Getting started

The below instructions are geared toward BTC, but can be adapted easily to other coins.

## Prerequisites:

These steps are for bitcoin but other supported bitcoins base coin should have similar setup

1. Install and run a full, archiving node - [instructions](https://bitcoin.org/en/full-node). Ensure that your bitcoin node has full transaction indexing enabled (`txindex=1`) and the RPC server enabled (`server=1`).
2. Synchronize your node with the Bitcoin network.
3. "Recent" version of Node.js (8+ recommended).
4. Latest MongoDB to use to store addresses balances and exchange api information (future feature).

## Instructions

```bash
npm install -g rpc-explorer
rpc-explorer
```

If you're running on mainnet with the default datadir and port, this Should Just Work.
Open [http://127.0.0.1:3002/](http://127.0.0.1:3002/) to view the explorer.

You may set configuration options in a `.env` file or using CLI args.
See [configuration](#configuration) for details.

## MongoDB setup
Enter MongoDB cli:

    $ mongo

Create databse:

    > use explorerdb

Create user with read/write access:
    > db.createUser( { user: "rpcexplorer", pwd: "3xp!0reR", roles: [ "readWrite" ] } )
    
### Configuration

Configuration options may be passed as environment variables
or by creating an env file at `~/.config/btc-rpc-explorer.env`
or at `.env` in the working directory.
See [example](examples/rtm/btc-rpc-explorer.env) for a list of the options and details for formatting `.env`.

You may also pass options as CLI arguments, for example:

```bash
rpc-explorer --port 8080 --bitcoind-port 18443 --bitcoind-cookie ~/.bitcoin/regtest/.cookie
```

See `rpc-explorer --help` for the full list of CLI options.

## Run via Docker

```
cp seed raptoreumd/
docker-compose up --build --force-recreate

# Support

* BTC: [3Jym9QJLXQyjSSGKS1LCD9LCroPqCGo3Lq](bitcoin:3Jym9QJLXQyjSSGKS1LCD9LCroPqCGo3Lq)
* LTC: [LeBistdbcpTDbztr4GU9P29WZzGqJVmnjT](litecoin:LeBistdbcpTDbztr4GU9P29WZzGqJVmnjT)
* RAVEN: [RUExhCD48z1jRCZtMJTyCXQx83N9svvavC](litecoin:RUExhCD48z1jRCZtMJTyCXQx83N9svvavC)

[npm-ver-img]: https://img.shields.io/npm/v/btc-rpc-explorer.svg?style=flat
[npm-ver-url]: https://www.npmjs.com/package/btc-rpc-explorer
[npm-dl-img]: http://img.shields.io/npm/dm/btc-rpc-explorer.svg?style=flat
[npm-dl-url]: https://npmcharts.com/compare/btc-rpc-explorer?minimal=true
