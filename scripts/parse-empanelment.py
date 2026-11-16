"""
Read the official empanelled-hospital lists into one JSON file of hospitals and their
empanelled specialities.

    python scripts/parse-empanelment.py
    npm run enrich-hospitals

Sources (downloaded to data/raw/empanelment/, gitignored):
  DGEHS  "List of Empanelled Hospitals/ Centers under DGEHS", 26/06/2025, Govt. of NCT of Delhi
         https://dgehs.delhi.gov.in/sites/default/files/inline-files/om_24.pdf
  CGHS   "List of CGHS empanelled hospitals / diagnostic centres ... Delhi/NCR", consolidated
         list as on 22 December 2025 (circulated by the Bureau of Indian Standards)
         https://www.bis.gov.in/wp-content/uploads/2025/12/circular-and-200-cghs-cashless-consolidated-list-as-on-22-Dec-2025.pdf

Only facility data is kept: name, address, NABH status, empanelled specialities, validity.
The CGHS list also names staff contacts with personal phone numbers and e-mails; those
columns are deliberately not read.

Output: data/processed/empanelment.json
"""
import json
import pathlib
import re
import urllib.request

import pymupdf

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "empanelment"
OUT = ROOT / "data" / "processed" / "empanelment.json"

SOURCES = {
    "DGEHS": ("dgehs_2025-06-26.pdf", "https://dgehs.delhi.gov.in/sites/default/files/inline-files/om_24.pdf", "2025-06-26"),
    "CGHS": ("cghs_bis_2025-12-22.pdf", "https://www.bis.gov.in/wp-content/uploads/2025/12/circular-and-200-cghs-cashless-consolidated-list-as-on-22-Dec-2025.pdf", "2025-12-22"),
}

# Speciality wording in the lists -> the department names the app uses.
SPECIALITY_PATTERNS = [
    (r"cardiolog|cardiac|heart", "Cardiology"),
    (r"cardiothoracic|ctvs", "Cardiothoracic Surgery"),
    (r"general medicine|internal medicine", "General Medicine"),
    (r"general surgery", "General Surgery"),
    (r"gyn|obst", "Obstetrics & Gynaecology"),
    (r"ortho|joint replacement", "Orthopaedics"),
    (r"urolog", "Urology"),
    (r"nephrolog|dialysis", "Nephrology"),
    (r"neurosurg|neuro surg", "Neurosurgery"),
    (r"neurolog", "Neurology"),
    (r"gastro|\bgi surgery", "Gastroenterology"),
    (r"pulmonolog|respiratory|chest", "Pulmonology"),
    (r"paediatric|pediatric|neonat", "Paediatrics"),
    (r"\beye\b|ophthalm", "Ophthalmology"),
    (r"\bent\b|e\.n\.t", "ENT"),
    (r"dental|dentist", "Dentistry"),
    (r"cancer|oncolog|chemotherapy|radiotherapy", "Oncology"),
    (r"psychiatr|mental", "Psychiatry"),
    (r"dermatolog|skin", "Dermatology"),
    (r"plastic", "Plastic Surgery"),
    (r"vascular", "Vascular Surgery"),
    (r"transplant", "Transplant"),
    (r"endocrin|diabet", "Endocrinology"),
    (r"emergenc|trauma|critical care|\bicu\b", "Emergency & Critical Care"),
    (r"physiotherap|rehabilitat", "Physical Medicine & Rehabilitation"),
]
DIAGNOSTIC_ONLY = re.compile(r"^(?:[^a-z]*(?:x-?ray|usg|ultrasound|ct scan|mri|colou?r doppler|opg|mammography|bone densitometry|laboratory|lab|pathology|nuclear medicine|investigations?|and|&|,|\.|dental x-?ray|:)\s*)+$", re.I)
MULTI = re.compile(r"multi\s*-?\s*special|all (available )?special|all facilities", re.I)


def clean(s):
    return re.sub(r"\s+", " ", (s or "").replace("�", "'")).strip(" .,;")


def departments(text):
    t = text.lower()
    found = []
    for pattern, dept in SPECIALITY_PATTERNS:
        if re.search(pattern, t) and dept not in found:
            found.append(dept)
    return found


def facility_kind(name, specialities_text):
    n = f"{name} {specialities_text}".lower()
    if DIAGNOSTIC_ONLY.match(specialities_text or "") or re.search(r"diagnostic|imaging|path ?lab|patholog|laborator|scans?|ultrasound|mri", name.lower()):
        return "diagnostic"
    if re.search(r"ayurved|panchkarma|homoeo|homeo|unani|siddha|naturopath|yoga", n):
        return "ayush"
    if re.search(r"dental", name.lower()) or re.fullmatch(r"all available dental care facilities", clean(specialities_text).lower()):
        return "dental"
    if re.search(r"eye (care|centre|center|clinic)|exclusive eye", n):
        return "eye centre"
    return "hospital"


