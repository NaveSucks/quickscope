import { test, before } from "node:test";
import assert from "node:assert/strict";
import { scryptSync, randomBytes } from "node:crypto";
import { Auth } from "../server/auth.ts";
import { createApp } from "../server/app.ts";
import { initializePhysics } from "../shared/physics.ts";
const password = randomBytes(18).toString("hex"),
  salt = randomBytes(16).toString("hex"),
  hash = salt + ":" + scryptSync(password, salt, 32).toString("hex"),
  origin = "https://test.invalid";
before(initializePhysics);
test("fail closed, expiry and rate limits", async () => {
  assert.throws(() => new Auth("", origin));
  const a = new Auth(hash, origin);
  assert.ok(await a.verify(password));
  assert.equal(await a.verify("wrong"), false);
  const token = a.create(0);
  assert.ok(a.get("qs=" + token, 1));
  assert.equal(a.get("qs=" + token, 28800001), null);
  for (let n = 0; n < 5; n++) assert.equal(a.allow("a", 100), true);
  assert.equal(a.allow("a", 100), false);
});
test("gate imports nothing and every nested game path is authenticated", async () => {
  const { app } = await createApp(hash, origin);
  try {
    const page = await app.inject({ url: "/quickscope/" });
    assert.equal(page.statusCode, 200);
    assert.ok(!page.body.includes('type="module"'));
    assert.ok(!page.body.includes("three"));
    for (const url of [
      "/quickscope/game/",
      "/quickscope/game/assets/a.js",
      "/quickscope/game/nested/rapier.wasm",
    ])
      assert.equal((await app.inject({ url })).statusCode, 401);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/quickscope/api/session",
          payload: { password },
        })
      ).statusCode,
      403,
    );
    const response = await app.inject({
      method: "POST",
      url: "/quickscope/api/session",
      headers: { origin },
      payload: { password },
    });
    assert.equal(response.statusCode, 200);
    assert.match(
      String(response.headers["set-cookie"]),
      /HttpOnly; Secure; SameSite=Strict/,
    );
    const cookie = String(response.headers["set-cookie"]).split(";")[0];
    assert.equal(
      (
        await app.inject({
          url: "/quickscope/api/session",
          headers: { cookie },
        })
      ).json().authenticated,
      true,
    );
    assert.equal(
      (
        await app.inject({
          method: "DELETE",
          url: "/quickscope/api/session",
          headers: { cookie, origin },
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (await app.inject({ url: "/quickscope/game/", headers: { cookie } }))
        .statusCode,
      401,
    );
  } finally {
    await app.close();
  }
});
