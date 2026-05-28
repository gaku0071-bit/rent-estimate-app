const sampleData = {
  property: {
    title: "アルファスクエア中島公園",
    room: "301（3階部分）",
    address: "北海道札幌市中央区南八条西６丁目423-54",
    access: "地下南北線「中島公園」徒歩6分 / 札幌市電「山鼻９条」徒歩2分",
    structure: "鉄筋コンクリート造 地上10階 総戸数54戸",
    layout: "2LDK[LDK9.8×洋4.9×洋5.9]",
    area: "49.44㎡",
    built: "2024年03月",
    moveIn: "2026年5月26日 / 清掃中",
    inquiry: "0665-00301",
    freeRent: "無条件FR2か月対象",
  },
  amounts: {
    rent: 120000,
    commonFee: 7000,
    deposit: 120000,
    keyMoney: 0,
    brokerageFee: 132000,
    keyFee: 9900,
    cleaningFee: 44000,
    insuranceFee: 20000,
    townFee: 300,
    supportFee: 1430,
    monthlyGuaranteeFee: 0,
    gasLeaseFee: 1595,
    parkingFee: 27500,
    acCleaningFee: 16500,
    stoveMaintenanceFee: 0,
    guaranteePersonal: 65163,
    guaranteeCorporate: 0,
  },
  settings: {
    depositText: "1ヶ月",
    guaranteeNote: "保証会社利用必須 ROOM iD(エポスカード)利用可。初回保証料は月額家賃等の50%、月次保証料は1.5%。大手法人は不要",
    guaranteeMode: "percent",
    monthlyGuaranteeMode: "percent",
    monthlyGuaranteeRate: 1.5,
    includeParking: false,
    includeAcCleaning: true,
    issueDate: "2026/05/17",
  },
};

const state = {
  estimateType: "personal",
  fees: [],
  lastData: null,
  csvRows: [],
  filteredCsvRows: [],
};

const feeDefinitions = [
  ["賃料", "rent", "monthly", true, "monthly"],
  ["共益費・管理費", "commonFee", "monthly", true, "monthly"],
  ["敷金", "deposit", "initial", false, "initial"],
  ["礼金", "keyMoney", "initial", false, "initial"],
  ["仲介手数料", "brokerageFee", "initial", false, "initial"],
  ["初回保証料", "guaranteePersonal", "personal", false, "initial"],
  ["保険料（2年）", "insuranceFee", "initial", false, "initial"],
  ["室内清掃費用", "cleaningFee", "initial", false, "initial"],
  ["水廻り消毒料", "waterSanitizingFee", "initial", false, "initial"],
  ["カギ交換費用", "keyFee", "initial", false, "initial"],
  ["抗菌施工料", "antibacterialFee", "initial", false, "initial"],
  ["24時間管理料", "supportFee", "monthly", true, "monthly"],
  ["月額保証料", "monthlyGuaranteeFee", "monthly", false, "monthly"],
  ["町内会費", "townFee", "monthly", true, "monthly"],
  ["北ガス給湯器リース料", "gasLeaseFee", "monthly", true, "monthly"],
  ["エアコン洗浄料", "acCleaningFee", "optionalAc", false, "initial"],
  ["ストーブ整備料", "stoveMaintenanceFee", "initial", false, "initial"],
  ["ペット消臭料", "deodorizingFee", "optionalPet", false, "moveout"],
  ["ペット関連費用", "petFee", "optionalPet", false, "initial"],
  ["エコジョーズ水落費用", "waterDrainFee", "initial", false, "moveout"],
  ["駐車場", "parkingFee", "optionalParking", false, "monthly"],
];

const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

function el(id) {
  return document.getElementById(id);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateForInput(value) {
  const match = String(value || "").match(/(\d{4})[年/](\d{1,2})[月/](\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function numberValue(id) {
  return Number(el(id).value || 0);
}

function textValue(id) {
  return el(id).value.trim();
}

function setFeeAmount(id, amount) {
  const fee = state.fees.find((item) => item.id === id);
  if (fee) fee.amount = amount;
}

function setFeeTiming(id, timing) {
  const fee = state.fees.find((item) => item.id === id);
  if (fee) fee.timing = timing;
}

function setFeeLabel(id, label) {
  const fee = state.fees.find((item) => item.id === id);
  if (fee && label) fee.label = label;
}

function parseCsvText(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function csvRowsToObjects(rows) {
  const headerIndex = rows.findIndex((row) => row.includes("物件") && row.includes("号室") && row.includes("家賃"));
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map((header) => header.trim());
  return rows
    .slice(headerIndex + 1)
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, (row[index] || "").trim()])))
    .filter((item) => item["物件"] || item["住所"] || item["号室"]);
}

function moneyFromManYen(value) {
  const text = String(value || "").replaceAll(",", "").trim();
  if (!text || text === "---" || text === "なし") return 0;
  const number = Number(text.match(/-?\d+(?:\.\d+)?/)?.[0] || 0);
  return Math.round(number * 10000);
}

function monthValueToAmount(value, rent) {
  const text = String(value || "").trim();
  if (!text || text === "---" || text === "なし") return 0;
  const month = Number(text.match(/(-?\d+(?:\.\d+)?)\s*月/)?.[1] || "");
  if (!Number.isNaN(month) && month > 0) return Math.round(rent * month);
  if (/円/.test(text)) return moneyToInt(text);
  return 0;
}

function moneyToInt(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function amountNear(text, pattern) {
  const match = String(text || "").match(pattern);
  if (!match) return 0;
  const amounts = match[0].match(/[\d,，]+円/g) || [];
  return amounts.length ? moneyToInt(amounts.at(-1)) : 0;
}

function inferPaymentTiming(text, fallback = "initial") {
  const value = String(text || "");
  const hasInitial = value.includes("契約時");
  const hasMoveout = value.includes("退去時");
  if ((hasInitial && hasMoveout) || value.includes("退去時払い可")) return "choice";
  if (value.includes("月額")) return "monthly";
  if (hasMoveout) return "moveout";
  return fallback;
}

function fixedGuaranteeAmount(text) {
  const value = String(text || "");
  const patterns = [
    /(?:初回保証料|保証料|保証委託料|保証会社事務手数料)[^。・\n\r%]{0,40}?一律\s*[:：]?\s*[\d,，]+円/g,
    /一律\s*[\d,，]+円[^。・\n\r%]{0,40}?(?:初回保証料|保証料|保証委託料|保証会社)/g,
    /(?:初回保証料|保証会社事務手数料|保証委託料)[^。・\n\r%]{0,40}?[\d,，]+円/g,
  ];
  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      const chunk = value.slice(Math.max(0, match.index - 4), match.index + match[0].length);
      if (/月額|月次|毎月|更新|年間/.test(chunk) && !/初回|新規契約時/.test(chunk)) continue;
      const amount = moneyToInt(match[0]);
      if (amount) return amount;
    }
  }
  return 0;
}

