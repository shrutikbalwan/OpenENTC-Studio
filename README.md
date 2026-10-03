# OpenENTC Studio

OpenENTC Studio is a free, open-source workspace for **Electronics and Telecommunication
Engineering (ENTC) students and teachers**. It runs in a web browser, or as a desktop app. It
combines circuit simulation, signals and control, communication, RF, digital logic, microcontrollers,
PCB layout, lab records and guided lessons in one project.

> **Status: unreleased alpha (0.1).** Expect rough edges. Results are simulations for learning. They are
> not certified measurements, and no feature is hardware-qualified. See [Limitations](#limitations).

## Quick start (about five minutes)

You need **Node.js 22.8.0 or newer** and Git. No other software or account is required.

```bash
git clone https://github.com/shrutikbalwan/OpenENTC-Studio.git
cd OpenENTC-Studio
npm ci          # installs development tools only; the app has no runtime dependencies
npm run dev     # starts a local server
```

Open <http://127.0.0.1:4173> in a current desktop browser (automated tests use Chromium; see the
[support matrix](docs/support-matrix.md)). Then:

1. Click **Open Circuit Lab**. The starter project is a 9 V supply with a 1 kΩ / 2 kΩ voltage divider.
2. Press **▶ Run DC analysis**. The middle node should read 6 V (9 V × 2 kΩ / 3 kΩ).
3. Change a resistor value, run again and compare.
4. Click **Export project** to save a `.entcproj` file you can import later.

After the first visit the app also works offline. Projects are stored in your browser, so export
them to keep a copy.

To check your setup the way CI does, run `npm run verify`.

## What is inside

- **Circuits:** a schematic editor with a built-in DC, transient and AC simulator, virtual bench instruments,
  SPICE export and an optional ngspice connection (desktop).
- **Signals, control and communication:** filter design, FFT, Bode/Nyquist/root locus, modulation, BER,
  coding, information theory.
- **RF and EM:** Smith chart, matching, transmission lines, antennas, radar and satellite links.
- **Digital and embedded:** logic minimisation, gate and Verilog simulation, 8051 and Arduino Uno
  simulators, a logic analyser, and optional HDL tools (desktop).
- **PCB, records and learning:** PCB layout with fabrication files, PDF lab records, lessons, quizzes
  and fault-finding practice.

The full catalogue is in [docs/features.md](docs/features.md). The state and limits of each
capability are recorded in [capabilities/ledger.json](capabilities/ledger.json).

## Limitations

- The built-in simulators are teaching models with documented simplifications
  ([model scope](docs/features.md#model-scope-and-limits)). Use ngspice or other professional tools for
  design work.
- External tools (ngspice, Arduino CLI, GHDL, Yosys, Verilator, nextpnr) are used only by the
  desktop app, and only when you install them and grant permission. The browser app never runs
  external programs.
- Physical-hardware use, clean-machine installers, code signing and independent expert review are
  **not yet done**. See [docs/support-matrix.md](docs/support-matrix.md) and
  [docs/modernization-progress.md](docs/modernization-progress.md).

## Documentation

| Topic | Where |
|---|---|
| Full feature list | [docs/features.md](docs/features.md) |
| Supported platforms and tools | [docs/support-matrix.md](docs/support-matrix.md) |
| Developer commands, builds and tool smoke tests | [docs/development.md](docs/development.md) |
| Architecture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/architecture/](docs/architecture/) |
| Project files and compatibility | [docs/project-compatibility-policy.md](docs/project-compatibility-policy.md) |
| Deprecations | [docs/deprecation-policy.md](docs/deprecation-policy.md) |
| Release process | [docs/governance/RELEASE-POLICY.md](docs/governance/RELEASE-POLICY.md), [docs/release-checklist.md](docs/release-checklist.md) |
| Maintainers | [docs/maintainers.md](docs/maintainers.md) |

## Contributing and security

- Contributions are welcome: read [CONTRIBUTING.md](CONTRIBUTING.md) and the
  [Code of Conduct](CODE_OF_CONDUCT.md).
- Report security problems privately as described in [SECURITY.md](SECURITY.md), not in a public issue.

## Licence

OpenENTC Studio is licensed under the **GNU General Public License, version 3 or (at your option) any
later version** (`GPL-3.0-or-later`). The full text is in [LICENSE](LICENSE), and the project notice is in
[NOTICE](NOTICE). Connected external tools keep their own licences.
