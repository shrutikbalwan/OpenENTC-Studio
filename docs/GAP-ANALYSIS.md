# Gap Analysis and Next-Level Roadmap

This document checks OpenENTC Studio against two things:

1. **What an ENTC student has to study**, using the SPPU E&TC 2019 syllabus (SE–BE, core
   and elective courses) as the reference.
2. **What existing tools offer** and where they fall short.

The gaps it finds become Phases 9–11. Phases 1–8 are already built; see
[ENTC-EXPANSION-ROADMAP.md](ENTC-EXPANSION-ROADMAP.md).

## 1. Existing tools and their gaps

| Tool | What it does well | Gap for an ENTC student |
|---|---|---|
| NI Multisim / ELVIS | SPICE, instruments, large part library | Paid licence and Windows only. Circuits only: no communication, DSP, EM or networks |
| Labcenter Proteus | MCU + circuit co-simulation, PCB | Paid. Only touches communication, DSP and VLSI |
| LTspice / ngspice / KiCad | Accurate SPICE, PCB | Expert user interface with no teaching, no explanations and no lab-record output |
| Falstad CircuitJS | Live animated circuits in a browser | Not SPICE-accurate, no magnetic coupling. Only circuits |
| Tinkercad Circuits / Wokwi | Arduino in the browser | Arduino-level only, no theory subjects. Needs internet and an account |
| MATLAB / Simulink | Everything, with toolboxes | Very costly. Students write code, so there is no guided lab experience |
| GNU Radio / Scilab / Octave | Free DSP and SDR | Code or flowgraph only, with no syllabus mapping. Hard to install on Windows |
| Logisim / EDA Playground | Digital logic, HDL | One subject each |
| Virtual Labs (vlab.co.in) | 31 ECE labs from IITs, free | Labs are separate websites with different styles. Needs a good internet connection. No common project, report, AI help or exam practice. Many older labs are fixed animations rather than real computation |

**Common gaps across all tools:**

- **G1 Fragmentation.** A student needs 8–10 different programs for one degree.
- **G2 Cost and platform.** The best tools are paid and/or Windows only.
- **G3 Connectivity.** Web tools need internet; Indian campuses and homes often have weak connections.
- **G4 No troubleshooting practice.** Real labs and jobs need fault finding, but simulators only show working circuits. Commercial fault simulators exist for industry training, not for students.
- **G5 No design-to-specification.** Tools analyse a circuit you already drew. Exams and projects ask you to *design* one, for example "design a Wien-bridge oscillator for 1 kHz".
- **G6 No grounded help.** Chatbots guess numbers. No tool checks its explanations against a real solver.
- **G7 Missing whole subjects.** No free tool covers radar, satellite, speech, PLC, measurement bridges or electrical machines alongside the rest.

## 2. Syllabus coverage gaps

| Course (SPPU 2019) | Before this phase | Gap |
|---|---|---|
| SE Electronic Circuits / LIC | Circuit Lab, op-amp, 555 | BJT/MOSFET bias **design**, oscillator design, active-filter design, regulators, Schmitt trigger, PLL |
| SE Electrical Circuits | Network Theory | Transformer, DC machine and induction motor |
| TE Digital Communication | Modulation, BER, line codes, Hamming/CRC/Viterbi | Information theory (entropy, Huffman, Shannon-Fano, LZW, capacity), spread spectrum (PN/Gold, DSSS, FHSS), OFDM |
| TE Electronic Measurements (elective) | Lab Bench instruments | AC bridges (Maxwell, Hay, Schering, Wien, Owen), Lissajous patterns, error and uncertainty analysis, Q-meter |
| TE Power Devices & Circuits | Power Electronics | SCR gate triggering (R, RC, UJT), snubber design, series/parallel SCR strings, MOSFET/IGBT loss |
| BE Radiation & Microwave Theory | Waveguides, S-parameters, arrays | Antenna parameters (aperture, Friis, horn, Yagi, helix, parabolic), microwave tubes (reflex klystron, magnetron), directional coupler |
| BE Radar / Satellite Communication | — | Radar range equation, Doppler, MTI blind speeds, pulse parameters; orbits (Kepler), look angles, satellite link budget with G/T and C/N₀ |
| BE Speech Processing (elective) | — | Short-time energy, zero-crossing rate, pitch (autocorrelation, AMDF), LPC (Levinson-Durbin), formants, cepstrum, MFCC, spectrogram |
| BE PLC, SCADA & Automation (elective) | — | Ladder-logic editor and scan-cycle simulator with timers, counters, latch/unlatch and examples |
| BE Electronic Product Design (elective) | Some calculators | Heat-sink thermal design, MTBF reliability, PCB trace width (IPC-2221), battery life |

