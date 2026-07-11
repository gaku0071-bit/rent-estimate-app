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
  unknownFeeCandidates: [],
  receivedTransferIds: new Set(),
};

const storeInfo = {
  name: "いい部屋ネット札幌大通店",
  address1: "札幌市中央区南２条西６丁目７−２",
  address2: "アルファスクエア大通１F",
  tel: "011-205-3032",
};

const feeDefinitions = [
  ["賃料", "rent", "monthly", true, "monthly"],
  ["共益費・管理費", "commonFee", "monthly", true, "monthly"],
  ["敷金", "deposit", "initial", false, "initial"],
  ["礼金", "keyMoney", "initial", false, "initial"],
  ["仲介手数料", "brokerageFee", "initial", false, "initial"],
  ["初回保証料", "guaranteePersonal", "personal", false, "initial"],
  ["初回保証料", "guaranteeCorporate", "corporate", false, "initial"],
  ["火災保険料", "insuranceFee", "initial", false, "initial"],
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

const USER_RULES_STORAGE_KEY = "rentEstimateUserFeeRules";

const ruleTargets = [
  ["asExtra", "追加項目のまま保存"],
  ["cleaningFee", "清掃料系"],
  ["waterSanitizingFee", "水廻り消毒系"],
  ["keyFee", "鍵交換系"],
  ["antibacterialFee", "抗菌・消毒系"],
  ["supportFee", "24時間・サポート系"],
  ["acCleaningFee", "エアコン清掃系"],
  ["stoveMaintenanceFee", "暖房・ストーブ整備系"],
  ["deodorizingFee", "消臭系"],
  ["petFee", "ペット系"],
  ["waterDrainFee", "水落・水抜き系"],
  ["gasLeaseFee", "水道・リース系"],
  ["townFee", "町内会費系"],
  ["monthlyGuaranteeFee", "月額保証・決済手数料系"],
  ["ignore", "今後は無視する"],
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

function setFeeType(id, type) {
  const fee = state.fees.find((item) => item.id === id);
  if (fee) fee.type = type;
}

function setFeeLabel(id, label) {
  const fee = state.fees.find((item) => item.id === id);
  if (fee && label) fee.label = label;
}

function insuranceFeeItem() {
  return state.fees.find((fee) => fee.id === "insuranceFee");
}

function insurancePaymentModeFromFee() {
  const fee = insuranceFeeItem();
  return fee && (fee.timing === "monthly" || fee.type === "monthly") ? "monthly" : "annual";
}

function normalizeInsuranceLabel(label, mode) {
  const base = String(label || "火災保険料")
    .replace(/（(?:月額|月払い|年払い|契約時|2年|２年)[^）]*）/g, "")
    .replace(/\((?:月額|月払い|年払い|契約時|2年|２年)[^)]*\)/g, "")
    .trim() || "火災保険料";
  return mode === "monthly" ? `${base}（月額）` : `${base}（年払い）`;
}

function applyInsurancePaymentMode(mode, { updateLabel = true } = {}) {
  const fee = insuranceFeeItem();
  if (!fee) return;
  const nextMode = mode === "monthly" ? "monthly" : "annual";
  if (nextMode === "monthly") {
    fee.type = "monthly";
    fee.timing = "monthly";
    fee.noProrate = true;
    fee.noInitialEstimate = false;
  } else {
    fee.type = "initial";
    fee.timing = "initial";
    fee.noProrate = false;
    fee.noInitialEstimate = false;
  }
  if (updateLabel) fee.label = normalizeInsuranceLabel(fee.label, nextMode);
  state.settings = {
    ...(state.settings || {}),
    feeTimings: {
      ...(state.settings?.feeTimings || {}),
      insuranceFee: fee.timing,
    },
    feeTypes: {
      ...(state.settings?.feeTypes || {}),
      insuranceFee: fee.type,
    },
    feeLabels: {
      ...(state.settings?.feeLabels || {}),
      insuranceFee: fee.label,
    },
  };
}

function syncInsurancePaymentSelect() {
  const select = el("insurancePaymentMode");
  if (select) select.value = insurancePaymentModeFromFee();
}

function isMonthlyGuaranteeLabel(label) {
  return /月額保証|月次保証|毎月保証|月々保証|月額手数料|月額事務手数料|収納代行手数料|支払手数料|口座振替料|口振手数料|引落手数料|家賃等決済サービス利用料|決済サービス利用料|決済手数料|月々決済手数料|毎月決済手数料/.test(String(label || ""));
}

function normalizeManualFee(fee) {
  if (!fee || !isMonthlyGuaranteeLabel(fee.label)) return false;
  fee.type = "monthly";
  fee.timing = "monthly";
  fee.guaranteeTarget = false;
  fee.noProrate = true;
  fee.noInitialEstimate = true;
  return true;
}

function normalizedRuleLabel(label) {
  return String(label || "").replace(/\s+/g, "").trim();
}

function readUserFeeRules() {
  try {
    const saved = JSON.parse(localStorage.getItem(USER_RULES_STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((rule) => normalizedRuleLabel(rule.label)) : [];
  } catch {
    return [];
  }
}

function writeUserFeeRules(rules) {
  localStorage.setItem(USER_RULES_STORAGE_KEY, JSON.stringify(rules, null, 2));
}

function upsertUserFeeRule(rule) {
  const label = normalizedRuleLabel(rule.label);
  if (!label) return;
  const rules = readUserFeeRules().filter((item) => normalizedRuleLabel(item.label) !== label);
  rules.push({
    label,
    targetId: rule.targetId || "asExtra",
    type: rule.type || "initial",
    timing: rule.timing || "initial",
    savedAt: new Date().toISOString(),
  });
  writeUserFeeRules(rules);
}

function findUserFeeRule(label) {
  const normalized = normalizedRuleLabel(label);
  return readUserFeeRules().find((rule) => normalizedRuleLabel(rule.label) === normalized);
}

function targetDefinition(targetId) {
  return feeDefinitions.find(([, key]) => key === targetId);
}

function applyUserFeeRuleToExtra(fee) {
  const rule = findUserFeeRule(fee.label);
  if (!rule) return { applied: false, fee };
  if (rule.targetId === "ignore") return { applied: true, ignored: true };
  const nextFee = {
    ...fee,
    timing: rule.timing || fee.timing || "initial",
    type: rule.type || fee.type || "initial",
    noProrate: rule.timing === "monthly" || fee.noProrate,
  };
  if (rule.targetId && rule.targetId !== "asExtra") {
    const definition = targetDefinition(rule.targetId);
    if (definition) {
      nextFee.id = `${rule.targetId}-${normalizedRuleLabel(fee.label)}`;
      nextFee.type = rule.type || definition[2];
      nextFee.timing = rule.timing || definition[4];
      nextFee.guaranteeTarget = Boolean(definition[3]);
    }
  }
  if (isMonthlyGuaranteeLabel(nextFee.label) || rule.targetId === "monthlyGuaranteeFee") {
    nextFee.type = "monthly";
    nextFee.timing = "monthly";
    nextFee.noProrate = true;
    nextFee.noInitialEstimate = true;
    nextFee.guaranteeTarget = false;
  }
  return { applied: true, fee: nextFee };
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
  const manMatch = String(value || "").normalize("NFKC").match(/(\d+(?:\.\d+)?)\s*万\s*円/);
  if (manMatch) return Math.round(Number(manMatch[1]) * 10000);
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function amountNear(text, pattern) {
  const match = String(text || "").match(pattern);
  if (!match) return 0;
  const amounts = match[0].match(/(?:[\d,，]+|\d+(?:\.\d+)?\s*万)円/g) || [];
  return amounts.length ? moneyToInt(amounts.at(-1)) : 0;
}

function normalizeRateText(text) {
  return String(text || "")
    .replace(/[０-９．，％]/g, (char) => "０１２３４５６７８９．，％".indexOf(char) >= 0 ? "0123456789.,%"["０１２３４５６７８９．，％".indexOf(char)] : char)
    .replace(/(?<=\d)\s+(?=\d)/g, "")
    .replace(/(?<=\d),(?=\d{1,2}\s*(?:%|パーセント))/g, ".");
}

function inferPaymentTiming(text, fallback = "initial") {
  const value = String(text || "");
  const hasInitial = value.includes("契約時") || value.includes("入居時");
  const hasMoveout = value.includes("退去時");
  if ((hasInitial && hasMoveout) || value.includes("退去時払い可") || /(?:契約時|入居時)(?:または|もしくは|又は)退去時|退去時(?:または|もしくは|又は)(?:契約時|入居時)/.test(value)) return "choice";
  if (value.includes("月額")) return "monthly";
  if (hasMoveout) return "moveout";
  return fallback;
}

const guaranteeMonthlyWords = /月額|月次|毎月|月々|毎月継続|継続保証|口座振替|口振|引落|決済|収納代行|支払手数料/;
const guaranteeInitialWords = /初回|契約時|保証委託料|初回保証料|初回保証委託料|新規契約時/;
const guaranteeMoneyPatternSource = "(?:[\\d,，]+\\s*円|\\d+(?:\\.\\d+)?\\s*万\\s*円)";

function firstRate(value, patterns) {
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return Number(match[1]);
  }
  return 0;
}

function guaranteeInitialMinimum(value, initialRate) {
  let minimum = 0;
  const patterns = [
    new RegExp(`(?:最低保証料|最低|下限)[^。・\\n\\r]{0,32}?${guaranteeMoneyPatternSource}`, "g"),
    new RegExp(`${guaranteeMoneyPatternSource}[^。・\\n\\r]{0,32}?(?:最低保証料|最低|下限)`, "g"),
  ];
  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      const amount = moneyToInt(match[0]);
      if (!amount) continue;
      const local = value.slice(Math.max(0, match.index - 48), match.index + match[0].length + 48);
      const before = value.slice(Math.max(0, match.index - 120), match.index);
      const monthlyNear = guaranteeMonthlyWords.test(local);
      const initialNear = guaranteeInitialWords.test(`${before}${local}`);
      if (amount < 10000 && monthlyNear) continue;
      if (monthlyNear && !initialNear) continue;
      if (initialRate || initialNear || amount >= 10000) minimum = Math.max(minimum, amount);
    }
  }
  return minimum;
}

function guaranteeFixedInitial(value, initialRate) {
  if (initialRate) return 0;
  const patterns = [
    new RegExp(`(?:初回保証料|初回保証委託料|保証委託料|保証料|保証会社事務手数料)[^。・\\n\\r%]{0,60}?(?:一律|定額)\\s*[:：]?\\s*(${guaranteeMoneyPatternSource})`, "g"),
    new RegExp(`(?:一律|定額)\\s*(${guaranteeMoneyPatternSource})[^。・\\n\\r%]{0,60}?(?:初回保証料|初回保証委託料|保証委託料|保証料|保証会社)`, "g"),
    new RegExp(`(?:初回保証料|初回保証委託料|保証委託料|保証会社事務手数料)\\s*[:：]?\\s*(${guaranteeMoneyPatternSource})`, "g"),
  ];
  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      const chunk = value.slice(Math.max(0, match.index - 24), match.index + match[0].length + 24);
      if (/最低|下限|%|パーセント/.test(chunk)) continue;
      if (/月額|月次|毎月|月々|更新|年間|年額/.test(chunk) && !/初回|新規契約時|契約時/.test(chunk)) continue;
      const amount = moneyToInt(match[1]);
      if (amount) return amount;
    }
  }
  return 0;
}

