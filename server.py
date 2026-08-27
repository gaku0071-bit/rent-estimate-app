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
from urllib.parse import quote, unquote


ROOT = Path(__file__).resolve().parent

DEFAULT_FEE_RULES = {
    "cleaningFee": [
        "室内清掃費用",
        "退去時室内清掃料",
        "退去時清掃費",
        "退去時清掃料",
        "退去清掃費",
        "退去清掃料",
        "室内清掃料",
        "室内清掃費",
        "清掃料",
        "清掃費",
        "清掃代",
        "ハウスクリーニング",
        "ハウスクリーニング料",
        "ハウスクリーニング費",
        "ハウスクリーニング代",
        "HC料",
        "HC費",
        "HC代",
        "ＨＣ料",
        "ＨＣ費",
        "ＨＣ代",
        "ルームクリーニング費用",
        "ルームクリーニング料",
        "ルームクリーニング費",
        "ルームクリーニング",
        "室内クリーニング料",
        "室内クリーニング費",
        "退室清掃料",
        "退室清掃費",
        "退室時清掃料",
        "退室時清掃費",
        "るーむくりーにんぐ費用",
        "るーむくりーにんぐ料",
        "るーむくりーにんぐ費",
        "家電清掃料",
    ],
    "waterSanitizingFee": [
        "退去時水廻消毒料",
        "退去時水廻り消毒料",
        "退去時水回消毒料",
        "退去時水回り消毒料",
        "水廻り消毒量",
        "水廻消毒料",
        "水廻り消毒料",
        "水廻り消毒費",
        "水廻り消毒代",
        "水廻消毒費",
        "水廻消毒代",
        "水回消毒料",
        "水回り消毒料",
        "水回り消毒料金",
        "水廻り消毒料金",
        "水回り消毒費",
        "水回り消毒代",
        "水回消毒代",
    ],
    "keyFee": [
        "カギ交換費用",
        "鍵交換費用",
        "カードキー設定交換料",
        "カードキー設定料",
        "カードキー設定変更料",
        "カードキー交換料",
        "シリンダー交換料",
        "シリンダ交換料",
        "シリンダー交換費",
        "シリンダ交換費",
        "シリンダー交換代",
        "シリンダ交換代",
        "鍵シリンダーローテーション費用",
        "鍵交換料",
        "鍵交換代",
        "カギ交換費",
    ],
    "antibacterialFee": [
        "抗菌施工料",
        "抗菌施工費",
        "抗菌処理料",
        "抗菌処理費",
        "抗菌消臭料",
        "抗菌消臭費",
        "室内抗菌料",
        "室内抗菌費",
        "除菌施工料",
        "除菌施工費",
        "除菌消臭料",
        "除菌消臭費",
        "室内消毒料",
        "室内消毒費",
        "消毒料",
        "消毒費",
        "消毒代",
        "抗菌代",
        "抗菌消毒料",
        "抗菌消毒費",
        "抗菌消臭代",
        "室内抗菌消臭料",
        "室内抗菌消臭費",
    ],
    "supportFee": [
        "24時間管理料",
        "24時間管理費",
        "24時間管理",
        "24時間サポート料",
        "24時間サポート費",
        "ホット２４hサービス",
        "ホット24hサービス",
        "ほっと２４hサービス",
        "ほっと24hサービス",
        "シャーメゾンSUPPORT24",
        "シャーメゾンＳＵＰＰＯＲＴ２４",
        "ギムサポートクラブ",
        "リペアサービス",
        "夜間サポート",
        "24時間サポート",
        "24時間駆けつけサービス",
        "24時間かけつけサービス",
        "安心サポート",
        "安心サポート24",
        "緊急サポート",
        "新生活サポート",
        "暮らしサポート",
        "ライフサポート",
        "管理サポート",
        "入居者サポート費用",
        "入居者サポート料",
        "タカラBB設備保守費",
        "くらしーど24",
        "くらしーど２４",
    ],
    "acCleaningFee": [
        "エアコン洗浄料",
        "エアコン清掃料",
        "エアコン清掃",
        "エアコン整備料",
        "エアコン分解清掃料",
        "エアコン分解整備料",
        "エアコンクリーニング",
        "エアコンクリーニング代",
    ],
    "stoveMaintenanceFee": [
        "ストーブ整備料",
        "暖房整備料",
        "暖房分解清掃料",
        "暖房分解清掃料金",
        "冷暖房機器清掃料",
        "冷暖房機器清掃費",
        "FF分解清掃料",
        "FF分解清掃費",
        "FF分解清掃費用",
        "FF清掃料",
        "FF清掃費",
        "ＦＦ清掃料",
        "ＦＦ清掃費",
        "FFストーブ分解清掃料",
        "冷暖房設備整備料",
        "エコジョーズ整備料",
    ],
    "deodorizingFee": [
        "退去時ペット消臭料",
        "退去時消臭料",
        "ペット消臭料",
        "ペット消臭費",
        "ペット消臭代",
        "消臭料",
        "消臭費",
    ],
    "petFee": [
        "ペット礼金",
        "ペット飼育時礼金",
        "ペット飼育料",
        "ペット飼育費",
        "ペット飼育時費用",
        "ペット一時金",
        "ペット清掃料",
        "ペット清掃費",
        "ペット消毒料",
        "ペット消毒費",
    ],
    "waterDrainFee": ["退去時エコジョーズ水落費用", "エコジョーズ水落費用", "水落費用", "水落し費用", "水抜き費用"],
    "gasLeaseFee": ["北ガス給湯器リース料", "水道料金", "水道料", "定額水道料", "上下水道料"],
    "townFee": ["町内会費", "町会費"],
    "monthlyGuaranteeFee": [
        "ライフ月額保証料",
        "月額保証料",
        "月額手数料",
        "月次保証料",
        "月額事務手数料",
        "収納代行手数料",
        "支払手数料",
        "口座振替料",
        "口振手数料",
        "引落手数料",
        "家賃等決済サービス利用料",
        "決済サービス利用料",
        "決済手数料",
        "月々決済手数料",
        "毎月決済手数料",
        "毎月保証料",
        "月々保証料",
        "保証会社月額手数料",
        "保証会社月額保証料",
    ],
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
    normalized = str(value).replace("，", ",")
    man_match = re.search(r"(\d+(?:\.\d+)?)\s*万", normalized)
    if man_match:
        return round(float(man_match.group(1)) * 10000)
    digits = re.sub(r"[^\d]", "", normalized)
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
            prefix = searchable_text[max(0, start - 16) : start]
            if label in {"消毒料", "消毒費", "消毒代"} and re.search(r"(?:水廻|水廻り|水回|水回り|水まわり|ペット)$", prefix):
                search_from = start + len(label)
                continue
            next_item = chunk.find("・", len(label))
            item_text = chunk[:next_item] if next_item != -1 else chunk
            if label in {"清掃料", "清掃費"} and re.search(r"(エアコン|暖房|ストーブ|冷暖房|FF)", prefix + item_text):
                search_from = start + len(label)
                continue
            if next_item != -1:
                following = chunk[next_item + 1 :]
                if following.startswith("退去時払い可"):
                    following_end = following.find("・")
                    item_text += "・" + (following[:following_end] if following_end != -1 else following)
            if re.search(rf"{re.escape(label)}\s*[:：]?\s*なし", item_text):
                return 0, label, "monthly" if "会費" in label else "initial"
            amount_match = re.search(r"([\d,，]+)\s*円", item_text)
            if amount_match:
                between_label_and_amount = item_text[len(label) : amount_match.start()]
                if re.search(r"駐車場|敷地内駐車場|駐車料|駐車区画", between_label_and_amount):
                    search_from = start + len(label)
                    continue
            amount = money_to_int(amount_match.group(1)) if amount_match else 0
            if amount:
                timing_text = item_text
                has_initial = "契約時" in timing_text or "入居時" in timing_text
                has_moveout = "退去時" in timing_text
                has_monthly = "月額" in timing_text
                is_choice = (
                    (has_initial and has_moveout)
                    or "退去時払い可" in timing_text
                    or re.search(r"(?:契約時|入居時)(?:または|もしくは|又は)退去時|退去時(?:または|もしくは|又は)(?:契約時|入居時)", timing_text)
                )
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


def pick_fixed_initial_guarantee(text: str) -> int:
    patterns = [
        r"(?:初回保証料|初回保証委託事務手数料|保証料|保証委託料|保証会社事務手数料)[^。・\n\r%]{0,40}?一律\s*[:：]?\s*([\d,，]+)\s*円",
        r"一律\s*([\d,，]+)\s*円[^。・\n\r%]{0,40}?(?:初回保証料|初回保証委託事務手数料|保証料|保証委託料|保証会社)",
        r"(?:初回保証料|初回保証委託事務手数料|保証会社事務手数料|保証委託料)[^。・\n\r%]{0,40}?([\d,，]+)\s*円",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.MULTILINE | re.DOTALL):
            chunk = text[max(0, match.start() - 4) : match.end()]
            if re.search(r"月額|月次|毎月|更新|年間", chunk) and not re.search(r"初回|新規契約時", chunk):
                continue
            amount = money_to_int(match.group(1))
            if amount:
                return amount
    return 0


def pick_initial_guarantee_rate(text: str) -> float:
    patterns = [
        r"(?:初回保証料|初回保証委託料|契約時保証料|初回保証会社保証料)[^%\d]{0,50}(\d+(?:\.\d+)?)%",
        r"(?:基本保証料|基本保証委託料)[^%\d]{0,50}(\d+(?:\.\d+)?)%",
        r"(?:月額賃料等|月額家賃等|賃料等|家賃等)[^%\d]{0,30}(\d+(?:\.\d+)?)%[^。・\n\r]{0,30}(?:初回|契約時)",
    ]
    for pattern in patterns:
        amount = pick_percent(pattern, text)
        if amount:
            return amount
    return 0


def extract_guarantee_note(text: str) -> str:
    patterns = [
        r"保証会社：(.+?)(?:。)?・保険\s*：",
        r"保証会社(?:必須|利用必須|利用可)?[:：](.+?)(?:【契約時費用】|・保険|保険:|保険：|$)",
        r"保証会社(?:必須|利用必須|利用可)?(.{0,260}?)(?:【契約時費用】|・保険|保険:|保険：|$)",
        r"機関保証「?([^。・\n\r]{0,220})",
        r"(D[‐-]support[^。・\n\r]{0,220})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.MULTILINE | re.DOTALL | re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return ""


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


def normalize_rate_text(text: str) -> str:
    value = str(text).translate(str.maketrans("０１２３４５６７８９．，％", "0123456789.,%"))
    value = re.sub(r"(?<=\d)\s+(?=\d)", "", value)
    value = re.sub(r"(?<=\d),(?=\d{1,2}\s*(?:%|パーセント))", ".", value)
    return value


GUARANTEE_MONTHLY_WORDS = r"月額|月次|毎月|月々|毎月継続|継続保証|口座振替|口振|引落|決済|収納代行|支払手数料"
GUARANTEE_INITIAL_WORDS = r"初回|契約時|保証委託料|初回保証料|初回保証委託料|新規契約時"
GUARANTEE_MONEY_PATTERN = r"(?:[\d,，]+\s*円|\d+(?:\.\d+)?\s*万(?:\s*円)?)"
GUARANTEE_MINIMUM_KEYWORD_PATTERN = r"(?:最低保証(?:委託)?料?(?!\s*(?:なし|無し|無|不要))|最低額(?!\s*(?:なし|無し|無|不要))|最低(?!保証|額)(?!\s*(?:なし|無し|無|不要))|下限(?!\s*(?:なし|無し|無|不要)))"


def guarantee_money_to_int(value: str | None) -> int:
    if not value:
        return 0
    normalized = normalize_rate_text(value)
    man_match = re.search(r"(\d+(?:\.\d+)?)\s*万\s*円", normalized)
    if man_match:
        return round(float(man_match.group(1)) * 10000)
    yen_match = re.search(r"([\d,，]+)\s*円", normalized)
    return money_to_int(yen_match.group(1)) if yen_match else 0


def _first_rate(patterns: list[str], text: str) -> float:
    for pattern in patterns:
        rate = pick_percent(pattern, text)
        if rate:
            return rate
    return 0.0


def _guarantee_initial_minimum(text: str, initial_rate: float) -> int:
    minimum = 0
    patterns = [
        rf"{GUARANTEE_MINIMUM_KEYWORD_PATTERN}[^。・\n\r]{{0,32}}?{GUARANTEE_MONEY_PATTERN}",
        rf"{GUARANTEE_MONEY_PATTERN}[^。・\n\r]{{0,32}}?{GUARANTEE_MINIMUM_KEYWORD_PATTERN}",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.MULTILINE | re.DOTALL):
            amount = guarantee_money_to_int(match.group(0))
            if not amount:
                continue
            local = text[max(0, match.start() - 48) : min(len(text), match.end() + 48)]
            before = text[max(0, match.start() - 120) : match.start()]
            monthly_near = re.search(GUARANTEE_MONTHLY_WORDS, local)
            initial_near = re.search(GUARANTEE_INITIAL_WORDS, before + local)
            if amount < 10000 and monthly_near:
                continue
            if monthly_near and not initial_near:
                continue
            if initial_rate or initial_near or amount >= 10000:
                minimum = max(minimum, amount)
    return minimum


def _guarantee_fixed_initial(text: str, initial_rate: float) -> int:
    if initial_rate:
        return 0
    patterns = [
        rf"(?:初回保証料|初回保証委託料|初回保証委託事務手数料|基本保証料|基本保証委託料|保証委託料|保証料|保証会社事務手数料)[^。・\n\r%]{{0,60}}?(?:一律|定額)\s*[:：]?\s*({GUARANTEE_MONEY_PATTERN})",
        rf"(?:一律|定額)\s*({GUARANTEE_MONEY_PATTERN})[^。・\n\r%]{{0,60}}?(?:初回保証料|初回保証委託料|初回保証委託事務手数料|保証委託料|保証料|保証会社)",
        rf"(?:初回保証料|初回保証委託料|初回保証委託事務手数料|基本保証料|基本保証委託料|保証委託料|保証会社事務手数料)\s*[:：]?\s*({GUARANTEE_MONEY_PATTERN})",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.MULTILINE | re.DOTALL):
            chunk = text[max(0, match.start() - 24) : min(len(text), match.end() + 24)]
            if re.search(r"最低|下限|%|パーセント", chunk):
                continue
            if re.search(r"月額|月次|毎月|月々|更新|年間|年額", chunk) and not re.search(r"初回|新規契約時|契約時", chunk):
                continue
            amount = guarantee_money_to_int(match.group(1))
            if amount:
                return amount
    return 0


def _guarantee_monthly_fixed(text: str, monthly_rate: float) -> int:
    if monthly_rate:
        return 0
    patterns = [
        rf"(?:月額保証料|月次保証料|月額保証委託料|月次保証委託料|月額保証委託事務手数料|集送金手数料|月額手数料|月額事務手数料|毎月保証料|月々保証料|支払手数料|収納代行手数料|決済手数料|月々決済手数料|毎月決済手数料|口座振替(?:サービス)?(?:利用)?料|口振(?:サービス)?(?:利用)?料|引落(?:サービス)?(?:利用)?料)[^。・\n\r%]{{0,80}}?({GUARANTEE_MONEY_PATTERN})",
        rf"(?:月額|毎月|月々)\s*[:：]?\s*({GUARANTEE_MONEY_PATTERN})",
        rf"(?:^|[（(・\s])月\s*({GUARANTEE_MONEY_PATTERN})",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.MULTILINE | re.DOTALL):
            matched_text = match.group(0)
            if re.search(r"最低|下限|更新|年間|年額|家賃等|賃料等|賃料総額", matched_text):
                continue
            amount = guarantee_money_to_int(match.group(1))
            if amount:
                return amount
    return 0


def _guarantee_monthly_fixed_extra(text: str, monthly_rate: float) -> int:
    if monthly_rate:
        direct_pattern = rf"(?:月額手数料|月額事務手数料|支払手数料|集送金手数料|収納代行手数料|決済手数料|口座振替(?:サービス)?(?:利用)?料|口振(?:サービス)?(?:利用)?料|引落(?:サービス)?(?:利用)?料)[^。・\n\r%]{{0,80}}?({GUARANTEE_MONEY_PATTERN})"
        direct_amount = sum(
            guarantee_money_to_int(match.group(1))
            for match in re.finditer(direct_pattern, text, re.MULTILINE | re.DOTALL)
        )
        if direct_amount:
            return direct_amount
    return sum(
        guarantee_money_to_int(match.group(1))
        for match in re.finditer(rf"(?:\+|＋)\s*[^+＋\d円]{{0,16}}?({GUARANTEE_MONEY_PATTERN})", text)
    )


def _guarantee_renewal_amount(text: str) -> int:
    patterns = [
        rf"(?:年間更新料|年次保証料|年間保証料|更新保証料|更新料|更新)[^。・\n\r]{{0,28}}?({GUARANTEE_MONEY_PATTERN})[^。・\n\r]{{0,10}}?(?:[/／]\s*年|年間|年額|年次)",
        rf"(?:年間|年次)[^。・\n\r]{{0,20}}?(?:更新料|保証料)[^。・\n\r]{{0,28}}?({GUARANTEE_MONEY_PATTERN})",
        rf"(?:年間更新料|年次保証料|年間保証料|更新保証料|継続保証委託料|継続保証料|更新料|更新)[^。・\n\r]{{0,28}}?(?:毎年|1年(?:毎|ごと)|年(?:毎|ごと)|年間|年額|年次)[^。・\n\r]{{0,28}}?({GUARANTEE_MONEY_PATTERN})",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.MULTILINE | re.DOTALL):
            if re.search(r"月額|月次|毎月|月々|\(月額\)|（月額）", match.group(0)):
                continue
            amount = guarantee_money_to_int(match.group(1))
            if amount:
                return amount
    return 0


def parse_guarantee_terms(text: str) -> dict[str, float | int | str]:
    normalized = normalize_rate_text(text).replace("％", "%")
    normalized = re.sub(r"[ \t]+", " ", normalized)
    initial_rate = _first_rate(
        [
            r"(?:初回保証料|初回保証委託料|初回保証委託事務手数料|基本保証料|基本保証委託料|契約時保証料|初回保証会社保証料|保証委託料|初回|契約時)[^。・\n\r/%]{0,80}?(\d+(?:\.\d+)?)\s*(?:%|パーセント)",
            r"(?:初回|契約時)[^。・\n\r]{0,80}?(?:月額賃料等|月額家賃等|賃料合計|賃料総額|総賃料|賃料等|家賃等)[^。・\n\r%]{0,40}?(\d+(?:\.\d+)?)\s*(?:%|パーセント)",
            r"(?:月額賃料等|月額家賃等|賃料合計|賃料総額|総賃料|賃料等|家賃等)[^。・\n\r%]{0,40}?(\d+(?:\.\d+)?)\s*(?:%|パーセント)[^。・\n\r]{0,40}?(?:初回|契約時)",
        ],
        normalized,
    )
    monthly_rate = _first_rate(
        [
            r"(?:月額保証料|月次保証料|月額保証委託料|月次保証委託料|月額保証委託事務手数料|集送金手数料|月額手数料|月額事務手数料|\[毎月\]保証料|毎月保証料|月々保証料|毎月継続保証料|継続保証料|支払手数料|収納代行手数料|決済手数料|月々決済手数料|毎月決済手数料|月額\s*/)[^。・\n\r%]{0,100}?(\d+(?:\.\d+)?)\s*(?:%|パーセント)",
            r"(?:月額|毎月|月々)(?!賃料|家賃|賃料等|家賃等)[^。・\n\r]{0,40}?(?:保証|手数料|賃料合計|賃料総額|総賃料)[^。・\n\r%]{0,60}?(\d+(?:\.\d+)?)\s*(?:%|パーセント)",
            r"(?:初回|初回保証料|契約時)[^。・\n\r]{0,50}?(?:%|パーセント)[^。・\n\r]{0,50}?(?:月額|毎月|月々)[^。・\n\r%]{0,60}?(\d+(?:\.\d+)?)\s*(?:%|パーセント)",
        ],
        normalized,
    )
    if re.search(rf"初回\s*\d+(?:\.\d+)?\s*(?:%|パーセント)[^。\n\r]{{0,40}}?(?:月|月額)\s*{GUARANTEE_MONEY_PATTERN}", normalized):
        monthly_rate = 0
    monthly_fixed_extras = _guarantee_monthly_fixed_extra(normalized, monthly_rate)
    initial_minimum = _guarantee_initial_minimum(normalized, initial_rate)
    fixed = _guarantee_fixed_initial(normalized, initial_rate)
    monthly_fixed = _guarantee_monthly_fixed(normalized, monthly_rate)
    renewal_amount = _guarantee_renewal_amount(normalized)
    return {
        "fixed": fixed,
        "initialRate": initial_rate,
        "initialMinimum": initial_minimum,
        "monthlyRate": monthly_rate,
        "monthlyFixed": monthly_fixed,
        "monthlyFixedExtra": monthly_fixed_extras,
        "renewalAmount": renewal_amount,
        "renewalPeriod": "annual" if renewal_amount else "none",
        "note": normalized.strip(),
    }


def last_money_amount(text: str) -> int:
    matches = re.findall(r"([\d,，]+)\s*円", text)
    return money_to_int(matches[-1]) if matches else 0


def infer_insurance_timing(text: str) -> str:
    return "monthly" if re.search(r"月額|毎月|月払い|月払|月々|/月|１ヶ月|1ヶ月", text or "") else "initial"


def pick_insurance_fee_info(text: str) -> tuple[int, str, str]:
    compact_text = re.sub(r"(?<=\d)\s+(?=\d)", "", text)
    patterns = [
        r"(?:家財保険|火災保険|保険)\s*[:：]\s*[^・\n\r]{0,120}?([\d,，]+)\s*円",
        r"(?:家財保険|火災保険|保険)\s+[^・\n\r]{0,120}?([\d,，]+)\s*円",
        r"(?:家財保険|火災保険|保険)[^・\n\r]{0,80}?要加入[^・\n\r]{0,80}?([\d,，]+)\s*円",
        r"(?:家財保険|火災保険|保険)[^・\n\r]{0,80}?(?:月額|毎月|月払い|月払|月々)[^・\n\r]{0,80}?([\d,，]+)\s*円",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, compact_text, re.MULTILINE | re.DOTALL):
            amount = money_to_int(match.group(1))
            chunk = match.group(0)
            timing = infer_insurance_timing(chunk)
            if timing == "monthly" and 100 <= amount <= 5000:
                return amount, timing, "火災保険料（月額）"
            if 100 <= amount <= 5000:
                return amount, "monthly", "火災保険料（月額）"
            if 10000 <= amount <= 50000:
                return amount, "initial", "火災保険料（年払い）"
            if timing == "monthly" and amount:
                return amount, timing, "火災保険料（月額）"
    return 0, "initial", "火災保険料（年払い）"


def pick_insurance_fee(text: str) -> int:
    amount, _, _ = pick_insurance_fee_info(text)
    return amount


def infer_fee_timing(text: str, label: str = "") -> str:
    has_initial = "契約時" in text or "入居時" in text
    has_moveout = "退去時" in text or "退居時" in text
    if (
        (has_initial and has_moveout)
        or "退去時払い可" in text
        or "退居時払い可" in text
        or re.search(r"(?:契約時|入居時)(?:または|もしくは|又は)(?:退去時|退居時)|(?:退去時|退居時)(?:または|もしくは|又は)(?:契約時|入居時)|(?:退去時|退居時)可", text)
    ):
        return "choice"
    if "月額" in text or "/月額" in text:
        return "monthly"
    if has_moveout or "退去時" in label:
        return "moveout"
    if re.search(r"更新時|更新料|更新手数料|更新事務手数料", f"{text}{label}"):
        return "choice"
    return "initial"


def generic_fee_type(timing: str) -> str:
    return "monthly" if timing == "monthly" else "initial"


def non_customer_fee_label(label: str) -> bool:
    if re.search(r"(?:無料)?インターネット[^。・\n\r]{0,32}?(?:初回|契約時)[^。・\n\r]{0,32}?事務手数料|(?:初回|契約時)[^。・\n\r]{0,32}?(?:無料)?インターネット[^。・\n\r]{0,32}?事務手数料", label):
        return False
    return bool(
        re.search(
            r"契約事務手数料|契約時事務手数料|事務手数料|契約手数料|書類作成|更新料|キャンセル|広告料|AD|仲介手数料|保険",
            label,
            re.IGNORECASE,
        )
    )


def remark_fee_label(label: str) -> bool:
    if re.search(r"事務手数料", label) and not re.search(r"更新事務手数料|契約更新事務手数料", label):
        return False
    return bool(
        re.search(
            r"都市ガス|ガス保証金|ガス保証料|北ガス|ガスリース|ガス.*リース|給湯器.*リース|リース料|更新料|更新手数料|更新事務手数料|契約更新事務手数料",
            label,
            re.IGNORECASE,
        )
    )


def inferred_extra_fee_category(label: str, context: str) -> str:
    value = f"{label}{context}"
    category_patterns = [
        ("monthlyGuaranteeFee", r"月額保証|月次保証|毎月保証|月々保証|月額保証委託料|月次保証委託料|月額保証委託事務手数料|集送金手数料|月額手数料|月額事務手数料|収納代行|支払手数料|口座振替|口振|引落|決済サービス|決済手数料"),
        ("cleaningFee", r"清掃|クリーニング|くりーにんぐ|退室|原状回復"),
        ("waterSanitizingFee", r"水廻|水回|水まわ|水周|水まわり"),
        ("keyFee", r"鍵|カギ|キー|シリンダ|シリンダー"),
        ("antibacterialFee", r"抗菌|除菌|消毒|殺菌"),
        ("supportFee", r"24|２４|サポート|リペア|安心|くらし|暮らし|ライフ|クラブ|緊急|駆けつけ|かけつけ|夜間受付|夜間緊急|夜間対応|アクセス24|見守り"),
        ("acCleaningFee", r"エアコン|AC|ＡＣ|空調"),
        ("stoveMaintenanceFee", r"ストーブ|暖房|FF|ＦＦ|冷暖房|エコジョーズ整備"),
        ("deodorizingFee", r"消臭|脱臭|防臭"),
        ("petFee", r"ペット|飼育"),
        ("waterDrainFee", r"水落|水抜|水落し|エコジョーズ"),
        ("gasLeaseFee", r"水道|給湯器|リース|北ガス|上下水"),
    ]
    for category, pattern in category_patterns:
        target = value if category == "monthlyGuaranteeFee" else label
        if re.search(pattern, target, re.IGNORECASE):
            return category
    return ""


def should_skip_extra_fee(label: str, context: str) -> bool:
    value = f"{label}{context}"
    if remark_fee_label(label):
        return False
    if re.search(r"無し|なし|不要|無料", value):
        return True
    if re.search(r"賃料|家賃|共益|管理費|敷金|礼金|保険|仲介|更新|広告|キャンセル|合計|小計|税込|税別|税額|請求|振込|日割|翌月|前家賃|駐車", label):
        return True
    if non_customer_fee_label(label):
        return True
    if re.search(r"取引態様|特記事項|条件|設備|セキュリティ|その他|曜日|営業時間|掲載|広告|転載", label):
        return True
    if re.search(r"保証会社|保証料|保証委託料", label) and not inferred_extra_fee_category(label, context) == "monthlyGuaranteeFee":
        return True
    if re.fullmatch(r"[\d,，.～〜/\\-]+", label):
        return True
    return False


def likely_fee_label(label: str, context: str) -> bool:
    value = f"{label}{context}"
    if inferred_extra_fee_category(label, context):
        return True
    if re.search(r"料|費|代|金|一時金|負担金|サポート|サービス|クラブ|清掃|消毒|整備|交換", label):
        return True
    if re.fullmatch(r"[A-Za-zＡ-Ｚａ-ｚ0-9０-９]{1,10}(?:料|費|代)", label):
        return True
    return bool(re.search(r"契約時|退去時|月額|入居時|毎月", value))


def extract_unregistered_fees(text: str, fee_rules: dict[str, list[str]]) -> list[dict]:
    known_labels = {label for labels in fee_rules.values() for label in labels}
    known_labels.update(
        {
            "賃料",
            "共益費",
            "共益費・管理費",
            "敷金",
            "礼金",
            "町内会費",
            "町会費",
            "保険",
            "初回保証料",
            "月額保証料",
        }
    )
    search_text = text.replace("\n", "")
    extras: list[dict] = []
    seen: set[tuple[str, int, str]] = set()
    fee_amount_pattern = r"(?:[\d,，]+\s*円|\d+(?:\.\d+)?\s*万(?:\s*円)?)"

    def add_candidate(label: str, context: str, amount: int) -> None:
        label = re.sub(r"\s+", "", label).strip("・:：、。○※-")
        label = re.sub(r"(契約時|退去時|月額|入居時|毎月|年額|更新時)$", "", label)
        if not label or not amount:
            return
        if not remark_fee_label(label) and any(known in label or label in known for known in known_labels):
            return
        if should_skip_extra_fee(label, context) or not likely_fee_label(label, context):
            return
        category = "remark" if remark_fee_label(label) else inferred_extra_fee_category(label, context)
        timing = "monthly" if category == "monthlyGuaranteeFee" else infer_fee_timing(context, label)
        fee_type = "remark" if category == "remark" else "monthly" if timing == "monthly" else "initial"
        key = (label, amount, timing)
        if key in seen:
            return
        seen.add(key)
        extras.append(
            {
                "id": f"extra-{len(extras) + 1}",
                "label": label,
                "amount": amount,
                "timing": timing,
                "type": fee_type,
                "guaranteeTarget": False,
                "noProrate": timing == "monthly",
                "noInitialEstimate": category in {"monthlyGuaranteeFee", "remark"},
            }
        )

    line_pattern = re.compile(
        rf"^\s*(?:○|※|・|-)?\s*([^：:\d円万]{{2,32}}?(?:料|費|代|金|一時金|負担金|サポート|サービス|クラブ|清掃|消毒|整備|交換)[^：:\d円万]{{0,12}})\s*(契約時|退去時(?:払い|支払|精算)?|月額|入居時|毎月|年額|更新時)?\s*({fee_amount_pattern})(.*)$"
    )
    for raw_line in text.splitlines():
        line = raw_line.strip()
        match = line_pattern.search(line)
        if not match:
            continue
        context = "".join(value or "" for value in match.groups())
        add_candidate(match.group(1), context, money_to_int(match.group(3)))

    patterns = [
        re.compile(rf"(?:^|・|○\s*)([^・：:\n]{{2,36}}?)[：:]\s*([^・]{{0,48}}?)({fee_amount_pattern})([^・]{{0,48}})"),
        re.compile(rf"(?:^|・|○\s*)([^・：:\n]{{2,36}}?)(?:\s|　)*(契約時|退去時(?:払い|支払|精算)?|月額|入居時|毎月|年額|更新時)?(?:\s|　)*(?:税込|非課税|課税|または|もしくは|又は|払い可|（税込）|\\(税込\\))*\s*({fee_amount_pattern})([^・]{{0,48}})"),
    ]

    for pattern in patterns:
        for match in pattern.finditer(search_text):
            context = "".join(value or "" for value in match.groups())
            add_candidate(match.group(1), context, money_to_int(match.group(3)))
    return extras


def extract_pdf_text(pdf_path: Path) -> str:
    pypdf = _load_pypdf()
    reader = pypdf.PdfReader(str(pdf_path))
    pages = [normalize_pdf_text(page.extract_text() or "") for page in reader.pages]
    return "\n".join(pages)


def looks_like_generated_estimate(text: str) -> bool:
    markers = [
        "初期費用御見積書",
        "お支払概算合計",
        "本見積はPDF記載内容をもとにした概算",
        "いい部屋ネット札幌大通店",
    ]
    return sum(marker in text for marker in markers) >= 2


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
    water_sanitizing_fee, water_sanitizing_label, water_sanitizing_timing = pick_labeled_money(
        fee_rules["waterSanitizingFee"],
        text,
    )
    key_fee, key_label, key_timing = pick_labeled_money(fee_rules["keyFee"], text)
    antibacterial_fee, antibacterial_label, antibacterial_timing = pick_labeled_money(fee_rules["antibacterialFee"], text)
    insurance_fee, insurance_timing, insurance_label = pick_insurance_fee_info(text)
    support_fee, support_label, support_timing = pick_labeled_money(fee_rules["supportFee"], text)
    if support_fee and support_timing == "initial" and re.search(r"24|２４|月額|リペアサービス|安心サポート|サポート|クラブ|くらし|暮らし|ライフ", support_label):
        support_timing = "monthly"
    ac_cleaning_fee, ac_cleaning_label, ac_cleaning_timing = pick_labeled_money(fee_rules["acCleaningFee"], text)
    stove_fee, stove_label, stove_timing = pick_labeled_money(fee_rules["stoveMaintenanceFee"], text)
    deodorizing_fee, deodorizing_label, deodorizing_timing = pick_labeled_money(fee_rules["deodorizingFee"], text)
    pet_fee, pet_label, pet_timing = pick_labeled_money(fee_rules["petFee"], text)
    water_drain_fee, water_drain_label, water_drain_timing = pick_labeled_money(fee_rules["waterDrainFee"], text)
    gas_lease_fee, gas_lease_label, gas_lease_timing = pick_labeled_money(fee_rules["gasLeaseFee"], text)
    if town_fee and town_timing == "initial":
        town_timing = "monthly"
    if gas_lease_fee and gas_lease_timing == "initial":
        gas_lease_timing = "monthly"
    inquiry = pick(r"お問い合わせ番号\s*([^\n]+)", text)
    free_rent = pick(r"(無条件FR\d+か月対象)", text)

    deposit_text = pick(r"敷金\s*([^\n]+)", text)
    deposit = parse_deposit_or_key_money("敷金", rent, text)
    key_money_text = pick(r"礼金\s*([^\n]+)", text)
    key_money = parse_deposit_or_key_money("礼金", rent, text)

    guarantee_note = extract_guarantee_note(text)
    monthly_subtotal = (
        rent
        + common_fee
        + (town_fee if town_timing == "monthly" else 0)
        + (support_fee if support_timing == "monthly" else 0)
        + (gas_lease_fee if gas_lease_timing == "monthly" else 0)
    )
    guarantee_text = f"{guarantee_note}\n{text}" if guarantee_note else text
    guarantee_text_for_rates = normalize_rate_text(guarantee_text)
    guarantee_terms = parse_guarantee_terms(guarantee_text_for_rates)
    monthly_guarantee_rate = float(guarantee_terms["monthlyRate"])
    monthly_fixed_extras = int(guarantee_terms["monthlyFixedExtra"])
    guarantee_renewal_amount = int(guarantee_terms["renewalAmount"])
    if monthly_guarantee_rate:
        monthly_guarantee_fee = int(monthly_subtotal * monthly_guarantee_rate / 100 + 0.5) + monthly_fixed_extras
        monthly_guarantee_label = (
            f"月額保証料（{monthly_guarantee_rate:g}%＋{monthly_fixed_extras:,}円）"
            if monthly_fixed_extras
            else f"月額保証料（{monthly_guarantee_rate:g}%）"
        )
        monthly_guarantee_timing = "monthly"
    elif int(guarantee_terms["monthlyFixed"]):
        monthly_guarantee_fee = int(guarantee_terms["monthlyFixed"])
        monthly_guarantee_label = "月額保証料"
        monthly_guarantee_timing = "monthly"
    else:
        monthly_guarantee_fee, monthly_guarantee_label, monthly_guarantee_timing = pick_labeled_money(
            fee_rules["monthlyGuaranteeFee"],
            guarantee_text,
        )
        if not monthly_guarantee_fee:
            monthly_guarantee_fee = money_to_int(pick(r"月額\s*[:：]?\s*([\d,，]+)円", guarantee_text))
            monthly_guarantee_label = "月額保証料" if monthly_guarantee_fee else monthly_guarantee_label
            monthly_guarantee_timing = "monthly" if monthly_guarantee_fee else monthly_guarantee_timing
    fixed_guarantee = int(guarantee_terms["fixed"]) or pick_fixed_initial_guarantee(guarantee_text_for_rates)
    initial_guarantee_rate = float(guarantee_terms["initialRate"]) or pick_initial_guarantee_rate(guarantee_text_for_rates)
    guarantee_minimum = int(guarantee_terms["initialMinimum"])
    calculated_initial_guarantee = int(monthly_subtotal * (initial_guarantee_rate / 100) + 0.5) if initial_guarantee_rate else 0
    initial_guarantee = fixed_guarantee or max(calculated_initial_guarantee, guarantee_minimum) if (fixed_guarantee or initial_guarantee_rate or guarantee_minimum) else 0
    initial_guarantee_label = "保証会社事務手数料" if fixed_guarantee and "事務手数料" in guarantee_text else "初回保証料"
    extracted_extra_fees = extract_unregistered_fees(text, fee_rules)
    remark_fees = [fee for fee in extracted_extra_fees if fee.get("type") == "remark"]
    extra_fees = [fee for fee in extracted_extra_fees if fee.get("type") != "remark"]

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
            "antibacterialFee": antibacterial_fee,
            "cleaningFee": cleaning_fee,
            "waterSanitizingFee": water_sanitizing_fee,
            "insuranceFee": insurance_fee,
            "townFee": town_fee,
            "supportFee": support_fee,
            "gasLeaseFee": gas_lease_fee,
            "parkingFee": parking_fee,
            "acCleaningFee": ac_cleaning_fee,
            "stoveMaintenanceFee": stove_fee,
            "deodorizingFee": deodorizing_fee,
            "petFee": pet_fee,
            "waterDrainFee": water_drain_fee,
            "monthlyGuaranteeFee": monthly_guarantee_fee,
            "guaranteePersonal": initial_guarantee,
            "guaranteeCorporate": 0,
        },
        "settings": {
            "depositText": deposit_text,
            "keyMoneyText": key_money_text,
            "guaranteeNote": guarantee_note,
            "guaranteeMode": "fixed" if fixed_guarantee else "percent" if initial_guarantee_rate else "none",
            "guaranteeRate": 0 if fixed_guarantee else initial_guarantee_rate,
            "guaranteeMinimum": guarantee_minimum,
            "guaranteeRenewalAmount": guarantee_renewal_amount,
            "guaranteeRenewalPeriod": "annual" if guarantee_renewal_amount else "none",
            "monthlyGuaranteeMode": "percent" if monthly_guarantee_rate else "fixed" if monthly_guarantee_fee else "none",
            "monthlyGuaranteeRate": monthly_guarantee_rate,
            "monthlyGuaranteeFixed": monthly_guarantee_fee if not monthly_guarantee_rate else 0,
            "monthlyGuaranteeFixedExtra": monthly_fixed_extras,
            "feeLabels": {
                "cleaningFee": cleaning_label,
                "waterSanitizingFee": water_sanitizing_label,
                "keyFee": key_label,
                "antibacterialFee": antibacterial_label,
                "supportFee": support_label,
                "townFee": town_label,
                "gasLeaseFee": gas_lease_label,
                "acCleaningFee": ac_cleaning_label,
                "stoveMaintenanceFee": stove_label,
                "deodorizingFee": deodorizing_label,
                "petFee": pet_label,
                "waterDrainFee": water_drain_label,
                "monthlyGuaranteeFee": monthly_guarantee_label,
                "guaranteePersonal": initial_guarantee_label,
                "insuranceFee": insurance_label,
                "keyMoney": "礼金",
            },
            "feeTimings": {
                "insuranceFee": insurance_timing,
                "cleaningFee": cleaning_timing,
                "waterSanitizingFee": water_sanitizing_timing,
                "keyFee": key_timing,
                "antibacterialFee": antibacterial_timing,
                "supportFee": support_timing,
                "townFee": town_timing,
                "gasLeaseFee": gas_lease_timing,
                "acCleaningFee": ac_cleaning_timing,
                "stoveMaintenanceFee": stove_timing,
                "deodorizingFee": deodorizing_timing,
                "petFee": pet_timing,
                "waterDrainFee": water_drain_timing,
                "monthlyGuaranteeFee": "monthly" if monthly_guarantee_fee else monthly_guarantee_timing,
                "keyMoney": "initial",
            },
            "feeTypes": {
                "insuranceFee": "monthly" if insurance_timing == "monthly" else "initial",
                "supportFee": "monthly" if support_timing == "monthly" else "initial",
                "townFee": "monthly" if town_timing == "monthly" else "initial",
                "gasLeaseFee": "monthly" if gas_lease_timing == "monthly" else "initial",
            },
            "includeParking": False,
            "includeAcCleaning": True,
            "includeCorporateGuarantee": False,
            "issueDate": pick(r"出力日:([0-9/]+)", text),
            "extraFees": extra_fees,
            "remarkFees": remark_fees,
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
            ".png": "image/png",
            ".zip": "application/zip",
        }.get(path.suffix, "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(path.stat().st_size))
        if path.suffix == ".zip":
            encoded_name = quote(path.name)
            self.send_header(
                "Content-Disposition",
                f"attachment; filename=extension-update.zip; filename*=UTF-8''{encoded_name}",
            )
        if path.suffix in {".html", ".css", ".js", ".json", ".zip"}:
            self.send_header("Cache-Control", "no-store")
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
        if looks_like_generated_estimate(text):
            self.send_response(422)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "このアプリで出力した見積PDFは読み込み対象外です。リアプロ等の物件概要PDFを読み込んでください。"}, ensure_ascii=False).encode("utf-8"))
            return
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
