/**
 * Dolu veya arızalı bir odaya tıklandığında açılacak, misafir bilgisini 
 * gösteren ve housekeeping işlemlerini (room statüs değişme) işlemlerini
 * tek tıkla yapmamızı sağlayan bileşen.
 */

import { X, User, Calendar, BedDouble, Sparkles, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useChangeRoomStatus } from '../../hooks/useHotelData';

const RoomDetailModal = ({ isOpen, onClose, room }) => { //çağırıldığı zaman üst bileşenden içine gelen parametreler.
    const statusMutation = useChangeRoomStatus(); // çağırıldığında isteği useHotelData'dan atar.
    
    if (!isOpen || !room) return null; // eğer oda yoksa ve açılmamışsa boş dön

    const handleStatusChange = (newStatus) => { // butonların onClick olayları tarafından tetiklenen olay yöneticisidir. (event handler)
        statusMutation.mutate( // yukarıda, useChangeRoomStatus'den gelen mutate fonksiyonu, TSQuery'nin isPending bayrağını true yapar butonlar kitlenir ve axios isteği backen'e gider.
            { roomId: room.id, status: newStatus }, // 1. argüman useChangeRoomStatus içindeki mutationFn'ye aktarılacak veri nesnesidir.
            { onSuccess: () => onClose() } // sunucudan başarılı onayı gelirse modal'ı kapat.
        );
    };

    const res = room.relevant_reservations?.[0]; // Backend'den prefetch_related ile gelen güncel rezervasyon.
    const isDirty = room.status === 'VD' || room.status === 'OD'; // eğer oda kirliyse değişken isDirty true olur

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-2">
                        <BedDouble className="text-blue-600" size={20} />
                        <h2 className="text-lg font-bold text-slate-800">Oda {room.room_number}</h2>
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-700">
                            {room.room_type_code}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full transition cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Konaklama Detayları */}
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Misafir & Konaklama</h3>
                        {res ? (
                            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-3">
                                <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                                    <User size={16} />
                                    <span>{res.guest?.first_name} {res.guest?.last_name}</span>
                                </div>
                                <div className="text-xs text-blue-700 font-medium flex items-center gap-1.5">
                                    <Calendar size={14} className="opacity-70" />
                                    <span>{res.check_in_date} &rarr; {res.check_out_date}</span>
                                </div>
                                <div className="inline-block px-2.5 py-1 bg-white rounded shadow-xs text-[10px] font-bold text-blue-800 uppercase tracking-wide">
                                    {res.status.replace('-', ' ')}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
                                <p className="text-xs font-medium text-slate-500">Bu odada anlık bir konaklama bulunmuyor.</p>
                            </div>
                        )}
                    </div>
                    
                    {/* Housekeeping Aksiyonları */}
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Oda Durumu İşlemleri</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {isDirty ? (
                                <button
                                onClick={() => handleStatusChange(room.status === 'VD' ? 'VC' : 'OC')}
                                disabled={statusMutation.isPending}
                                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                                >
                                    <Sparkles size={18} /> Temiz İşaretle (Clean)
                                </button>
                            ) : (
                                <button
                                onClick={() => handleStatusChange(room.status === 'VC' ? 'VD' : 'OD')}
                                disabled={statusMutation.isPending}
                                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                                >
                                    <AlertTriangle size={18} /> Kirli İşaretle (Dirty)
                                </button>
                            )}

                            <button
                            onClick={() => handleStatusChange(room.status === 'OOO' ? 'VD' : 'OOO')}
                            disabled={statusMutation.isPending}
                            className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                            >
                                <ShieldAlert size={18} /> {room.status === 'OOO' ? 'Servise Geri Al' : 'Arızalı (OOO) Yap'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoomDetailModal;