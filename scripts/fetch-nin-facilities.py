"""
Download the government health-facility registry for the Delhi NCR area into data/raw/nin/.

    python scripts/fetch-nin-facilities.py
    npm run enrich-hospitals

Source: "Hospital Directory (National Health Portal): NIN Health Facilities with Geo Code and
additional parameters" (Ministry of Health and Family Welfare / NIHFW, Open Government Data
Platform India), as served by Esri India's Living Atlas:
https://livingatlas.esri.in/server/rest/services/LivingAtlas/IND_Hospital_Directory/MapServer/0
Licence: Government Open Data License - India (attribute the source).

It has facility name, type (e.g. "District Hospital", "100-500 Bedded Hospital"), address,
landline and coordinates. It has no departments and no live bed numbers.
"""
import json
import pathlib
import urllib.parse
import urllib.request

URL = "https://livingatlas.esri.in/server/rest/services/LivingAtlas/IND_Hospital_Directory/MapServer/0/query"
BOX = {"xmin": 76.8, "ymin": 28.2, "xmax": 77.65, "ymax": 28.95, "spatialReference": {"wkid": 4326}}
FIELDS = "objectid,health_facility_name,facility_type,address,locality,posatalcode,landline_number,state_name,district_name,lat,lon"
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "raw" / "nin"


def page(offset: int):
    q = urllib.parse.urlencode({
        "where": "1=1", "geometry": json.dumps(BOX), "geometryType": "esriGeometryEnvelope", "inSR": 4326,
        "spatialRel": "esriSpatialRelIntersects", "outFields": FIELDS, "returnGeometry": "false",
        "orderByFields": "objectid", "resultOffset": offset, "resultRecordCount": 1000, "f": "json",
    })
    req = urllib.request.Request(f"{URL}?{q}", headers={"User-Agent": "city-healer-data-fetch"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.load(r)
    if "error" in data:
        raise SystemExit(f"registry query failed: {data['error']}")
    return [f["attributes"] for f in data.get("features", [])]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows, offset = [], 0
    while True:
        batch = page(offset)
        rows += batch
        if len(batch) < 1000:
            break
        offset += 1000
    (OUT / "nin_ncr_facilities.json").write_text(json.dumps(rows, ensure_ascii=False), encoding="utf8")
    print(f"{len(rows)} facilities saved to {OUT / 'nin_ncr_facilities.json'}")


if __name__ == "__main__":
    main()