## 3. Plan

| Phase | Items | Gaps closed |
|---|---|---|
| 9 | Information Theory & Spread Spectrum · Analog Design Studio (design-to-spec) · Electronic Measurements · Radar & Satellite · Antennas & Microwave Tubes · Speech Processing · PLC Ladder Lab · Electrical Machines & Power Devices · Product Design calculators | G5, G7 |
| 10 | **Fault Hunt**: fault-injection troubleshooting in Circuit Lab. The tool secretly opens, shorts or drifts a part; the student probes with the multimeter, names the fault and gets scored | G4 |
| 11 | **Offline app**: a service worker caches the whole studio, so it works with no internet after the first visit and can be installed on a phone or laptop | G2, G3 |

G1 is solved by the single workspace, and G6 by the AI lab partner (tool-checked answers).

Same rules as before: every computation has automated tests against textbook values or
SciPy, every feature gets a capability-ledger entry, and `npm run verify` stays green.

## Progress

- [x] Phase 9 — Information & Coding, Analog Design, Measurements, Radar & Satellite, Speech Processing, PLC & Automation, Machines & Devices, Product Design
- [x] Phase 10 — Fault Hunt (five boards, hidden faults, virtual multimeter, scoring and debrief)
- [x] Phase 11 — Offline app (service worker + web-app manifest; works with no internet after the first visit)

All three phases are built, tested and documented. Every gap from section 2 now has a lab, and
the common gaps G1–G7 are covered by the single workspace, the free and cross-platform build,
offline support, Fault Hunt, design-to-spec tools, the tool-checked AI partner and the new
subject labs.

## Sources

- SPPU E&TC 2019 curriculum structures:
  [Sanjivani COE](https://sanjivanicoe.org.in/images/NAAC/syllabus_structure_patternwise/ECE/ETC_2019_Pattern.pdf),
  [AVCOE BE revised syllabus](https://www.avcoe.org/pdf/syllbus/e&tc/B.E.%20E%20Tc%20Revised%20Syllabus_Final_01092022_compressed.pdf),
  [ZCOER BE course outcomes](https://zcoer.in/wp-content/uploads/2023/05/Course-Outcomes-BE2019-Pattern.pdf)
- [Virtual Labs ECE broad area](https://new.vlab.co.in/broad_area.php?ba_id=1);
  [connectivity limits of virtual and remote labs in India](https://online-journals.org/index.php/i-joe/article/download/5391/3848/18120)
- [Comparing circuit simulation tools in electronics labs (UMH)](https://portalinvestigacion.umh.es/documentos/692dc0867042d0300ad3adc7);
  [Falstad vs SPICE accuracy (EEVblog)](https://www.eevblog.com/forum/beginners/simulation-of-a-blinking-circuit-(falstad)/msg3412558/)
- [Instructor-induced faults in training simulators (US11417239B1)](https://patents.google.com/patent/US11417239);
  [industrial troubleshooting simulators](https://www.tpctraining.com/pages/electrical-troubleshooting-simulation-skill-set)

## Phase 12 — Real + Virtual Bench

One firmware runs on a real Arduino over USB (Web Serial) and, unchanged, on the simulated Uno
wired to the same circuit, so students compare hardware, simulation and theory on one plot. No
free tool listed in section 1 connects real hardware and its simulated twin this way.
