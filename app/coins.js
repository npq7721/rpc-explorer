var btc = require("./coins/btc.js");
var ltc = require("./coins/ltc.js");
var pgn = require("./coins/pgn.js");
var rtm = require("./coins/rtm.js");
var trtm = require("./coins/trtm.js");
var pyrk = require("./coins/pyrk.js");
var tnowp = require("./coins/tnowp.js");

module.exports = {
	"BTC": btc,
	"LTC": ltc,
	"PGN": pgn,
	"RTM": rtm,
	"tRTM": trtm,
	"PYRK" : pyrk,
	"TNOWP" : tnowp,
	
	"coins":["BTC", "LTC", "PGN", "RTM", "tRTM", "PYRK", "TNOWP"],

	networks : {
		BTC : {
			bitcoinjs : {
				messagePrefix: '\x18Bitcoin Signed Message:\n',
			  bech32: 'bc',
			  bip32: {
			    public: 0x0488b21e,
			    private: 0x0488ade4,
			  },
			  pubKeyHash: 0x00,
			  scriptHash: 0x05,
			  wif: 0x80,
			},
			name: 'bitcoin',
		  alias: 'bitcoin mainnet',
		  pubkeyhash: 0x00,
		  privatekey: 0x80,
		  scripthash: 0x05,
		  xpubkey: 0x0488b21e,
		  xprivkey: 0x0488ade4,
		  networkMagic: 0xf9beb4d9,
		  port: 8333,
		  dnsSeeds: [
		    'seed.bitcoin.sipa.be',
		    'dnsseed.bluematt.me',
		    'dnsseed.bitcoin.dashjr.org',
		    'seed.bitcoinstats.com',
		    'seed.bitnodes.io',
		    'bitseed.xf2.org'
		  ]
		},
		RTM : {
			bitcoinjs : {
				messagePrefix: '\x18Raptoreum Signed Message:\n',
			  bech32: 'rc',
			  bip32: {
			    public: 0x0488b21e,
			    private: 0x0488ade4,
			  },
			  pubKeyHash: 60,
			  scriptHash: 122,
			  wif: 128,
			},
			name: 'Raptoreum',
		  alias: 'raptoreum',
		  pubkeyhash: 60,
		  privatekey: 128,
		  scripthash: 122,
		  xpubkey: 0x0488b21e,
		  xprivkey: 0x0488ade4,
		  networkMagic: 0x6251665e,
		  port: 8333,
		  dnsSeeds: [
		    'explorer.raptoreum.com'
		  ]
		},
		tRTM : {
			bitcoinjs : {
				messagePrefix: '\x18Raptoreum Signed Message:\n',
				bech32: 'rc',
				bip32: {
					public: 0x0488b21e,
					private: 0x0488ade4,
				},
				pubKeyHash: 123,
				scriptHash: 19,
				wif: 128,
			},
			name: 'Raptoreum Testnet',
			alias: 'raptoreum testnet',
			pubkeyhash: 123,
			privatekey: 239,
			scripthash: 19,
			xpubkey: 0x043587cf,
			xprivkey: 0x04358394,
			networkMagic: 0x7472746d,
			port: 10225,
			dnsSeeds: [
				'explorer.raptoreum.com'
			],
			assetSupported: true,
		},
		TNOWP : {
			bitcoinjs : {
				messagePrefix: '\x18Nowp Signed Message:\n',
				bech32: 'tnp',
				bip32: {
					public: 0x043587cf,
					private: 0x04358394,
				},
				pubKeyHash: 112,
				scriptHash: 196,
				wif: 239,
			},
			name: 'Raptoreum Testnet',
			alias: 'raptoreum testnet',
			pubkeyhash: 112,
			privatekey: 239,
			scripthash: 196,
			xpubkey: 0x043587cf,
			xprivkey: 0x04358394,
			networkMagic: 0x076e6f77,
			port: 7888,
			dnsSeeds: [
			]
		},
		PYRK : {
          bitcoinjs : {
              messagePrefix: '\x18PYRK Signed Message:\n',
            bech32: 'pk',
            bip32: {
              public: 0x0488b21e,
              private: 0x0488ade4,
            },
            pubKeyHash: 55,
            scriptHash: 16,
            wif: 183,
          },
          name: 'Pyrk',
        alias: 'pyrk mainnet',
        pubkeyhash: 55,
        privatekey: 183,
        scripthash: 16,
        xpubkey: 0x0488b21e,
        xprivkey: 0x0488ade4,
        networkMagic: 0xb00d6cbe,
        port: 8333,
        dnsSeeds: [
          'explorer.pyrk.org/'
        ]
      }
	}
};
