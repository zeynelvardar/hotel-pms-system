/**
 * Ön Büro Rezervasyon Dashboardu Bileşeni
 * 
 * Bileşenin kendisi veri çekmez, Üst bileşenden (Dashboard.jsx)
 * kendisine paket olarak gelen veriyi alır ve ekrana basar.
 * 
 *
 */

import { Calendar, BedDouble, User } from 'lucide-react';
import toast from 'react-hot-toast';

const ReservationTable = ({ data, type, isLoading }) => { // üst bileşenden gelen parametreler
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <span className="text-sm font-medium">Kayıtlar yükleniyor...</span>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="text-center p-16 text-slate-400 bg-white rounded-xl border border-slate-200">
                <User size={36} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Bu listede henüz kayıtlı rezervasyon bulunmuyor.</p>
            </div>
        );
    }

    const handleAction = (reservationId, actionName) => {
        // Faz 6.4'te gerçek api çağrılarına bağlanacak.
        toast.success(`${actionName} işlemi Faz 6.4'te tamamlanacak. (ID: ${reservationId})`)
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                            <th className="py-3.5 px-5">Misafir</th>
                            <th className="py-3.5 px-5">Oda</th>
                            <th className="py-3.5 px-5">Tarihler</th>
                            <th className="py-3.5 px-5">Bakiye</th>
                            <th className="py-3.5 px-5">Statü</th>
                            <th className="py-3.5 px-5">Aksiyon</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                        {data.map((item) => {
                            // Backend'den gelen veririnin format güvenliği (N+A korumalı Serializer yapısına göre)
                            const guestName = item.guest_name || `${item.guest?.first_name} ${item.guest?.last_name}`;
                            const roomNumber = item.room_number || item.room?.room_number || 'Atanmadı';
                            const price = Number(item.total_price || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
                            
                            return (
                                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                                    <td className="py-3.5 px-5 font-semibold text-slate-800">
                                        {guestName}
                                    </td>
                                    <td className="py-3.5 px-5 text-xs text-slate-500 font-medium">
                                        <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                            <BedDouble size={16} className="text-slate-500" />
                                            {roomNumber}
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-5 text-slate-500 font-medium">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar size={14} className="text-slate-700"/>
                                            {item.check_in_date} &rarr; {item.check_out_date}
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-5 font-bold text-slate-700">
                                        {price}
                                    </td>
                                    <td className="py-3.5 px-5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                            {item.status?.replace("_", ' ')}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-5 text-right">
                                        {type === 'arrivals' && (
                                            <button onClick={() => handleAction(item.id, 'Check-in')} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition">
                                                Check-in
                                            </button>
                                        )}
                                        {type === 'departures' && (
                                            <button onClick={() => handleAction(item.id, 'Check-out')} className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition">
                                                Check-out
                                            </button>
                                        )}
                                        {type === 'inHouse' && (
                                            <button onClick={() => handleAction(item.id, "Detay Gör")} className="px-3 py-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition">
                                                Yönet
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ReservationTable;