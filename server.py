from __future__ import annotations

import json
import os
import re
import socket
import sys
import tempfile
from email.parser import BytesParser
from email.policy import default
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parent

DEFAULT_FEE_RULES = {
    "cleaningFee": [
        "室内清掃費用",
        "退去時室内清掃料",
        "退去時水廻消毒料",
        "退去時水廻り消毒料",
        "退去時水回消毒料",
        "退去時水回り消毒料",
        "水廻り消毒量",
        "水廻消毒料",
        "水廻り消毒料",
        "水回消毒料",
        "水回り消毒料",
        "水回り消毒料金",
        "水廻り消毒料金",
        "退去時清掃費",
        "退去時清掃料",
        "室内清掃料",
        "室内清掃費",
        "清掃料",
        "ハウスクリーニング",
        "ハウスクリーニング料",
        "家電清掃料",
    ],
    "keyFee": [
        "カギ交換費用",
        "鍵交換費用",
        "カードキー設定交換料",
        "カードキー設定料",
        "カードキー交換料",
        "シリンダー交換料",
        "シリンダー交換費",
        "鍵シリンダーローテーション費用",
        "鍵交換料",
    ],
    "supportFee": [
        "24時間管理料",
        "24時間管理費",
        "シャーメゾンSUPPORT24",
        "シャーメゾンＳＵＰＰＯＲＴ２４",
        "ギムサポートクラブ",
        "リペアサービス",
        "夜間サポート",
        "24時間サポート",
        "安心サポート",
        "緊急サポート",
    ],
    "acCleaningFee": [
        "エアコン洗浄料",
        "エアコン清掃料",
        "エアコン清掃",
        "エアコン整備料",
        "エアコン分解清掃料",
        "エアコン分解整備料",
        "エアコンクリーニング",
    ],
    "stoveMaintenanceFee": [
        "ストーブ整備料",
        "暖房整備料",
        "暖房分解清掃料",
        "暖房分解清掃料金",
        "FF分解清掃料",
        "FFストーブ分解清掃料",
        "冷暖房設備整備料",
    ],
    "gasLeaseFee": ["北ガス給湯器リース料", "水道料金", "水道料", "定額水道料", "上下水道料"],
    "townFee": ["町内会費", "町会費"],
    "monthlyGuaranteeFee": ["ライフ月額保証料", "月額保証料", "月額手数料", "月次保証料", "月額事務手数料"],
}