function guaranteeMonthlyFixed(value, monthlyRate) {
  if (monthlyRate) return 0;
  const patterns = [
    new RegExp(`(?:月額保証料|月次保証料|月額手数料|月額事務手数料|毎月保証料|月々保証料|支払手数料|収納代行手数料|決済手数料|月々決済手数料|毎月決済手数料|口座振替料|口振手数料|引落手数料)[^。・\\n\\r%]{0,80}?(${guaranteeMoneyPatternSource})`, "g"),
    new RegExp(`(?:月額|毎月|月々)\\s*[:：]?\\s*(${guaranteeMoneyPatternSource})`, "g"),
    new RegExp(`(?:^|[（(・\\s])月\\s*(${guaranteeMoneyPatternSource})`, "g"),
  ];
  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      if (/最低|下限|更新|年間|年額|家賃等|賃料等|賃料総額/.test(match[0])) continue;
      const amount = moneyToInt(match[1]);
      if (amount) return amount;
    }
  }
  return 0;
}

function parseGuaranteeTerms(text) {
  const value = normalizeRateText(String(text || "").normalize("NFKC").replace(/％/g, "%")).replace(/[ \t]+/g, " ");
  const initialRate = firstRate(value, [
    /(?:初回保証料|初回保証委託料|契約時保証料|初回保証会社保証料|保証委託料|初回|契約時)[^。・\n\r%]{0,80}?(\d+(?:\.\d+)?)\s*(?:%|パーセント)/,
    /(?:初回|契約時)[^。・\n\r]{0,80}?(?:月額賃料等|月額家賃等|賃料合計|賃料総額|総賃料|賃料等|家賃等)[^。・\n\r%]{0,40}?(\d+(?:\.\d+)?)\s*(?:%|パーセント)/,
    /(?:月額賃料等|月額家賃等|賃料合計|賃料総額|総賃料|賃料等|家賃等)[^。・\n\r%]{0,40}?(\d+(?:\.\d+)?)\s*(?:%|パーセント)[^。・\n\r]{0,40}?(?:初回|契約時)/,
  ]);
  const monthlyRate = firstRate(value, [
    /(?:月額保証料|月次保証料|月額手数料|月額事務手数料|\[毎月\]保証料|毎月保証料|月々保証料|毎月継続保証料|継続保証料|支払手数料|収納代行手数料|決済手数料|月々決済手数料|毎月決済手数料|月額\s*\/)[^。・\n\r%]{0,100}?(\d+(?:\.\d+)?)\s*(?:%|パーセント)/,
    /(?:月額|毎月|月々)(?!賃料|家賃|賃料等|家賃等)[^。・\n\r]{0,40}?(?:保証|手数料|賃料合計|賃料総額|総賃料)[^。・\n\r%]{0,60}?(\d+(?:\.\d+)?)\s*(?:%|パーセント)/,
    /(?:初回|初回保証料|契約時)[^。・\n\r]{0,50}?(?:%|パーセント)[^。・\n\r]{0,50}?(?:月額|毎月|月々)[^。・\n\r%]{0,60}?(\d+(?:\.\d+)?)\s*(?:%|パーセント)/,
  ]);
  const safeMonthlyRate = new RegExp(`初回\\s*\\d+(?:\\.\\d+)?\\s*(?:%|パーセント)[^。\\n\\r]{0,40}?(?:月|月額)\\s*${guaranteeMoneyPatternSource}`).test(value) ? 0 : monthlyRate;
  const monthlyFixedExtraPattern = new RegExp(`(?:\\+|＋)\\s*[^+＋\\d円]{0,16}?(${guaranteeMoneyPatternSource})`, "g");
  const monthlyFixedExtra = [...value.matchAll(monthlyFixedExtraPattern)].reduce((sum, match) => sum + moneyToInt(match[1]), 0);
  return {
    fixed: guaranteeFixedInitial(value, initialRate),
    initialRate,
    initialMinimum: guaranteeInitialMinimum(value, initialRate),
    monthlyRate: safeMonthlyRate,
    monthlyFixed: guaranteeMonthlyFixed(value, safeMonthlyRate),
    monthlyFixedExtra,
    note: value.trim(),
  };
}

