const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  runScripts: "outside-only",
  url: "https://www.realnetpro.com/room_detail.php?id=2680768",
});
const { window } = dom;
let sentPayload = null;

const extracted = {
  property: { title: "バーニーズ クレール", room: "105" },
  base: { rent: 55000, commonFee: 4000, deposit: 0, keyMoney: 0 },
  guarantee: { alternatives: [], note: "" },
  fees: [
    { label: "エアコン分解清掃料", amount: 22000, timing: "initial", type: "initial", category: "acCleaningFee", optional: false, sourceSection: "初期費用", confidence: "high" },
    { label: "ペット飼育時礼金", amount: 55000, timing: "initial", type: "optional", category: "petFee", optional: true, sourceSection: "礼金備考", confidence: "high" },
  ],
  diagnostics: { warnings: [], unregisteredFees: [], sourceType: "realpro-public-room", sourceSections: [], recognizedFees: [], choiceFees: [], moveoutFees: [], monthlyFees: [] },
};

window.RealproEstimateParser = {
  extract() {
    return { extracted, estimateData: null };
  },
  toEstimateData(value) {
    return {
      source: "realpro-extension",
      version: 3,
      settings: {
        extraFees: value.fees.map((fee) => ({ ...fee })),
      },
    };
  },
};
window.chrome = {
  storage: {
    local: {
      get(_key, callback) { callback({}); },
      set(_value, callback) { callback?.(); },
    },
  },
  runtime: {
    sendMessage(message, callback) {
      sentPayload = message.payload;
      callback({ ok: true });
    },
  },
};

async function main() {
  window.eval(fs.readFileSync(path.join(__dirname, "realpro-estimate-extension", "realpro-content.js"), "utf8"));
  window.document.getElementById("rent-estimate-extension-button").click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  const feeCheckboxes = [...window.document.querySelectorAll("[data-fee-enabled]")];
  assert.equal(feeCheckboxes.length, 2);
  assert.equal(feeCheckboxes[0].checked, true);
  assert.equal(feeCheckboxes[1].checked, false);
  assert.match(feeCheckboxes[1].closest("label").textContent, /任意/);

  window.document.querySelector("[data-send]").click();
  assert.ok(sentPayload);
  assert.equal(sentPayload.settings.extraFees.length, 2);
  const pet = sentPayload.settings.extraFees.find((fee) => fee.label === "ペット飼育時礼金");
  assert.ok(pet);
  assert.equal(pet.includeInEstimate, false);

  console.log("Extension optional fee transfer: passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