function nonCustomerFeeLabel(label) {
  return /契約事務手数料|契約時事務手数料|事務手数料|契約手数料|書類作成|更新料|キャンセル|広告料|AD|仲介手数料|保証会社|保証料|保険/.test(label);
}

function genericFeeType(timing) {
  return timing === "monthly" ? "monthly" : "initial";
}

function feeLabelExists(label) {
  return state.fees.some((fee) => normalizeMatchText(fee.label) === normalizeMatchText(label));
}

function addExtraFee(fee) {
  if (!fee?.label || !Number(fee.amount || 0) || feeLabelExists(fee.label) || nonCustomerFeeLabel(fee.label)) return false;
  state.fees.push({
    id: fee.id || `extra-${Date.now()}-${state.fees.length}`,
    label: fee.label,
    amount: Number(fee.amount || 0),
    type: fee.type || genericFeeType(fee.timing),
    timing: fee.timing || "initial",
    guaranteeTarget: Boolean(fee.guaranteeTarget),
    noProrate: Boolean(fee.noProrate),
    derived: false,
  });
  return true;
}

function extractUnregisteredFeesFromText(text) {
  const value = String(text || "").replace(/\n/g, "");
  const knownWords = [
    "賃料",
    "共益費",
    "管理費",
    "敷金",
    "礼金",
    "町内会費",
    "町会費",
    "保険",
    "初回保証料",
    "月額保証料",
    "カギ",
    "鍵",
    "カードキー",
    "シリンダ",
    "清掃",
    "クリーニング",
    "抗菌",
    "除菌",
    "消毒",
    "サポート",
    "水道",
  ];
  const extras = [];
  const seen = new Set();
  const pattern = /(?:^|・|○\s*)([^・：:\n]{2,36}?)[：:]\s*([^・]{0,48}?)([\d,，]+)\s*円([^・]{0,48})/g;
  for (const match of value.matchAll(pattern)) {
    const label = match[1].replace(/\s+/g, "").replace(/[・:：、。]+$/g, "");
    const context = match.slice(1).join("");
    const amount = moneyToInt(match[3]);
    if (!label || !amount || /無し|なし|不要/.test(context)) continue;
    if (nonCustomerFeeLabel(label)) continue;
    if (knownWords.some((word) => label.includes(word) || word.includes(label))) continue;
    const timing = inferPaymentTiming(context);
    const key = `${label}-${amount}-${timing}`;
    if (seen.has(key)) continue;
    seen.add(key);
    extras.push({ label, amount, timing, type: genericFeeType(timing), noProrate: timing === "monthly" });
  }
  return extras;
}

function parkingAmount(value) {
  const text = String(value || "");
  if (!text || /無し|なし|満車|---|無料/.test(text)) return 0;
  return moneyToInt(text);
}

function normalizeBuilt(value) {
  const text = String(value || "").trim();
  const match = text.match(/(\d{4})[/.年](\d{1,2})/);
  if (!match) return text;
  return `${match[1]}年${match[2].padStart(2, "0")}月`;
}

function csvOptionLabel(item) {
  return `${item["物件"] || "物件名なし"} ${item["号室"] || ""} / ${item["住所"] || ""}`;
}

function normalizeMatchText(value) {
  return String(value || "")
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, "")
    .replace(/[・･\-.．ー‐]/g, "")
    .toLowerCase();
}

function normalizeRoom(value) {
  return String(value || "").match(/[A-Za-z]?\d+[A-Za-z]?/)?.[0]?.toLowerCase() || "";
}

function matchingCsvItem() {
  if (!state.csvRows.length) return null;
  const title = normalizeMatchText(textValue("propertyTitle") || state.property?.title);
  const room = normalizeRoom(textValue("room") || state.property?.room);
  if (!title) return null;
  const titleMatches = state.csvRows.filter((item) => normalizeMatchText(item["物件"]) === title);
  if (room) {
    const exact = titleMatches.find((item) => normalizeRoom(item["号室"]) === room);
    if (exact) return exact;
  }
  return titleMatches.length === 1 ? titleMatches[0] : null;
}

function selectedCsvItem() {
  const index = Number(el("csvSelect").value);
  return state.filteredCsvRows[index] || null;
}

function renderCsvSelector() {
  const query = textValue("csvSearch").toLowerCase();
  state.filteredCsvRows = state.csvRows
    .filter((item) => csvOptionLabel(item).toLowerCase().includes(query))
    .slice(0, 300);

  el("csvSelect").innerHTML = state.filteredCsvRows
    .map((item, index) => `<option value="${index}">${escapeHtml(csvOptionLabel(item))}</option>`)
    .join("");
  renderCsvPreview();
}

function renderCsvPreview() {
  const item = selectedCsvItem();
  el("csvPreview").innerHTML = item
    ? `
      <strong>${escapeHtml(item["物件"] || "-")} ${escapeHtml(item["号室"] || "")}</strong><br>
      ${escapeHtml(item["住所"] || "-")} / ${escapeHtml(item["交通"] || "-")}<br>
      家賃 ${escapeHtml(item["家賃"] || "-")}万円・管理費 ${escapeHtml(item["管理費"] || "-")}万円・敷 ${escapeHtml(item["敷"] || "-")}・礼 ${escapeHtml(item["礼"] || "-")}・駐車場 ${escapeHtml(item["P"] || "-")}
    `
    : "該当する物件がありません。";
}

