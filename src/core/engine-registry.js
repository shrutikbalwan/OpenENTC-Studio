export const engines = [
  { id: 'builtin-dc', name: 'OpenENTC DC', area: 'Circuit', status: 'built-in', license: 'GPL-3.0-or-later', capability: 'Limited DC resistive analysis' },
  { id: 'ngspice', name: 'ngspice', area: 'Circuit', status: 'unavailable', license: 'BSD-3-Clause', capability: 'Adapter contract present; executable not detected in browser preview', candidates: ['C:/Program Files/ngspice/bin/ngspice.exe', 'C:/Program Files/ngspice/bin/ngspice_con.exe', '/usr/bin/ngspice', '/usr/local/bin/ngspice'] },
  { id: 'kicad', name: 'KiCad', area: 'PCB', status: 'unavailable', license: 'GPL-3.0-or-later', capability: 'Adapter contract present; executable not detected in browser preview', candidates: ['C:/Program Files/KiCad/9.0/bin/kicad-cli.exe', '/usr/bin/kicad-cli', '/usr/local/bin/kicad-cli'] },
  { id: 'arduino-cli', name: 'Arduino CLI', area: 'Embedded', status: 'unavailable', license: 'GPL-3.0-only', capability: 'Adapter contract present; executable and board target not detected in browser preview', candidates: ['C:/Program Files/Arduino CLI/arduino-cli.exe', '/usr/bin/arduino-cli', '/usr/local/bin/arduino-cli'] },
  { id: 'platformio', name: 'PlatformIO Core', area: 'Embedded', status: 'unavailable', license: 'Apache-2.0', capability: 'Compile adapter contract present; executable not detected in browser preview', candidates: ['C:/Users/Public/.platformio/penv/Scripts/platformio.exe', '/usr/bin/pio', '/usr/local/bin/pio'] },
  { id: 'renode', name: 'Renode', area: 'Embedded', status: 'unavailable', license: 'MIT', capability: 'Simulation adapter contract present; executable not detected in browser preview', candidates: ['C:/Program Files/Renode/Renode.exe', '/usr/bin/renode', '/usr/local/bin/renode'] },
  { id: 'simavr', name: 'simavr', area: 'Embedded', status: 'unsupported', license: 'GPL-3.0-only', capability: 'No adapter is scheduled in phases 0–13' },
  { id: 'verilator', name: 'Verilator', area: 'FPGA', status: 'unavailable', license: 'LGPL-3.0-or-later', capability: 'Adapter contract present; executable not detected in browser preview', candidates: ['C:/Program Files/Verilator/bin/verilator.exe', '/usr/bin/verilator', '/usr/local/bin/verilator'] },
  { id: 'ghdl', name: 'GHDL', area: 'FPGA', status: 'unavailable', license: 'GPL-2.0-or-later', capability: 'Adapter contract present; executable not detected in browser preview', candidates: ['C:/Program Files/GHDL/bin/ghdl.exe', '/usr/bin/ghdl', '/usr/local/bin/ghdl'] },
  { id: 'yosys', name: 'Yosys', area: 'FPGA', status: 'unavailable', license: 'ISC', capability: 'Adapter contract present; executable not detected in browser preview', candidates: ['C:/Program Files/Yosys/bin/yosys.exe', '/usr/bin/yosys', '/usr/local/bin/yosys'] },
  { id: 'nextpnr-ice40', name: 'nextpnr (ice40)', area: 'FPGA', status: 'unavailable', license: 'ISC', capability: 'ice40 target adapter contract present; executable not detected in browser preview', candidates: ['C:/Program Files/nextpnr/bin/nextpnr-ice40.exe', '/usr/bin/nextpnr-ice40', '/usr/local/bin/nextpnr-ice40'] },
  { id: 'nextpnr', name: 'nextpnr (other families)', area: 'FPGA', status: 'unavailable', disabled: true, license: 'ISC', capability: 'Disabled until an explicit supported device-family target manifest is configured' },
  { id: 'octave', name: 'GNU Octave', area: 'DSP', status: 'unsupported', license: 'GPL-3.0-or-later', capability: 'No adapter is scheduled in phases 0–13' },
  { id: 'gnuradio', name: 'GNU Radio', area: 'Communication', status: 'unavailable', license: 'GPL-3.0-or-later', capability: 'Not detected; supported flowgraphs planned for Phase 9', candidates: ['C:/Program Files/GNURadio/bin/python.exe', '/usr/bin/python3', '/usr/local/bin/python3'] },
  { id: 'wireshark', name: 'Wireshark/TShark', area: 'Network', status: 'unavailable', license: 'GPL-2.0-or-later', capability: 'Saved-capture adapter contract present; executable not detected in browser preview', candidates: ['C:/Program Files/Wireshark/tshark.exe', '/usr/bin/tshark', '/usr/local/bin/tshark'] }
];

export function getEngine(id) {
  return engines.find((engine) => engine.id === id);
}
