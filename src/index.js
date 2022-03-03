const BitizenCreateHttpRpcMiddleware = require("eth-json-rpc-http")
const BitizenCreateAsyncMiddleware = require("json-rpc-engine/src/createAsyncMiddleware")
const BitizenRpcEngine = require("json-rpc-engine")
import SafeEventEmitter from '@metamask/safe-event-emitter';

const _bitizenHandledReqMethods = {
  "eth_requestAccounts": true,
  "eth_accounts": true,
  "eth_sendTransaction": true,
  "eth_sign": true,
  "eth_decrypt": true,
  "eth_getEncryptionPublicKey": true,
  "eth_signTypedData": true,
  "eth_signTypedData_v3": true,
  "eth_signTypedData_v4": true,
  "personal_sign": true,
  "wallet_requestPermissions": true,
  "wallet_getPermissions": true,
  "wallet_addEthereumChain": true,
  "wallet_switchEthereumChain": true,
  "wallet_watchAsset": true,
  "wallet_scanQRCode": true,
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
  isMetaMask: false, // enable for debug, https://metamask.github.io/test-dapp/
  isConnected: () => window.ethereum.chainId != "",
  chainId: "",
  reqId: 1,
  _bitizenEventEmitter: new SafeEventEmitter(),
  _bitizenRpcEngine: new BitizenRpcEngine(),
  _BitizenUpdateRpcUrl(chainId, rpcUrl) {
    if (window.ethereum.isMetaMask) {
      console.log("bitizen_inpage update RPC", chainId, rpcUrl);
    }
    window.ethereum._bitizenRpcEngine = new BitizenRpcEngine()
    window.ethereum._bitizenRpcEngine.push(bitizenRpcRequestHandler)
    window.ethereum._bitizenRpcEngine.push(BitizenCreateHttpRpcMiddleware({ rpcUrl }))
    window.ethereum.chainId = chainId
  },
  _BitizenEventEmit(topic, args = []) {
    if (window.ethereum.isMetaMask) {
      console.log("bitizen_inpage emit", topic, args);
    }
    window.ethereum._bitizenEventEmitter.emit(topic, ...args)
  },
  async request(req) {
    if (!req.jsonrpc) {
      req.jsonrpc = "2.0"
    }
    if (!req.id) {
      req.id = window.ethereum.reqId++;
    }
    if (window.ethereum.isMetaMask) {
      console.log("bitizen_inpage req", req.id, req);
    }
    return new Promise(async (resolve, reject) => {
      const res = await window.ethereum._bitizenRpcEngine.handle(req)
      if (window.ethereum.isMetaMask) {
        console.log("bitizen_inpage res", res.result, res.error);
      }
      if (res.error) {
        reject(res.error)
      } else {
        resolve(res.result)
      }
    })
  },
  on: (topic, callback) => window.ethereum._bitizenEventEmitter.on(topic, callback),
  enable: () => window.ethereum.request({ method: 'eth_requestAccounts' }),
  removeListener: (eventName, listener) => window.ethereum._bitizenEventEmitter.removeListener(eventName, listener),
  removeAllListeners: (list) => window.ethereum._bitizenEventEmitter.removeAllListeners(list),
}

