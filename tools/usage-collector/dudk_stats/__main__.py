import pprint
import sys

from export import export_rows, export_totals
from filters import Filters
from fetch import fetch_log
from helpers import check_env, parse_row

conn_details = check_env()
log = fetch_log(conn_details)

# Remove any log lines that do not match our expectations
parsed_log_lines = filter(
    lambda x: x is not None, [parse_row(r) for r in log.splitlines()]
)

# Apply any filters that are specified on the command line
args = dict([a.split("=") for a in sys.argv[1:]])
filters = Filters.parse_args(**args)
if filters:
    parsed_log_lines = filter(lambda x: filters.filter(x), parsed_log_lines)


# If we don't do this, the first iteration through the filter object
# will consume it so that we woiuld have to filter all over again.
parsed_log_lines = list(parsed_log_lines)

# Dump the log lines to a CSV
with open("stats.csv", "w") as f:
    export_rows(parsed_log_lines, f)


totals = export_totals(parsed_log_lines)

print("Raw stats have been written to stats.csv")
print("")
print("Event stats\n===========\n")
pprint.pp(totals["events"], indent=2, compact=True)
print("")
print("Client stats\n============\n")
pprint.pp(totals["clients"], indent=2, compact=True)
