/**
 * roomRack.jsx : Room Rack ekranının sunum katmanıdır. (UI Layer)
 */

import { useRoomRack } from '../hooks/useHotelData';
import { Loader2 } from 'lucide-react';

const RoomRack = () => {
  const { data: rackData, isLoading, isError, error, isFetching } = useRoomRack();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (isError) {
    return <div className="text-red-500 p-4 bg-red-50 rounded-lg">Veri çekilemedi: {error.message}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-slate-800">Oda Planı (Room Rack)</h2>
        {/* Arka planda 1 dakikalık sessiz güncelleme olurken ufak bir ibare gösterelim */}
        {isFetching && <span className="text-xs text-blue-500 font-semibold animate-pulse">Güncelleniyor...</span>}
      </div>

      {Object.entries(rackData).map(([floor, rooms]) => (
        <div key={floor} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-700 border-b pb-2 mb-4">Kat {floor}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
            {rooms.map((room) => (
              <div 
                key={room.id} 
                className={`p-4 rounded-lg border-2 ${
                  room.status === 'VC' ? 'border-emerald-400 bg-emerald-50' :
                  room.status === 'VD' ? 'border-red-400 bg-red-50' :
                  room.status === 'OC' ? 'border-blue-400 bg-blue-50' :
                  room.status === 'OD' ? 'border-orange-400 bg-orange-50' :
                  'border-slate-300 bg-slate-100'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-lg text-slate-800">{room.room_number}</span>
                  <span className="text-xs font-bold px-2 py-1 rounded bg-white/60 text-slate-700 shadow-sm">
                    {room.status}
                  </span>
                </div>
                <div className="text-xs text-slate-600 font-medium mb-2">{room.room_type_code}</div>
                
                {room.active_reservation ? (
                  <div className="mt-2 pt-2 border-t border-slate-200/50">
                    <p className="text-sm font-semibold text-slate-800 truncate" title={room.active_reservation.guest_name}>
                      {room.active_reservation.guest_name}
                    </p>
                    <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">
                      {room.active_reservation.status.replace('_', ' ')}
                    </p>
                  </div>
                ) : (
                  <div className="mt-2 pt-2 border-t border-slate-200/50">
                    <p className="text-sm text-slate-400 italic">Boş</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RoomRack;

