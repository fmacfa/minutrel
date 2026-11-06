import json
import os
import sys

results = json.loads(os.environ["CI_RESULTS"])
failed = [name for name, job in results.items() if job["result"] != "success"]
if failed:
    print("Contrôles non réussis : " + ", ".join(failed))
    sys.exit(1)
print("Tous les contrôles obligatoires ont réussi.")
