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
  reqId: 1,
  _bitizenEventEmitter: new SafeEventEmitter(),
  _bitizenRpcWriteEngine: _bitizenRpcWriteEngine,
  _bitizenRpcReadEngines: {},
  _BitizenUpdateReadRpcEngines(list) {
    _bitizenRpcReadEngines = {}
    if (!list) {
      return
    }
    list.forEach(el => {
      const [chainId, rpcUrl] = el;
      if (window.ethereum.debug) {
        console.debug("Bitizen: [debug] update RPC", chainId, rpcUrl);
      }
      window.ethereum._bitizenRpcReadEngines[chainId] = new BitizenRpcEngine()
      if (rpcUrl) {
        window.ethereum._bitizenRpcReadEngines[chainId].push(BitizenCreateHttpRpcMiddleware({ rpcUrl }))
      }
    });
    window.ethereum.chainId = list[0][0]
  },
  _BitizenEventEmit(topic, args = []) {
    if (window.ethereum.debug) {
      console.debug("Bitizen: [debug] emit", topic, args);
    }
    window.ethereum._bitizenEventEmitter.emit(topic, ...args)
  },
  async request(req) {
    // For Opensea
    if (req.method && req.method.method) {
      req = req.method
    }
    if (!req.jsonrpc) {
      req.jsonrpc = "2.0"
    }
    if (!req.id) {
      req.id = window.ethereum.reqId++;
    }
    if (!req.chainId) {
      req.chainId = window.ethereum.chainId
    }
    if (window.ethereum.debug) {
      console.debug("Bitizen: [debug] request", req.id, req.method);
    }
    return new Promise(async (resolve, reject) => {
      let res

      if (_bitizenHandledReqMethods[req.method]) {
        res = await window.ethereum._bitizenRpcWriteEngine.handle(req)
      } else {
        res = await (window.ethereum._bitizenRpcReadEngines[req.chainId] ?? new BitizenRpcEngine()).handle(req)
      }

      if (window.ethereum.debug) {
        console.debug("Bitizen: [debug] response", req.id, res);
      }
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
      console.error(`Bitizen: '` + topic + `' is deprecated and may be removed in the future or unsupported for now.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1193`);
      return;
    }
    if (typeof msg == 'string') {
      console.warn(msg);
    }
    window.ethereum._bitizenEventEmitter.on(topic, callback)
  },
  enable: () => {
    console.warn(`Bitizen: 'ethereum.enable()' is deprecated and may be removed in the future.Please use the 'eth_requestAccounts' RPC method instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1102`);
    window.ethereum.request({ method: 'eth_requestAccounts' })
  },
  send: (method) => {
    console.warn(`Bitizen: 'ethereum.send(...)' is deprecated and may be removed in the future.Please use 'ethereum.sendAsync(...)' or 'ethereum.request(...)' instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1193`);
    return window.ethereum.request({ method })
  },
  removeListener: (eventName, listener) => window.ethereum._bitizenEventEmitter.removeListener(eventName, listener),
  removeAllListeners: (list) => window.ethereum._bitizenEventEmitter.removeAllListeners(list),
}

