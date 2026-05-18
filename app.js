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
    includeParking: false,
    includeAcCleaning: true,
    issueDate: "2026/05/17",
  },
};

const state = {
  estimateType: "personal",
  fees: [],
  lastData: null,
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
  ["カギ交換費用", "keyFee", "initial", false, "initial"],
  ["24時間管理料", "supportFee", "monthly", true, "monthly"],
  ["月額保証料", "monthlyGuaranteeFee", "monthly", false, "monthly"],
  ["町内会費", "townFee", "monthly", true, "monthly"],
  ["北ガス給湯器リース料", "gasLeaseFee", "monthly", true, "monthly"],
  ["エアコン洗浄料", "acCleaningFee", "optionalAc", false, "initial"],
  ["ストーブ整備料", "stoveMaintenanceFee", "initial", false, "initial"],
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
  el("includeFreeRentNote").checked = false;
  el("pdfInput").value = "";
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

  state.property = property;
  state.settings = settings;
  state.fees = feeDefinitions.map(([label, key, type, guaranteeTarget, timing]) => ({
    id: key,
    label: settings.feeLabels?.[key] || label,
    amount: amounts[key] || 0,
    type,
    timing: settings.feeTimings?.[key] || timing,
    guaranteeTarget,
    derived: ["guaranteePersonal", "brokerageFee"].includes(key),
  }));
  syncDerivedFees();
  renderGuaranteeTargets();
  renderFeeEditor();
  renderEstimate();
}

function applicableFee(fee) {
  if (fee.type === "personal") return state.estimateType === "personal";
  if (fee.type === "corporate") return state.estimateType === "corporate";
  if (fee.type === "optionalParking") return el("includeParking").checked;
  if (fee.type === "optionalAc") return el("includeAcCleaning").checked;
  return true;
}

function feeKindLabel(type) {
  return {
    initial: "契約時",
    monthly: "月額",
    personal: "個人",
    corporate: "法人",
    optionalParking: "月額",
    optionalAc: "任意",
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
  return ["monthly", "optionalParking"].includes(fee.type);
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

function syncDerivedFees() {
  syncGuaranteeFee();
  syncBrokerageFee();
}

function updateGuaranteeFeeInput() {
  ["guaranteePersonal", "brokerageFee"].forEach((id) => {
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
  return ["supportFee", "townFee"].includes(fee.id);
}

function proratedRows() {
  const days = numberValue("prorateDays");
  const monthDays = Math.max(numberValue("monthDays"), 1);
  if (!days) return [];
  return state.fees
    .filter((fee) => ["monthly", "optionalParking"].includes(fee.type) && applicableFee(fee) && !skipProration(fee))
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
    .filter((fee) => ["monthly", "optionalParking"].includes(fee.type) && applicableFee(fee))
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
    .filter((fee) => ["monthly", "optionalParking"].includes(fee.type) && applicableFee(fee) && skipProration(fee))
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
    acCleaningFee: 51,
    stoveMaintenanceFee: 52,
    keyFee: 60,
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
  const baseRows = state.fees.filter((fee) => applicableFee(fee) && fee.timing !== "moveout" && (!hasMoveInDate || !["monthly", "optionalParking"].includes(fee.type)));
  const monthlyRows = hasMoveInDate ? nextMonthRows() : [];
  return [...baseRows, ...proratedRows(), ...monthlyRows, ...monthlyFullRows(), ...freeRentDeductionRows()]
    .filter((fee) => fee.amount !== 0)
    .sort((a, b) => estimateRowOrder(a) - estimateRowOrder(b));
}

function total() {
  return estimateRows()
    .filter((fee) => fee.timing !== "choice")
    .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
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
        ${["initial", "monthly", "personal", "corporate", "optionalParking", "optionalAc"].map((type) => `<option value="${type}" ${fee.type === type ? "selected" : ""}>${feeKindLabel(type)}</option>`).join("")}
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
    choiceFees.length ? `支払時期の選択が必要な項目があります（${escapeHtml(choiceFees.map((fee) => fee.label).join("、"))}）。要選択の項目は合計から除外しています。` : "",
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
  const choices = timingChoiceFees();
  el("status").textContent = choices.length
    ? `${file.name} から物件情報を読み込みました。支払時期の選択が必要な項目があります。`
    : `${file.name} から物件情報を読み込みました。`;
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

el("printButton").addEventListener("click", () => window.print());

loadData(sampleData);

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}
