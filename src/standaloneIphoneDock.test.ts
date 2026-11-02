import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { keyboardIsVisible, stableIphoneScreenHeight } from "./standaloneIphoneDock";

test("keeps the physical portrait viewport when iOS layout viewport shrinks", () => {
  assert.equal(stableIphoneScreenHeight(393, 852, true, 410), 852);
  assert.equal(stableIphoneScreenHeight(852, 393, true, 410), 852);
  assert.equal(stableIphoneScreenHeight(393, 852, false, 393), 393);
  assert.equal(stableIphoneScreenHeight(0, 0, true, 812), 812);
});

test("dock is hidden for an actual keyboard but not after the field loses focus", () => {
  assert.equal(keyboardIsVisible(true, 395, 852), true);
  assert.equal(keyboardIsVisible(false, 395, 852), false);
  assert.equal(keyboardIsVisible(true, 820, 852), false);
});

test("bottom dock never uses physical-screen top coordinates that can crop it", () => {
  const css = readFileSync(new URL("./ios-pwa-layout.css", import.meta.url), "utf8");
  assert.match(css, /html \.app \.bottom-nav\s*\{[^}]*top:\s*auto\s*!important/s);
  assert.match(css, /html \.app \.bottom-nav\s*\{[^}]*bottom:\s*calc\(10px \+ env\(safe-area-inset-bottom/s);
  assert.doesNotMatch(css, /top:\s*calc\(var\(--wimm-standalone-screen-height/);
  assert.doesNotMatch(css, /--wimm-nav-recovery-y/);
});