function fixedGuaranteeAmount(text) {
  return parseGuaranteeTerms(text).fixed;
}

function guaranteeMinimumAmount(text) {
  return parseGuaranteeTerms(text).initialMinimum;
}

function initialGuaranteeRate(text) {
  return parseGuaranteeTerms(text).initialRate;
}

function normalizeGuaranteeSettings(settings) {
  const note = settings?.guaranteeNote || "";
  const terms = parseGuaranteeTerms(note);
  if (!terms.initialRate && !terms.fixed && !terms.monthlyRate && !terms.monthlyFixed) return settings;
  return {
    ...settings,
    guaranteeMode: terms.fixed ? "fixed" : "percent",
    guaranteeRate: terms.fixed ? 0 : terms.initialRate || Number(settings.guaranteeRate || 50),
    guaranteeMinimum: terms.initialMinimum || Number(settings.guaranteeMinimum || 0),
    monthlyGuaranteeMode: terms.monthlyRate ? "percent" : terms.monthlyFixed ? "fixed" : settings.monthlyGuaranteeMode,
    monthlyGuaranteeRate: terms.monthlyRate || Number(settings.monthlyGuaranteeRate || 0),
    monthlyGuaranteeFixedExtra: terms.monthlyFixedExtra || Number(settings.monthlyGuaranteeFixedExtra || 0),
  };
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
    noInitialEstimate: Boolean(fee.noInitialEstimate),
    derived: false,
  });
  return true;
}

