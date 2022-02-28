const BitizenCreateHttpRpcMiddleware = require("eth-json-rpc-http")
const BitizenCreateAsyncMiddleware = require("json-rpc-engine/src/createAsyncMiddleware")
const BitizenRpcEngine = require("json-rpc-engine")
import SafeEventEmitter from '@metamask/safe-event-emitter';

const _bitizenHandledReqMethods = {
  "eth_requestAccounts": true,
  "eth_accounts": true,
  "eth_sendTransaction": true,
  "eth_sign": true,
  "personal_sign": true,
  "eth_decrypt": true,
  "eth_getEncryptionPublicKey": true,
  "wallet_requestPermissions": true,
  "wallet_getPermissions": true,
  "wallet_addEthereumChain": true,
  "wallet_switchEthereumChain": true,
  "wallet_watchAsset": true,
  "wallet_scanQRCode": true,
  "eth_signTypedData": true,
  "eth_signTypedData_v3": true,
  "eth_signTypedData_v4": true,
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
  isConnected: false,
  chainId: "",
  reqId: 1,
  async request(req) {
    if (!req.jsonrpc) {
      req.jsonrpc = "2.0"
    }
    if (!req.id) {
      req.id = this.reqId++;
    }
    if (this.isMetaMask) {
      console.log("bitizen_inpage req", req.id, req);
    }
    return new Promise(async (resolve, reject) => {
      const res = await this._bitizenRpcEngine.handle(req)
      if (this.isMetaMask) {
        console.log("bitizen_inpage res", res.result, res.error);
      }
      if (res.error) {
        reject(res.error)
      } else {
        resolve(res.result)
      }
    })
  },
  on: (topic, callback) => this._bitizenEventEmitter.on(topic, callback),
  _bitizenEventEmitter: new SafeEventEmitter(),
  _bitizenRpcEngine: new BitizenRpcEngine(),
  _BitizenUpdateRpcUrl(chainId, rpcUrl) {
    this._bitizenRpcEngine = new BitizenRpcEngine()
    this._bitizenRpcEngine.push(bitizenRpcRequestHandler)
    this._bitizenRpcEngine.push(BitizenCreateHttpRpcMiddleware({ rpcUrl }))
    this.chainId = chainId
    this.isConnected = true
  },
  _BitizenEventEmit(topic, args = []) {
    this._bitizenEventEmitter.emit(topic, ...args)
  }
}