def load_fee_rules() -> dict[str, list[str]]:
    rules = {key: labels[:] for key, labels in DEFAULT_FEE_RULES.items()}
    rules_path = ROOT / "fee_rules.json"
    if not rules_path.exists():
        return rules

    try:
        raw_rules = json.loads(rules_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return rules

    for key, value in raw_rules.items():
        labels = value.get("labels") if isinstance(value, dict) else value
        if not isinstance(labels, list):
            continue
        cleaned = [str(label).strip() for label in labels if str(label).strip()]
        if cleaned:
            merged = rules.get(key, [])[:]
            for label in cleaned:
                if label not in merged:
                    merged.append(label)
            rules[key] = merged
    return rules


def local_ip_addresses() -> list[str]:
    addresses: set[str] = set()
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127."):
                addresses.add(ip)
    except OSError:
        pass

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            ip = sock.getsockname()[0]
            if not ip.startswith("127."):
                addresses.add(ip)
    except OSError:
        pass

    return sorted(addresses)


def _load_pypdf():
    try:
        import pypdf  # type: ignore

        return pypdf
    except ModuleNotFoundError:
        runtime = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/python"
        if runtime.exists():
            sys.path.insert(0, str(runtime))
        import pypdf  # type: ignore

        return pypdf


def normalize_pdf_text(text: str) -> str:
    try:
        return text.encode("latin1").decode("cp932")
    except UnicodeError:
        return text


def money_to_int(value: str | None) -> int:
    if not value:
        return 0
    digits = re.sub(r"[^\d]", "", value)
    return int(digits) if digits else 0


def pick(pattern: str, text: str, default: str = "") -> str:
    match = re.search(pattern, text, re.MULTILINE | re.DOTALL)
    return match.group(1).strip() if match else default


def pick_labeled_money(labels: list[str], text: str) -> tuple[int, str, str]:
    searchable_text = text.replace("\n", "")
    for label in labels:
        search_from = 0
        while True:
            start = searchable_text.find(label, search_from)
            if start == -1:
                break
            chunk = searchable_text[start : start + 180]
            next_item = chunk.find("・", len(label))
            item_text = chunk[:next_item] if next_item != -1 else chunk
            if next_item != -1:
                following = chunk[next_item + 1 :]
                if following.startswith("退去時払い可"):
                    following_end = following.find("・")
                    item_text += "・" + (following[:following_end] if following_end != -1 else following)
            if re.search(rf"{re.escape(label)}\s*[:：]?\s*なし", item_text):
                return 0, label, "monthly" if "会費" in label else "initial"
            amount_match = re.search(r"([\d,，]+)円", item_text)
            amount = money_to_int(amount_match.group(1)) if amount_match else 0
            if amount:
                timing_text = item_text
                has_initial = "契約時" in timing_text
                has_moveout = "退去時" in timing_text
                has_monthly = "月額" in timing_text
                is_choice = (has_initial and has_moveout) or "退去時払い可" in timing_text
                timing = (
                    "choice"
                    if is_choice
                    else "monthly"
                    if has_monthly
                    else "moveout"
                    if has_moveout or (not has_initial and "退去時" in label)
                    else "initial"
                )
                return amount, label, timing
            search_from = start + len(label)
    return 0, labels[0], "initial"


def parse_deposit_or_key_money(label: str, rent: int, text: str) -> int:
    value = pick(rf"{label}\s*([^\n]+)", text)
    if not value or "なし" in value:
        return 0
    money = money_to_int(pick(r"([\d,，]+)円", value))
    if money:
        return money
    month_match = re.search(r"(\d+)ヶ月", value)
    if month_match:
        return rent * int(month_match.group(1))
    return 0


def pick_percent(pattern: str, text: str) -> float:
    value = pick(pattern, text)
    return float(value) if value else 0.0


def extract_pdf_text(pdf_path: Path) -> str:
    pypdf = _load_pypdf()
    reader = pypdf.PdfReader(str(pdf_path))
    pages = [normalize_pdf_text(page.extract_text() or "") for page in reader.pages]
    return "\n".join(pages)


def read_uploaded_pdf(handler: BaseHTTPRequestHandler) -> bytes | None:
    content_type = handler.headers.get("Content-Type", "")
    content_length = int(handler.headers.get("Content-Length", "0") or "0")
    if not content_type.startswith("multipart/form-data") or content_length <= 0:
        return None

    body = handler.rfile.read(content_length)
    message = BytesParser(policy=default).parsebytes(
        f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("utf-8") + body
    )
    for part in message.iter_parts():
        if part.get_param("name", header="content-disposition") == "pdf":
            payload = part.get_payload(decode=True)
            return payload if payload else None
    return None


def parse_property(text: str) -> dict:
    fee_rules = load_fee_rules()
    rent = money_to_int(pick(r"賃料\s*([\d,，]+)\s*円", text))
    common_fee = money_to_int(pick(r"共益費・管理費\s*([\d,，]+)円", text))
    parking_fee = money_to_int(pick(r"敷地内駐車場／[^／]*／([\d,，]+)円", text))
    town_fee, town_label, town_timing = pick_labeled_money(fee_rules["townFee"], text)
    cleaning_fee, cleaning_label, cleaning_timing = pick_labeled_money(fee_rules["cleaningFee"], text)
    key_fee, key_label, key_timing = pick_labeled_money(fee_rules["keyFee"], text)
    insurance_text = pick(r"保険：(.+?)・\s*(?:町内会費|ハウスクリーニング|室内清掃費用|退去時室内清掃料|カギ交換費用|鍵交換料|カードキー設定交換料)", text)
    insurance_fee = money_to_int(pick(r"([\d,，]+)円", insurance_text))
    support_fee, support_label, support_timing = pick_labeled_money(fee_rules["supportFee"], text)
    ac_cleaning_fee, ac_cleaning_label, ac_cleaning_timing = pick_labeled_money(fee_rules["acCleaningFee"], text)
    stove_fee, stove_label, stove_timing = pick_labeled_money(fee_rules["stoveMaintenanceFee"], text)
    gas_lease_fee, gas_lease_label, gas_lease_timing = pick_labeled_money(fee_rules["gasLeaseFee"], text)
    inquiry = pick(r"お問い合わせ番号\s*([^\n]+)", text)
    free_rent = pick(r"(無条件FR\d+か月対象)", text)

    deposit_text = pick(r"敷金\s*([^\n]+)", text)
    deposit = parse_deposit_or_key_money("敷金", rent, text)
    key_money_text = pick(r"礼金\s*([^\n]+)", text)
    key_money = parse_deposit_or_key_money("礼金", rent, text)

    guarantee_note = pick(r"保証会社：(.+?)(?:。)?・保険\s*：", text)
    monthly_subtotal = rent + common_fee + town_fee + support_fee + gas_lease_fee
    monthly_guarantee_rate = pick_percent(r"(?:月額保証料|月次保証料|月額手数料|月額事務手数料|\[毎月\]保証料)[^\d]*(\d+(?:\.\d+)?)%", guarantee_note)
    if monthly_guarantee_rate:
        monthly_guarantee_fee = int(monthly_subtotal * monthly_guarantee_rate / 100 + 0.5)
        monthly_guarantee_label = f"月額保証料（{monthly_guarantee_rate:g}%）"
        monthly_guarantee_timing = "monthly"
    else:
        monthly_guarantee_fee, monthly_guarantee_label, monthly_guarantee_timing = pick_labeled_money(
            fee_rules["monthlyGuaranteeFee"],
            guarantee_note or text,
        )
    fixed_guarantee = money_to_int(
        pick(r"(?:初回保証料|新規契約時\]事務手数料|事務手数料)\s*[:：]?\s*([\d,，]+)円", guarantee_note)
    )
    initial_guarantee = fixed_guarantee or int(monthly_subtotal * 0.5 + 0.5)
    initial_guarantee_label = "保証会社事務手数料" if fixed_guarantee and "事務手数料" in guarantee_note else "初回保証料"

    return {
        "property": {
            "title": pick(r"物件名\s*([^\n]+)", text),
            "room": pick(r"号室名\s*([^\n]+)", text),
            "address": pick(r"所在地\s*([^\n]+)", text),
            "access": " / ".join(re.findall(r"(?:地下|札幌市電)[^\n]+", text)[:2]),
            "structure": pick(r"建築構造\s*([^\n]+)", text),
            "layout": pick(r"間取タイプ\s*([^\n]+)", text),
            "area": pick(r"専有面積\s*([^\s]+)", text),
            "built": pick(r"築年\s*([^\n]+)", text),
            "moveIn": pick(r"空室\s*/\s*([^\n]+)", text),
            "inquiry": inquiry,
            "freeRent": free_rent,
        },
        "amounts": {
            "rent": rent,
            "commonFee": common_fee,
            "deposit": deposit,
            "keyMoney": key_money,
            "keyFee": key_fee,
            "cleaningFee": cleaning_fee,
            "insuranceFee": insurance_fee,
            "townFee": town_fee,
            "supportFee": support_fee,
            "gasLeaseFee": gas_lease_fee,
            "parkingFee": parking_fee,
            "acCleaningFee": ac_cleaning_fee,
            "stoveMaintenanceFee": stove_fee,
            "monthlyGuaranteeFee": monthly_guarantee_fee,
            "guaranteePersonal": initial_guarantee,
            "guaranteeCorporate": 0,
        },
        "settings": {
            "depositText": deposit_text,
            "keyMoneyText": key_money_text,
            "guaranteeNote": guarantee_note,
            "guaranteeMode": "fixed" if fixed_guarantee else "percent",
            "monthlyGuaranteeMode": "percent" if monthly_guarantee_rate else "fixed",
            "monthlyGuaranteeRate": monthly_guarantee_rate,
            "feeLabels": {
                "cleaningFee": cleaning_label,
                "keyFee": key_label,
                "supportFee": support_label,
                "townFee": town_label,
                "gasLeaseFee": gas_lease_label,
                "acCleaningFee": ac_cleaning_label,
                "stoveMaintenanceFee": stove_label,
                "monthlyGuaranteeFee": monthly_guarantee_label,
                "guaranteePersonal": initial_guarantee_label,
                "keyMoney": "礼金",
            },
            "feeTimings": {
                "cleaningFee": cleaning_timing,
                "keyFee": key_timing,
                "supportFee": support_timing,
                "townFee": town_timing,
                "gasLeaseFee": gas_lease_timing,
                "acCleaningFee": ac_cleaning_timing,
                "stoveMaintenanceFee": stove_timing,
                "monthlyGuaranteeFee": "monthly" if monthly_guarantee_fee else monthly_guarantee_timing,
                "keyMoney": "initial",
            },
            "includeParking": False,
            "includeAcCleaning": True,
            "issueDate": pick(r"出力日:([0-9/]+)", text),
        },
        "rawText": text,
    }


class AppHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        rel = unquote(self.path.split("?", 1)[0]).lstrip("/") or "index.html"
        path = (ROOT / rel).resolve()
        if not str(path).startswith(str(ROOT)) or not path.exists() or path.is_dir():
            self.send_error(404)
            return
        content_type = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
        }.get(path.suffix, "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.end_headers()
        self.wfile.write(path.read_bytes())

    def do_POST(self) -> None:
        if self.path != "/api/parse-pdf":
            self.send_error(404)
            return

        pdf_bytes = read_uploaded_pdf(self)
        if not pdf_bytes:
            self.send_error(400, "PDF file is required")
            return

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=True) as tmp:
            tmp.write(pdf_bytes)
            tmp.flush()
            text = extract_pdf_text(Path(tmp.name))
        payload = parse_property(text)
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))


def main() -> None:
    port = int(os.environ.get("PORT") or (sys.argv[1] if len(sys.argv) > 1 else 8787))
    server = ThreadingHTTPServer(("0.0.0.0", port), AppHandler)
    print(f"PC用URL: http://127.0.0.1:{port}", flush=True)
    for ip in local_ip_addresses():
        print(f"スマホ用URL: http://{ip}:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