def split_name_address(cell):
    """DGEHS puts name and address in one cell: 'Jeewan Mala Hospital 67/1 & 66A/2, New Rohtak Road Delhi-05'."""
    s = clean(cell)
    m = re.search(r"(,|\s(?=\d)|\s(?=[A-Z]{1,3}-\d)|\s(?=(Plot|Sector|Sec\.|Opp|Near|Main|Road|Marg|Block|Pocket|Khasra|Village|Vill\.|H\.? ?No)\b))", s)
    if m and m.start() > 6:
        return s[: m.start()].strip(" ,."), s[m.start():].strip(" ,.")
    return s, ""


def rows_of(pdf):
    doc = pymupdf.open(pdf)
    for page in doc:
        for t in page.find_tables().tables:
            for r in t.extract():
                yield [clean(c) for c in r]


def parse_dgehs(pdf):
    out, current = [], None
    for r in rows_of(pdf):
        cells = [c for c in r]
        first = cells[0] if cells else ""
        if not any(cells) or first.lower().startswith("s. no") or re.fullmatch(r"[ivx]+\.\s*[a-z ]+", first.lower()):
            continue
        if re.fullmatch(r"\d+\.?", first):
            name_cell = next((c for c in cells[1:] if c and not re.fullmatch(r"\d+", c)), "")
            spec = cells[-1]
            nabh = next((c for c in cells[2:-1] if re.search(r"nabh|nabl|empanelled", c, re.I)), "")
            name, address = split_name_address(name_cell)
            current = {"scheme": "DGEHS", "name": name, "address": address, "nabh": nabh, "specialities": spec}
            out.append(current)
        elif current is not None:
            # A continuation row of the previous entry.
            if cells[-1]:
                current["specialities"] = clean(current["specialities"] + " " + cells[-1])
    return out


def parse_cghs(pdf):
    out, current = [], None
    for r in rows_of(pdf):
        if len(r) < 7 or r[1].lower().startswith("name of the hospital"):
            continue
        sl, name, address, _contact, _email, nabh, spec = r[:7]
        validity = r[7] if len(r) > 7 else ""
        if re.fullmatch(r"\d+\.?", sl):
            current = {"scheme": "CGHS", "name": name, "address": address, "nabh": nabh, "specialities": spec, "validity": validity}
            out.append(current)
        elif current is not None:
            for key, val in (("name", name), ("address", address), ("nabh", nabh), ("specialities", spec), ("validity", validity)):
                if val:
                    current[key] = clean(current.get(key, "") + " " + val)
    return out


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    for scheme, (fname, url, _date) in SOURCES.items():
        if not (RAW / fname).exists():
            print(f"downloading {scheme} list ...")
            req = urllib.request.Request(url, headers={"User-Agent": "city-healer-data-fetch"})
            with urllib.request.urlopen(req, timeout=120) as r:
                (RAW / fname).write_bytes(r.read())

    entries = parse_dgehs(RAW / SOURCES["DGEHS"][0]) + parse_cghs(RAW / SOURCES["CGHS"][0])
    result = []
    for e in entries:
        e = {k: clean(v) for k, v in e.items()}
        if not e["name"]:
            continue
        e["kind"] = facility_kind(e["name"], e["specialities"])
        e["departments"] = departments(e["specialities"]) if e["kind"] == "hospital" else []
        e["multiSpeciality"] = bool(MULTI.search(e["specialities"]))
        e["nabhAccredited"] = bool(re.search(r"\bnabh\b", e["nabh"], re.I)) and not re.search(r"non[- ]?nabh", e["nabh"], re.I)
        e["sourceDate"] = SOURCES[e["scheme"]][2]
        # Entries the list itself marks as suspended, closed or exited are not empanelled.
        e["inactive"] = bool(re.search(r"suspend|closure|closed|exit(ed)? from|de-?empanel|not interested", f"{e['name']} {e['address']} {e['specialities']}", re.I))
        result.append(e)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"sources": {k: {"url": v[1], "date": v[2]} for k, v in SOURCES.items()}, "facilities": result}, ensure_ascii=False, indent=1), encoding="utf8")
    from collections import Counter
    print(f"{len(result)} entries:", dict(Counter((e['scheme'], e['kind']) for e in result)))
    hospitals = [e for e in result if e["kind"] == "hospital"]
    print(f"hospitals with departments: {sum(1 for e in hospitals if e['departments'])}, multi-speciality: {sum(1 for e in hospitals if e['multiSpeciality'])}, NABH: {sum(1 for e in hospitals if e['nabhAccredited'])}")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
