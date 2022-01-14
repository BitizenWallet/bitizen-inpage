const createHttpRpcMiddleware = require("eth-json-rpc-http");
const createAsyncMiddleware = require("json-rpc-engine/src/createAsyncMiddleware");
const RpcEngine = require("json-rpc-engine");

const engine = new RpcEngine();

const customAppRpcRequestHandler = createAsyncMiddleware(
  async (req, res, next) => {
    console.log("custom-middleware", req, res, next);
    if (req.method == "eth_accounts") {
      res.result = ["0x000000000000000000000000000000000000dead"];
    } else {
      next();
    }
  }
);

engine.push(customAppRpcRequestHandler);
engine.push(createHttpRpcMiddleware({ rpcUrl: "https://cloudflare-eth.com" }));

window.ethereum = {
  send(req, cb) {
    const cb1 = function (a, b) {
      console.log("send-res", a, b);
      cb(a, b);
    };
    console.log("send", req);
    engine.handle(req, cb1);
  },
  sendAsync(req, cb) {
    const cb1 = function (a, b) {
      console.log("sendAsync-res", a, b);
      cb(a, b);
    };
    console.log("sendAsync", req);
    engine.handle(req, cb1);
  },
};
