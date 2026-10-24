import test from "node:test";
import assert from "node:assert/strict";
import { mandatoryComputerOnly } from "./worker-live.js";

test("phone-supported research must not trigger a laptop blocker",()=>{
  assert.equal(mandatoryComputerOnly("You only need a smartphone. No laptop or desktop is required."),false);
  assert.equal(mandatoryComputerOnly("A smartphone or laptop is sufficient."),false);
  assert.equal(mandatoryComputerOnly("No computer is required."),false);
});
test("explicit mandatory laptop remains a blocker",()=>{
  assert.equal(mandatoryComputerOnly("A laptop is required to participate."),true);
  assert.equal(mandatoryComputerOnly("A desktop computer is mandatory."),true);
});
