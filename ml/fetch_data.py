"""
Download the public datasets the City Healer models are trained on, into ml/raw/ (gitignored).

    python ml/fetch_data.py

Each file is checked against the SHA-256 it had when the models in this repository were
trained, so a changed upstream file is noticed instead of silently giving different models.

  pima.csv               Pima Indians Diabetes Database (NIDDK; via UCI / Jason Brownlee mirror)  -> ml/train_lab.py
  cleveland.data         UCI Heart Disease, Cleveland Clinic Foundation                           -> ml/train_lab.py
  ilpd.csv               UCI Indian Liver Patient Dataset (ILPD)                                  -> ml/train_lab.py
  medicine_details.csv   Medicine_Details (Hugging Face MattBastar/Medicine_Details; from 1mg)     -> ml/build_medicine_index.py
  indian_foods_5000.json 5000 Indian Foods Nutrition Dataset (thebarbellcrew, MIT)                -> ml/train_diet.py

The symptom-triage data (gretelai/symptom_to_diagnosis) is already in ml/data/.
"""
import hashlib
import pathlib
import sys
import urllib.request

RAW = pathlib.Path(__file__).resolve().parent / "raw"

FILES = {
    "pima.csv": ("https://raw.githubusercontent.com/jbrownlee/Datasets/master/pima-indians-diabetes.data.csv",
                 "6bfe5d0f379d17a0e0819b996407e3c09bf80febd4287f2ed212190dfff154af"),
    "cleveland.data": ("https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data",
                       "a74b7efa387bc9d108d7d0115d831fe9b414b29ae7124f331b622b4efa0427c8"),
    "ilpd.csv": ("https://archive.ics.uci.edu/ml/machine-learning-databases/00225/Indian%20Liver%20Patient%20Dataset%20(ILPD).csv",
                 "84feac16488de5cf89bd22bd802c77f25841fe93e9ddd32355683e94d46c3425"),
    "medicine_details.csv": ("https://huggingface.co/datasets/MattBastar/Medicine_Details/resolve/main/Medicine_Details.csv",
                             "88605620167a34cec347a8130525042d26a5920ad9cf9b4d7c695aaf2e123e38"),
    "indian_foods_5000.json": ("https://huggingface.co/datasets/thebarbellcrew/indian-food-nutrition-5k/resolve/main/indian_foods_5000.json",
                               "b09164674edbd24ddd7d66c7beab2d3a2d4a448089caebe20fa6478328de7f01"),
}


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    RAW.mkdir(exist_ok=True)
    bad = 0
    for name, (url, expected) in FILES.items():
        target = RAW / name
        if not target.exists():
            print(f"downloading {name} ...")
            req = urllib.request.Request(url, headers={"User-Agent": "city-healer-ml-fetch"})
            with urllib.request.urlopen(req, timeout=120) as r:
                target.write_bytes(r.read())
        actual = sha256(target)
        if actual == expected:
            print(f"  ok        {name}")
        else:
            bad += 1
            print(f"  CHANGED   {name}: sha256 {actual} (trained on {expected}). Retrained models may differ.")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
