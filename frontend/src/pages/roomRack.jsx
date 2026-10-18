/**
 * roomRack.jsx : Room Rack ekranının sunum katmanıdır. (UI Layer)
 */

import { useState, useMemo } from 'react';
import { useRoomRack } from '../hooks/useHotelData';
import RoomDetailModal from '../components/rack/RoomDetailModal';
import NewReservationModal from '../components/dashboard/NewReservationModal';
import { Loader2, AlertCircle, BedDouble, Filter, Plus } from 'lucide-react';


// DRY Prensibi: Oda statü renklerini ve etiketlerini tek merkezden yönetiyoruz.
const STATUS_CONFIG = {
  ALL: { label: 'Tümü', badge: 'bg-slate-800 text-white' },
  VC: { label: 'Boş Temiz (VC)', badge: 'bg-emerald-500 text-white', card: 'border-emerald-300 bg-emerald-50/50 hover:shadow-md text-emerald-900' },
  VD: { label: 'Boş Kirli (VD)', badge: 'bg-rose-500 text-white', card: 'border-rose-300 bg-rose-50/50 hover:border-rose-500 hover:shadow-md text-rose-900' },
  OC: { label: 'Dolu Temiz (OC)', badge: 'bg-blue-600 text-white', card: 'border-blue-300 bg-blue-50/50  hover:border-blue-500 hover:shadow-md text-blue-900' },
  OD: { label: 'Dolu Kirli (OD)', badge: 'bg-amber-500 text-white', card: 'border-amber-300 bg-amber-50/50 hover:border-amber-500 hover:shadow-md text-amber-900' },
  OOO: { label: 'Arızalı (OOO)', badge: 'bg-slate-500 text-white', card:'border-slate-300 bg-slate-100 hover:border-slate-400 hover:shadow-md text-slate-500 opacity-70' },

};

const RoomRack = () => {
  const { data: rackData, isLoading, isError, error } = useRoomRack();  // odalarının durumunu django back'enden çekip tarayıcının cache'ine alındığı fonksiyondur. Nesne parçalma yapılır, lazım olanları almak için.

  const [filterStatus, setFilterStatus] = useState('ALL'); // Rack'i Ekrana Basar / filterStatus: okuma değişkeni / setFilterStatus: yazma değişkeni (güncelleme yapıldığında çağırılır)
  const [selectedDetailRoom, setSelectedDetailRoom] = useState(null); // Ekranda hangi odanın detay modal'ının açık olduğunu/olmadığını takip eden hafıza kutusudur.
  const [selectedResRoomId, setSelectedResRoomId] = useState(null); // Hızlı rezervasyon / Check-in modalının açık olup olmadığını takip eden hafıza kutusudur.

  // İş Mantığı Yönlendiricisi
  const handleRoomClick = (room) => {
    setSelectedDetailRoom(room);
  };

  // Frontend Filtreleme 
  const filteredRack = useMemo(() => { // rack verisi filtrelendiğinde cache'de tutulması için useMemo kullanılır ve maliyeti önler
    if (!rackData) return [];  // henüz db'den cevap gelmediyse boş döner. çökmez.
    if (filterStatus === 'ALL') return Object.entries(rackData);  // eğer filtre tüm odalar ise eleme yapılmaz. Liste yapısını ARRAY'e dönüştürür. 

    const filtered = {}; // filtreden geçen odaları toplayacağımız boş sepet.
    Object.entries(rackData).forEach(([floor, rooms]) => { // rackData array'e dönüştürülüp forEach ile döngüye sokulur. Döngünün her adımınında fonksiyon çalışır.
      const matchingRooms = rooms.filter(r => r.status === filterStatus); // filterStatus state'ine göre döngüde yazdırılacaklar filtrelenir.
      if (matchingRooms.length > 0) filtered[floor] = matchingRooms; // eğer filtreden sonra eşleşen oda varsa -> filtered listesinin içine ekler.
    });
    return Object.entries(filtered); // array halinde filtrelenmiş oda listesini döner.
  }, [rackData, filterStatus]); // bu değerler değiştiğinde döngüyü çalıştır.

  if (isLoading) { // eğer isLoading true ise yükleniliyor... yazısı yazılır.
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-blue-600">
        <Loader2 className="h-10 w-10 animate-spin mb-4" />
        <span className="text-sm font-bold tracking-wider uppercase text-slate-500">Kat Planı Yükleniyor...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-3 p-5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
        <AlertCircle size={24} className="shrink-0" />
        <div>
          <p className="font-bold">Oda planı verisi alınamadı</p>
          <p className="text-sm mt-1">{error?.response?.data?.detail || error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">

      {/* Üst Bar & Filtreler */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="">Oda Planı (Room Rack)</h2>
          <p className="text-xs text-slate-500 mt-0.5">Kat bazlı interaktif oda ve misafir durumu</p>
        </div>

        {/* her statü için ekrana birer filtre butonu basar. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter size={16} className="text-slate-400 mx-2" /> 
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all curser-pointer ${
              filterStatus === key
              ? `${config.badge} shadow-md scale-105`
              : 'text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100'
            }`}
            >
              {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Render */}
      {filteredRack.length === 0 ? ( 
        <div className="text-center p-16 bg-white rounded-2xl border border-slate-200 text-slate-400">
          <BedDouble size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-base font-semibold text-slate-600">Bu kriterlere uygun oda bulunamadı.</p>
        </div> 
      ) : ( 
        filteredRack.map(([floor, rooms]) => (
          <div key={floor} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs" >
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-3">
              Kat {floor}
              <div className="h-px bg-slate-100 flex-1"></div>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
              {rooms.map((room) => {
                const config = STATUS_CONFIG[room.status] || STATUS_CONFIG.OOO;
                const activeRes = room.relevant_reservations?.[0];

                return (
                  <div
                  key={room.id}
                  onClick={() => handleRoomClick(room)}
                  className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer select-none group flex flex-col justify-between min-h-[110px] ${config.card}`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-black text-xl tracking-tighter">
                          {room.room_number}
                        </span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm ${config.badge}`}>
                          {room.status}
                        </span>
                      </div>
                      <div className="text-[10px] font-bold opacity-60">
                        {room.room_type_code}
                      </div>
                    </div>

                    <div className="pt-2 mt-2 border-t border-current/20">
                      {activeRes ? (
                        <div className="truncate">
                          <p
                          className="text-xs font-bold truncate"
                          title={`${activeRes.guest?.first_name || ''} ${activeRes.guest?.last_name || ''}`}
                          >
                            {activeRes.guest
                            ? `${activeRes.guest.first_name} ${activeRes.guest.last_name}`
                            : activeRes.status.replace('_', ' ')}
                          </p>
                        </div>
                      ) : (
                        <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation; // Kartın tıklama olayının (RoomDetailModal) tetiklemesini engeller.
                          setSelectedResRoomId(room.id) // Sadece rezervasyon modalını açar.
                        }}
                        className="flex items-center gap-1 text-[11px] font-bold opacity-75 hover:opacity-100 hover:scale-105 transition-all cursor-pointer py-0.5 px-1 rounded hover:bg-black/5"
                        >
                          <Plus size={12} /> Rezervasyon
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Modallar */}
      <RoomDetailModal 
      isOpen={!!selectedDetailRoom}
      onClose={() => setSelectedDetailRoom(null)}
      room={selectedDetailRoom}
      />

      <NewReservationModal  
      isOpen={!!selectedResRoomId}
      onClose={() => setSelectedResRoomId(null)}
      initialRoomId={selectedResRoomId}
      />
    </div>
  );
};

export default RoomRack;