function applyCsvItem(item) {
  if (!item) return;
  const rent = moneyFromManYen(item["家賃"]);
  const commonFee = moneyFromManYen(item["管理費"]);
  const parkingFee = parkingAmount(item["P"]);

  el("propertyTitle").value = item["物件"] || "";
  el("room").value = item["号室"] || "";
  el("address").value = item["住所"] || "";
  el("access").value = item["交通"] || "";
  el("layout").value = item["間取"] || "";
  el("area").value = item["広さ"] ? `${item["広さ"]}㎡` : "";
  el("built").value = normalizeBuilt(item["築年"]);

  state.property = {
    ...(state.property || {}),
    title: item["物件"] || "",
    room: item["号室"] || "",
    address: item["住所"] || "",
    access: item["交通"] || "",
    layout: item["間取"] || "",
    area: item["広さ"] ? `${item["広さ"]}㎡` : "",
    built: normalizeBuilt(item["築年"]),
    moveIn: item["現況"] || state.property?.moveIn || "",
  };

  setFeeAmount("rent", rent);
  setFeeAmount("commonFee", commonFee);
  setFeeAmount("deposit", monthValueToAmount(item["敷"], rent));
  setFeeAmount("keyMoney", monthValueToAmount(item["礼"], rent));
  setFeeAmount("parkingFee", parkingFee);
  el("includeParking").checked = parkingFee > 0;
  el("includePetFee").checked = false;

  syncDerivedFees();
  renderGuaranteeTargets();
  updateGuaranteeFeeInput();
  renderFeeEditor();
  renderEstimate();
}

