// Tempo de video em mm:ss (src/lib/timecode.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { formatarTimecode as f, lerTimecode as l } from "../../src/lib/timecode.ts";

test("formata minutos, horas e casos ruins", () => {
  assert.equal(f(0), "0:00");
  assert.equal(f(761000), "12:41");
  assert.equal(f(59999), "0:59");
  assert.equal(f(3723000), "1:02:03");
  assert.equal(f(-5), "0:00");
  assert.equal(f(Number.NaN), "0:00");
});

test("le os formatos aceitos", () => {
  assert.equal(l("12:41"), 761000);
  assert.equal(l(" 0:05 "), 5000);
  assert.equal(l("75"), 75000);
  assert.equal(l("1:02:03"), 3723000);
  assert.equal(l("12:41.5"), 761500);
  assert.equal(l("12:41,5"), 761500);
  assert.equal(l("90:00"), 5400000); // live longa sem hora explicita
});

test("recusa o que nao e tempo", () => {
  for (const t of ["", "abc", "12:", ":30", "1:2:3:4", "12:60", "1:60:00", "-3", "12:41s"]) {
    assert.equal(l(t), null, `"${t}" deveria ser recusado`);
  }
});

test("ida e volta", () => {
  for (const ms of [0, 1000, 61000, 761000, 3600000, 3723000]) assert.equal(l(f(ms)), ms);
});
