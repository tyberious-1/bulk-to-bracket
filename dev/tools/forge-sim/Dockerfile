# Test-only: runs Forge (open-source MTG engine) headless so we can play our built decks against each other.
# Not part of the app. Build:  docker build -t btb-forge dev/tools/forge-sim
# Run:  see README.md in this folder.
FROM eclipse-temurin:17-jre
ARG FORGE_VERSION=2.0.16
RUN apt-get update && apt-get install -y --no-install-recommends bzip2 curl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN mkdir /forge && cd /forge \
 && curl -fsSL -A "bulk-to-bracket-sim/1.0" -o f.tar.bz2 "https://github.com/Card-Forge/forge/releases/download/forge-${FORGE_VERSION}/forge-installer-${FORGE_VERSION}.tar.bz2" \
 && tar xjf f.tar.bz2 && rm f.tar.bz2 && ls
WORKDIR /forge
ENTRYPOINT ["/bin/bash"]
