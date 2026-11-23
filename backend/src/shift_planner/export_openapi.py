"""Print the OpenAPI schema as JSON (used to generate frontend TypeScript types)."""

import json
import sys

from shift_planner.main import app


def main() -> None:
    json.dump(app.openapi(), sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
