#!/usr/bin/env bash
set -euo pipefail
export PATH="/ucrt64/bin:/usr/bin:/mingw64/bin:${PATH}"
SOURCE_DIR="${1:-/c/Users/shrut/AppData/Local/Temp/ngspice-source}"
PREFIX_DIR="${2:-/c/Users/shrut/AppData/Local/Programs/ngspice}"
cd "$SOURCE_DIR"
./autogen.sh
rm -rf release64
mkdir release64
cd release64
  # Build the console-capable binary so deterministic batch simulations can be
  # exercised by CI and the desktop engine. The optional Windows GUI wrapper
  # is intentionally left to a separately packaged release build.
  ../configure --disable-xspice --enable-cider --enable-openmp --disable-debug --prefix="$PREFIX_DIR" CFLAGS="-std=gnu17 -O2" LDFLAGS=""
make -j"${MAKE_JOBS:-8}"
make install
