/**
 * RoomAssignmentModal (Oda Blokaj / Seçim Ekranı)
 * 
 * İş Kuralları (Business Logic):
 * 1. Varsayılan olarak SADECE misafirin satın aldığı oda tipindeki (bookedRoomTypeCode) müsait odaları yükler.
 * 2. Housekeeping statüsüne (VC, VD, OC, OD) göre filtreleme imkanı sunar. Arızalı (OOO) odalar backend tarafından
 *    zaten filtrelendiği (exclude) için bu ekrana hiç yansımaz ve seçilemez.
 * 3. Resepsiyonist isterse filtre barından diğer oda tiplerini (Upgrade/Downgrade) veya "Tümü"nü seçebilir.
 * 4. Odaları Kat (Floor) bazında gruplayarak sunar.
 * 5. IN_HOUSE (Konaklayan) misafirlerde blokaj kaldırma (Unassign) işlemini kilitler.
 */

import { useState, useEffect, useMemo } from 'react';
import { useAvailableRooms, useRoomTypes } from '../../hooks/useHotelData';
import { X, DoorOpen, DoorClosed, AlertTriangle, Loader2, Ban, Filter, Layers, Check, Sparkles } from 'lucide-react';

// HK Statüleri için Renk ve Etiket Sözlüğü (DRY)
const HK_STATUS = {
    'VC': { label: 'Boş Temiz (VC)', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    'VD': { label: 'Boş Kirli (VD)', color: 'bg-rose-100 text-rose-700 border-rose-200' },
    'OC': { label: 'Dolu Temiz (OC)', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    'OD': { label: 'Dolu Kirli (OD)', color: 'bg-amber-100 text-amber-700 border-amber-200' }
};

const RoomAssignmentModal = ({ 
    isOpen, 
    onClose, 
    onAssign, 
    checkIn, 
    checkOut, 
    currentRoomId, 
    reservationStatus,
    bookedRoomTypeCode 
}) => {
    // ==========================================
    // 1. YEREL DURUM (LOCAL STATE) & VERİ ÇEKİMİ
    // ==========================================
    const [selectedRoomId, setSelectedRoomId] = useState(currentRoomId || null);
    
    // Filtre 1: Oda Tipi (Varsayılan: Misafirin satın aldığı tip, yoksa 'ALL')
    const [activeTypeFilter, setActiveTypeFilter] = useState(bookedRoomTypeCode || 'ALL');
    
    // Filtre 2: Housekeeping Statüsü (Varsayılan: Tümü)
    const [activeHKFilter, setActiveHKFilter] = useState('ALL');

    const { data: availableRooms, isLoading, isError } = useAvailableRooms(checkIn, checkOut);
    const { data: roomTypes } = useRoomTypes();

    useEffect(() => {
        if (isOpen) {
            setSelectedRoomId(currentRoomId || null);
            setActiveTypeFilter(bookedRoomTypeCode || 'ALL');
            setActiveHKFilter('ALL');
        }
    }, [isOpen, currentRoomId, bookedRoomTypeCode]);

    // ==========================================
    // 2. VERİ NORMALİZASYONU VE TÜRETİLMİŞ DURUMLAR
    // ==========================================
    const isUnassignLocked = reservationStatus === 'IN_HOUSE';

    const roomTypeMap = useMemo(() => {
        const map = {};
        if (Array.isArray(roomTypes)) {
            roomTypes.forEach(rt => {
                map[rt.id] = rt;
                map[rt.code] = rt;
            });
        }
        return map;
    }, [roomTypes]);

    const resolveRoomTypeCode = (room) => {
        if (room.room_type_code) return room.room_type_code;
        if (typeof room.room_type === 'object' && room.room_type?.code) return room.room_type.code;
        const typeId = room.room_type_id || room.room_type;
        return roomTypeMap[typeId]?.code || 'STD';
    };

    // Oda Tipi Filtresi için Sayaçlar (Sadece statü filtresinden geçenleri sayar)
    const typeCounts = useMemo(() => {
        const counts = { ALL: 0 };
        if (!Array.isArray(availableRooms)) return counts;

        availableRooms.forEach(room => {
            // Eğer bir HK statüsü seçiliyse ve bu oda o statüde değilse sayma
            if (activeHKFilter !== 'ALL' && room.status !== activeHKFilter) return;

            const code = resolveRoomTypeCode(room);
            counts.ALL += 1;
            counts[code] = (counts[code] || 0) + 1;
        });
        return counts;
    }, [availableRooms, activeHKFilter, roomTypeMap]);

    // HK Statüsü Filtresi için Sayaçlar (Sadece oda tipi filtresinden geçenleri sayar)
    const hkCounts = useMemo(() => {
        const counts = { ALL: 0, VC: 0, VD: 0, OC: 0, OD: 0 };
        if (!Array.isArray(availableRooms)) return counts;

        availableRooms.forEach(room => {
            // Eğer bir oda tipi seçiliyse ve bu oda o tipte değilse sayma
            if (activeTypeFilter !== 'ALL' && resolveRoomTypeCode(room) !== activeTypeFilter) return;

            counts.ALL += 1;
            if (room.status && counts[room.status] !== undefined) {
                counts[room.status] += 1;
            }
        });
        return counts;
    }, [availableRooms, activeTypeFilter, roomTypeMap]);


    const typeFilterOptions = useMemo(() => {
        const options = [];
        if (Array.isArray(roomTypes) && roomTypes.length > 0) {
            roomTypes.forEach(rt => {
                options.push({
                    code: rt.code,
                    name: rt.name,
                    count: typeCounts[rt.code] || 0,
                    isBookedType: rt.code === bookedRoomTypeCode
                });
            });
        } else {
            Object.keys(typeCounts).filter(k => k !== 'ALL').forEach(code => {
                options.push({
                    code,
                    name: code,
                    count: typeCounts[code] || 0,
                    isBookedType: code === bookedRoomTypeCode
                });
            });
        }
        return options;
    }, [roomTypes, typeCounts, bookedRoomTypeCode]);

    // ÇİFT FİLTRELEME: Önce Tipe, sonra Statüye göre süz ve Katlara göre grupla
    const groupedRooms = useMemo(() => {
        if (!Array.isArray(availableRooms)) return {};

        const filtered = availableRooms.filter(room => {
            const matchType = activeTypeFilter === 'ALL' || resolveRoomTypeCode(room) === activeTypeFilter;
            const matchHK = activeHKFilter === 'ALL' || room.status === activeHKFilter;
            return matchType && matchHK;
        });

        return filtered.reduce((acc, room) => {
            const floor = room.floor != null ? String(room.floor) : 'Diğer';
            if (!acc[floor]) acc[floor] = [];
            acc[floor].push(room);
            return acc;
        }, {});
    }, [availableRooms, activeTypeFilter, activeHKFilter, roomTypeMap]);

    // ==========================================
    // 3. ERKEN DÖNÜŞ (EARLY RETURN)
    // ==========================================
    if (!isOpen) return null;

    // ==========================================
    // 4. AKSİYON İŞLEYİCİLER
    // ==========================================
    const handleRoomSelect = (roomId) => {
        setSelectedRoomId(roomId);
    };

    const handleUnassign = () => {
        if (isUnassignLocked) return;
        setSelectedRoomId(null);
    };

    const selectedRoomDetails = availableRooms?.find(r => String(r.id) === String(selectedRoomId));
    const selectedRoomTypeCode = selectedRoomDetails ? resolveRoomTypeCode(selectedRoomDetails) : null;
    const isDifferentRoomType = selectedRoomDetails && bookedRoomTypeCode && selectedRoomTypeCode !== bookedRoomTypeCode;

    const handleConfirm = () => {
        onAssign(selectedRoomId, selectedRoomDetails?.room_number || null);
        onClose();
    };

    const visibleRoomCount = Object.values(groupedRooms).reduce((sum, arr) => sum + arr.length, 0);

    // ==========================================
    // 5. EKRAN ÇİZİMİ (RENDER)
    // ==========================================
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[90vh] overflow-hidden">
                
                {/* 5.1 HEADER */}
                <div className="flex items-center justify-between px-6 py-4 bg-slate-800 text-white shrink-0">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <DoorOpen size={20} className="text-blue-400" />
                            Oda Seçimi ve Blokaj Yönetimi
                        </h2>
                        <p className="text-xs text-slate-300 mt-1 opacity-90">
                            Tarih Aralığı: {checkIn?.split('-').reverse().join('.')} — {checkOut?.split('-').reverse().join('.')} 
                            {bookedRoomTypeCode && ` • Satın Alınan Tip: ${bookedRoomTypeCode}`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                {/* 5.2 ÜST KONTROL BAR: BLOKAJSIZ BEKLET & FİLTRELER */}
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 shrink-0 flex flex-col gap-4">
                    
                    {/* Üst Satır: Blokajı Kaldır & Temizlik Filtresi */}
                    <div className="flex items-center justify-between">
                        
                        {/* Sol: HK Filtreleri (Görseldeki Gibi Tasarım) */}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <Sparkles size={12} className="text-slate-400" /> Temizlik / Statü
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setActiveHKFilter('ALL')}
                                    className={`px-4 py-1.5 rounded text-xs font-bold transition-all border ${
                                        activeHKFilter === 'ALL'
                                            ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                                    }`}
                                >
                                    Tümü ({hkCounts.ALL})
                                </button>
                                
                                {Object.entries(HK_STATUS).map(([key, data]) => {
                                    const isActive = activeHKFilter === key;
                                    const count = hkCounts[key] || 0;
                                    
                                    // Eğer o statüde hiç oda yoksa butonu biraz silik göster
                                    const opacityClass = count === 0 && !isActive ? 'opacity-50' : '';

                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setActiveHKFilter(key)}
                                            className={`px-3 py-1.5 rounded text-xs font-bold transition-all border ${opacityClass} ${
                                                isActive
                                                    ? `${data.color} border-current shadow-sm ring-1 ring-current`
                                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            {data.label} <span className="ml-1 opacity-70">({count})</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Sağ: Blokajsız (Havuz) Butonu */}
                        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                            <div className="text-right">
                                <h3 className="text-[13px] font-bold text-slate-700">Havuzda Beklet</h3>
                                <p className="text-[10px] text-slate-500">
                                    Fiziksel blokaj atamadan kapasite sat.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleUnassign}
                                disabled={isUnassignLocked || selectedRoomId === null}
                                className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                                    selectedRoomId === null 
                                        ? 'bg-amber-500 text-white shadow-md' 
                                        : isUnassignLocked 
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer'
                                }`}
                                title={isUnassignLocked ? "İçeride konaklayan misafirin oda blokajı kaldırılamaz." : ""}
                            >
                                <Ban size={14} />
                                {selectedRoomId === null ? 'Blokajsız' : 'Blokajı Kaldır'}
                            </button>
                        </div>

                    </div>

                    {/* Alt Satır: Oda Tipi Filtreleri */}
                    <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-2">
                            <Layers size={12} className="text-slate-400" /> Oda Tipi
                        </span>

                        {typeFilterOptions.map((opt) => {
                            const isActive = activeTypeFilter === opt.code;
                            return (
                                <button
                                    key={opt.code}
                                    type="button"
                                    onClick={() => setActiveTypeFilter(opt.code)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                                        isActive
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                                    }`}
                                >
                                    <span>{opt.name} ({opt.code})</span>
                                    {opt.isBookedType && (
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold ${
                                            isActive ? 'bg-blue-800 text-blue-100' : 'bg-emerald-100 text-emerald-700'
                                        }`}>
                                            Satın Alınan
                                        </span>
                                    )}
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                        isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {opt.count}
                                    </span>
                                </button>
                            );
                        })}

                        <button
                            type="button"
                            onClick={() => setActiveTypeFilter('ALL')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                                activeTypeFilter === 'ALL'
                                    ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                            }`}
                        >
                            <span>Tüm Oda Tipleri</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                activeTypeFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                                {typeCounts.ALL || 0}
                            </span>
                        </button>
                    </div>
                </div>

                {/* 5.3 ODA LİSTESİ (KATLARA GÖRE GRUPLU) */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                            <Loader2 size={32} className="animate-spin mb-3 text-blue-500" />
                            <p className="text-sm font-semibold">Müsait odalar aranıyor...</p>
                        </div>
                    ) : isError ? (
                        <div className="flex flex-col items-center justify-center h-48 text-rose-500">
                            <AlertTriangle size={32} className="mb-3" />
                            <p className="text-sm font-semibold">Odalar yüklenirken bir hata oluştu.</p>
                        </div>
                    ) : visibleRoomCount === 0 ? (
                        <div className="flex flex-col items-center justify-center h-56 text-slate-500 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <DoorClosed size={44} className="mb-3 opacity-25" />
                            {activeTypeFilter !== 'ALL' || activeHKFilter !== 'ALL' ? (
                                <>
                                    <p className="text-sm font-bold text-slate-700">
                                        Seçili filtrelere uygun müsait oda bulunamadı.
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1 mb-4">
                                        Filtreleri sıfırlayarak diğer odaları görüntüleyebilirsiniz.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => { setActiveTypeFilter('ALL'); setActiveHKFilter('ALL'); }}
                                        className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg shadow-sm transition cursor-pointer"
                                    >
                                        Filtreleri Temizle
                                    </button>
                                </>
                            ) : (
                                <p className="text-sm font-semibold">Bu tarihlerde otelde hiç müsait oda bulunamadı.</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Object.keys(groupedRooms).sort((a, b) => {
                                if (a === 'Diğer') return 1;
                                if (b === 'Diğer') return -1;
                                return parseInt(a) - parseInt(b);
                            }).map((floor) => (
                                <div key={floor} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
                                        {floor === 'Diğer' ? floor : `${floor}. Kat`}
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                        {groupedRooms[floor].map((room) => {
                                            const isSelected = selectedRoomId !== null && String(selectedRoomId) === String(room.id);
                                            const currentRoomTypeCode = resolveRoomTypeCode(room);
                                            const isMismatch = bookedRoomTypeCode && currentRoomTypeCode !== bookedRoomTypeCode;
                                            
                                            // HK Statüsüne Göre Rozet Tasarımı
                                            const hkStatusLabel = room.status || 'Bilinmiyor';
                                            const hkStatusColor = HK_STATUS[hkStatusLabel]?.color || 'bg-slate-100 text-slate-500 border-slate-200';

                                            return (
                                                <button
                                                    key={room.id}
                                                    type="button"
                                                    onClick={() => handleRoomSelect(room.id)}
                                                    className={`relative flex flex-col p-3 pt-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                                                        isSelected 
                                                            ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-500/20' 
                                                            : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 hover:shadow-sm'
                                                    }`}
                                                >
                                                    {/* Seçili İkonu */}
                                                    {isSelected && (
                                                        <span className="absolute top-2 right-2 text-blue-600">
                                                            <Check size={16} strokeWidth={3} />
                                                        </span>
                                                    )}

                                                    {/* Upgrade/Downgrade Uyarı Rozeti */}
                                                    {isMismatch && (
                                                        <span 
                                                            className="absolute -top-2 -left-2 bg-amber-500 text-white rounded-full p-1 shadow-md z-10" 
                                                            title={`Farklı Oda Tipi: Satın alınan (${bookedRoomTypeCode}), bu oda (${currentRoomTypeCode})`}
                                                        >
                                                            <AlertTriangle size={12} />
                                                        </span>
                                                    )}

                                                    {/* HK Statü Rozeti */}
                                                    <span 
                                                        className={`absolute -top-2 right-3 text-[9px] font-extrabold px-1.5 py-0.5 rounded border shadow-sm ${hkStatusColor}`}
                                                    >
                                                        {hkStatusLabel}
                                                    </span>

                                                    <span className={`text-xl font-black mt-1 ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                                                        {room.room_number}
                                                    </span>
                                                    <span className={`text-xs font-bold mt-0.5 ${
                                                        isMismatch ? 'text-amber-600' : isSelected ? 'text-blue-600' : 'text-slate-400'
                                                    }`}>
                                                        {currentRoomTypeCode}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 5.4 FOOTER (ONAY ALANI) */}
                <div className="px-6 py-4 bg-white border-t border-slate-200 shrink-0 flex items-center justify-between rounded-b-2xl">
                    <div className="flex-1">
                        {isDifferentRoomType ? (
                            <p className="text-xs font-semibold text-amber-600 flex items-center gap-1.5">
                                <AlertTriangle size={14} /> 
                                Seçilen oda ({selectedRoomTypeCode}), misafirin satın aldığı ({bookedRoomTypeCode}) tipinden farklı! (Upgrade / Downgrade)
                            </p>
                        ) : isUnassignLocked && selectedRoomId === currentRoomId ? (
                            <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                                <AlertTriangle size={14} className="text-amber-500" /> 
                                Misafir içeride konaklıyor. Sadece başka bir boş oda seçerek taşıma (Room Move) yapabilirsiniz.
                            </p>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                            İptal
                        </button>
                        <button 
                            type="button" 
                            onClick={handleConfirm}
                            disabled={isLoading || isError || (!selectedRoomId && !isUnassignLocked && currentRoomId === null)}
                            className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg shadow-md transition-colors cursor-pointer"
                        >
                            Seçimi Onayla
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default RoomAssignmentModal;