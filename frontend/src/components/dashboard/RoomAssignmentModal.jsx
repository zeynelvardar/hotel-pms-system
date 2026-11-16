/**
 * RoomAssignmentModal (Oda Blokaj / Seçim Ekranı)
 * 
 * İş Kuralları (Business Logic):
 * 1. Varsayılan olarak SADECE misafirin satın aldığı oda tipindeki (bookedRoomTypeCode) müsait odaları yükler.
 * 2. Resepsiyonist isterse filtre barından diğer oda tiplerini (Upgrade/Downgrade) veya "Tümü"nü seçebilir.
 * 3. Odaları Kat (Floor) bazında gruplayarak sunar.
 * 4. IN_HOUSE (Konaklayan) misafirlerde blokaj kaldırma (Unassign) işlemini kilitler.
 */

import { useState, useEffect, useMemo } from 'react';
import { useAvailableRooms, useRoomTypes } from '../../hooks/useHotelData';
import { X, DoorOpen, DoorClosed, AlertTriangle, Loader2, Ban, Filter, Layers, Check } from 'lucide-react';

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
    // Varsayılan filtre: Misafirin satın aldığı oda tipi (Yoksa 'ALL')
    const [activeTypeFilter, setActiveTypeFilter] = useState(bookedRoomTypeCode || 'ALL');

    const { data: availableRooms, isLoading, isError } = useAvailableRooms(checkIn, checkOut);
    const { data: roomTypes } = useRoomTypes();

    // Modal her açıldığında seçili odayı ve varsayılan oda tipi filtresini senkronize et
    useEffect(() => {
        if (isOpen) {
            setSelectedRoomId(currentRoomId || null);
            setActiveTypeFilter(bookedRoomTypeCode || 'ALL');
        }
    }, [isOpen, currentRoomId, bookedRoomTypeCode]);

    // ==========================================
    // 2. VERİ NORMALİZASYONU VE TÜRETİLMİŞ DURUMLAR
    // ==========================================
    const isUnassignLocked = reservationStatus === 'IN_HOUSE';

    // Oda tiplerini ID ve Code bazlı hızlı erişim (O(1)) haritasına çevir (DRY)
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

    // Herhangi bir oda objesinden oda tipi kodunu güvenli şekilde çözen yardımcı
    const resolveRoomTypeCode = (room) => {
        if (room.room_type_code) return room.room_type_code;
        if (typeof room.room_type === 'object' && room.room_type?.code) return room.room_type.code;
        const typeId = room.room_type_id || room.room_type;
        return roomTypeMap[typeId]?.code || 'STD';
    };

    // Her oda tipinde kaç adet müsait oda olduğunu hesapla (Filtre rozetleri için)
    const typeCounts = useMemo(() => {
        const counts = { ALL: 0 };
        if (!Array.isArray(availableRooms)) return counts;

        availableRooms.forEach(room => {
            const code = resolveRoomTypeCode(room);
            counts.ALL += 1;
            counts[code] = (counts[code] || 0) + 1;
        });
        return counts;
    }, [availableRooms, roomTypeMap]);

    // Filtre barında gösterilecek oda tipi seçenekleri
    const filterOptions = useMemo(() => {
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
            // roomTypes henüz yüklenmediyse mevcut odalardan üret
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

    // Seçili oda tipi filtresine göre odaları süz ve katlara (floor) göre grupla
    const groupedRooms = useMemo(() => {
        if (!Array.isArray(availableRooms)) return {};

        const filtered = availableRooms.filter(room => {
            if (activeTypeFilter === 'ALL') return true;
            return resolveRoomTypeCode(room) === activeTypeFilter;
        });

        return filtered.reduce((acc, room) => {
            const floor = room.floor != null ? String(room.floor) : 'Diğer';
            if (!acc[floor]) acc[floor] = [];
            acc[floor].push(room);
            return acc;
        }, {});
    }, [availableRooms, activeTypeFilter, roomTypeMap]);

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

    const selectedRoomDetails = availableRooms?.find(r => r.id === selectedRoomId);
    const selectedRoomTypeCode = selectedRoomDetails ? resolveRoomTypeCode(selectedRoomDetails) : null;
    const isDifferentRoomType = selectedRoomDetails && bookedRoomTypeCode && selectedRoomTypeCode !== bookedRoomTypeCode;

    const handleConfirm = () => {
        // Seçilen oda ID'si ile birlikte oda numarasını da üst bileşene bildiriyoruz
        onAssign(selectedRoomId, selectedRoomDetails?.room_number || null);
        onClose();
    };

    const visibleRoomCount = Object.values(groupedRooms).reduce((sum, arr) => sum + arr.length, 0);

    // ==========================================
    // 5. EKRAN ÇİZİMİ (RENDER)
    // ==========================================
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden">
                
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

                {/* 5.2 ÜST KONTROL BAR: BLOKAJSIZ BEKLET & ODA TİPİ FİLTRELERİ */}
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 shrink-0 space-y-4">
                    
                    {/* Blokajsız (Havuz) Satırı */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${selectedRoomId === null ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-500' : 'bg-slate-200 text-slate-500'}`}>
                                <Filter size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-700">Blokajsız (Havuzda) Beklet</h3>
                                <p className="text-xs text-slate-500">
                                    Fiziksel oda atamadan kapasite bazlı havuzda bekletebilirsiniz.
                                </p>
                            </div>
                        </div>
                        
                        <button
                            type="button"
                            onClick={handleUnassign}
                            disabled={isUnassignLocked || selectedRoomId === null}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                                selectedRoomId === null 
                                    ? 'bg-amber-500 text-white shadow-sm' 
                                    : isUnassignLocked 
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer shadow-sm'
                            }`}
                            title={isUnassignLocked ? "İçeride konaklayan (In-House) misafirin oda blokajı kaldırılamaz." : ""}
                        >
                            <Ban size={14} />
                            {selectedRoomId === null ? 'Şu An Blokajsız' : 'Blokajı Kaldır (Havuz)'}
                        </button>
                    </div>

                    {/* Oda Tipi Filtreleme Sekmeleri */}
                    <div className="pt-3 border-t border-slate-200/80 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 flex items-center gap-1 mr-2">
                            <Layers size={14} className="text-blue-500" />
                            Oda Tipi Filtresi:
                        </span>

                        {filterOptions.map((opt) => {
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

                        {/* Tümü Seçeneği */}
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
                        <div className="flex flex-col items-center justify-center h-56 text-slate-500 bg-white rounded-xl border border-slate-200 p-6">
                            <DoorClosed size={44} className="mb-3 opacity-25" />
                            {activeTypeFilter !== 'ALL' && (typeCounts.ALL || 0) > 0 ? (
                                <>
                                    <p className="text-sm font-bold text-slate-700">
                                        Seçili oda tipinde ({activeTypeFilter}) müsait oda bulunamadı.
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1 mb-4">
                                        Otelde diğer oda tiplerine ait toplam <b>{typeCounts.ALL}</b> müsait oda mevcut.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTypeFilter('ALL')}
                                        className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition cursor-pointer"
                                    >
                                        Tüm Müsait Odaları Göster ({typeCounts.ALL})
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
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">
                                        {floor === 'Diğer' ? floor : `${floor}. Kat`}
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {groupedRooms[floor].map((room) => {
                                            const isSelected = selectedRoomId === room.id;
                                            const currentRoomTypeCode = resolveRoomTypeCode(room);
                                            const isMismatch = bookedRoomTypeCode && currentRoomTypeCode !== bookedRoomTypeCode;

                                            return (
                                                <button
                                                    key={room.id}
                                                    type="button"
                                                    onClick={() => handleRoomSelect(room.id)}
                                                    className={`relative flex flex-col p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${
                                                        isSelected 
                                                            ? 'border-blue-600 bg-blue-50/80 shadow-md ring-2 ring-blue-500/20' 
                                                            : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {isSelected && (
                                                        <span className="absolute top-2 right-2 text-blue-600">
                                                            <Check size={16} strokeWidth={3} />
                                                        </span>
                                                    )}
                                                    {isMismatch && (
                                                        <span 
                                                            className="absolute -top-2 -right-2 bg-amber-500 text-white rounded-full p-1 shadow-sm" 
                                                            title={`Farklı Oda Tipi: Satın alınan (${bookedRoomTypeCode}), bu oda (${currentRoomTypeCode})`}
                                                        >
                                                            <AlertTriangle size={12} />
                                                        </span>
                                                    )}
                                                    <span className={`text-lg font-black ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                                                        {room.room_number}
                                                    </span>
                                                    <span className={`text-xs font-bold mt-1 ${
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
                <div className="px-6 py-4 bg-white border-t border-slate-200 shrink-0 flex items-center justify-between">
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
                            disabled={isLoading || isError}
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