function applyCsvEnhancement(item) {
  if (!item) return [];
  const notes = `${item["備考"] || ""}\n${item["現況"] || ""}`;
  const applied = [];

  const keyFee = amountNear(notes, /(?:カギ|鍵|カードキー|シリンダー|シリンダ)[^。・\n\r]*?[\d,，]+円/);
  if (keyFee) {
    setFeeAmount("keyFee", keyFee);
    setFeeLabel("keyFee", /カードキー/.test(notes) ? "カードキー設定料" : /シリンダー/.test(notes) ? "シリンダー交換料" : "カギ交換費用");
    setFeeTiming("keyFee", inferPaymentTiming(notes));
    applied.push("鍵交換");
  }

  const antibacterialFee = amountNear(notes, /(?:抗菌施工料|抗菌施工費|抗菌処理料|抗菌処理費|抗菌消臭料|抗菌消臭費|室内抗菌料|室内抗菌費|除菌施工料|除菌施工費|除菌消臭料|除菌消臭費|室内消毒料|室内消毒費)[^。・\n\r]*?[\d,，]+円/);
  if (antibacterialFee) {
    setFeeAmount("antibacterialFee", antibacterialFee);
    setFeeLabel("antibacterialFee", /除菌/.test(notes) ? "除菌施工料" : /消毒/.test(notes) ? "室内消毒料" : "抗菌施工料");
    setFeeTiming("antibacterialFee", inferPaymentTiming(notes));
    applied.push("抗菌施工料");
  }

  const acCleaningFee = amountNear(notes, /(?:エアコン洗浄料|エアコン清掃料|エアコン清掃|エアコン整備料|エアコン分解清掃料|エアコン分解整備料|エアコンクリーニング|エアコンクリーニング代)[^。・\n\r]*?[\d,，]+円/);
  if (acCleaningFee) {
    setFeeAmount("acCleaningFee", acCleaningFee);
    setFeeLabel("acCleaningFee", /分解整備/.test(notes) ? "エアコン分解整備料" : /分解清掃/.test(notes) ? "エアコン分解清掃料" : "エアコン清掃料");
    setFeeTiming("acCleaningFee", inferPaymentTiming(notes));
    applied.push("エアコン清掃");
  }

  const stoveFee = amountNear(notes, /(?:ストーブ整備料|暖房整備料|暖房分解清掃料|暖房分解清掃料金|冷暖房機器清掃料|冷暖房機器清掃費|FF分解清掃料|FF分解清掃費|FF分解清掃費用|FFストーブ分解清掃料)[^。・\n\r]*?[\d,，]+円/);
  if (stoveFee) {
    setFeeAmount("stoveMaintenanceFee", stoveFee);
    setFeeLabel("stoveMaintenanceFee", /FF/.test(notes) ? "FF分解清掃料" : "暖房分解清掃料");
    setFeeTiming("stoveMaintenanceFee", inferPaymentTiming(notes));
    applied.push("暖房・ストーブ整備");
  }

  const deodorizingFee = amountNear(notes, /(?:退去時ペット消臭料|退去時消臭料|ペット消臭料|ペット消臭費|ペット消臭代|消臭料|消臭費)[^。・\n\r]*?[\d,，]+円/);
  if (deodorizingFee) {
    setFeeAmount("deodorizingFee", deodorizingFee);
    setFeeLabel("deodorizingFee", /ペット/.test(notes) ? "ペット消臭料" : "消臭料");
    setFeeTiming("deodorizingFee", inferPaymentTiming(notes, "moveout"));
    applied.push("消臭料");
  }

  const petFee = amountNear(notes, /(?:ペット礼金|ペット飼育時礼金|ペット飼育料|ペット飼育費|ペット飼育時費用|ペット一時金|ペット清掃料|ペット清掃費|ペット消毒料|ペット消毒費)[^。・\n\r]*?[\d,，]+円/);
  if (petFee) {
    setFeeAmount("petFee", petFee);
    setFeeLabel(
      "petFee",
      /ペット飼育時礼金|ペット礼金/.test(notes) ? "ペット礼金" : /清掃/.test(notes) ? "ペット清掃料" : /消毒/.test(notes) ? "ペット消毒料" : "ペット関連費用",
    );
    setFeeTiming("petFee", inferPaymentTiming(notes));
    applied.push("ペット関連費用");
  }

  const waterDrainFee = amountNear(notes, /(?:退去時エコジョーズ水落費用|エコジョーズ水落費用|水落費用|水落し費用|水抜き費用)[^。・\n\r]*?[\d,，]+円/);
  if (waterDrainFee) {
    setFeeAmount("waterDrainFee", waterDrainFee);
    setFeeLabel("waterDrainFee", /エコジョーズ/.test(notes) ? "エコジョーズ水落費用" : "水落費用");
    setFeeTiming("waterDrainFee", inferPaymentTiming(notes, "moveout"));
    applied.push("水落費用");
  }

  const cleaningFee = amountNear(notes, /(?:室内清掃料|室内清掃費|退去時室内清掃料|退去時清掃料|退去時清掃費|ハウスクリーニング料?|ルームクリーニング費用|ルームクリーニング料|ルームクリーニング費|ルームクリーニング|るーむくりーにんぐ費用|るーむくりーにんぐ料|るーむくりーにんぐ費|家電清掃料|清掃料)[^。・\n\r]*?[\d,，]+円/);
  if (cleaningFee) {
    setFeeAmount("cleaningFee", cleaningFee);
    setFeeLabel("cleaningFee", /ルームクリーニング|るーむくりーにんぐ/.test(notes) ? "ルームクリーニング費用" : /クリーニング/.test(notes) ? "ハウスクリーニング" : "清掃料");
    setFeeTiming("cleaningFee", inferPaymentTiming(notes));
    applied.push("清掃料");
  }

  const waterSanitizingFee = amountNear(notes, /(?:退去時水廻消毒料|退去時水廻り消毒料|退去時水回消毒料|退去時水回り消毒料|水廻り?消毒料|水回り?消毒料|水廻り?消毒費|水回り?消毒費|水廻り?消毒料金|水回り?消毒料金|水廻り?消毒量)[^。・\n\r]*?[\d,，]+円/);
  if (waterSanitizingFee) {
    setFeeAmount("waterSanitizingFee", waterSanitizingFee);
    setFeeLabel("waterSanitizingFee", "水廻り消毒料");
    setFeeTiming("waterSanitizingFee", inferPaymentTiming(notes));
    applied.push("水廻り消毒料");
  }

  const supportFee = amountNear(notes, /(?:24時間管理料|24時間管理費|24時間サポート料|24時間サポート費|シャーメゾンSUPPORT24|ギムサポートクラブ|リペアサービス|夜間サポート|24時間サポート|安心サポート|緊急サポート|新生活サポート|暮らしサポート|ライフサポート|管理サポート)[^。・\n\r]*?[\d,，]+円/);
  if (supportFee) {
    setFeeAmount("supportFee", supportFee);
    setFeeLabel("supportFee", /シャーメゾン/.test(notes) ? "シャーメゾンSUPPORT24" : /ギム/.test(notes) ? "ギムサポートクラブ" : /リペア/.test(notes) ? "リペアサービス" : "24時間サポート");
    setFeeTiming("supportFee", "monthly");
    applied.push("24時間系");
  }

  const waterFee = amountNear(notes, /(?:水道料金|水道料|定額水道料|上下水道料)[^。・\n\r]*?[\d,，]+円/);
  if (waterFee) {
    setFeeAmount("gasLeaseFee", waterFee);
    setFeeLabel("gasLeaseFee", /定額/.test(notes) ? "定額水道料" : "水道料");
    setFeeTiming("gasLeaseFee", "monthly");
    applied.push("水道料");
  }

  const fixedGuarantee = fixedGuaranteeAmount(notes);
  const compactNotes = notes.replace(/(?<=[\d.])\s+(?=\d)/g, "");
  if (fixedGuarantee) {
    state.settings.guaranteeMode = "fixed";
    state.settings.guaranteeRate = 0;
    setFeeAmount("guaranteePersonal", fixedGuarantee);
    setFeeLabel("guaranteePersonal", "初回保証料");
    applied.push("初回保証料");
  } else {
    const initialRate = Number(compactNotes.match(/初回保証料[^%\d]*(\d+(?:\.\d+)?)(?:%|パーセント)/)?.[1] || 0);
    if (initialRate) {
      state.settings.guaranteeMode = "percent";
      state.settings.guaranteeRate = initialRate;
      el("guaranteeRate").value = initialRate;
      applied.push(`初回保証料${initialRate}%`);
    }
  }

  const monthlyRate = Number(compactNotes.match(/(?:月額手数料|月額保証料|月次保証料|支払手数料|月々)[^%\d]*(\d+(?:\.\d+)?)(?:%|パーセント)/)?.[1] || 0);
  const monthlyFixed =
    amountNear(notes, /(?:月額手数料|月額保証料|月次保証料|月額事務手数料|収納代行手数料|支払手数料|口座振替料|口振手数料)[^。・\n\r]*?[\d,，]+円/) ||
    amountNear(notes, /月額\s*[:：]?\s*[\d,，]+円/);
  const monthlyFixedExtras = [...notes.matchAll(/(?:\+|＋)\s*[^+＋\d円]{0,16}?([\d,，]+)\s*円/g)].reduce((sum, match) => sum + moneyToInt(match[1]), 0);
  if (monthlyRate) {
    state.settings.monthlyGuaranteeMode = "percent";
    state.settings.monthlyGuaranteeRate = monthlyRate;
    state.settings.monthlyGuaranteeFixedExtra = monthlyFixedExtras;
    setFeeLabel("monthlyGuaranteeFee", monthlyFixedExtras ? `月額保証料（${monthlyRate}%＋${yen.format(monthlyFixedExtras)}）` : `月額保証料（${monthlyRate}%）`);
    setFeeTiming("monthlyGuaranteeFee", "monthly");
    applied.push("月額保証料");
  } else if (monthlyFixed) {
    state.settings.monthlyGuaranteeMode = "fixed";
    state.settings.monthlyGuaranteeFixedExtra = 0;
    setFeeAmount("monthlyGuaranteeFee", monthlyFixed);
    setFeeLabel("monthlyGuaranteeFee", /収納代行/.test(notes) ? "収納代行手数料" : /支払/.test(notes) ? "支払手数料" : /口/.test(notes) ? "口座振替料" : "月額保証料");
    setFeeTiming("monthlyGuaranteeFee", "monthly");
    applied.push("月額保証料");
  } else if (/月額手数料や更新料はありません|月額手数料なし|月額保証料なし/.test(notes)) {
    state.settings.monthlyGuaranteeMode = "fixed";
    state.settings.monthlyGuaranteeFixedExtra = 0;
    setFeeAmount("monthlyGuaranteeFee", 0);
    applied.push("月額保証料なし");
  }

  extractUnregisteredFeesFromText(notes).forEach((fee) => {
    if (addExtraFee(fee)) applied.push(fee.label);
  });

  syncDerivedFees();
  renderGuaranteeTargets();
  updateGuaranteeFeeInput();
  renderFeeEditor();
  renderEstimate();
  return applied;
}

function enhanceFromCsvMatch() {
  const item = matchingCsvItem();
  const applied = applyCsvEnhancement(item);
  return { item, applied };
}

function syncProrateFromMoveInDate() {
  const value = el("moveInDate").value;
  if (!value) {
    el("prorateDays").value = 0;
    return;
  }

  const [year, month, day] = value.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  el("monthDays").value = daysInMonth;
  el("prorateDays").value = Math.max(daysInMonth - day + 1, 0);
}

