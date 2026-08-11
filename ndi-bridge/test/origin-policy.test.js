const test = require("node:test");
const assert = require("node:assert/strict");
const { isAllowedLocalOrigin } = require("../dist/ipc/OriginPolicy.js");

test("allows exact localhost origins on any local development port", () => {
  assert.equal(isAllowedLocalOrigin("http://localhost:8080"), true);
  assert.equal(isAllowedLocalOrigin("http://127.0.0.1:17890"), true);
  assert.equal(isAllowedLocalOrigin("null"), true);
});

test("rejects lookalike hostnames and non-local origins", () => {
  assert.equal(isAllowedLocalOrigin("http://localhost.attacker.example"), false);
  assert.equal(isAllowedLocalOrigin("http://127.0.0.1.attacker.example"), false);
  assert.equal(isAllowedLocalOrigin("https://localhost:8080"), false);
  assert.equal(isAllowedLocalOrigin("https://attacker.example"), false);
});
