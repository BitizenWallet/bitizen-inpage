const BitizenCreateHttpRpcMiddleware = require("eth-json-rpc-http")
const BitizenCreateAsyncMiddleware = require("json-rpc-engine/src/createAsyncMiddleware")
const BitizenRpcEngine = require("json-rpc-engine")
import SafeEventEmitter from '@metamask/safe-event-emitter';

const _bitizenHandledReqMethods = {
  "eth_requestAccounts": true,
  "eth_requestAccountsMultiChain": true, // For BitizenWallet internal development use only.
  "eth_accounts": true,
  "eth_sendTransaction": true,
  "eth_sign": true,
  // "eth_decrypt": true,
  // "eth_getEncryptionPublicKey": true,
  "eth_signTypedData": true,
  "eth_signTypedData_v3": true,
  "eth_signTypedData_v4": true,
  "personal_sign": true,
  // "wallet_requestPermissions": true,
  // "wallet_getPermissions": true,
  "wallet_addEthereumChain": true,
  "wallet_switchEthereumChain": true,
  "wallet_watchAsset": true,
  // "wallet_scanQRCode": true,
}

// Deprecated warning message: https://github.com/MetaMask/providers/blob/main/src/messages.ts
const _bitizenHandledEvents = {
  "accountsChanged": true,
  "chainChanged": true,
  "connect": true,
  "networkChanged": `Bitizen: The event 'networkChanged' is deprecated and may be removed in the future. Use 'chainChanged' instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1193#chainchanged`,
}

async function getFlutterInAppWebview() {
  while ((!window['flutter_inappwebview'] || !window['flutter_inappwebview']['callHandler']) && window.ethereum.isBitizen) {
    await new Promise(resolve => { setTimeout(resolve, 300) })
  }
  return window.flutter_inappwebview
}

const _bitizenRpcWriteEngine = new BitizenRpcEngine();
_bitizenRpcWriteEngine.push(BitizenCreateAsyncMiddleware(
  async (req, res, next) => {
    try {
      const webview = await getFlutterInAppWebview();
      const data = await webview.callHandler("BitizenRpcRequest", JSON.stringify(req))
      res.error = data.error
      res.result = data.result
    } catch (error) {
      res.error = error
    }
  }
))

window.ethereum = {
  isBitizen: true,
  debug: false,
  isConnected: () => window.ethereum.chainId != "",
  chainId: "",
  networkVersion: "",
  reqId: 1,
  version: '0.0.18',
  _bitizenEventEmitter: new SafeEventEmitter(),
  _bitizenRpcWriteEngine: _bitizenRpcWriteEngine,
  _bitizenRpcReadEngines: {},
  _BitizenUpdateReadRpcEngines(list) {
    window.ethereum._bitizenRpcReadEngines = {}
    if (!list) {
      return
    }
    list.forEach(el => {
      const [chainId, rpcUrl] = el;
      _bitizenConsole.debug("Bitizen: [debug] update RPC", chainId, rpcUrl);
      window.ethereum._bitizenRpcReadEngines[chainId] = new BitizenRpcEngine()
      if (rpcUrl) {
        window.ethereum._bitizenRpcReadEngines[chainId].push(BitizenCreateHttpRpcMiddleware({ rpcUrl }))
      }
    });
    window.ethereum.chainId = list[0][0]
    window.ethereum.networkVersion = list[0][0]
  },
  _BitizenEventEmit(topic, args = []) {
    _bitizenConsole.debug("Bitizen: [debug] emit", topic, args);
    window.ethereum._bitizenEventEmitter.emit(topic, ...args)
  },
  async request(req) {
    if (!req.jsonrpc) {
      req.jsonrpc = "2.0"
    }
    if (!req.id) {
      req.id = window.ethereum.reqId++;
    }
    if (!req.chainId) {
      req.chainId = window.ethereum.chainId
    }
    _bitizenConsole.debug("Bitizen: [debug] request", req.id, req.method);
    return new Promise(async (resolve, reject) => {
      let res

      if (_bitizenHandledReqMethods[req.method]) {
        res = await window.ethereum._bitizenRpcWriteEngine.handle(req)
      } else {
        res = await (window.ethereum._bitizenRpcReadEngines[req.chainId] ?? new BitizenRpcEngine()).handle(req)
      }

      _bitizenConsole.debug("Bitizen: [debug] response", req.id, res);
      if (res.error) {
        reject(res.error)
      } else {
        resolve(res.result)
      }
    })
  },
  on: (topic, callback) => {
    let msg = _bitizenHandledEvents[topic];
    if (!msg) {
      _bitizenConsole.error(`Bitizen: '` + topic + `' is deprecated and may be removed in the future or unsupported for now.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1193`);
      return;
    }
    if (typeof msg == 'string') {
      _bitizenConsole.warn(msg);
    }
    window.ethereum._bitizenEventEmitter.on(topic, callback)
  },
  enable: () => {
    _bitizenConsole.warn(`Bitizen: 'ethereum.enable()' is deprecated and may be removed in the future.Please use the 'eth_requestAccounts' RPC method instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1102`);
    return window.ethereum.request({ method: 'eth_requestAccounts' });
  },
  sendAsync: (req, cb) => {
    _bitizenConsole.warn(`Bitizen: 'ethereum.sendAsync(...)' is deprecated and may be removed in the future.Please use 'ethereum.request(...)' instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1193`);
    _bitizenConsole.debug("Bitizen: [debug] sendAsync request", req, cb);
    if (typeof req != 'object') {
      req = { method: req, params: cb }
    }
    window.ethereum.request(req).then(result => {
      const res = {
        id: req.id,
        jsonrpc: req.jsonrpc,
        result: result,
      };
      cb(null, res)
      _bitizenConsole.debug("Bitizen: [debug] sendAsync response", res);
    }).catch(error => {
      const res = {
        id: req.id,
        jsonrpc: req.jsonrpc,
        error: error,
      };
      cb(error, res)
      _bitizenConsole.debug("Bitizen: [debug] sendAsync response", res);
    });
  },
  send: (req, cb) => {
    _bitizenConsole.warn(`Bitizen: 'ethereum.send(...)' is deprecated and may be removed in the future.Please use 'ethereum.request(...)' instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1193`);
    _bitizenConsole.debug("Bitizen: [debug] send request", req, cb);
    if (typeof req == 'object') {
      if (cb) {
        window.ethereum.request(req).then(result => {
          const res = {
            id: req.id,
            jsonrpc: req.jsonrpc,
            result: result,
          };
          cb(null, res)
          _bitizenConsole.debug("Bitizen: [debug] send response", res);
        }).catch(error => {
          const res = {
            id: req.id,
            jsonrpc: req.jsonrpc,
            error: error,
          };
          cb(error, res)
          _bitizenConsole.debug("Bitizen: [debug] send response", res);
        });
      } else {
        return window.ethereum.request(req)
      }
    } else {
      return new Promise(async (resolve, reject) => {
        try {
          const resp = await window.ethereum.request({ method: req, params: cb });
          _bitizenConsole.debug("Bitizen: [debug] send response", resp);
          resolve({ id: undefined, jsonrpc: '2.0', result: resp });
        } catch (error) {
          _bitizenConsole.debug("Bitizen: [debug] send response", error);
          reject(error);
        }
      })
    }
  },
  removeListener: (eventName, listener) => window.ethereum._bitizenEventEmitter.removeListener(eventName, listener),
  removeAllListeners: (list) => window.ethereum._bitizenEventEmitter.removeAllListeners(list),
}

