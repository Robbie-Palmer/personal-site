// OpenAPI models a successful WebSocket handshake as HTTP 101 rather than a
// 2xx response. Keep Spectral's success-response invariant for ordinary HTTP
// operations while accepting that protocol-upgrade success code.
const operationSuccessResponse = (responses) => {
  if (!responses || typeof responses !== "object") return [];
  const hasSuccess = Object.keys(responses).some(
    (status) => status === "101" || /^[23]\d\d$/.test(status),
  );
  return hasSuccess
    ? []
    : [{ message: "Operation must define a 101, 2xx, or 3xx response." }];
};

export default operationSuccessResponse;
