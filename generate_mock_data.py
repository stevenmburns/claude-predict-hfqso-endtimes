import json
import numpy as np
from datetime import datetime, timedelta, timezone

rng = np.random.default_rng(42)

bands = [
    ("17m", 60),
    ("15m", 50),
    ("12m", 45),
    ("10m", 50),
]

records = []
current_time = datetime(2026, 3, 4, 17, 30, 0, tzinfo=timezone.utc)

for band, count in bands:
    for i in range(count):
        interval_minutes = rng.normal(loc=1.0, scale=0.1)
        current_time += timedelta(minutes=interval_minutes)
        pending = band == "10m" or (band == "12m" and i >= count - 25)
        record: dict = {"Band": band, "Completed": not pending}
        if not pending:
            record["Completed_Timestamp"] = current_time.isoformat()
        records.append(record)

with open("mock_data.json", "w") as f:
    json.dump(records, f, indent=2)

print(f"Generated {len(records)} records -> mock_data.json")