function resetToBlank() {
  state.estimateType = "personal";
  state.property = {};
  state.settings = {};
  state.fees = [];
  document.querySelectorAll("[data-estimate-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.estimateType === "personal");
  });
  [
    "recipientName",
    "propertyTitle",
    "room",
    "address",
    "access",
    "layout",
    "area",
    "built",
    "inquiry",
    "issueDate",
    "moveInDate",
    "freeRentStart",
    "freeRentEnd",
  ].forEach((id) => {
    el(id).value = "";
  });
  el("prorateDays").value = 0;
  el("monthDays").value = 30;
  el("guaranteeRate").value = 50;
  el("includeParking").checked = false;
  el("includeAcCleaning").checked = false;
  el("includePetFee").checked = false;
  el("includeFreeRentNote").checked = false;
  el("pdfInput").value = "";
  el("csvInput").value = "";
  el("csvSearch").value = "";
  state.csvRows = [];
  state.filteredCsvRows = [];
  el("csvPanel").hidden = true;
  renderGuaranteeTargets();
  renderFeeEditor();
  renderEstimate();
}

function loadData(data) {
  state.lastData = structuredClone(data);
  const { property, amounts, settings } = data;
  state.estimateType = "personal";
  document.querySelectorAll("[data-estimate-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.estimateType === "personal");
  });
  el("recipientName").value = "お客様";
  el("prorateDays").value = 0;
  el("monthDays").value = 30;
  el("guaranteeRate").value = 50;
  el("propertyTitle").value = property.title || "";
  el("room").value = property.room || "";
  el("address").value = property.address || "";
  el("access").value = property.access || "";
  el("layout").value = property.layout || "";
  el("area").value = property.area || "";
  el("built").value = property.built || "";
  el("inquiry").value = property.inquiry || "";
  el("issueDate").value = dateForInput(settings.issueDate) || today();
  el("moveInDate").value = dateForInput(property.moveIn);
  el("freeRentStart").value = "";
  el("freeRentEnd").value = "";
  syncProrateFromMoveInDate();
  el("includeParking").checked = Boolean(settings.includeParking);
  el("includeAcCleaning").checked = Boolean(settings.includeAcCleaning);
  el("includePetFee").checked = Boolean(settings.includePetFee);

  state.property = property;
  state.settings = settings;
  state.fees = feeDefinitions.map(([label, key, type, guaranteeTarget, timing]) => ({
    id: key,
    label: settings.feeLabels?.[key] || label,
    amount: amounts[key] || 0,
    type,
    timing: settings.feeTimings?.[key] || timing,
    guaranteeTarget,
    derived: ["guaranteePersonal", "brokerageFee"].includes(key) || (key === "monthlyGuaranteeFee" && settings.monthlyGuaranteeMode === "percent"),
  }));
  (settings.extraFees || []).forEach((fee) => addExtraFee(fee));
  syncDerivedFees();
  renderGuaranteeTargets();
  renderFeeEditor();
  renderEstimate();
}

function applicableFee(fee) {
  if (isPetRelatedFee(fee)) return el("includePetFee").checked;
  if (fee.type === "personal") return state.estimateType === "personal";
  if (fee.type === "corporate") return state.estimateType === "corporate";
  if (fee.type === "optionalParking") return el("includeParking").checked;
  if (fee.type === "optionalAc") return el("includeAcCleaning").checked;
  return true;
}

function isPetRelatedFee(fee) {
  return fee.type === "optionalPet" || /ペット/.test(fee.label || "");
}

function feeKindLabel(type) {
  return {
    initial: "契約時",
    monthly: "月額",
    personal: "個人",
    corporate: "法人",
    optionalParking: "月額",
    optionalAc: "任意",
    optionalPet: "任意",
    discount: "控除",
  }[type] || "契約時";
}

function timingLabel(timing) {
  return {
    initial: "契約時",
    monthly: "月額",
    moveout: "退去時",
    choice: "要選択",
  }[timing] || "契約時";
}

function timingOptions() {
  return ["choice", "initial", "monthly", "moveout"];
}

function timingChoiceFees() {
  return state.fees.filter((fee) => fee.timing === "choice" && Number(fee.amount || 0) !== 0);
}

function guaranteeCandidate(fee) {
  return fee.id !== "monthlyGuaranteeFee" && ["monthly", "optionalParking"].includes(fee.type);
}

function guaranteeBaseRows() {
  return state.fees.filter((fee) => guaranteeCandidate(fee) && fee.guaranteeTarget && applicableFee(fee));
}

function guaranteeBaseTotal() {
  return guaranteeBaseRows().reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
}

function guaranteeAmount() {
  if (state.settings?.guaranteeMode === "fixed") {
    const guaranteeFee = state.fees.find((fee) => fee.id === "guaranteePersonal");
    return Number(guaranteeFee?.amount || 0);
  }
  return Math.round(guaranteeBaseTotal() * (numberValue("guaranteeRate") / 100));
}

function syncGuaranteeFee() {
  const guaranteeFee = state.fees.find((fee) => fee.id === "guaranteePersonal");
  if (guaranteeFee && state.settings?.guaranteeMode !== "fixed") {
    guaranteeFee.amount = guaranteeAmount();
  }
}

function syncBrokerageFee() {
  const rentFee = state.fees.find((fee) => fee.id === "rent");
  const brokerageFee = state.fees.find((fee) => fee.id === "brokerageFee");
  if (brokerageFee) {
    brokerageFee.amount = Math.round(Number(rentFee?.amount || 0) * 1.1);
  }
}

function syncMonthlyGuaranteeFee() {
  if (state.settings?.monthlyGuaranteeMode !== "percent") return;
  const monthlyGuaranteeFee = state.fees.find((fee) => fee.id === "monthlyGuaranteeFee");
  const rate = Number(state.settings?.monthlyGuaranteeRate || 0);
  const fixedExtra = Number(state.settings?.monthlyGuaranteeFixedExtra || 0);
  if (monthlyGuaranteeFee && rate) {
    monthlyGuaranteeFee.amount = Math.round(guaranteeBaseTotal() * (rate / 100)) + fixedExtra;
  }
}

function syncDerivedFees() {
  syncMonthlyGuaranteeFee();
  syncGuaranteeFee();
  syncBrokerageFee();
}

function updateGuaranteeFeeInput() {
  ["guaranteePersonal", "brokerageFee", "monthlyGuaranteeFee"].forEach((id) => {
    const index = state.fees.findIndex((fee) => fee.id === id);
    if (index < 0) return;
    const input = document.querySelector(`[data-field="amount"][data-index="${index}"]`);
    if (input) {
      input.value = state.fees[index].amount;
    }
  });
}

