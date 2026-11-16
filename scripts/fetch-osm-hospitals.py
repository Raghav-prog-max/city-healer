"""
Download the OpenStreetMap health-facilities export for India (HDX, ODbL) into data/raw/osm/.

    python scripts/fetch-osm-hospitals.py
    npm run import-hospitals -- --dry-run      then without --dry-run

Source: Humanitarian Data Exchange, "India: Health Facilities (OpenStreetMap Export)"
https://data.humdata.org/dataset/hotosm_ind_health_facilities
Licence: Open Database License (ODbL). Credit "© OpenStreetMap contributors" wherever the data
is shown (the hospital cards do).

The export is regenerated regularly, so the checksum printed below will change over time;
the import keeps the OSM ids, so re-importing updates hospitals rather than duplicating them.
"""
import hashlib
import pathlib
import urllib.request
import zipfile

URL = "https://production-raw-data-api.s3.amazonaws.com/ISO3/IND/health_facilities/hotosm_ind_health_facilities_osm_geojson.zip"
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "raw" / "osm"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    zpath = OUT / "india_health_facilities_geojson.zip"
    print(f"downloading {URL}")
    req = urllib.request.Request(URL, headers={"User-Agent": "city-healer-data-fetch"})
    with urllib.request.urlopen(req, timeout=300) as r:
        zpath.write_bytes(r.read())
    print(f"  {zpath.stat().st_size // 1024} KB, sha256 {hashlib.sha256(zpath.read_bytes()).hexdigest()}")
    with zipfile.ZipFile(zpath) as z:
        for name in z.namelist():
            if name.startswith("/") or ".." in name:
                raise SystemExit(f"refusing unsafe path in zip: {name}")
        z.extractall(OUT)
    print(f"extracted to {OUT}")


if __name__ == "__main__":
    main()
