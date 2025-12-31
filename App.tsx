import React, { useState, useEffect, useCallback } from 'react';
import { Direction, RoadState, SignalLight, LogEntry } from './types';
import TrafficLight from './components/TrafficLight';
import AnalysisCard from './components/AnalysisCard';
import { analyzeTrafficImage, fileToBase64 } from './services/geminiService';
import { Siren, AlertOctagon, RefreshCw, Activity } from 'lucide-react';

const INITIAL_ROADS: RoadState[] = [
  { id: Direction.North, currentLight: SignalLight.Red, timer: 0, lastAnalysis: null, imagePreview: null, isProcessing: false, mode: 'Normal' },
  { id: Direction.South, currentLight: SignalLight.Red, timer: 0, lastAnalysis: null, imagePreview: null, isProcessing: false, mode: 'Normal' },
  { id: Direction.East, currentLight: SignalLight.Red, timer: 0, lastAnalysis: null, imagePreview: null, isProcessing: false, mode: 'Normal' },
  { id: Direction.West, currentLight: SignalLight.Red, timer: 0, lastAnalysis: null, imagePreview: null, isProcessing: false, mode: 'Normal' },
];

export default function App() {
  const [roads, setRoads] = useState<RoadState[]>(INITIAL_ROADS);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Helper to add logs
  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }, ...prev].slice(0, 50)); // Keep last 50 logs
  };

  // Logic to calculate green light duration
  const calculateDuration = (trucks: number, cars: number, bikes: number): number => {
    // Base time + weighted vehicle calculation
    // Truck: 5s, Car: 2s, Bike: 1s
    const weightedTime = (trucks * 5) + (cars * 2) + (bikes * 1);
    // Clamp between 10s and 60s
    return Math.max(10, Math.min(weightedTime, 60));
  };

  // Handle file upload and analysis
  const handleUpload = async (direction: Direction, file: File) => {
    // Update processing state
    setRoads(prev => prev.map(r => r.id === direction ? { ...r, isProcessing: true, imagePreview: URL.createObjectURL(file) } : r));
    addLog(`Analyzing feed for ${direction}...`, 'info');

    try {
      const base64 = await fileToBase64(file);
      const analysis = await analyzeTrafficImage(base64, file.type);
      
      addLog(`Analysis complete for ${direction}. Density: ${analysis.traffic_density}`, 'success');

      setRoads(prev => {
        const newRoads = [...prev];
        const roadIndex = newRoads.findIndex(r => r.id === direction);
        if (roadIndex === -1) return prev;

        const road = newRoads[roadIndex];
        road.lastAnalysis = analysis;
        road.isProcessing = false;

        // Check for Emergency Override (Ambulance)
        if (analysis.ambulance_present) {
            road.mode = 'Emergency';
            addLog(`AMBULANCE DETECTED AT ${direction}! INITIATING EMERGENCY PROTOCOL.`, 'warning');
            return newRoads;
        }

        // Check for Hazards (Accident/Fight)
        if (analysis.accident_present || analysis.fight_present) {
            road.mode = 'Hazard';
            addLog(`HAZARD DETECTED AT ${direction}! Lane closed.`, 'error');
            road.currentLight = SignalLight.Red;
            return newRoads;
        }

        // Normal Operation
        road.mode = 'Normal';
        return newRoads;
      });

    } catch (error) {
      console.error(error);
      addLog(`Failed to analyze ${direction}`, 'error');
      setRoads(prev => prev.map(r => r.id === direction ? { ...r, isProcessing: false } : r));
    }
  };

  // Signal Controller Loop (The "Brain") - Now with Synced N/S & E/W
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setRoads(prevRoads => {
        const nextRoads = prevRoads.map(r => ({...r}));
        const north = nextRoads[0]; // Idx 0
        const south = nextRoads[1]; // Idx 1
        const east = nextRoads[2];  // Idx 2
        const west = nextRoads[3];  // Idx 3

        // 1. Emergency Override Logic (Highest Priority)
        const emergencyRoads = nextRoads.filter(r => r.mode === 'Emergency');
        if (emergencyRoads.length > 0) {
            // Safety Step: Check for unsafe active roads (Green/Yellow) that are NOT the emergency road
            const unsafeRoads = nextRoads.filter(r => 
                r.mode !== 'Emergency' && 
                (r.currentLight === SignalLight.Green || r.currentLight === SignalLight.Yellow)
            );

            if (unsafeRoads.length > 0) {
                // Safely stop traffic before letting emergency vehicle through
                unsafeRoads.forEach(r => {
                    if (r.currentLight === SignalLight.Green) {
                        r.currentLight = SignalLight.Yellow;
                        r.timer = 3; // 3 Second Safety Buffer
                        addLog(`Emergency Protocol: Switching ${r.id} to Yellow (3s).`, 'warning');
                    } else if (r.currentLight === SignalLight.Yellow) {
                        if (r.timer > 0) {
                            r.timer -= 1;
                        } else {
                            r.currentLight = SignalLight.Red;
                            r.timer = 0;
                            addLog(`Emergency Protocol: ${r.id} Stopped.`, 'info');
                        }
                    }
                });
                
                // Ensure emergency roads wait for clear intersection
                emergencyRoads.forEach(r => {
                    if (r.currentLight !== SignalLight.Red && r.currentLight !== SignalLight.Green) {
                        r.currentLight = SignalLight.Red;
                    }
                });
                
                return nextRoads;
            }

            // Intersection is clear (unsafeRoads == 0). Grant Green to Emergency.
            emergencyRoads.forEach(r => {
                if (r.currentLight !== SignalLight.Green) {
                     r.currentLight = SignalLight.Green;
                     r.timer = 60; // Max time for emergency
                     addLog(`EMERGENCY: Green for ${r.id}`, 'warning');
                }
                if (r.timer > 0) r.timer -= 1;
                
                // Auto-clear simulation
                if (r.timer <= 0) {
                    r.mode = 'Normal';
                    addLog(`Emergency cleared at ${r.id}`, 'info');
                }
            });
            return nextRoads;
        }

        // 2. Normal Cycle Logic (Synchronized Phases)
        // Phases: NS_GREEN -> NS_YELLOW -> EW_GREEN -> EW_YELLOW
        
        const isNsGreen = (north.currentLight === SignalLight.Green || south.currentLight === SignalLight.Green);
        const isNsYellow = (north.currentLight === SignalLight.Yellow || south.currentLight === SignalLight.Yellow);
        const isEwGreen = (east.currentLight === SignalLight.Green || west.currentLight === SignalLight.Green);
        const isEwYellow = (east.currentLight === SignalLight.Yellow || west.currentLight === SignalLight.Yellow);

        // Helper to decrement
        const tick = (r: RoadState) => { if (r.timer > 0) r.timer -= 1; };
        nextRoads.forEach(tick);

        // Logic State Machine
        if (isNsGreen) {
            if (north.timer === 0 && south.timer === 0) {
                // Switch NS to Yellow
                north.currentLight = SignalLight.Yellow;
                south.currentLight = SignalLight.Yellow;
                north.timer = 3;
                south.timer = 3;
                addLog('North/South switching to Yellow', 'info');
            }
        } else if (isNsYellow) {
            if (north.timer === 0 && south.timer === 0) {
                // Switch NS to Red, Start EW
                north.currentLight = SignalLight.Red;
                south.currentLight = SignalLight.Red;

                // Calculate duration based on max load of East/West
                const eCounts = east.lastAnalysis?.vehicle_counts || {trucks:0, cars:0, bikes:0};
                const wCounts = west.lastAnalysis?.vehicle_counts || {trucks:0, cars:0, bikes:0};
                const dur = Math.max(
                    calculateDuration(eCounts.trucks, eCounts.cars, eCounts.bikes),
                    calculateDuration(wCounts.trucks, wCounts.cars, wCounts.bikes),
                    10 // Min duration
                );

                // Only set green if not Hazard
                if (east.mode !== 'Hazard') {
                    east.currentLight = SignalLight.Green;
                    east.timer = dur;
                }
                if (west.mode !== 'Hazard') {
                    west.currentLight = SignalLight.Green;
                    west.timer = dur;
                }
                
                addLog(`East/West Axis Green for ${dur}s`, 'success');
            }
        } else if (isEwGreen) {
            if (east.timer === 0 && west.timer === 0) {
                 // Switch EW to Yellow
                 east.currentLight = SignalLight.Yellow;
                 west.currentLight = SignalLight.Yellow;
                 east.timer = 3;
                 west.timer = 3;
                 addLog('East/West switching to Yellow', 'info');
            }
        } else if (isEwYellow) {
            if (east.timer === 0 && west.timer === 0) {
                // Switch EW to Red, Start NS
                east.currentLight = SignalLight.Red;
                west.currentLight = SignalLight.Red;

                // Calculate duration based on max load of North/South
                const nCounts = north.lastAnalysis?.vehicle_counts || {trucks:0, cars:0, bikes:0};
                const sCounts = south.lastAnalysis?.vehicle_counts || {trucks:0, cars:0, bikes:0};
                const dur = Math.max(
                    calculateDuration(nCounts.trucks, nCounts.cars, nCounts.bikes),
                    calculateDuration(sCounts.trucks, sCounts.cars, sCounts.bikes),
                    10
                );

                if (north.mode !== 'Hazard') {
                    north.currentLight = SignalLight.Green;
                    north.timer = dur;
                }
                if (south.mode !== 'Hazard') {
                    south.currentLight = SignalLight.Green;
                    south.timer = dur;
                }

                addLog(`North/South Axis Green for ${dur}s`, 'success');
            }
        } else {
            // All Red (System Start or Error State) -> Default start NS
            north.currentLight = SignalLight.Green;
            south.currentLight = SignalLight.Green;
            north.timer = 15;
            south.timer = 15;
            addLog('System Start: North/South Green', 'success');
        }

        return nextRoads;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, []);


  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 flex flex-col items-center">
      
      {/* Header */}
      <header className="w-full max-w-7xl flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
        <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            SmartTraffic AI
            </h1>
            <p className="text-slate-500 text-sm mt-1">
            Gemini-powered Adaptive Signal Control
            </p>
        </div>
        <div className="flex gap-4">
             <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                Live Monitoring
             </div>
             <button 
               onClick={() => window.location.reload()}
               className="p-2 hover:bg-slate-800 rounded-full transition"
               title="Reset System"
             >
                <RefreshCw size={18} />
             </button>
        </div>
      </header>

      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Log & System Status */}
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 h-[600px] flex flex-col">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Activity size={18} className="text-blue-400" />
                    System Logs
                </h2>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                    {logs.length === 0 && <p className="text-slate-600 italic text-sm">System ready. Waiting for events...</p>}
                    {logs.map(log => (
                        <div key={log.id} className="text-xs border-l-2 pl-3 py-1 animate-fade-in" style={{
                            borderColor: log.type === 'success' ? '#22c55e' : log.type === 'error' ? '#ef4444' : log.type === 'warning' ? '#f97316' : '#3b82f6'
                        }}>
                            <span className="text-slate-500 font-mono mr-2">{log.timestamp}</span>
                            <span className={log.type === 'warning' ? 'text-orange-400 font-bold' : log.type === 'error' ? 'text-red-400' : 'text-slate-300'}>
                                {log.message}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h3 className="font-semibold text-sm text-slate-400 mb-3">Logic Rules</h3>
                <ul className="space-y-2 text-xs text-slate-500">
                    <li className="flex justify-between"><span>Synchronized Axes:</span> <span className="text-slate-300">N+S / E+W</span></li>
                    <li className="flex justify-between"><span>Truck Weight:</span> <span className="text-slate-300">5s</span></li>
                    <li className="flex justify-between"><span>Car Weight:</span> <span className="text-slate-300">2s</span></li>
                    <li className="flex justify-between"><span>Bike Weight:</span> <span className="text-slate-300">1s</span></li>
                    <li className="flex justify-between items-center"><span className="flex items-center gap-1 text-red-400"><Siren size={12}/> Ambulance:</span> <span className="text-red-400 font-bold">IMMEDIATE GREEN</span></li>
                    <li className="flex justify-between items-center"><span className="flex items-center gap-1 text-yellow-500"><AlertOctagon size={12}/> Hazard:</span> <span className="text-yellow-500 font-bold">STOP (RED)</span></li>
                </ul>
            </div>
        </div>

        {/* Center & Right: Traffic Grid */}
        <div className="lg:col-span-2 relative">
            {/* The Intersection Visual - Expanded Size */}
            <div className="relative aspect-square max-w-[800px] mx-auto bg-slate-900 rounded-3xl border-4 border-slate-800 shadow-2xl overflow-hidden">
                
                {/* Road Markings */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-full bg-slate-800/50"></div> {/* Vertical Road */}
                    <div className="h-32 w-full bg-slate-800/50 absolute"></div> {/* Horizontal Road */}
                    {/* Intersection Center */}
                    <div className="w-32 h-32 bg-slate-800 z-0 relative flex items-center justify-center">
                         <div className="w-24 h-24 border-2 border-dashed border-slate-600/30 rounded-lg"></div>
                    </div>
                </div>

                {/* North Position - Reorganized Layout to Avoid Overlap */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col-reverse items-center gap-2 z-10 w-48">
                    <div className="transform scale-75 origin-top">
                        <TrafficLight state={roads[0].currentLight} timer={roads[0].timer} />
                    </div>
                    {/* Card is now at the top edge of the container */}
                    <div className="h-48 w-full mb-1">
                        <AnalysisCard road={roads[0]} onUpload={handleUpload} />
                    </div>
                </div>

                {/* South Position - Reorganized Layout to Avoid Overlap */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10 w-48">
                    <div className="transform scale-75 origin-bottom">
                         <TrafficLight state={roads[1].currentLight} timer={roads[1].timer} />
                    </div>
                    {/* Card is now at the bottom edge of the container */}
                    <div className="h-48 w-full mt-1">
                         <AnalysisCard road={roads[1]} onUpload={handleUpload} />
                    </div>
                </div>

                {/* East Position */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-10 w-48">
                     <div className="transform scale-75 origin-right">
                         <TrafficLight state={roads[2].currentLight} timer={roads[2].timer} />
                     </div>
                     <div className="h-48 w-full mt-1">
                         <AnalysisCard road={roads[2]} onUpload={handleUpload} />
                     </div>
                </div>

                {/* West Position */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-10 w-48">
                     <div className="transform scale-75 origin-left">
                         <TrafficLight state={roads[3].currentLight} timer={roads[3].timer} />
                     </div>
                     <div className="h-48 w-full mt-1">
                         <AnalysisCard road={roads[3]} onUpload={handleUpload} />
                     </div>
                </div>

            </div>
        </div>

      </main>
    </div>
  );
}