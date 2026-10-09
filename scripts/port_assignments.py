"""Host services are allocated individually; container ports remain internal."""
import os
import re


def service_port(port):
    key = "TRAIN_LOOP_DASHBOARD_PORT" if port == 8024 else f"TRAIN_LOOP_SERVICE_{port}_PORT"
    return int(os.environ.get(key, port))


def mapped_url(value):
    return re.sub(r"(127\.0\.0\.1:)([0-9]+)", lambda m: m[1] + str(service_port(int(m[2]))), value)