function extractUnregisteredFeesFromText(text) {
  const sourceText = String(text || "");
  const value = sourceText.replace(/\n/g, "");
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

  const shouldSkip = (label, context) =>
    /無し|なし|不要|無料/.test(`${label}${context}`) ||
    nonCustomerFeeLabel(label) ||
    /賃料|家賃|共益|管理費|敷金|礼金|保険|仲介|更新|広告|キャンセル|合計|小計|税込|税別|税額|請求|振込|日割|翌月|前家賃|駐車|取引態様|特記事項|条件|設備|セキュリティ|掲載|転載/.test(label);

  const inferredCategory = (label, context) => {
    const valueText = `${label}${context}`;
    if (isMonthlyGuaranteeLabel(valueText)) return "monthlyGuaranteeFee";
    if (/清掃|クリーニング|くりーにんぐ|退室|原状回復/.test(label)) return "cleaningFee";
    if (/水廻|水回|水まわ|水周|水まわり/.test(label)) return "waterSanitizingFee";
    if (/鍵|カギ|キー|シリンダ|シリンダー/.test(label)) return "keyFee";
    if (/抗菌|除菌|消毒|殺菌/.test(label)) return "antibacterialFee";
    if (/24|２４|サポート|リペア|安心|くらし|暮らし|ライフ|クラブ|緊急|駆けつけ|かけつけ/.test(label)) return "supportFee";
    if (/エアコン|AC|ＡＣ|空調/.test(label)) return "acCleaningFee";
    if (/ストーブ|暖房|FF|ＦＦ|冷暖房|エコジョーズ整備/.test(label)) return "stoveMaintenanceFee";
    if (/消臭|脱臭|防臭/.test(label)) return "deodorizingFee";
    if (/ペット|飼育/.test(label)) return "petFee";
    if (/水落|水抜|水落し|エコジョーズ/.test(label)) return "waterDrainFee";
    if (/水道|給湯器|リース|北ガス|上下水/.test(label)) return "gasLeaseFee";
    return "";
  };

  const likelyFeeLabel = (label, context) =>
    Boolean(
      inferredCategory(label, context) ||
        /料|費|代|金|一時金|負担金|サポート|サービス|クラブ|清掃|消毒|整備|交換/.test(label) ||
        /^[A-Za-zＡ-Ｚａ-ｚ0-9０-９]{1,10}(?:料|費|代)$/.test(label) ||
        /契約時|退去時|月額|入居時|毎月/.test(`${label}${context}`),
    );

  const addCandidate = (rawLabel, context, amount) => {
    const label = String(rawLabel || "")
      .replace(/\s+/g, "")
      .replace(/[・:：、。○※-]+$/g, "")
      .replace(/^[・:：、。○※-]+/g, "")
      .replace(/(契約時|退去時|月額|入居時|毎月|年額)$/g, "");
    if (!label || !amount || /無し|なし|不要/.test(context)) return;
    if (shouldSkip(label, context) || !likelyFeeLabel(label, context)) return;
    if (knownWords.some((word) => label.includes(word) || word.includes(label))) return;
    const timing = inferPaymentTiming(context);
    const key = `${label}-${amount}-${timing}`;
    if (seen.has(key)) return;
    seen.add(key);
    extras.push({ label, amount, timing, type: genericFeeType(timing), noProrate: timing === "monthly" });
  };

  const linePattern = /^\s*(?:○|※|・|-)?\s*([^：:\d円]{2,32}?(?:料|費|代|金|一時金|負担金|サポート|サービス|クラブ|清掃|消毒|整備|交換)[^：:\d円]{0,12})\s*(契約時|退去時|月額|入居時|毎月|年額)?\s*([\d,，]+)\s*円(.*)$/;
  sourceText.split(/\n/).forEach((line) => {
    const match = line.trim().match(linePattern);
    if (!match) return;
    addCandidate(match[1], match.slice(1).join(""), moneyToInt(match[3]));
  });

  const patterns = [
    /(?:^|・|○\s*)([^・：:\n]{2,36}?)[：:]\s*([^・]{0,48}?)([\d,，]+)\s*円([^・]{0,48})/g,
    /(?:^|・|○\s*)([^・：:\n]{2,36}?)(?:\s|　)*(契約時|退去時|月額|入居時|毎月)?(?:\s|　)*(?:税込|非課税|課税|または|もしくは|又は|払い可|（税込）|\(税込\))*\s*([\d,，]+)\s*円([^・]{0,48})/g,
  ];
  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      addCandidate(match[1], match.slice(1).join(""), moneyToInt(match[3]));
    }
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

  const stoveFee = amountNear(notes, /(?:ストーブ整備料|暖房整備料|暖房分解清掃料|暖房分解清掃料金|冷暖房機器清掃料|冷暖房機器清掃費|FF分解清掃料|FF分解清掃費|FF分解清掃費用|FF清掃料|FF清掃費|ＦＦ清掃料|ＦＦ清掃費|FFストーブ分解清掃料)[^。・\n\r]*?[\d,，]+円/);
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

  const cleaningFee = amountNear(notes, /(?:室内清掃料|室内清掃費|退去時室内清掃料|退去時清掃料|退去時清掃費|退去清掃料|退去清掃費|ハウスクリーニング料?|HC料|HC費|HC代|ＨＣ料|ＨＣ費|ＨＣ代|ルームクリーニング費用|ルームクリーニング料|ルームクリーニング費|ルームクリーニング|るーむくりーにんぐ費用|るーむくりーにんぐ料|るーむくりーにんぐ費|家電清掃料|清掃料)[^。・\n\r]*?[\d,，]+円/);
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

  const supportFee = amountNear(notes, /(?:24時間管理料|24時間管理費|24時間管理|24時間サポート料|24時間サポート費|シャーメゾンSUPPORT24|ギムサポートクラブ|リペアサービス|夜間サポート|24時間サポート|安心サポート|緊急サポート|新生活サポート|暮らしサポート|ライフサポート|管理サポート)[^。・\n\r]*?[\d,，]+円/);
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

  const guaranteeTerms = parseGuaranteeTerms(notes);
  const fixedGuarantee = guaranteeTerms.fixed;
  if (fixedGuarantee) {
    state.settings.guaranteeMode = "fixed";
    state.settings.guaranteeRate = 0;
    state.settings.guaranteeMinimum = 0;
    setFeeAmount("guaranteePersonal", fixedGuarantee);
    setFeeLabel("guaranteePersonal", "初回保証料");
    applied.push("初回保証料");
  } else {
    const initialRate = guaranteeTerms.initialRate;
    if (initialRate) {
      state.settings.guaranteeMode = "percent";
      state.settings.guaranteeRate = initialRate;
      state.settings.guaranteeMinimum = guaranteeTerms.initialMinimum;
      el("guaranteeRate").value = initialRate;
      applied.push(`初回保証料${initialRate}%`);
    }
  }

  const monthlyRate = guaranteeTerms.monthlyRate;
  const monthlyFixed = guaranteeTerms.monthlyFixed;
  const monthlyFixedExtras = guaranteeTerms.monthlyFixedExtra;
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
  el("includeNextMonth").checked = day >= 15;
}

