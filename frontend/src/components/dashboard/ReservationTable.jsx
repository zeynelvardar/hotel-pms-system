/**
 * Ön Büro Rezervasyon Dashboardu Tablo Bileşeni
 * Gelen sekme tipine (type) ve rezervasyon statüsüne (status) göre
 * Check-in, Check-out gibi operasyonel butonları güvenli bir şekilde render eder.
 */

// ==========================================
// 1. İÇE AKTARIMLAR (IMPORTS)
// ==========================================
import { formatDate } from '../../utils/formatters';
import { Calendar, BedDouble, User, Loader2 } from 'lucide-react';
import { useReservationAction } from '../../hooks/useHotelData';

const ReservationTable = ({ data, type, isLoading }) => {
    // ==========================================
    // 2. KANCALAR (HOOKS)
    // ==========================================
    const { checkIn, isCheckingIn, checkOut, isCheckingOut } = useReservationAction(); // check-in ve check-out işlemlerini yapan useReservationAction() hook'unu çağırıyoruz.

    // ==========================================
    // 3. YÜKLENİYOR VE BOŞ DURUMLARI (EARLY RETURNS)
    // ==========================================
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500 bg-white rounded-xl border border-slate-200">
                <div className="w-8 h-8 border-2 border-slate-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <span className="text-sm font-medium">Kayıtlar Yükleniyor...</span>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="text-center p-16 text-slate-400 bg-white rounded-xl border border-slate-200">
                <User size={36} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Seçili sekmede henüz kayıtlı işlem bulunmuyor.</p>
            </div>
        );
    }

    // ==========================================
    // 4. YARDIMCI FONKSİYONLAR (HELPERS)
    // ==========================================
    // Tablonun "Aksiyon" sütununu gereksiz if/else kalabalığından kurtarır
    const renderActionButtons = (item) => { // Renderlamada butonlara yardımcı olan fonkisyon. (arayüzdeki data.map(item) değişkeninden gelir.)
        const todayStr = new Date().toLocaleDateString('en-CA'); // bugünün tarihini alır. 
        const isFutureArrival = item.check_in_date > todayStr; // giriş tarihi bugün olmayan misafirlerin check'in butonunu deaktif etmek için kullanılır.

        // Kural 1: CHECK-IN BUTONU (Sadece bekleyenlere ve tarihi gelmiş olanlarla)
        if (item.status === 'RESERVED') {
            return (
                <button
                    onClick={() => checkIn(item.id)} // useReservationAction'dan gelen checkIn yapma butonu
                    disabled={isCheckingIn || isFutureArrival} // checkin'e alma işlemi gerçekleşiyorsa veya giriş tarihi gelecekteyse butonu devre dışı bırakır.
                    title={isFutureArrival ? "Giriş tarihi henüz gelmedi!" : ""} // fare butonun üzerine geldiğinde giriş tarihi henüz gelmedi yazar.
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition cursor-pointer
                        ${isFutureArrival ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300'}`}
                >
                    {isCheckingIn && <Loader2 size={12} className="animate-spin" />}
                    Check-in Yap
                </button>
            );
        }

        // Kural 2: CHECK-OUT BUTONU (Yalnızca otelde konaklayanlara)
        if (item.status === 'IN_HOUSE') {
            return (
                <button
                    onClick={() => checkOut(item.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-xs font-semibold transition cursor-pointer"
                >
                    {isCheckingOut && <Loader2 size={12} className="animate-spin" />}
                    Check-out Yap
                </button>
            );
        }

        // Kural 3: İŞLEM TAMAMLANDI (Check-Out, Cancelled, No-Show)
        return (
            <span className="text-[11px] font-semibold text-slate-400 italic">
                İşlem Tamamlandı
            </span>
        );
    };

    // ==========================================
    // 5. ANA EKRAN ÇİZİMİ (MAIN RENDER)
    // ==========================================
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-sm">
                    {/* Tablo Başlığı */}
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
                    {/* Tablo Gövdesi */}
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                        {data.map((item) => {
                            // Veri güvenliği kontrolleri
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
                                            <Calendar size={14} className="text-slate-700" />
                                            {formatDate(item.check_in_date)} &rarr; {formatDate(item.check_out_date)}
                                        </div> 
                                    </td>
                                    <td className="py-3.5 px-5 font-bold text-slate-700">
                                        {price}
                                    </td>
                                    <td className="py-3.5 px-5">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md
                                            ${item.status === 'RESERVED' ? 'bg-indigo-50 text-indigo-600' : ''}
                                            ${item.status === 'IN_HOUSE' ? 'bg-blue-50 text-blue-600' : ''}
                                            ${item.status === 'CHECKED_OUT' ? 'bg-slate-100 text-slate-600' : ''}
                                            ${['CANCELLED', 'NO_SHOW'].includes(item.status) ? 'bg-rose-50 text-rose-600' : ''}
                                        `}>
                                            {item.status?.replace("_", ' ')}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-5 text-right">
                                        {renderActionButtons(item)}
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