function moveInDateParts() {
  const value = el("moveInDate").value;
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

function parseDateInput(id) {
  const value = el(id).value;
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function monthEndDate(year, month) {
  return new Date(year, month, 0);
}

function monthStartDate(year, month) {
  return new Date(year, month - 1, 1);
}

function overlapDays(startA, endA, startB, endB) {
  const start = new Date(Math.max(startA.getTime(), startB.getTime()));
  const end = new Date(Math.min(endA.getTime(), endB.getTime()));
  if (end < start) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

function freeRentRange() {
  const start = parseDateInput("freeRentStart");
  const end = parseDateInput("freeRentEnd");
  if (!start || !end || end < start) return null;
  return { start, end };
}

function shouldIncludeNextMonthRent() {
  const parts = moveInDateParts();
  return parts ? parts.day >= 15 : false;
}

function skipProration(fee) {
  return Boolean(fee.noProrate) || ["supportFee", "townFee", "gasLeaseFee"].includes(fee.id);
}

function estimateMonthlyChargeFee(fee) {
  return ["monthly", "optionalParking"].includes(fee.type) && fee.id !== "monthlyGuaranteeFee";
}

function proratedRows() {
  const days = numberValue("prorateDays");
  const monthDays = Math.max(numberValue("monthDays"), 1);
  if (!days) return [];
  return state.fees
    .filter((fee) => estimateMonthlyChargeFee(fee) && applicableFee(fee) && !skipProration(fee))
    .map((fee) => ({
      label: `${fee.label} 日割（${days}/${monthDays}）`,
      amount: Math.round((fee.amount * days) / monthDays),
      type: "prorate",
      timing: "initial",
      sourceId: fee.id,
      rowKind: "prorate",
    }));
}

function freeRentTargetFees() {
  return state.fees.filter((fee) => ["rent", "commonFee"].includes(fee.id) && applicableFee(fee));
}

function freeRentDeductionRows() {
  const range = freeRentRange();
  const moveIn = moveInDateParts();
  if (!range || !moveIn) return [];

  const periods = [
    {
      label: "入居月",
      start: new Date(moveIn.year, moveIn.month - 1, moveIn.day),
      end: monthEndDate(moveIn.year, moveIn.month),
      monthDays: new Date(moveIn.year, moveIn.month, 0).getDate(),
    },
  ];

  if (shouldIncludeNextMonthRent()) {
    const nextMonthStart = addDays(monthEndDate(moveIn.year, moveIn.month), 1);
    periods.push({
      label: "翌月",
      start: nextMonthStart,
      end: monthEndDate(nextMonthStart.getFullYear(), nextMonthStart.getMonth() + 1),
      monthDays: new Date(nextMonthStart.getFullYear(), nextMonthStart.getMonth() + 1, 0).getDate(),
    });
  }

  return freeRentTargetFees().flatMap((fee) =>
    periods
      .map((period) => {
        const days = overlapDays(period.start, period.end, range.start, range.end);
        return {
          label: `${fee.label} フリーレント控除（${period.label} ${days}日）`,
          amount: -Math.round((Number(fee.amount || 0) * days) / period.monthDays),
          type: "discount",
          timing: "initial",
          sourceId: fee.id,
          rowKind: "discount",
        };
      })
      .filter((row) => row.amount !== 0),
  );
}

function nextMonthRows() {
  if (!shouldIncludeNextMonthRent()) return [];
  return state.fees
    .filter((fee) => estimateMonthlyChargeFee(fee) && applicableFee(fee))
    .map((fee) => ({
      ...fee,
      label: `${fee.label} 翌月分`,
      timing: "initial",
      sourceId: fee.id,
      rowKind: "nextMonth",
    }));
}

function monthlyFullRows() {
  if (!moveInDateParts()) return [];
  return state.fees
    .filter((fee) => estimateMonthlyChargeFee(fee) && applicableFee(fee) && skipProration(fee))
    .map((fee) => ({
      ...fee,
      label: `${fee.label} 入居月分`,
      timing: "initial",
      sourceId: fee.id,
      rowKind: "monthlyFull",
    }));
}

function estimateRowOrder(row) {
  const id = row.sourceId || row.id;
  const kind = row.rowKind || "base";
  const baseOrder = {
    deposit: 10,
    keyMoney: 20,
    rent: 30,
    commonFee: 31,
    gasLeaseFee: 32,
    supportFee: 33,
    townFee: 34,
    monthlyGuaranteeFee: 35,
    cleaningFee: 50,
    waterSanitizingFee: 51,
    acCleaningFee: 52,
    stoveMaintenanceFee: 53,
    deodorizingFee: 54,
    petFee: 55,
    waterDrainFee: 56,
    keyFee: 60,
    antibacterialFee: 61,
    insuranceFee: 70,
    guaranteePersonal: 80,
    brokerageFee: 90,
    parkingFee: 36,
  };
  const kindOffset = {
    base: 0,
    prorate: 0,
    nextMonth: 10,
    monthlyFull: 20,
    discount: 25,
  };
  return (baseOrder[id] ?? 500) + (kindOffset[kind] ?? 0);
}

function estimateRows() {
  syncDerivedFees();
  const hasMoveInDate = Boolean(moveInDateParts());
  const baseRows = state.fees.filter((fee) => applicableFee(fee) && fee.timing !== "moveout" && fee.id !== "monthlyGuaranteeFee" && (!hasMoveInDate || !["monthly", "optionalParking"].includes(fee.type)));
  const monthlyRows = hasMoveInDate ? nextMonthRows() : [];
  return [...baseRows, ...proratedRows(), ...monthlyRows, ...monthlyFullRows(), ...freeRentDeductionRows()]
    .filter((fee) => fee.amount !== 0)
    .sort((a, b) => estimateRowOrder(a) - estimateRowOrder(b));
}

function total() {
  return estimateRows().reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
}

function monthlySummaryRows() {
  return state.fees.filter((fee) => ["monthly", "optionalParking"].includes(fee.type) && applicableFee(fee) && Number(fee.amount || 0) !== 0);
}

function monthlySummaryTotal() {
  return monthlySummaryRows().reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
}

function moveoutRows() {
  return state.fees.filter((fee) => applicableFee(fee) && fee.timing === "moveout" && Number(fee.amount || 0) !== 0);
}

function moveoutTotal() {
  return moveoutRows().reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
}

function renderFeeEditor() {
  const wrap = el("feeEditor");
  const notice = el("timingNotice");
  const choiceFees = timingChoiceFees();
  notice.hidden = choiceFees.length === 0;
  notice.textContent = choiceFees.length
    ? `支払時期の選択が必要です: ${choiceFees.map((fee) => fee.label).join("、")}`
    : "";
  wrap.innerHTML = "";
  state.fees.forEach((fee, index) => {
    const row = document.createElement("div");
    row.className = `fee-row ${fee.timing === "choice" ? "needs-timing" : ""}`;
    row.innerHTML = `
      <input aria-label="項目名" value="${escapeHtml(fee.label)}" data-field="label" data-index="${index}">
      <input aria-label="金額" type="number" value="${fee.amount}" data-field="amount" data-index="${index}" ${fee.derived ? "readonly" : ""}>
      <select aria-label="支払時期" data-field="timing" data-index="${index}">
        ${timingOptions().map((timing) => `<option value="${timing}" ${fee.timing === timing ? "selected" : ""}>${timingLabel(timing)}</option>`).join("")}
      </select>
      <select aria-label="区分" data-field="type" data-index="${index}">
        ${["initial", "monthly", "personal", "corporate", "optionalParking", "optionalAc", "optionalPet"].map((type) => `<option value="${type}" ${fee.type === type ? "selected" : ""}>${feeKindLabel(type)}</option>`).join("")}
      </select>
      <button type="button" aria-label="削除" data-remove="${index}">×</button>
    `;
    wrap.appendChild(row);
  });
}

function renderGuaranteeTargets() {
  const wrap = el("guaranteeTargets");
  const candidates = state.fees.filter(guaranteeCandidate);
  wrap.innerHTML = `
    <div class="target-summary">
      <span>${state.settings?.guaranteeMode === "fixed" ? "固定額で読込" : `対象合計 ${yen.format(guaranteeBaseTotal())}`}</span>
      <strong>初回保証料 ${yen.format(guaranteeAmount())}</strong>
    </div>
    ${candidates.map((fee) => `
      <label class="target-row">
        <input type="checkbox" data-guarantee-target="${fee.id}" ${fee.guaranteeTarget ? "checked" : ""}>
        <span>${escapeHtml(fee.label)}</span>
        <strong>${yen.format(Number(fee.amount || 0))}</strong>
      </label>
    `).join("")}
  `;
}

function renderEstimate() {
  syncDerivedFees();
  const kind = state.estimateType === "personal" ? "個人宛" : "法人宛";
  const rows = estimateRows();
  const monthlyRows = monthlySummaryRows();
  const exitRows = moveoutRows();
  const property = {
    title: textValue("propertyTitle"),
    room: textValue("room"),
    address: textValue("address"),
    access: textValue("access"),
    layout: textValue("layout"),
    area: textValue("area"),
    built: textValue("built"),
    inquiry: textValue("inquiry"),
  };
  const freeRent = state.property?.freeRent || "";
  const guaranteeNote = state.settings?.guaranteeNote || "";
  const guaranteeLabels = guaranteeBaseRows().map((fee) => fee.label).join("、");
  const choiceFees = timingChoiceFees();
  const moveInParts = moveInDateParts();
  const freeRange = freeRentRange();
  const rentRuleNote = moveInParts
    ? moveInParts.day >= 15
      ? "入居日が15日以降のため、入居月の日割と翌月分の月額費用を見積に含めています。24時間管理料と町内会費は日割せず、入居月分を満額で含めています。駐車場を含める場合は駐車場も日割・翌月分を計算します。"
      : "入居日が14日以前のため、入居月の日割のみ見積に含めています。24時間管理料と町内会費は日割せず、入居月分を満額で含めています。駐車場を含める場合は駐車場も日割計算します。"
    : "";
  const notes = [
    rentRuleNote,
    freeRange ? "フリーレント期間に重なる賃料と共益費・管理費を控除しています。" : "",
    choiceFees.length ? `支払時期の選択が必要な項目があります（${escapeHtml(choiceFees.map((fee) => fee.label).join("、"))}）。要選択の項目は契約時候補として合計に含めています。退去時払いにする場合は、費用項目欄で支払時期を退去時に変更してください。` : "",
    el("includeFreeRentNote").checked && freeRent ? `<strong>${escapeHtml(freeRent)}</strong>` : "",
    "本見積はPDF記載内容をもとにした概算です。申込条件、入居日、管理会社確認により金額が変動する場合があります。",
    guaranteeNote ? `保証会社条件: ${escapeHtml(guaranteeNote)}` : "",
  ].filter(Boolean);

  el("estimate").innerHTML = `
    <div class="estimate-head">
      <h2>初期費用御見積書 <span class="quote-kind">${kind}</span></h2>
      <div class="meta">
        発行日 ${escapeHtml(el("issueDate").value || today())}<br>
        問い合わせ番号 ${escapeHtml(property.inquiry || "-")}
      </div>
    </div>
    <div class="recipient">${escapeHtml(textValue("recipientName") || "お客様")} 御中</div>
    <div class="property-box">
      <dl>
        ${definition("物件名", property.title, "号室", property.room)}
        ${definition("所在地", property.address, "交通", property.access)}
        ${definition("間取り", property.layout, "専有面積", property.area)}
        ${definition("築年", property.built, "入居開始", el("moveInDate").value || "-")}
      </dl>
    </div>
    <div class="estimate-total">
      <span>お支払概算合計</span>
      <strong>${yen.format(total())}</strong>
    </div>
    <table>
      <thead>
        <tr><th>項目</th><th>区分</th><th>支払時期</th><th class="amount">金額</th></tr>
      </thead>
      <tbody>
        ${rows.map((fee) => `<tr class="${fee.timing === "moveout" ? "moveout-row" : ""} ${fee.timing === "choice" ? "choice-row" : ""}"><td>${escapeHtml(fee.label)}</td><td>${feeKindLabel(fee.type)}</td><td>${timingLabel(fee.timing)}</td><td class="amount">${yen.format(Number(fee.amount || 0))}</td></tr>`).join("")}
      </tbody>
    </table>
    ${monthlyRows.length ? `
      <section class="summary-box monthly-box">
        <div class="summary-head">
          <span>月額費用</span>
          <strong>${yen.format(monthlySummaryTotal())}</strong>
        </div>
        <table>
          <thead>
            <tr><th>項目</th><th class="amount">月額</th></tr>
          </thead>
          <tbody>
            ${monthlyRows.map((fee) => `<tr><td>${escapeHtml(fee.label)}</td><td class="amount">${yen.format(Number(fee.amount || 0))}</td></tr>`).join("")}
          </tbody>
        </table>
      </section>
    ` : ""}
    ${exitRows.length ? `
      <section class="summary-box moveout-box">
        <div class="summary-head">
          <span>退去時費用</span>
          <strong>${yen.format(moveoutTotal())}</strong>
        </div>
        <table>
          <thead>
            <tr><th>項目</th><th>区分</th><th class="amount">金額</th></tr>
          </thead>
          <tbody>
            ${exitRows.map((fee) => `<tr><td>${escapeHtml(fee.label)}</td><td>${feeKindLabel(fee.type)}</td><td class="amount">${yen.format(Number(fee.amount || 0))}</td></tr>`).join("")}
          </tbody>
        </table>
      </section>
    ` : ""}
    <div class="notes">
      ${notes.map((note) => `<p>※ ${note}</p>`).join("")}
    </div>
  `;
}

function definition(a, av, b, bv) {
  return `<dt>${escapeHtml(a)}</dt><dd>${escapeHtml(av || "-")}</dd><dt>${escapeHtml(b)}</dt><dd>${escapeHtml(bv || "-")}</dd>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function parsePdf(file) {
  const form = new FormData();
  form.append("pdf", file);
  el("status").textContent = "PDFを解析しています。";
  const response = await fetch("/api/parse-pdf", { method: "POST", body: form });
  if (!response.ok) throw new Error("PDF解析に失敗しました。");
  const data = await response.json();
  loadData(data);
  const csvResult = enhanceFromCsvMatch();
  const choices = timingChoiceFees();
  const csvMessage = csvResult.item
    ? ` CSV補強: ${csvResult.item["物件"] || ""} ${csvResult.item["号室"] || ""}${csvResult.applied.length ? `（${csvResult.applied.join("、")}）` : "（該当備考なし）"}`
    : state.csvRows.length
    ? " CSV補強: 同じ物件が見つかりませんでした。"
    : "";
  el("status").textContent = choices.length
    ? `${file.name} から物件情報を読み込みました。支払時期の選択が必要な項目があります。${csvMessage}`
    : `${file.name} から物件情報を読み込みました。${csvMessage}`;
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("CSV読込に失敗しました。"));
    reader.readAsText(file, "utf-8");
  });
}

async function parseCsv(file) {
  el("status").textContent = "CSVを読み込んでいます。";
  const text = await readFileText(file);
  const rows = csvRowsToObjects(parseCsvText(text));
  if (!rows.length) throw new Error("CSVの列を読み取れませんでした。");
  state.csvRows = rows;
  el("csvPanel").hidden = false;
  el("csvSearch").value = "";
  renderCsvSelector();
  el("status").textContent = `${file.name} から ${rows.length} 件の物件を読み込みました。次回PDF読込時に同じ物件の備考で自動補強します。`;
}

document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.dataset?.guaranteeTarget) return;
  if (target.dataset?.field) {
    const fee = state.fees[Number(target.dataset.index)];
    if (!fee.derived || target.dataset.field !== "amount") {
      fee[target.dataset.field] = target.dataset.field === "amount" ? Number(target.value || 0) : target.value;
    }
  }
  syncDerivedFees();
  renderGuaranteeTargets();
  updateGuaranteeFeeInput();
  renderEstimate();
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.id === "pdfInput" && target.files[0]) {
    parsePdf(target.files[0]).catch((error) => {
      el("status").textContent = error.message;
    });
    return;
  }
  if (target.id === "csvInput" && target.files[0]) {
    parseCsv(target.files[0]).catch((error) => {
      el("status").textContent = error.message;
    });
    return;
  }
  if (target.id === "csvSelect") {
    renderCsvPreview();
    return;
  }
  if (target.dataset?.guaranteeTarget) {
    const fee = state.fees.find((item) => item.id === target.dataset.guaranteeTarget);
    if (fee) {
      fee.guaranteeTarget = target.checked;
      syncDerivedFees();
      renderGuaranteeTargets();
      updateGuaranteeFeeInput();
      renderEstimate();
    }
    return;
  }
  if (target.id === "moveInDate") {
    syncProrateFromMoveInDate();
    renderEstimate();
    return;
  }
  if (["freeRentStart", "freeRentEnd"].includes(target.id)) {
    renderEstimate();
    return;
  }
  if (target.dataset?.field) {
    state.fees[Number(target.dataset.index)][target.dataset.field] = target.value;
    syncDerivedFees();
    renderGuaranteeTargets();
    updateGuaranteeFeeInput();
  }
  renderEstimate();
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (target.dataset?.estimateType) {
    state.estimateType = target.dataset.estimateType;
    document.querySelectorAll("[data-estimate-type]").forEach((button) => {
      button.classList.toggle("active", button === target);
    });
    renderEstimate();
  }
  if (target.dataset?.remove) {
    state.fees.splice(Number(target.dataset.remove), 1);
    syncDerivedFees();
    renderGuaranteeTargets();
    renderFeeEditor();
    renderEstimate();
  }
});

el("sampleButton").addEventListener("click", () => {
  loadData(sampleData);
  el("status").textContent = "添付PDFから読み取ったサンプル内容を読み込みました。";
});

el("resetButton").addEventListener("click", () => {
  resetToBlank();
  el("status").textContent = "入力内容を空の状態へ戻しました。";
});

el("addFeeButton").addEventListener("click", () => {
  state.fees.push({ id: `custom-${Date.now()}`, label: "追加項目", amount: 0, type: "initial", timing: "initial", guaranteeTarget: false, derived: false });
  renderGuaranteeTargets();
  renderFeeEditor();
});

el("csvSearch").addEventListener("input", renderCsvSelector);

el("applyCsvButton").addEventListener("click", () => {
  const item = selectedCsvItem();
  if (!item) {
    el("status").textContent = "CSV補強に使う物件を選択してください。";
    return;
  }
  const applied = applyCsvEnhancement(item);
  el("status").textContent = `${item["物件"] || "選択した物件"} ${item["号室"] || ""} のCSV備考で補強しました。${applied.length ? `反映: ${applied.join("、")}` : "反映できる費用項目は見つかりませんでした。"}`;
});

el("printButton").addEventListener("click", () => window.print());

resetToBlank();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}
