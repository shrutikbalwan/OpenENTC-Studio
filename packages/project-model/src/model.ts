export type ProjectFormat = 'openentc-project';
export type SignalShape = 'sine' | 'square' | 'triangle';

export interface ProjectComponent {
  id: string;
  type: string;
  label: string;
  value: number;
  unit: string;
  n1: string;
  n2: string;
  x: number;
  y: number;
  rotation?: number;
  [key: string]: unknown;
}

export interface ProjectWire {
  from: string;
  to: string;
  route?: { axis: 'x' | 'y'; coordinate: number } | { points: Array<{ x: number; y: number }> };
  [key: string]: unknown;
}
export interface ProjectJunction { id: string; node: string; x: number; y: number; [key: string]: unknown; }
export interface ProjectNetLabel { id: string; text: string; node: string; x: number; y: number; [key: string]: unknown; }
export interface ProjectArtifact { path: string; sha256: string; size: number; mediaType: string; [key: string]: unknown; }
export interface ArtifactManifest { format: 'openentc-artifact-manifest'; version: 1; tool: string; toolVersion: string; generatedAt: string | null; artifacts: ProjectArtifact[]; }

export interface ProjectRegistryEntry {
  id?: string;
  [key: string]: unknown;
}

export interface OpenEntcProject {
  format: ProjectFormat;
  version: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  circuit: {
    components: ProjectComponent[];
    wires: ProjectWire[];
    junctions: ProjectJunction[];
    netLabels: ProjectNetLabel[];
    signal: { shape: SignalShape; frequency: number; amplitude: number; offset: number; [key: string]: unknown };
    [key: string]: unknown;
  };
  embedded: { board: string; language: string; code: string; [key: string]: unknown };
  artifacts: ProjectArtifact[];
  units: Record<string, string>;
  provenance: { createdBy: string; engineVersions: Record<string, string>; [key: string]: unknown };
  documents: ProjectRegistryEntry[];
  targets: ProjectRegistryEntry[];
  toolchainConstraints: ProjectRegistryEntry[];
  experiments: ProjectRegistryEntry[];
  notes: unknown[];
  settings: { theme: string; grid: boolean; gridSize: number; [key: string]: unknown };
  [key: string]: unknown;
}

export function isOpenEntcProject(value: unknown): value is OpenEntcProject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const project = value as Partial<OpenEntcProject>;
  return project.format === 'openentc-project'
    && Number.isInteger(project.version)
    && typeof project.name === 'string' && project.name.trim().length > 0
    && typeof project.createdAt === 'string' && typeof project.updatedAt === 'string'
    && Array.isArray(project.circuit?.components)
    && Array.isArray(project.circuit?.wires)
    && Array.isArray(project.circuit?.junctions)
    && Array.isArray(project.circuit?.netLabels)
    && typeof project.circuit?.signal === 'object' && project.circuit.signal !== null
    && typeof project.embedded?.board === 'string'
    && typeof project.embedded?.language === 'string'
    && typeof project.embedded?.code === 'string'
    && Array.isArray(project.artifacts)
    && project.artifacts.every((artifact) => !!artifact
      && typeof artifact.path === 'string' && artifact.path.length > 0 && artifact.path.length <= 4096
      && !artifact.path.startsWith('/') && !artifact.path.startsWith('\\') && !/^[A-Za-z]:[\\/]/.test(artifact.path)
      && artifact.path.split(/[\\/]/).every((segment) => segment && segment !== '.' && segment !== '..')
      && /^[a-f0-9]{64}$/.test(artifact.sha256)
      && Number.isInteger(artifact.size) && artifact.size >= 0 && artifact.size <= 268435456
      && typeof artifact.mediaType === 'string' && artifact.mediaType.trim().length > 0 && artifact.mediaType.length <= 200)
    && typeof project.units === 'object' && project.units !== null && !Array.isArray(project.units)
    && typeof project.provenance?.createdBy === 'string'
    && typeof project.provenance?.engineVersions === 'object' && project.provenance.engineVersions !== null
    && Array.isArray(project.documents)
    && Array.isArray(project.targets)
    && Array.isArray(project.toolchainConstraints)
    && Array.isArray(project.experiments)
    && Array.isArray(project.notes)
    && typeof project.settings?.theme === 'string'
    && typeof project.settings?.grid === 'boolean'
    && typeof project.settings?.gridSize === 'number';
}
