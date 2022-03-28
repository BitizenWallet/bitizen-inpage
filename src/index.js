const BitizenCreateHttpRpcMiddleware = require("eth-json-rpc-http")
const BitizenCreateAsyncMiddleware = require("json-rpc-engine/src/createAsyncMiddleware")
const BitizenRpcEngine = require("json-rpc-engine")
import SafeEventEmitter from '@metamask/safe-event-emitter';

const _bitizenHandledReqMethods = {
  "eth_requestAccounts": true,
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

const bitizenRpcRequestHandler = BitizenCreateAsyncMiddleware(
  async (req, res, next) => {
    if (_bitizenHandledReqMethods[req.method]) {
      req.chainId = window.ethereum.chainId
      try {
        const data = await window.flutter_inappwebview.callHandler("BitizenRpcRequest", JSON.stringify(req))
        res.error = data.error
        res.result = data.result
      } catch (error) {
        res.error = error
      }
    } else {
      next()
    }
  }
)

window.ethereum = {
  isBitizen: true,
  debug: false,
  isConnected: () => window.ethereum.chainId != "",
  chainId: "",
  reqId: 1,
  _bitizenEventEmitter: new SafeEventEmitter(),
  _bitizenRpcEngine: new BitizenRpcEngine(),
  _BitizenUpdateRpcUrl(chainId, rpcUrl) {
    if (window.ethereum.debug) {
      console.log("Bitizen: [debug] update RPC", chainId, rpcUrl);
    }
    window.ethereum._bitizenRpcEngine = new BitizenRpcEngine()
    window.ethereum._bitizenRpcEngine.push(bitizenRpcRequestHandler)
    if (rpcUrl) {
      window.ethereum._bitizenRpcEngine.push(BitizenCreateHttpRpcMiddleware({ rpcUrl }))
    }
    window.ethereum.chainId = chainId
  },
  _BitizenEventEmit(topic, args = []) {
    if (window.ethereum.debug) {
      console.log("Bitizen: [debug] emit", topic, args);
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
    if (window.ethereum.debug) {
      console.log("Bitizen: [debug] request", req.id, req);
    }
    return new Promise(async (resolve, reject) => {
      const res = await window.ethereum._bitizenRpcEngine.handle(req)
      if (window.ethereum.debug) {
        console.log("Bitizen: [debug] response", res.result, res.error);
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

