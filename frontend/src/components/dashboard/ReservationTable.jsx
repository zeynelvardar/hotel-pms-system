/**
 * Ön Büro Rezervasyon Dashboardu Bileşeni
 * 
 * Bileşenin kendisi veri çekmez, Üst bileşenden (Dashboard.jsx)
 * kendisine paket olarak gelen veriyi alır ve ekrana basar.
 * 
 *
 */

import { formatDate } from '../../utils/formatters';
import { Calendar, BedDouble, User, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useReservationAction } from '../../hooks/useHotelData';

const ReservationTable = ({ data, type, isLoading }) => { // üst bileşenden gelen parametreler
    const { checkIn, isCheckingIn, checkOut, isCheckingOut } = useReservationAction();
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
                            const guestName = item.guest_full_name || item.guest_name || (item.guest?.first_name ? `${item.guest.first_name} ${item.guest.last_name || ''}`.trim() : 'İsimsiz Misafir');
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
                                            {formatDate(item.check_in_date)} &rarr; {formatDate(item.check_out_date)}
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
                                            <button
                                            onClick={() => checkIn(item.id)}
                                            disabled={isCheckingIn}
                                            className="inline-flex items-center gap 1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-semibold transition curser-pointer"
                                            >
                                                {isCheckingIn && <Loader2 size={12} className="animate-spin"/>}
                                                Check-in Yap
                                            </button>
                                        )}
                                        {type === 'departures' && (
                                            <button
                                            onClick={() => checkOut(item.id)}
                                            disabled={isCheckingOut}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-xs font-semibold transition cursor-pointer"
                                            >
                                                {isCheckingOut && <Loader2 size={12} className="animate-spin" />}
                                                Check-out Yap
                                            </button>
                                        )}
                                        {type === 'inHouse' && (
                                            <button
                                            onClick={() => checkOut(item.id)}
                                            disabled={isCheckingOut}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-xs font-semibold transition curser-pointer"
                                            >
                                                {isCheckingOut && <Loader2 size={12} className="animate-spin" />}
                                                Hızlı Check-out
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