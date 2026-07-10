#!/usr/bin/env node

const { Buffer } = require("node:buffer");
const { decode, encode } = require("@msgpack/msgpack");
const { createResponse, dispatch, pluginId } = require("./eve-sidecar.cjs");

(async () => {
  const { startCultNetOperationServer } = await import("cultnet-ts");
  const server = await startCultNetOperationServer({
    runtimeId: "sai-vn-plugin",
    host: process.env.EVE_PLUGIN_HOST || "127.0.0.1",
    port: Number(process.env.EVE_PLUGIN_PORT || 0),
    handler: request => {
      if (request.serviceId !== pluginId) throw new Error(`Expected service ${pluginId}.`);
      if (request.payloadSchema !== "gamecult.eve.plugin_abi.request.v1") throw new Error("Unsupported plugin payload schema.");
      const abiRequest = decode(Buffer.from(request.payload, "base64"));
      let abiResponse;
      try {
        abiResponse = createResponse(abiRequest, dispatch(abiRequest));
      } catch (error) {
        abiResponse = createResponse(abiRequest, {}, "rejected", error instanceof Error ? error.message : String(error));
      }
      return {
        schemaVersion: "cultnet.operation_response.v0",
        messageId: request.messageId,
        serviceId: pluginId,
        operation: request.operation,
        status: abiResponse.status,
        payloadSchema: abiResponse.schema,
        payloadEncoding: "messagepack-base64",
        payload: Buffer.from(encode(abiResponse)).toString("base64"),
        diagnostics: (abiResponse.diagnostics || []).map(item => item.message),
        sourceRuntimeId: "sai-vn-plugin",
      };
    },
  });
  process.stdout.write(`${JSON.stringify({ schema: "gamecult.eve.plugin_endpoint.v1", pluginId, endpoint: server.endpoint })}\n`);
  const stop = async () => { await server.close(); process.exit(0); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  await new Promise(() => {});
})().catch(error => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exit(1);
});
