from collections import Counter, defaultdict
from csv import writer as csv_writer
import sys


def export_rows(parsed_log_lines, f):
    writer = csv_writer(f)
    writer.writerow(["timestamp", "event", "client"])
    for mr in parsed_log_lines:
        writer.writerow([mr.tstamp.isoformat(), mr.event, mr.client_id])


def export_totals(parsed_log_lines):
    clients = defaultdict(Counter)
    event_counter = Counter()

    for mr in parsed_log_lines:
        icount, ccount = 0, 0
        if mr.event == "initialised":
            icount = 1
            event_counter.update(initialised=1)
        elif mr.event == "configured":
            ccount = 1
            event_counter.update(configured=1)

        clients[mr.client_id].update(total=1, initialised=icount, configured=ccount)

    return {
        "clients": {k: dict(v) for (k, v) in clients.items()},
        "events": dict(event_counter),
    }
