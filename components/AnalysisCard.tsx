import React, { useRef } from 'react';
import { RoadState, Direction, AnalysisResult } from '../types';
import { Upload, AlertTriangle, ShieldAlert, Truck, Car, Bike, Activity } from 'lucide-react';

interface AnalysisCardProps {
  road: RoadState;
  onUpload: (direction: Direction, file: File) => void;
}

const AnalysisCard: React.FC<AnalysisCardProps> = ({ road, onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(road.id, e.target.files[0]);
    }
  };

  const hasCritical = road.lastAnalysis?.ambulance_present || road.lastAnalysis?.accident_present || road.lastAnalysis?.fight_present;

  return (
    <div className={`relative flex flex-col h-full bg-slate-800 rounded-xl overflow-hidden border transition-colors duration-500 ${hasCritical ? 'border-red-500' : 'border-slate-700'}`}>
      
      {/* Image Preview / Upload Area */}
      <div className="relative h-32 bg-slate-900 group flex-shrink-0">
        {road.imagePreview ? (
          <img src={road.imagePreview} alt={`${road.id} feed`} className="w-full h-full object-cover opacity-80" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Activity className="w-8 h-8 mb-1 opacity-50" />
            <span className="text-xs">No Signal</span>
          </div>
        )}
        
        {/* Overlay Upload Trigger */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer backdrop-blur-sm"
        >
          <div className="text-white flex flex-col items-center">
            <Upload className="w-6 h-6 mb-1" />
            <span className="font-semibold text-xs">Upload Feed</span>
          </div>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*,video/*"
          onChange={handleFileChange}
        />
        
        {/* Direction Label */}
        <div className="absolute top-2 left-2 bg-slate-900/80 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white border border-slate-700">
          {road.id}
        </div>

        {/* Processing Spinner */}
        {road.isProcessing && (
          <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>

      {/* Stats Panel */}
      <div className="p-3 flex-1 flex flex-col justify-between overflow-hidden">
        {road.lastAnalysis ? (
          <>
            <div className="grid grid-cols-3 gap-1 mb-2">
              <StatBadge icon={<Truck size={12} />} count={road.lastAnalysis.vehicle_counts.trucks} label="Hvy" color="text-purple-400" />
              <StatBadge icon={<Car size={12} />} count={road.lastAnalysis.vehicle_counts.cars} label="Car" color="text-blue-400" />
              <StatBadge icon={<Bike size={12} />} count={road.lastAnalysis.vehicle_counts.bikes} label="Bike" color="text-green-400" />
            </div>

            <div className="space-y-1">
               <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-700 pb-1">
                 <span>Density: <span className="text-white font-medium">{road.lastAnalysis.traffic_density}</span></span>
                 <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                   road.mode === 'Emergency' ? 'bg-red-500 text-white' : 
                   road.mode === 'Hazard' ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-slate-300'
                 }`}>
                   {road.mode}
                 </span>
               </div>
               
               {/* Alerts */}
               <div className="flex flex-wrap gap-1">
                 {road.lastAnalysis.ambulance_present && (
                   <AlertBadge icon={<ShieldAlert size={10} />} text="AMBULANCE" color="bg-red-600" />
                 )}
                 {road.lastAnalysis.accident_present && (
                   <AlertBadge icon={<AlertTriangle size={10} />} text="ACCIDENT" color="bg-orange-600" />
                 )}
                 {road.lastAnalysis.fight_present && (
                   <AlertBadge icon={<AlertTriangle size={10} />} text="FIGHT" color="bg-yellow-600 text-black" />
                 )}
               </div>
            </div>
          </>
        ) : (
          <div className="text-center text-xs text-slate-600 py-2">
            Upload to analyze
          </div>
        )}
      </div>
    </div>
  );
};

const StatBadge = ({ icon, count, label, color }: { icon: React.ReactNode, count: number, label: string, color: string }) => (
  <div className="flex flex-col items-center bg-slate-700/50 p-1.5 rounded">
    <span className={`mb-0.5 ${color}`}>{icon}</span>
    <span className="text-sm font-bold leading-none">{count}</span>
    <span className="text-[8px] text-slate-500 uppercase">{label}</span>
  </div>
);

const AlertBadge = ({ icon, text, color }: { icon: React.ReactNode, text: string, color: string }) => (
  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${color} text-white animate-pulse`}>
    {icon}
    {text}
  </div>
);

export default AnalysisCard;