export enum Direction {
  North = 'North',
  South = 'South',
  East = 'East',
  West = 'West',
}

export interface VehicleCounts {
  trucks: number;
  cars: number;
  bikes: number;
}

export interface AnalysisResult {
  ambulance_present: boolean;
  accident_present: boolean;
  fight_present: boolean;
  vehicle_counts: VehicleCounts;
  traffic_density: 'Low' | 'Medium' | 'High';
  summary: string;
}

export enum SignalLight {
  Red = 'RED',
  Yellow = 'YELLOW',
  Green = 'GREEN',
}

export interface RoadState {
  id: Direction;
  currentLight: SignalLight;
  timer: number;
  lastAnalysis: AnalysisResult | null;
  imagePreview: string | null;
  isProcessing: boolean;
  mode: 'Normal' | 'Emergency' | 'Hazard';
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}