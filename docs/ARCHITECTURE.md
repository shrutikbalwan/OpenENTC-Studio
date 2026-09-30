# Architecture

## Product boundary

OpenENTC Studio is the project shell, user interface, learning layer and orchestration boundary. It does not copy the source code of every engineering application into one program. Specialist engines remain independently versioned processes.

```text
User interface
    ↓
Project and capability services
    ├── Built-in DC circuit engine
    ├── SPICE adapter → ngspice
    ├── PCB adapter → KiCad
    ├── MCU adapter → Arduino CLI / simavr
    ├── FPGA adapter → Yosys / nextpnr
    ├── DSP adapter → Octave / SciPy
    ├── Radio adapter → GNU Radio
    └── Network adapter → Wireshark
```

## Trust model

- Projects are local by default.
- Engine processes receive only the files required for a requested operation.
- Imported projects are validated before use.
- Native commands must use fixed argument arrays rather than shell strings.
- Each connector must report its executable, version, licence and capabilities.
- Generated artifacts should be written into a project-specific build directory.

## Desktop milestone

Tauri is the preferred desktop wrapper. The frontend can remain dependency-light while a Rust command layer provides engine discovery, process execution, USB/serial access and filesystem permissions. Every native command must have an explicit allow-list entry.

## Project format

The canonical manifest remains versioned and human-readable as `openentc.project.json`. Browser export packages that manifest in a deterministic, store-only `.entcproj` ZIP with strict size, header, entry-count, CRC and UTF-8 checks; legacy `.entc.json` files remain importable. Future schema changes should include migrations and never silently discard unknown data.
