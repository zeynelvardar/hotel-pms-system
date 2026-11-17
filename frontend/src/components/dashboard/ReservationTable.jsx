/**
 * Ön Büro Rezervasyon Dashboardu Tablo Bileşeni
 * Gelen sekme tipine (type) ve rezervasyon statüsüne (status) göre
 * Check-in, Check-out gibi operasyonel butonları güvenli bir şekilde render eder.
 * Elektra Web tarzı sütun bazlı anlık arama/filtreleme ve akıllı sıralama destekler.
 */

// ==========================================
// 1. İÇE AKTARIMLAR (IMPORTS)
// ==========================================
import { useState, useMemo } from 'react';
import { formatDate, maskDateInput } from '../../utils/formatters';
import { 
    Calendar, BedDouble, User, Loader2, Users, Building, 
    ArrowUpDown, ArrowUp, ArrowDown, LogIn, LogOut, CheckCircle2, Search, X 
} from 'lucide-react';
import { useReservationAction, useSystemDate } from '../../hooks/useHotelData';

// ==========================================
// 2. YARDIMCI BİLEŞEN: SÜTUN BAŞLIĞI VE FİLTRE KUTUSU
// ==========================================
// DİKKAT (Senior Note): Bu bileşen ana bileşenin DIŞINDA tanımlanmalıdır. 
// Aksi takdirde React her render'da input'u yeniden oluşturur ve klavye odağı (focus) kaybolur!
const SortableHeaderWithFilter = ({ 
    sortKey, label, filterKey, filters, sortConfig, onSort, onFilterChange, isDate 
}) => {
    const isActive = sortConfig.key === sortKey;
    const hasFilterValue = Boolean(filters[filterKey]);

    const handleTextChange = (e) => {
        let val = e.target.value;
        // Eğer tarih hücresiyse, kullanıcı 16102026 yazsa bile anında 16.10.2026 yapar
        if (isDate) {
            val = maskDateInput(val);
        }
        onFilterChange(filterKey, val);
    };

    const handleDateSelection = (e) => {
        const dateVal = e.target.value; // YYYY-MM-DD
        if (dateVal) {
            const [y, m, d] = dateVal.split('-');
            onFilterChange(filterKey, `${d}.${m}.${y}`);
        }
    };

    return (
        <th className="py-3 px-3 align-top select-none bg-slate-50 border-b border-slate-200">
            {/* Üst Kısım: Sıralama Başlığı */}
            <div 
                className="flex items-center justify-between gap-1 cursor-pointer hover:text-blue-600 transition-colors group mb-1.5"
                onClick={() => onSort(sortKey)}
            >
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    {label}
                </span>
                <span className="text-slate-400 group-hover:text-blue-600 transition-colors">
                    {!isActive ? <ArrowUpDown size={11} /> : 
                      sortConfig.direction === 'asc' ? <ArrowUp size={11} className="text-blue-600" /> : 
                      <ArrowDown size={11} className="text-blue-600" />}
                </span>
            </div>

            {/* Alt Kısım: Elektra Web Tarzı Mini Arama Kutusu */}
            <div className="relative flex items-center">
                <span className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-slate-400">
                    <Search size={11} />
                </span>
                
                <input
                    type="text"
                    value={filters[filterKey] || ''}
                    onChange={handleTextChange}
                    placeholder={isDate ? "GG.AA.YYYY" : "Ara..."}
                    maxLength={isDate ? 10 : undefined}
                    className={`w-full bg-white border rounded px-2 pl-6 py-1 text-[11px] font-medium outline-none transition-all shadow-2xs
                        ${hasFilterValue ? (isDate ? 'pr-10' : 'pr-6') : (isDate ? 'pr-6' : 'pr-2')}
                        ${hasFilterValue 
                            ? 'border-blue-500 ring-1 ring-blue-500/20 text-blue-900 bg-blue-50/20' 
                            : 'border-slate-300 text-slate-700 hover:border-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20'}`}
                />
                
                {/* Tarih Kolonuysa Hem Takvim İkonu Hem de Görünmez Yerel Takvim Seçici Çıkar */}
                {isDate && (
                    <div className={`absolute inset-y-0 flex items-center ${hasFilterValue ? 'right-5' : 'right-1'}`} title="Takvimden Seç">
                        <input 
                            type="date" 
                            onChange={handleDateSelection}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Calendar size={12} className="text-slate-400 hover:text-blue-600 pointer-events-none" />
                    </div>
                )}

                {/* Filtre Temizleme Butonu */}
                {hasFilterValue && (
                    <button
                        type="button"
                        onClick={() => onFilterChange(filterKey, '')}
                        className="absolute inset-y-0 right-0 pr-1.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Temizle"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>
        </th>
    );
};

// ==========================================
// 3. ANA BİLEŞEN (MAIN COMPONENT)
// ==========================================
const ReservationTable = ({ data, type, isLoading, onRowDoubleClick }) => {
    const { checkIn, isCheckingIn, checkOut, isCheckingOut } = useReservationAction();
    const { data: systemDate, isLoading: isDateLoading } = useSystemDate();
    const activeDate = systemDate;

    // State: Sıralama ve Filtreler
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [filters, setFilters] = useState({
        guest: '', room: '', checkIn: '', checkOut: '', price: '', status: '', agency: ''
    });

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    // Arama kutuları "DD.MM.YYYY" formatında (noktalı) filtrelediği için 
    // Backend'den gelen ISO (YYYY-MM-DD) tarihini string aramaya hazırlayan yardımcı fonksiyon
    const formatForSearch = (isoDate) => {
        if (!isoDate) return '';
        const [y, m, d] = isoDate.split('T')[0].split('-');
        return `${d}.${m}.${y}`;
    };

    // Filtreleme ve Sıralama İşlemi (Optimize Cached State)
    const filteredAndSortedData = useMemo(() => {
        if (!data || !Array.isArray(data)) return [];

        // 1. FİLTRELEME
        const filtered = data.filter(item => {
            const guestName = (item.guest_full_name || item.guest_name || '').toLowerCase();
            const roomNum = (item.room_number || '').toLowerCase();
            const priceVal = String(item.total_price || '').toLowerCase();
            const statusVal = (item.status || '').replace('_', ' ').toLowerCase();
            const agencyVal = (item.agency_display || item.agency || '').toLowerCase();
            
            // Tarihler için arama standardizasyonu
            const checkInFormatted = formatForSearch(item.check_in_date);
            const checkOutFormatted = formatForSearch(item.check_out_date);

            if (filters.guest && !guestName.includes(filters.guest.toLowerCase())) return false;
            if (filters.room && !roomNum.includes(filters.room.toLowerCase())) return false;
            if (filters.checkIn && !checkInFormatted.includes(filters.checkIn)) return false;
            if (filters.checkOut && !checkOutFormatted.includes(filters.checkOut)) return false;
            if (filters.price && !priceVal.includes(filters.price.toLowerCase())) return false;
            if (filters.status && !statusVal.includes(filters.status.toLowerCase())) return false;
            if (filters.agency && !agencyVal.includes(filters.agency.toLowerCase())) return false;

            return true;
        });

        // 2. SIRALAMA
        if (sortConfig.key) {
            filtered.sort((a, b) => {
                let aValue, bValue;
                
                switch (sortConfig.key) {
                    case 'guest':
                        aValue = (a.guest_full_name || a.guest_name || '').toLowerCase();
                        bValue = (b.guest_full_name || b.guest_name || '').toLowerCase();
                        return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
                    
                    case 'room':
                        aValue = a.room_number || '';
                        bValue = b.room_number || '';
                        if (!aValue) return 1; 
                        if (!bValue) return -1;
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

        return filtered;
    }, [data, filters, sortConfig]);

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

    if (!data || data.length === 0) {
        return (
            <div className="text-center p-16 text-slate-400 bg-white rounded-xl border border-slate-200">
                <User size={36} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Seçili sekmede henüz kayıtlı işlem bulunmuyor.</p>
            </div>
        );
    }

    // ==========================================
    // 5. AKSİYON BUTONU RENDER EDİCİSİ
    // ==========================================
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

        return (
            <div className="flex justify-end pr-2" title="İşlem Tamamlandı">
                <CheckCircle2 size={20} className="text-slate-300" />
            </div>
        );
    };

    // ==========================================
    // 6. EKRAN ÇİZİMİ (MAIN RENDER)
    // ==========================================
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
                    {/* Tablo Başlığı ve Sütun Filtreleri */}
                    <thead>
                        <tr>
                            <SortableHeaderWithFilter sortKey="guest" label="Misafir" filterKey="guest" filters={filters} sortConfig={sortConfig} onSort={requestSort} onFilterChange={handleFilterChange} />
                            <SortableHeaderWithFilter sortKey="room" label="Oda No" filterKey="room" filters={filters} sortConfig={sortConfig} onSort={requestSort} onFilterChange={handleFilterChange} />
                            <SortableHeaderWithFilter sortKey="checkIn" label="Check-in" filterKey="checkIn" filters={filters} sortConfig={sortConfig} onSort={requestSort} onFilterChange={handleFilterChange} isDate />
                            <SortableHeaderWithFilter sortKey="checkOut" label="Check-out" filterKey="checkOut" filters={filters} sortConfig={sortConfig} onSort={requestSort} onFilterChange={handleFilterChange} isDate />
                            <SortableHeaderWithFilter sortKey="price" label="Bakiye" filterKey="price" filters={filters} sortConfig={sortConfig} onSort={requestSort} onFilterChange={handleFilterChange} />
                            <SortableHeaderWithFilter sortKey="status" label="Statü" filterKey="status" filters={filters} sortConfig={sortConfig} onSort={requestSort} onFilterChange={handleFilterChange} />
                            <SortableHeaderWithFilter sortKey="agency" label="Acenta" filterKey="agency" filters={filters} sortConfig={sortConfig} onSort={requestSort} onFilterChange={handleFilterChange} />
                            <th className="py-3 px-4 text-right align-middle bg-slate-50 border-b border-slate-200">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Aksiyon</span>
                            </th>
                        </tr>
                    </thead>

                    {/* Tablo Gövdesi */}
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filteredAndSortedData.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="text-center py-12 text-slate-400 text-xs font-semibold">
                                    Arama kriterlerine uygun kayıt bulunamadı.
                                </td>
                            </tr>
                        ) : (
                            filteredAndSortedData.map((item) => {
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
                                        <td className="py-3.5 px-4 text-xs font-medium">
                                            <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                                <BedDouble size={16} className={item.room_number ? "text-blue-500" : "text-amber-500"} />
                                                {roomNumber}
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar size={14} className="text-emerald-500" />
                                                {formatDate(item.check_in_date)}
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar size={14} className="text-rose-400" />
                                                {formatDate(item.check_out_date)}
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 font-black text-slate-700">
                                            {price}
                                        </td>
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
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-1.5 text-slate-600">
                                                <Building size={14} className="text-slate-400" />
                                                <span className="text-xs font-semibold uppercase tracking-wider">
                                                    {item.agency_display || item.agency}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            <div className="flex justify-end">
                                                {renderActionButtons(item)}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ReservationTable;