/**
 * Ön Büro Rezervasyon Dashboardu Tablo Bileşeni
 * Gelen sekme tipine (type) ve rezervasyon statüsüne (status) göre
 * Check-in, Check-out gibi operasyonel butonları güvenli bir şekilde render eder.
 * Misafir sayısı, acenta rozeti ve çift tıklama ile Kart açma özelliklerini barındırır.
 */

// ==========================================
// 1. İÇE AKTARIMLAR (IMPORTS)
// ==========================================
import { formatDate } from '../../utils/formatters';
import { Calendar, BedDouble, User, Loader2, Users } from 'lucide-react';
import { useReservationAction, useSystemDate } from '../../hooks/useHotelData';

const ReservationTable = ({ data, type, isLoading, onRowDoubleClick }) => {
    // ==========================================
    // 2. KANCALAR (HOOKS)
    // ==========================================
    // Check-in ve check-out mutasyon işlemlerini yürüten hook
    const { checkIn, isCheckingIn, checkOut, isCheckingOut } = useReservationAction();
    // Otelin aktif operasyon gününü sağlayan hook (gece denetimi/night audit referansı)
    const { data: systemDate, isLoading: isDateLoading } = useSystemDate();
    const activeDate = systemDate;

    // ==========================================
    // 3. YÜKLENİYOR VE BOŞ DURUMLARI (EARLY RETURNS)
    // ==========================================
    if (isLoading || isDateLoading || !activeDate) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500 bg-white rounded-xl border border-slate-200">
                <div className="w-8 h-8 border-2 border-slate-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <span className="text-sm font-medium">Otel Operasyon Günü ve Kayıtlar Yükleniyor...</span>
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
    // Tablonun "Aksiyon" sütununu sadeleştiren yardımcı render fonksiyonu
    const renderActionButtons = (item) => {
        // Karşılaştırma doğrudan otelin sistem çalışma günü (activeDate) üzerinden yapılır
        const isFutureArrival = item.check_in_date > activeDate;     // Giriş tarihi henüz gelmediyse true döner
        const isFutureDeparture = item.check_out_date > activeDate; // Çıkış tarihi henüz gelmediyse true döner

        // Kural 1: CHECK-IN BUTONU (Sadece rezervasyon aşamasındakilere ve günü gelmiş olanlara)
        if (item.status === 'RESERVED') {
            return (
                <button
                    onClick={(e) => { e.stopPropagation(); checkIn(item.id); }} // onDoubleClick satır tetikleyicisini önler
                    disabled={isCheckingIn || isFutureArrival}
                    title={isFutureArrival ? `Giriş tarihi (${formatDate(item.check_in_date)}) henüz gelmedi!` : ""}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition cursor-pointer
                        ${isFutureArrival ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300'}`}
                >
                    {isCheckingIn && <Loader2 size={12} className="animate-spin" />}
                    Check-in Yap
                </button>
            );
        }

        // Kural 2: CHECK-OUT BUTONU (Yalnızca otelde konaklayanlar [IN_HOUSE] için)
        if (item.status === 'IN_HOUSE') {
            return (
                <button
                    onClick={(e) => { e.stopPropagation(); checkOut(item.id); }} // onDoubleClick satır tetikleyicisini önler
                    disabled={isCheckingOut || isFutureDeparture}
                    title={isFutureDeparture ? `Çıkış tarihi (${formatDate(item.check_out_date)}) henüz gelmedi!` : ''}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition cursor-pointer
                        ${isFutureDeparture ? 'bg-slate-400 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300'}`}
                >
                    {isCheckingOut && <Loader2 size={12} className="animate-spin" />}
                    Check-out Yap
                </button>
            );
        }

        // Kural 3: İŞLEM TAMAMLANDI (CHECKED_OUT, CANCELLED, NO_SHOW)
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
                            <th className="py-3.5 px-5">Statü / Acenta</th>
                            <th className="py-3.5 px-5 text-right">Aksiyon</th>
                        </tr>
                    </thead>

                    {/* Tablo Gövdesi */}
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                        {data.map((item) => {
                            const guestName = item.guest_full_name || item.guest_name || 'İsimsiz Misafir';
                            const roomNumber = item.room_number || 'Atanmadı';
                            const price = Number(item.total_price || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
                            const extraGuestsCount = (item.total_guest_count || 1) - 1;

                            return (
                                <tr
                                    key={item.id}
                                    onDoubleClick={() => onRowDoubleClick && onRowDoubleClick(item)}
                                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                                >
                                    {/* SÜTUN 1: MİSAFİR BİLGİSİ (Ana misafir adı ve varsa refakatçi sayısı rozeti) */}
                                    <td className="py-3.5 px-5">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-slate-800">{guestName}</span>
                                            {extraGuestsCount > 0 && (
                                                <span className="flex items-center gap-1 bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                    <Users size={10} /> +{extraGuestsCount}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* SÜTUN 2: ODA NUMARASI (Oda ikonu ve atanmış oda numarası) */}
                                    <td className="py-3.5 px-5 text-xs text-slate-500 font-medium">
                                        <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                            <BedDouble size={16} className="text-slate-500" />
                                            {roomNumber}
                                        </div>
                                    </td>

                                    {/* SÜTUN 3: KONAKLAMA TARİHLERİ (Giriş ve çıkış tarihleri arası akış oku) */}
                                    <td className="py-3.5 px-5 text-slate-500 font-medium">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar size={14} className="text-slate-700" />
                                            {formatDate(item.check_in_date)} &rarr; {formatDate(item.check_out_date)}
                                        </div>
                                    </td>

                                    {/* SÜTUN 4: BAKİYE / TOPLAM TUTAR (TL para birimi formatlı fiyat) */}
                                    <td className="py-3.5 px-5 font-bold text-slate-700">
                                        {price}
                                    </td>

                                    {/* SÜTUN 5: STATÜ VE ACENTA (Rezervasyon durumu rozeti ve münferit harici acenta adı) */}
                                    <td className="py-3.5 px-5">
                                        <div className="flex flex-col gap-1 items-start">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md
                                                ${item.status === 'RESERVED' ? 'bg-indigo-50 text-indigo-600' : ''}
                                                ${item.status === 'IN_HOUSE' ? 'bg-blue-50 text-blue-600' : ''}
                                                ${item.status === 'CHECKED_OUT' ? 'bg-slate-100 text-slate-600' : ''}
                                                ${['CANCELLED', 'NO_SHOW'].includes(item.status) ? 'bg-rose-50 text-rose-600' : ''}
                                            `}>
                                                {item.status?.replace("_", ' ')}
                                            </span>
                                            {item.agency_display && item.agency !== "DIRECT" && (
                                                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                                                    {item.agency_display}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* SÜTUN 6: AKSİYON (Operasyonel Check-in / Check-out tetikleyici butonları) */}
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