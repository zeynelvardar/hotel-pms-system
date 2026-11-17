/**
 * Ön Büro Rezervasyon Dashboardu Tablo Bileşeni
 * Gelen sekme tipine (type) ve rezervasyon statüsüne (status) göre
 * Check-in, Check-out gibi operasyonel butonları güvenli bir şekilde render eder.
 * Mimarisi gereği Frontend tabanlı hızlı kolon sıralaması (Sorting) yapabilir.
 */

// ==========================================
// 1. İÇE AKTARIMLAR (IMPORTS)
// ==========================================
import { useState, useMemo } from 'react';
import { formatDate } from '../../utils/formatters';
import { 
    Calendar, BedDouble, User, Loader2, Users, Building, 
    ArrowUpDown, ArrowUp, ArrowDown, LogIn, LogOut, CheckCircle2 
} from 'lucide-react';
import { useReservationAction, useSystemDate } from '../../hooks/useHotelData';

const ReservationTable = ({ data, type, isLoading, onRowDoubleClick }) => {
    // ==========================================
    // 2. KANCALAR (HOOKS) & YEREL DURUM
    // ==========================================
    const { checkIn, isCheckingIn, checkOut, isCheckingOut } = useReservationAction();
    const { data: systemDate, isLoading: isDateLoading } = useSystemDate();
    const activeDate = systemDate;

    // Sıralama (Sorting) State'i
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // ==========================================
    // 3. İŞ MANTIĞI & VERİ SIRALAMA (DERIVED STATE)
    // ==========================================
    const sortedData = useMemo(() => {
        if (!data || !Array.isArray(data)) return [];
        let sortableItems = [...data];
        
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                let aValue, bValue;
                
                switch (sortConfig.key) {
                    case 'guest':
                        aValue = (a.guest_full_name || a.guest_name || '').toLowerCase();
                        bValue = (b.guest_full_name || b.guest_name || '').toLowerCase();
                        return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
                    
                    case 'room':
                        aValue = a.room_number || '';
                        bValue = b.room_number || '';
                        // Atanmamış odaları her zaman en sona atar
                        if (!aValue) return 1; 
                        if (!bValue) return -1;
                        // numeric:true sayesinde "10" ve "2" kıyaslamasında "2"yi öne alır (Doğru Aritmetik)
                        return sortConfig.direction === 'asc' 
                            ? aValue.localeCompare(bValue, undefined, { numeric: true }) 
                            : bValue.localeCompare(aValue, undefined, { numeric: true });
                    
                    case 'checkIn':
                        aValue = new Date(a.check_in_date).getTime();
                        bValue = new Date(b.check_in_date).getTime();
                        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
                    
                    case 'checkOut':
                        aValue = new Date(a.check_out_date).getTime();
                        bValue = new Date(b.check_out_date).getTime();
                        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
                    
                    case 'price':
                        aValue = Number(a.total_price || 0);
                        bValue = Number(b.total_price || 0);
                        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
                    
                    case 'status':
                        aValue = a.status || '';
                        bValue = b.status || '';
                        return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
                    
                    case 'agency':
                        aValue = (a.agency_display || a.agency || '').toLowerCase();
                        bValue = (b.agency_display || b.agency || '').toLowerCase();
                        return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
                    
                    default:
                        return 0;
                }
            });
        }
        return sortableItems;
    }, [data, sortConfig]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // ==========================================
    // 4. ERKEN DÖNÜŞLER (EARLY RETURNS)
    // ==========================================
    if (isLoading || isDateLoading || !activeDate) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500 bg-white rounded-xl border border-slate-200">
                <Loader2 size={32} className="animate-spin mb-3 text-slate-400" />
                <span className="text-sm font-medium">Otel Operasyon Günü ve Kayıtlar Yükleniyor...</span>
            </div>
        );
    }

    if (!sortedData || sortedData.length === 0) {
        return (
            <div className="text-center p-16 text-slate-400 bg-white rounded-xl border border-slate-200">
                <User size={36} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Seçili sekmede henüz kayıtlı işlem bulunmuyor.</p>
            </div>
        );
    }

    // ==========================================
    // 5. YARDIMCI BİLEŞENLER VE FONKSİYONLAR
    // ==========================================
    
    // DRY (Don't Repeat Yourself) - Tekrar edilebilir Sıralama Başlığı
    const SortableHeader = ({ sortKey, label, className = "" }) => {
        const isActive = sortConfig.key === sortKey;
        return (
            <th 
                className={`py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors group select-none ${className}`}
                onClick={() => requestSort(sortKey)}
            >
                <div className="flex items-center gap-1.5">
                    {label}
                    <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
                        {!isActive ? <ArrowUpDown size={12} /> : 
                          sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-blue-600" /> : 
                          <ArrowDown size={12} className="text-blue-600" />}
                    </span>
                </div>
            </th>
        );
    };

    // Minimal İkonografik Aksiyon Butonları
    const renderActionButtons = (item) => {
        const isFutureArrival = item.check_in_date > activeDate;
        const isFutureDeparture = item.check_out_date > activeDate;

        if (item.status === 'RESERVED') {
            return (
                <button
                    onClick={(e) => { e.stopPropagation(); checkIn(item.id); }}
                    disabled={isCheckingIn || isFutureArrival}
                    title={isFutureArrival ? `Giriş tarihi (${formatDate(item.check_in_date)}) henüz gelmedi!` : "Misafiri Otele Al (Check-in)"}
                    className={`p-2 rounded-lg text-white transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95
                        ${isFutureArrival ? 'bg-slate-300 text-slate-100 cursor-not-allowed shadow-none' : 'bg-emerald-500 hover:bg-emerald-600'}`}
                >
                    {isCheckingIn ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                </button>
            );
        }

        if (item.status === 'IN_HOUSE') {
            return (
                <button
                    onClick={(e) => { e.stopPropagation(); checkOut(item.id); }}
                    disabled={isCheckingOut || isFutureDeparture}
                    title={isFutureDeparture ? `Çıkış tarihi (${formatDate(item.check_out_date)}) henüz gelmedi!` : 'Odayı Kapat (Check-out)'}
                    className={`p-2 rounded-lg text-white transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95
                        ${isFutureDeparture ? 'bg-slate-300 text-slate-100 cursor-not-allowed shadow-none' : 'bg-rose-500 hover:bg-rose-600'}`}
                >
                    {isCheckingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
                </button>
            );
        }

        // Tamamlanmış İşlemler İçin Statik İkon
        return (
            <div className="flex justify-end pr-2" title="İşlem Tamamlandı">
                <CheckCircle2 size={20} className="text-slate-300" />
            </div>
        );
    };

    // ==========================================
    // 6. ANA EKRAN ÇİZİMİ (MAIN RENDER)
    // ==========================================
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
                    {/* Tablo Başlığı */}
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold">
                            <SortableHeader sortKey="guest" label="Misafir" />
                            <SortableHeader sortKey="room" label="Oda No" />
                            <SortableHeader sortKey="checkIn" label="Check-in" />
                            <SortableHeader sortKey="checkOut" label="Check-out" />
                            <SortableHeader sortKey="price" label="Bakiye" />
                            <SortableHeader sortKey="status" label="Statü" />
                            <SortableHeader sortKey="agency" label="Acenta" />
                            <th className="py-3.5 px-4 text-right">Aksiyon</th>
                        </tr>
                    </thead>

                    {/* Tablo Gövdesi */}
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                        {sortedData.map((item) => {
                            const guestName = item.guest_full_name || item.guest_name || 'İsimsiz Misafir';
                            const roomNumber = item.room_number || 'Atanmadı';
                            const price = Number(item.total_price || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
                            const extraGuestsCount = (item.total_guest_count || 1) - 1;

                            return (
                                <tr
                                    key={item.id}
                                    onDoubleClick={() => onRowDoubleClick && onRowDoubleClick(item)}
                                    className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                                >
                                    {/* MİSAFİR */}
                                    <td className="py-3.5 px-4">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800">{guestName}</span>
                                            {extraGuestsCount > 0 && (
                                                <span className="flex items-center gap-1 bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                    <Users size={10} /> +{extraGuestsCount}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* ODA */}
                                    <td className="py-3.5 px-4 text-xs font-medium">
                                        <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                            <BedDouble size={16} className={item.room_number ? "text-blue-500" : "text-amber-500"} />
                                            {roomNumber}
                                        </div>
                                    </td>

                                    {/* CHECK-IN */}
                                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar size={14} className="text-emerald-500" />
                                            {formatDate(item.check_in_date)}
                                        </div>
                                    </td>

                                    {/* CHECK-OUT */}
                                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar size={14} className="text-rose-400" />
                                            {formatDate(item.check_out_date)}
                                        </div>
                                    </td>

                                    {/* BAKİYE */}
                                    <td className="py-3.5 px-4 font-black text-slate-700">
                                        {price}
                                    </td>

                                    {/* STATÜ */}
                                    <td className="py-3.5 px-4">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border
                                            ${item.status === 'RESERVED' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : ''}
                                            ${item.status === 'IN_HOUSE' ? 'bg-blue-50 border-blue-100 text-blue-600' : ''}
                                            ${item.status === 'CHECKED_OUT' ? 'bg-slate-100 border-slate-200 text-slate-600' : ''}
                                            ${['CANCELLED', 'NO_SHOW'].includes(item.status) ? 'bg-rose-50 border-rose-100 text-rose-600' : ''}
                                        `}>
                                            {item.status?.replace("_", ' ')}
                                        </span>
                                    </td>

                                    {/* ACENTA */}
                                    <td className="py-3.5 px-4">
                                        <div className="flex items-center gap-1.5 text-slate-600">
                                            <Building size={14} className="text-slate-400" />
                                            <span className="text-xs font-semibold uppercase tracking-wider">
                                                {item.agency_display || item.agency}
                                            </span>
                                        </div>
                                    </td>

                                    {/* AKSİYON */}
                                    <td className="py-3.5 px-4 text-right">
                                        <div className="flex justify-end">
                                            {renderActionButtons(item)}
                                        </div>
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