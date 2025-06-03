from fabric import Connection


def fetch_log(config):
    result = Connection(
        f"{config.username}@{config.host}:{config.port}",
        connect_kwargs={"key_filename": config.key_path},
    ).run(
        f"cat {config.remote_path}",
        hide=True,
    )

    return result.stdout