function resetToBlank() {
  state.estimateType = "personal";
  state.property = {};
  state.settings = {};
  state.fees = [];
  state.lastData = null;
  state.unknownFeeCandidates = [];
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
    "insurancePaymentMode",
    "freeRentStart",
    "freeRentEnd",
  ].forEach((id) => {
    el(id).value = id === "insurancePaymentMode" ? "annual" : "";
  });
  el("prorateDays").value = 0;
  el("monthDays").value = 30;
  el("guaranteeRate").value = 50;
  el("includeParking").checked = false;
  el("includeNextMonth").checked = false;
  el("includeAcCleaning").checked = false;
  el("includePetFee").checked = false;
  el("includeCorporateGuarantee").checked = false;
  el("includeFreeRentNote").checked = false;
  el("pdfInput").value = "";
  el("csvInput").value = "";
  el("csvSearch").value = "";
  state.csvRows = [];
  state.filteredCsvRows = [];
  el("csvPanel").hidden = true;
  renderGuaranteeTargets();
  renderFeeEditor();
  renderUnknownRulesPanel();
  renderEstimate();
}

function loadData(data) {
  state.lastData = structuredClone(data);
  const { property, amounts } = data;
  const settings = normalizeGuaranteeSettings(data.settings || {});
  state.estimateType = "personal";
  document.querySelectorAll("[data-estimate-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.estimateType === "personal");
  });
  el("recipientName").value = "お客様";
  el("prorateDays").value = 0;
  el("monthDays").value = 30;
  el("guaranteeRate").value = Number(settings.guaranteeRate || 50);
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
  el("includeNextMonth").checked = Boolean(moveInDateParts()?.day >= 15);
  el("includeAcCleaning").checked = Boolean(settings.includeAcCleaning);
  el("includePetFee").checked = Boolean(settings.includePetFee);
  el("includeCorporateGuarantee").checked = Boolean(settings.includeCorporateGuarantee);

  state.property = property;
  state.settings = settings;
  state.unknownFeeCandidates = [];
  state.fees = feeDefinitions.map(([label, key, type, guaranteeTarget, timing]) => ({
    id: key,
    label: settings.feeLabels?.[key] || label,
    amount: amounts[key] || 0,
    type: settings.feeTypes?.[key] || type,
    timing: settings.feeTimings?.[key] || timing,
    guaranteeTarget,
    derived: ["guaranteePersonal", "guaranteeCorporate", "brokerageFee"].includes(key) || (key === "monthlyGuaranteeFee" && settings.monthlyGuaranteeMode === "percent"),
  }));
  applyInsurancePaymentMode(
    settings.feeTimings?.insuranceFee === "monthly" || settings.feeTypes?.insuranceFee === "monthly" ? "monthly" : "annual",
    { updateLabel: !settings.feeLabels?.insuranceFee },
  );
  syncInsurancePaymentSelect();
  (settings.extraFees || []).forEach((fee) => {
    const result = applyUserFeeRuleToExtra(fee);
    if (result.ignored) return;
    if (!result.applied) {
      state.unknownFeeCandidates.push({ ...fee });
    }
    addExtraFee(result.fee);
  });
  syncDerivedFees();
  renderGuaranteeTargets();
  renderFeeEditor();
  renderUnknownRulesPanel();
  renderEstimate();
}

function validExtensionPayload(data) {
  if (!data || data.source !== "realpro-extension" || data.version !== 1) return false;
  if (!data.property || !data.amounts || !data.settings) return false;
  return typeof data.property.title === "string" && Number.isFinite(Number(data.amounts.rent || 0));
}

function receiveExtensionData(event) {
  if (event.source !== window || event.origin !== window.location.origin) return;
  if (event.data?.type !== "RENT_ESTIMATE_EXTENSION_DATA") return;

  const transferId = String(event.data.transferId || "");
  if (transferId && state.receivedTransferIds.has(transferId)) {
    window.postMessage({ type: "RENT_ESTIMATE_EXTENSION_ACK", transferId }, window.location.origin);
    return;
  }

  const payload = event.data.payload;
  if (!validExtensionPayload(payload)) {
    el("status").textContent = "リアプロから受信したデータ形式が正しくありません。拡張機能を更新してください。";
    return;
  }

  if (transferId) state.receivedTransferIds.add(transferId);
  loadData(payload);
  const warnings = payload.settings?.extractionDiagnostics?.warnings || [];
  el("status").textContent = warnings.length
    ? `リアプロから物件情報を読み込みました。確認事項: ${warnings.join("、")}`
    : "リアプロから物件情報と費用を読み込みました。金額と支払時期を確認してください。";
  window.postMessage({ type: "RENT_ESTIMATE_EXTENSION_ACK", transferId }, window.location.origin);
}

