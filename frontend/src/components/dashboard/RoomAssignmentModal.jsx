/**
 * RoomAssignmentModal (Oda Blokaj / Seçim Ekranı)
 * - Belirtilen tarihlere göre (checkIn/checkOut) SADECE müsait odaları listeler.
 * - Odaları Kat (Floor) bilgisine göre gruplayarak ızgara (grid) yapısında sunar.
 * - IN_HOUSE (Konaklayan) rezervasyonlarda Blokaj Kaldırma (Unassign) işlemini engeller.
 * - İşlem sonucunu (Seçilen Oda ID veya null) üst bileşene (ReservationCardModal) aktarır.
 */

import { useState, useMemo, useEffect } from 'react';
import { useAvailableRooms } from '../../hooks/useHotelData';
import { X, DoorOpen, DoorClosed, AlertTriangle, Loader2, Ban, Filter } from 'lucide-react';

// ISO tarih formatını (YYYY-AA-GG) okunabilir formata (GG.AA.YYYY) çevirir
const formatDisplayDate = (dateString) => {
    if (!dateString) return '';
    return dateString.split('-').reverse().join('.');
};

const RoomAssignmentModal = ({
    isOpen,
    onClose,
    onAssign,
    checkIn,
    checkOut,
    currentRoomId,
    reservationStatus,
    bookedRoomTypeCode // Misafirin satın aldığı oda tipi (farklı tip odaya geçerken uyarı gösterilir)
}) => {
    // ==========================================
    // 1. YEREL DURUM VE VERİ ÇEKİMİ
    // ==========================================
    const [selectedRoomId, setSelectedRoomId] = useState(currentRoomId || null);

    // Modal her açıldığında veya farklı bir rezervasyona geçildiğinde state'i senkronize et
    useEffect(() => {
        if (isOpen) {
            setSelectedRoomId(currentRoomId || null);
        }
    }, [isOpen, currentRoomId]);

    // TanStack Query ile sadece boş odaları getir
    const { data: availableRooms, isLoading, isError } = useAvailableRooms(checkIn, checkOut);

    // ==========================================
    // 2. İŞ MANTIĞI & TÜRETİLMİŞ DURUMLAR
    // ==========================================
    // Konaklayan misafirin odası boşaltılamaz (Unassign Koruması)
    const isUnassignLocked = reservationStatus === 'IN_HOUSE';

    // Odaları katlara (floor) göre grupla
    const groupedRooms = useMemo(() => {
        if (!availableRooms) return {};

        return availableRooms.reduce((acc, room) => {
            const floor = room.floor ?? 'Bilinmeyen Kat';
            if (!acc[floor]) acc[floor] = [];
            acc[floor].push(room);
            return acc;
        }, {});
    }, [availableRooms]);

    // Kat anahtarlarını sayısal olarak sırala (Sayısal olmayanları en sona at)
    const sortedFloors = useMemo(() => {
        return Object.keys(groupedRooms).sort((a, b) => {
            const floorA = parseInt(a, 10);
            const floorB = parseInt(b, 10);

            if (Number.isNaN(floorA)) return 1;
            if (Number.isNaN(floorB)) return -1;
            return floorA - floorB;
        });
    }, [groupedRooms]);

    const selectedRoomDetails = useMemo(() => {
        return availableRooms?.find((room) => room.id === selectedRoomId);
    }, [availableRooms, selectedRoomId]);

    // Misafirin satın aldığı oda tipinden farklı bir oda seçildiyse uyar
    const isDifferentRoomType = Boolean(
        selectedRoomDetails &&
        bookedRoomTypeCode &&
        selectedRoomDetails.room_type_code !== bookedRoomTypeCode
    );

    // ==========================================
    // 3. ERKEN DÖNÜŞLER (EARLY RETURNS)
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

    const handleConfirm = () => {
        onAssign(selectedRoomId);
        onClose();
    };

    // ==========================================
    // 5. EKRAN ÇİZİMİ (RENDER)
    // ==========================================
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden">

                {/* 5.1 HEADER */}
                <div className="flex items-center justify-between px-6 py-4 bg-slate-800 text-slate-100 border-b border-slate-700 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <DoorOpen size={20} className="text-blue-400" />
                            Oda Seçimi (Blokaj)
                        </h2>
                        <p className="text-xs text-slate-300 mt-1 opacity-90">
                            Filtre: {formatDisplayDate(checkIn)} - {formatDisplayDate(checkOut)} Tarihleri Arası Müsait Odalar
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700 rounded-full transition cursor-pointer"
                        aria-label="Kapat"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 5.2 UNASSIGN (BLOKAJ KALDIRMA) ALANI */}
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 shrink-0 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div
                            className={`p-2 rounded-lg ${
                                selectedRoomId === null
                                    ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-500'
                                    : 'bg-slate-200 text-slate-500'
                            }`}
                        >
                            <Filter size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-700">Blokajsız (Havuzda) Beklet</h3>
                            <p className="text-xs text-slate-500 max-w-md mt-0.5">
                                Rezervasyonu fiziksel bir odaya atmadan kapasite bazlı bekletebilirsiniz.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleUnassign}
                        disabled={isUnassignLocked || selectedRoomId === null}
                        title={
                            isUnassignLocked
                                ? 'İçeride konaklayan (In-House) misafirin oda blokajı kaldırılamaz.'
                                : ''
                        }
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                            selectedRoomId === null
                                ? 'bg-amber-500 text-white shadow-md'
                                : isUnassignLocked
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer shadow-sm'
                        }`}
                    >
                        <Ban size={16} />
                        {selectedRoomId === null ? 'Şu An Blokajsız' : 'Blokajı Kaldır (Havuz)'}
                    </button>
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
                    ) : availableRooms?.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                            <DoorClosed size={48} className="mb-3 opacity-20" />
                            <p className="text-sm font-semibold">Bu tarihlerde otelde müsait oda bulunamadı.</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {sortedFloors.map((floor) => (
                                <div key={floor} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
                                        {Number.isNaN(parseInt(floor, 10)) ? floor : `${floor}. Kat`}
                                    </h3>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {groupedRooms[floor].map((room) => {
                                            const isSelected = selectedRoomId === room.id;
                                            const isMismatch = Boolean(
                                                bookedRoomTypeCode && room.room_type_code !== bookedRoomTypeCode
                                            );

                                            return (
                                                <button
                                                    key={room.id}
                                                    type="button"
                                                    onClick={() => handleRoomSelect(room.id)}
                                                    className={`relative flex flex-col p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${
                                                        isSelected
                                                            ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-500/20'
                                                            : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {isMismatch && (
                                                        <span
                                                            className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-sm"
                                                            title={`Satın alınan tip (${bookedRoomTypeCode}) ile uyuşmuyor`}
                                                        >
                                                            <AlertTriangle size={12} />
                                                        </span>
                                                    )}

                                                    <span
                                                        className={`text-lg font-black ${
                                                            isSelected ? 'text-blue-700' : 'text-slate-700'
                                                        }`}
                                                    >
                                                        {room.room_number}
                                                    </span>

                                                    <span
                                                        className={`text-xs font-semibold mt-1 ${
                                                            isMismatch && isSelected
                                                                ? 'text-rose-600'
                                                                : isSelected
                                                                    ? 'text-blue-500'
                                                                    : 'text-slate-400'
                                                        }`}
                                                    >
                                                        {room.room_type_code}
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
                <div className="px-6 py-4 bg-white border-t border-slate-200 shrink-0 flex items-center justify-between gap-4">
                    <div className="flex-1">
                        {isDifferentRoomType ? (
                            <p className="text-xs font-semibold text-rose-600 flex items-center gap-1.5">
                                <AlertTriangle size={14} className="shrink-0" />
                                Dikkat: Seçilen oda, misafirin satın aldığı {bookedRoomTypeCode} tipi ile uyuşmuyor! (Upgrade/Downgrade)
                            </p>
                        ) : isUnassignLocked && selectedRoomId === currentRoomId ? (
                            <p className="text-xs font-semibold text-amber-600 flex items-center gap-1.5">
                                <AlertTriangle size={14} className="shrink-0" />
                                Misafir içeride konaklıyor. Yalnızca başka bir boş oda seçerek taşıma (Room Change) yapabilirsiniz.
                            </p>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
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