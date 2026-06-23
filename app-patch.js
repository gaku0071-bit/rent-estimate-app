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

function guaranteeMinimumAmount(text) {
  const value = String(text || "");
  return amountNear(
    value,
    /(?:初回保証料|初回保証委託料|保証委託料|初回)[^。・\n\r]{0,100}?(?:最低|下限)[^。・\n\r]{0,30}?(?:[\d,，]+|\d+(?:\.\d+)?\s*万)円/,
  ) || (
    /(?:初回保証料|初回保証委託料|保証委託料|初回)[^。・\n\r]{0,100}?(?:%|パーセント)/.test(value)
      ? amountNear(value, /(?:最低保証料|最低|下限)[^。・\n\r]{0,30}?(?:[\d,，]+|\d+(?:\.\d+)?\s*万)円/)
      : 0
  );
}

function initialGuaranteeRate(text) {
  const value = normalizeRateText(text);
  return Number(
    value.match(/(?:初回保証料|初回保証委託料|保証委託料|初回)[^%\d]{0,80}(\d+(?:\.\d+)?)(?:%|パーセント)/)?.[1] ||
      value.match(/(?:賃料合計|月額賃料|月額家賃|賃料等|家賃等)[^%\d]{0,30}(\d+(?:\.\d+)?)(?:%|パーセント)/)?.[1] ||
      0,
  );
}

function normalizeGuaranteeSettings(settings) {
  const note = settings?.guaranteeNote || "";
  const rate = initialGuaranteeRate(note);
  if (!rate) return settings;
  return {
    ...settings,
    guaranteeMode: "percent",
    guaranteeRate: rate,
    guaranteeMinimum: guaranteeMinimumAmount(note) || Number(settings.guaranteeMinimum || 0),
  };
}

function fixedGuaranteeAmount(text) {
  const value = String(text || "");
  const patterns = [
    /(?:初回保証料|保証料|保証委託料|保証会社事務手数料)[^。・\n\r%]{0,40}?一律\s*[:：]?\s*(?:[\d,，]+|\d+(?:\.\d+)?\s*万)円/g,
    /一律\s*(?:[\d,，]+|\d+(?:\.\d+)?\s*万)円[^。・\n\r%]{0,40}?(?:初回保証料|保証料|保証委託料|保証会社)/g,
    /(?:初回保証料|保証会社事務手数料|保証委託料)[^。・\n\r%]{0,40}?(?:[\d,，]+|\d+(?:\.\d+)?\s*万)円/g,
  ];
  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      const chunk = value.slice(Math.max(0, match.index - 4), match.index + match[0].length);
      if (/最低|下限/.test(chunk) || /%|パーセント/.test(chunk)) continue;
      if (/月額|月次|毎月|更新|年間/.test(chunk) && !/初回|新規契約時/.test(chunk)) continue;
      const amount = moneyToInt(match[0]);
      if (amount) return amount;
    }
  }
  return 0;
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