function applicableFee(fee) {
  if (isPetRelatedFee(fee)) return el("includePetFee").checked;
  if (fee.type === "personal") return state.estimateType === "personal";
  if (fee.type === "corporate") return state.estimateType === "corporate" && (fee.id !== "guaranteeCorporate" || el("includeCorporateGuarantee").checked);
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

function recipientHonorific() {
  return state.estimateType === "personal" ? "様" : "御中";
}

function recipientDisplayName() {
  const name = textValue("recipientName") || "お客様";
  if (/様$|御中$/.test(name) || name === "お客様") return name;
  return `${name} ${recipientHonorific()}`;
}

function corporateGuaranteeMessage() {
  if (state.estimateType !== "corporate") return "";
  return el("includeCorporateGuarantee").checked
    ? "法人宛のため、初回保証料を見積に含めています。不要な場合は「法人宛に初回保証料を含める」のチェックを外してください。"
    : "法人宛のため、初回保証料は見積に含めていません。保証会社利用が必要な場合は「法人宛に初回保証料を含める」にチェックしてください。";
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
  const calculated = Math.round(guaranteeBaseTotal() * (numberValue("guaranteeRate") / 100));
  return Math.max(calculated, Number(state.settings?.guaranteeMinimum || 0));
}

function syncGuaranteeFee() {
  const amount = guaranteeAmount();
  ["guaranteePersonal", "guaranteeCorporate"].forEach((id) => {
    const guaranteeFee = state.fees.find((fee) => fee.id === id);
    if (guaranteeFee) guaranteeFee.amount = amount;
  });
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
  ["guaranteePersonal", "guaranteeCorporate", "brokerageFee", "monthlyGuaranteeFee"].forEach((id) => {
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
  return Boolean(el("includeNextMonth").checked);
}

function proratableMonthlyFee(fee) {
  return ["rent", "commonFee", "parkingFee"].includes(fee.id) || fee.type === "optionalParking";
}

function skipProration(fee) {
  return Boolean(fee.noProrate) || !proratableMonthlyFee(fee);
}

function estimateMonthlyChargeFee(fee) {
  return ["monthly", "optionalParking"].includes(fee.type) && fee.id !== "monthlyGuaranteeFee" && !fee.noInitialEstimate;
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
  const monthlyRows = shouldIncludeNextMonthRent() ? nextMonthRows() : [];
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

function formatDateText(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return value;
  return `${year}/${month}/${day}`;
}

function plainAmount(value) {
  return `${Number(value || 0).toLocaleString("ja-JP")}円`;
}

function shareLine(label, value) {
  return `${label}: ${value || "-"}`;
}

function feeLinesForShare(rows, emptyText) {
  if (!rows.length) return [emptyText];
  return rows.map((fee) => `・${fee.label}: ${plainAmount(fee.amount)}（${timingLabel(fee.timing)}）`);
}

function summaryFeeLinesForShare(rows, emptyText) {
  if (!rows.length) return [emptyText];
  return rows.map((fee) => `・${fee.label}: ${plainAmount(fee.amount)}`);
}

function buildShareText({ kind, rows, monthlyRows, exitRows, property, notes }) {
  const lines = [
    "【賃貸初期費用のお見積り】",
    recipientDisplayName(),
    "",
    shareLine("物件名", `${property.title || ""}${property.room ? ` ${property.room}` : ""}`.trim()),
    shareLine("所在地", property.address),
    shareLine("交通", property.access),
    shareLine("間取り", property.layout),
    shareLine("専有面積", property.area),
    shareLine("入居開始日", formatDateText(el("moveInDate").value)),
    shareLine("見積区分", kind),
    "",
    `■ 初期費用合計: ${plainAmount(total())}`,
    ...feeLinesForShare(rows, "・初期費用項目はありません"),
    "",
    `■ 月額費用合計: ${plainAmount(monthlySummaryTotal())}`,
    ...summaryFeeLinesForShare(monthlyRows, "・月額費用項目はありません"),
    "",
    `■ 退去時費用合計: ${plainAmount(moveoutTotal())}`,
    ...summaryFeeLinesForShare(exitRows, "・退去時費用項目はありません"),
  ];

  const plainNotes = notes
    .map((note) => String(note).replace(/<[^>]*>/g, ""))
    .filter(Boolean);
  if (plainNotes.length) {
    lines.push("", "■ 備考", ...plainNotes.map((note) => `・${note}`));
  }

  lines.push("", `${storeInfo.name}`, `${storeInfo.address1}`, `${storeInfo.address2}`, `TEL ${storeInfo.tel}`);
  return lines.join("\n");
}

function renderShareText(context) {
  const textarea = el("shareText");
  if (!textarea) return;
  textarea.value = buildShareText(context);
}

async function copyShareText() {
  const textarea = el("shareText");
  const text = textarea?.value || "";
  if (!text) {
    el("status").textContent = "コピーする見積本文がありません。";
    return;
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
    }
    el("status").textContent = "メール・LINE貼付用の本文をコピーしました。";
  } catch {
    textarea.focus();
    textarea.select();
    el("status").textContent = "自動コピーできませんでした。本文欄を選択してコピーしてください。";
  }
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
      <select aria-label="区分" data-field="type" data-index="${index}">
        ${["initial", "monthly", "personal", "corporate", "optionalParking", "optionalAc", "optionalPet"].map((type) => `<option value="${type}" ${fee.type === type ? "selected" : ""}>${feeKindLabel(type)}</option>`).join("")}
      </select>
      <select aria-label="支払時期" data-field="timing" data-index="${index}">
        ${timingOptions().map((timing) => `<option value="${timing}" ${fee.timing === timing ? "selected" : ""}>${timingLabel(timing)}</option>`).join("")}
      </select>
      <button type="button" aria-label="削除" data-remove="${index}">×</button>
    `;
    wrap.appendChild(row);
  });
}

function renderGuaranteeTargets() {
  const wrap = el("guaranteeTargets");
  const candidates = state.fees.filter(guaranteeCandidate);
  const corporateMessage = corporateGuaranteeMessage();
  wrap.innerHTML = `
    ${corporateMessage ? `<div class="timing-notice corporate-guarantee-notice">${escapeHtml(corporateMessage)}</div>` : ""}
    <div class="target-summary">
      <span>${state.settings?.guaranteeMode === "fixed"
        ? "固定額で読込"
        : `対象合計 ${yen.format(guaranteeBaseTotal())}${Number(state.settings?.guaranteeMinimum || 0) ? ` / 最低 ${yen.format(Number(state.settings.guaranteeMinimum))}` : ""}`}</span>
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
  const estimateEl = el("estimate");
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
  const includeNextMonth = shouldIncludeNextMonthRent();
  const rentRuleNote = moveInParts
    ? includeNextMonth
      ? "翌月分を初期費用に含める設定のため、翌月分の月額費用を見積に含めています。日割は家賃、共益費・管理費、駐車場のみ計算し、その他の月額費用は日割せず入居月分を満額で含めています。"
      : "入居月の日割のみ見積に含めています。日割は家賃、共益費・管理費、駐車場のみ計算し、その他の月額費用は日割せず入居月分を満額で含めています。翌月分を含める場合は「翌月分を初期費用に含める」にチェックしてください。"
    : includeNextMonth
      ? "翌月分を初期費用に含める設定のため、翌月分の月額費用を見積に含めています。入居開始日が未入力のため、入居月の日割は計算していません。"
      : "";
  const notes = [
    rentRuleNote,
    freeRange ? "フリーレント期間に重なる賃料と共益費・管理費を控除しています。" : "",
    choiceFees.length ? `支払時期の選択が必要な項目があります（${escapeHtml(choiceFees.map((fee) => fee.label).join("、"))}）。要選択の項目は契約時候補として合計に含めています。退去時払いにする場合は、費用項目欄で支払時期を退去時に変更してください。` : "",
    corporateGuaranteeMessage(),
    el("includeFreeRentNote").checked && freeRent ? `<strong>${escapeHtml(freeRent)}</strong>` : "",
    "本見積はPDF記載内容をもとにした概算です。申込条件、入居日、管理会社確認により金額が変動する場合があります。",
    guaranteeNote ? `保証会社条件: ${escapeHtml(guaranteeNote)}` : "",
  ].filter(Boolean);

  estimateEl.className = `a4 ${rows.length + monthlyRows.length + exitRows.length > 26 ? "compact-print" : ""}`;
  estimateEl.innerHTML = `
    <div class="estimate-head">
      <div class="brand-block">
        <img class="store-logo" src="store-logo.png" alt="いい部屋ネット" />
        <div class="store-info">
          <strong>${escapeHtml(storeInfo.name)}</strong>
          <span>${escapeHtml(storeInfo.address1)}</span>
          <span>${escapeHtml(storeInfo.address2)}</span>
          <span>TEL ${escapeHtml(storeInfo.tel)}</span>
        </div>
      </div>
      <h2>初期費用御見積書 <span class="quote-kind">${kind}</span></h2>
      <div class="meta">
        発行日 ${escapeHtml(el("issueDate").value || today())}<br>
        問い合わせ番号 ${escapeHtml(property.inquiry || "-")}
      </div>
    </div>
    <div class="recipient">${escapeHtml(recipientDisplayName())}</div>
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
    <div class="estimate-body">
      <section class="main-costs">
        <table>
          <thead>
            <tr><th>項目</th><th>区分</th><th>支払時期</th><th class="amount">金額</th></tr>
          </thead>
          <tbody>
            ${rows.map((fee) => `<tr class="${fee.timing === "moveout" ? "moveout-row" : ""} ${fee.timing === "choice" ? "choice-row" : ""}"><td>${escapeHtml(fee.label)}</td><td>${feeKindLabel(fee.type)}</td><td>${timingLabel(fee.timing)}</td><td class="amount">${yen.format(Number(fee.amount || 0))}</td></tr>`).join("")}
          </tbody>
        </table>
      </section>
      <aside class="side-costs">
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
      </aside>
    </div>
  `;
  renderShareText({ kind, rows, monthlyRows, exitRows, property, notes });
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

function ruleTargetLabel(targetId) {
  return ruleTargets.find(([id]) => id === targetId)?.[1] || "追加項目";
}

function ruleTypeFor(targetId, timing) {
  const definition = targetDefinition(targetId);
  if (targetId === "monthlyGuaranteeFee" || timing === "monthly") return "monthly";
  if (definition) return definition[2];
  return genericFeeType(timing);
}

function renderUnknownRulesPanel() {
  const panel = el("unknownRulesPanel");
  const list = el("unknownRulesList");
  const summary = el("savedRulesSummary");
  const candidates = state.unknownFeeCandidates
    .map((fee, index) => ({ ...fee, originalIndex: index }))
    .filter((fee) => !findUserFeeRule(fee.label));
  const savedRules = readUserFeeRules();

  panel.hidden = !candidates.length && !savedRules.length;
  list.innerHTML = candidates.length
    ? candidates
        .map((fee) => {
          const timing = fee.timing || "initial";
          return `
            <div class="unknown-rule-row">
              <div class="unknown-rule-main">
                <strong>${escapeHtml(fee.label)}</strong>
                <span>${yen.format(Number(fee.amount || 0))} / ${timingLabel(timing)}</span>
              </div>
              <label>分類
                <select data-rule-target="${fee.originalIndex}">
                  ${ruleTargets.map(([id, label]) => `<option value="${id}">${escapeHtml(label)}</option>`).join("")}
                </select>
              </label>
              <label>支払時期
                <select data-rule-timing="${fee.originalIndex}">
                  ${timingOptions().map((item) => `<option value="${item}" ${item === timing ? "selected" : ""}>${timingLabel(item)}</option>`).join("")}
                </select>
              </label>
              <div class="unknown-rule-buttons">
                <button type="button" data-save-rule="${fee.originalIndex}">保存</button>
                <button type="button" data-ignore-rule="${fee.originalIndex}">無視</button>
              </div>
            </div>
          `;
        })
        .join("")
    : `<p class="section-help">未登録の候補はありません。保存済みルールは書き出して別PCに移せます。</p>`;

  summary.innerHTML = savedRules.length
    ? `保存済み追加ルール: ${savedRules.length}件 ${savedRules.slice(-5).map((rule) => `<span>${escapeHtml(rule.label)}=${escapeHtml(ruleTargetLabel(rule.targetId))}</span>`).join("")}`
    : "保存済み追加ルールはありません。";
}

function saveUnknownRule(index, targetId, timing) {
  const fee = state.unknownFeeCandidates[index];
  if (!fee) return;
  const finalTiming = targetId === "monthlyGuaranteeFee" ? "monthly" : timing;
  upsertUserFeeRule({
    label: fee.label,
    targetId,
    timing: finalTiming,
    type: ruleTypeFor(targetId, finalTiming),
  });
  if (state.lastData) {
    loadData(state.lastData);
  } else {
    state.unknownFeeCandidates.splice(index, 1);
    renderUnknownRulesPanel();
    renderEstimate();
  }
  el("status").textContent = `${fee.label} を「${ruleTargetLabel(targetId)}」として保存しました。`;
}

function ignoreUnknownRule(index) {
  const fee = state.unknownFeeCandidates[index];
  if (!fee) return;
  upsertUserFeeRule({ label: fee.label, targetId: "ignore", timing: "initial", type: "initial" });
  if (state.lastData) {
    loadData(state.lastData);
  } else {
    state.unknownFeeCandidates.splice(index, 1);
    renderUnknownRulesPanel();
    renderEstimate();
  }
  el("status").textContent = `${fee.label} は今後読み込まない項目として保存しました。`;
}

function exportUserRules() {
  const rules = readUserFeeRules();
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), rules }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "追加ルール.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  el("status").textContent = `追加ルール ${rules.length}件を書き出しました。`;
}

async function importUserRules(file) {
  const text = await readFileText(file);
  const data = JSON.parse(text);
  const incoming = Array.isArray(data) ? data : data.rules;
  if (!Array.isArray(incoming)) throw new Error("追加ルールJSONを読み取れませんでした。");
  const existing = readUserFeeRules();
  const merged = [...existing];
  incoming.forEach((rule) => {
    const label = normalizedRuleLabel(rule.label);
    if (!label) return;
    const index = merged.findIndex((item) => normalizedRuleLabel(item.label) === label);
    const next = {
      label,
      targetId: rule.targetId || "asExtra",
      type: rule.type || ruleTypeFor(rule.targetId || "asExtra", rule.timing || "initial"),
      timing: rule.timing || "initial",
      savedAt: rule.savedAt || new Date().toISOString(),
    };
    if (index >= 0) merged[index] = next;
    else merged.push(next);
  });
  writeUserFeeRules(merged);
  if (state.lastData) loadData(state.lastData);
  else renderUnknownRulesPanel();
  el("status").textContent = `追加ルールを読み込みました。保存済み ${merged.length}件です。`;
}

async function parsePdf(file) {
  const form = new FormData();
  form.append("pdf", file);
  el("status").textContent = "PDFを解析しています。";
  const response = await fetch("/api/parse-pdf", { method: "POST", body: form });
  if (!response.ok) {
    let message = "PDF解析に失敗しました。";
    try {
      const errorData = await response.json();
      if (errorData?.error) message = errorData.error;
    } catch {
      // Keep the default message when the server did not return JSON.
    }
    throw new Error(message);
  }
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
    if (target.dataset.field === "label" && normalizeManualFee(fee)) {
      renderFeeEditor();
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
  if (target.id === "importRulesInput" && target.files[0]) {
    importUserRules(target.files[0]).catch((error) => {
      el("status").textContent = error.message;
    });
    target.value = "";
    return;
  }
  if (target.dataset?.ruleTarget || target.dataset?.ruleTiming) {
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
  if (target.id === "insurancePaymentMode") {
    applyInsurancePaymentMode(target.value);
    renderFeeEditor();
    syncDerivedFees();
    renderGuaranteeTargets();
    updateGuaranteeFeeInput();
    renderEstimate();
    el("status").textContent = target.value === "monthly"
      ? "火災保険料を月払いとして月額費用に反映しました。"
      : "火災保険料を年払い・契約時払いとして初期費用に反映しました。";
    return;
  }
  if (["freeRentStart", "freeRentEnd", "includeNextMonth"].includes(target.id)) {
    renderEstimate();
    return;
  }
  if (target.id === "includeCorporateGuarantee") {
    syncDerivedFees();
    renderGuaranteeTargets();
    renderEstimate();
    el("status").textContent = corporateGuaranteeMessage();
    return;
  }
  if (target.dataset?.field) {
    const fee = state.fees[Number(target.dataset.index)];
    fee[target.dataset.field] = target.value;
    if (target.dataset.field === "label") normalizeManualFee(fee);
    if (fee.id === "insuranceFee" && ["type", "timing"].includes(target.dataset.field)) {
      applyInsurancePaymentMode(insurancePaymentModeFromFee(), { updateLabel: false });
      syncInsurancePaymentSelect();
    }
    syncDerivedFees();
    renderGuaranteeTargets();
    updateGuaranteeFeeInput();
  }
  renderEstimate();
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (target.dataset?.saveRule) {
    const index = Number(target.dataset.saveRule);
    const targetId = document.querySelector(`[data-rule-target="${index}"]`)?.value || "asExtra";
    const timing = document.querySelector(`[data-rule-timing="${index}"]`)?.value || "initial";
    saveUnknownRule(index, targetId, timing);
    return;
  }
  if (target.dataset?.ignoreRule) {
    ignoreUnknownRule(Number(target.dataset.ignoreRule));
    return;
  }
  if (target.dataset?.estimateType) {
    state.estimateType = target.dataset.estimateType;
    document.querySelectorAll("[data-estimate-type]").forEach((button) => {
      button.classList.toggle("active", button === target);
    });
    renderGuaranteeTargets();
    renderEstimate();
    if (state.estimateType === "corporate") {
      el("status").textContent = corporateGuaranteeMessage();
    }
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
  state.fees.push({ id: `custom-${Date.now()}`, label: "追加項目", amount: 0, type: "initial", timing: "initial", guaranteeTarget: false, noProrate: false, noInitialEstimate: false, derived: false });
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

el("exportRulesButton").addEventListener("click", exportUserRules);

el("printButton").addEventListener("click", () => window.print());
el("copyTextButton")?.addEventListener("click", copyShareText);

window.addEventListener("message", receiveExtensionData);

resetToBlank();
window.postMessage({ type: "RENT_ESTIMATE_APP_READY" }, window.location.origin);

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}
