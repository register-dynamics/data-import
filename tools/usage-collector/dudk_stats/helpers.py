from dataclasses import dataclass
from datetime import datetime
import os
import re
import sys


@dataclass
class ConnectionDetails:
    name: str
    port: int
    username: str
    key_path: str

    def __init__(self, environ):
        self.host = environ["DUDK_SERVER_HOST"]
        self.port = environ["DUDK_SERVER_PORT"]
        self.username = environ["DUDK_SERVER_USER"]
        self.key_path = os.path.expanduser(environ["DUDK_SERVER_KEY"])
        self.remote_path = environ["DUDK_SERVER_PATH"]


def check_env() -> ConnectionDetails:
    missing = list(
        filter(
            lambda x: x not in os.environ,
            [
                "DUDK_SERVER_HOST",
                "DUDK_SERVER_PORT",
                "DUDK_SERVER_USER",
                "DUDK_SERVER_PATH",
                "DUDK_SERVER_KEY",
            ],
        )
    )

    if any(missing):
        for m in missing:
            sys.stderr.write(f"'{m}' is not defined and is required\n")
        sys.exit(1)

    return ConnectionDetails(os.environ)


@dataclass
class MetricRow:
    tstamp: datetime
    event: str
    client_id: str


ROW_RE = re.compile(r"\[(.*?)\]\s+(\S+)\s+(\d{3})")
EVENT_RE = re.compile(r"\/dudk-metrics/(.*)/(.*)")
UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$"
)


def parse_row(row: str) -> MetricRow:
    match = ROW_RE.match(row)
    if not match:
        return None

    timestamp, filepath, status_code = match.groups()
    timestamp_dt = datetime.strptime(timestamp, "%d/%b/%Y:%H:%M:%S %z")

    matches = EVENT_RE.match(filepath)
    if not matches:
        return None

    client_id, event = matches.groups()

    # client_id should look like a uuid or it's prob a junk record.
    if not UUID_RE.match(client_id):
        return None

    return MetricRow(
        tstamp=timestamp_dt,
        event=event,
        client_id=client_id,
    )
