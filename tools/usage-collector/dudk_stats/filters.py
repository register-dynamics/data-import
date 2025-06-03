from dataclasses import dataclass
from datetime import datetime, date


@dataclass
class Filters:
    start_date: date
    end_date: date
    client_id: str
    events: list

    def filter(self, metric_row):
        """
        If any filters were specified, makes sure the provided metric_row exists
        inside the filters, returning None if not. This means it can be used with
        something like the filter() builtin to remove non-matching items.
        """
        if self.start_date and metric_row.tstamp.date() < self.start_date:
            return None
        if self.end_date and metric_row.tstamp.date() > self.end_date:
            return None
        if self.client_id and self.client_id != metric_row.client_id:
            return None
        if self.events and metric_row.event not in self.events:
            return None
        return metric_row

    @classmethod
    def parse_args(klz, **kwargs):
        """
        Given the command line args in the format key="something" will parse
        them out into vars in an instance of this dataclass, ensuring they
        are in the correct type.
        """
        start = kwargs.get("start", None)
        end = kwargs.get("end", None)
        client = kwargs.get("client", None)
        events = kwargs.get("events", None)

        if start:
            start = datetime.strptime(start, "%d-%m-%Y").date()

        if end:
            end = datetime.strptime(end, "%d-%m-%Y").date()

        if events:
            events = [e.strip() for e in events.split(",")]

        return Filters(start_date=start, end_date=end, client_id=client, events=events)
