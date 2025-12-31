import React from 'react';
import { SignalLight } from '../types';

interface TrafficLightProps {
  state: SignalLight;
  timer: number;
  className?: string;
}

const TrafficLight: React.FC<TrafficLightProps> = ({ state, timer, className = '' }) => {
  return (
    <div className={`bg-gray-900 p-4 rounded-2xl border-4 border-gray-800 shadow-xl flex flex-col items-center gap-4 w-24 ${className}`}>
      {/* Red Light */}
      <div
        className={`w-16 h-16 rounded-full transition-all duration-300 ${
          state === SignalLight.Red
            ? 'bg-red-500 light-glow-red'
            : 'bg-red-900/30'
        }`}
      />
      
      {/* Yellow Light */}
      <div
        className={`w-16 h-16 rounded-full transition-all duration-300 ${
          state === SignalLight.Yellow
            ? 'bg-yellow-500 light-glow-yellow'
            : 'bg-yellow-900/30'
        }`}
      />
      
      {/* Green Light */}
      <div
        className={`w-16 h-16 rounded-full transition-all duration-300 ${
          state === SignalLight.Green
            ? 'bg-green-500 light-glow-green'
            : 'bg-green-900/30'
        }`}
      />

      {/* Timer Display */}
      <div className="bg-gray-800 text-white font-mono text-xl w-full text-center py-1 rounded border border-gray-700">
        {timer}s
      </div>
    </div>
  );
};

export default TrafficLight;