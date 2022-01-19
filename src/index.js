const BitizenCreateHttpRpcMiddleware = require("eth-json-rpc-http")
const BitizenCreateAsyncMiddleware = require("json-rpc-engine/src/createAsyncMiddleware")
const BitizenRpcEngine = require("json-rpc-engine")
import SafeEventEmitter from '@metamask/safe-event-emitter';

const _bitizenHandledReqMethods = [
  "eth_requestAccounts",
  "eth_accounts",
  "eth_sendTransaction",
  "eth_sign",
  "eth_decrypt",
  "eth_getEncryptionPublicKey",
  "wallet_requestPermissions",
  "wallet_getPermissions",
  "wallet_addEthereumChain",
  "wallet_switchEthereumChain",
  "wallet_watchAsset",
  "wallet_scanQRCode",
]

const bitizenRpcRequestHandler = BitizenCreateAsyncMiddleware(
  async (req, res, next) => {
    if (_bitizenHandledReqMethods.indexOf(req.method) != -1) {
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
  isMetaMask: true, // TODO
  isConnected: false,
  chainId: "",
  async request(req) {
    if (!req.jsonrpc) {
      req.jsonrpc = "2.0"
    }
    console.log("bitizen_inpage req", req);
    return new Promise(async (resolve, reject) => {
      const res = await window.ethereum._bitizenRpcEngine.handle(req)
      console.log("bitizen_inpage res", res.result, res.error);
      if (res.error) {
        reject(res.error)
      } else {
        resolve(res.result)
      }
    })
  },
  on: (topic, callback) => window.ethereum._bitizenEventEmitter.on(topic, callback),
  _bitizenEventEmitter: new SafeEventEmitter(),
  _bitizenRpcEngine: new BitizenRpcEngine(),
  _BitizenUpdateRpcUrl(chainId, rpcUrl) {
    window.ethereum._bitizenRpcEngine = new BitizenRpcEngine()
    window.ethereum._bitizenRpcEngine.push(bitizenRpcRequestHandler)
    window.ethereum._bitizenRpcEngine.push(BitizenCreateHttpRpcMiddleware({ rpcUrl }))
    window.ethereum.chainId = chainId
    window.ethereum.isConnected = true
  },
  _BitizenEventEmit(topic, args = []) {
    window.ethereum._bitizenEventEmitter.emit(topic, ...args)
  }
}

