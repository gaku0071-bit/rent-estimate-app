const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const dom = new JSDOM(fs.readFileSync(path.join(__dirname, "index.html"), "utf8"), {
  runScripts: "outside-only", url: "http://127.0.0.1:8787/",
});
const { window } = dom;
const { document } = window;
window.structuredClone = structuredClone;
window.eval(fs.readFileSync(path.join(__dirname, "app.js"), "utf8"));
window.eval(fs.readFileSync(path.join(__dirname, "app-patch.js"), "utf8"));
const row = () => document.querySelector("#feeEditor").lastElementChild;
function edit(field, value) {
  const input = row().querySelector(`[data-field="${field}"]`);
  input.value = value;
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
}
const total = () => window.total();
const names = (fees) => fees.map((fee) => fee.label);

// A missed pet fee can be entered without any parser-supplied pet amount.
const before = total();
document.getElementById("addOptionalFeeButton").click();
assert.equal(document.activeElement, row().querySelector('[data-field="label"]'));
edit("label", "ペット礼金");
edit("amount", "86000");
assert.equal(row().querySelector('[data-field="type"]').value, "optional");
assert.equal(row().querySelector("[data-optional-include]").checked, false);
assert.equal(total(), before);
assert.ok(names(window.optionalRows()).includes("ペット礼金"));
row().querySelector("[data-optional-include]").click();
assert.equal(total(), before + 86000);
assert.ok(names(window.estimateRows()).includes("ペット礼金"));
assert.ok(!names(window.monthlySummaryRows()).includes("ペット礼金"));
assert.match(document.getElementById("shareText").value, /ペット礼金: 86,000円/);
edit("label", "ペット飼育時礼金");
assert.equal(total(), before + 86000);
row().querySelector("[data-optional-include]").click();
assert.equal(total(), before);

// Move-out and monthly optional charges retain their selected payment timing.
edit("label", "ペット消臭料");
edit("timing", "moveout");
row().querySelector("[data-optional-include]").click();
assert.equal(total(), before);
assert.ok(names(window.moveoutRows()).includes("ペット消臭料"));
edit("label", "ペット月額費用");
edit("amount", "2000");
edit("timing", "monthly");
assert.ok(names(window.monthlySummaryRows()).includes("ペット月額費用"));
row().querySelector("[data-optional-include]").click();
assert.ok(!names(window.monthlySummaryRows()).includes("ペット月額費用"));

// The original add-and-reclassify workflow must also work.
document.getElementById("addFeeButton").click();
edit("label", "追加ペット礼金");
edit("amount", "50000");
edit("type", "optional");
assert.equal(total(), before);
row().querySelector("[data-optional-include]").click();
assert.equal(total(), before + 50000);
document.getElementById("resetButton").click();
assert.equal(total(), 0);
assert.equal(window.optionalRows().length, 0);
console.log("Manual optional pet fees: passed");
