/**
 * ReservationCardModal (Stay Card)
 * Rezervasyonun kontrat (tarih, acenta, fiyat, not) detaylarını yönetir.
 * Odadaki misafirleri listeler ve çift tıklamayla GuestCardModal'ı tetikler.
 * 
 * Mimari Güvenceler:
 * 1. Rules of Hooks: Tüm hook ve useMemo çağrıları erken return'den önce çalışır.
 * 2. Derived State: allGuests ve selectedGuest ID üzerinden doğrudan türetilir.
 * 3. Form Shield: isEditing aktifken arka plan sorguları formu sıfırlamaz.
 */

import { useState, useEffect, useMemo } from 'react';
import { getNextDay } from '../../utils/formatters';
import { useUpdateReservation, useReservationAction, useAgencyChoices } from '../../hooks/useHotelData';
import { X, Save, Users, Calendar, Building, CreditCard, FileText, Ban, Loader2 } from 'lucide-react';
import GuestCardModal from './GuestCardModal';

const ReservationCardModal = ({ isOpen, onClose, reservationData }) => {
    // ==========================================
    // 1. YEREL DURUM (LOCAL STATE)
    // ==========================================
    const [formData, setFormData] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    
    // Alt Modal (Misafir Kartı) ID Takibi
    const [selectedGuestId, setSelectedGuestId] = useState(null);
    const [isGuestCardOpen, setIsGuestCardOpen] = useState(false);

    // ==========================================
    // 2. SUNUCU SORGULARI VE MUTASYONLAR
    // ==========================================
    const { data: agencyChoices, isLoading: isAgenciesLoading } = useAgencyChoices();

    const updateMutation = useUpdateReservation(() => {
        setIsEditing(false);
    });
    
    const { cancelRes, isCancelling } = useReservationAction();

    // ==========================================
    // 3. TÜRETİLMİŞ DURUMLAR (HOOK SIRASI KORUMASI)
    // ==========================================
    // Erken return'den (early return) önce çalışmak zorundadır
    const allGuests = useMemo(() => {
        if (!reservationData) return [];
        return [
            ...(reservationData.guest ? [{ ...reservationData.guest, is_main: true }] : []),
            ...(reservationData.accompanying_guests || []).map(g => ({ ...g, is_main: false }))
        ];
    }, [reservationData]);

    const selectedGuest = useMemo(() => {
        if (!selectedGuestId) return null;
        return allGuests.find((g) => g.id === selectedGuestId) || null;
    }, [selectedGuestId, allGuests]);

    // ==========================================
    // 4. YAŞAM DÖNGÜSÜ (EFFECTS)
    // ==========================================
    useEffect(() => {
        if (isOpen && reservationData) {
            // Arka plandaki invalidateQueries tetiklendiğinde kullanıcının yazdıklarını ezme
            if (!isEditing) {
                setFormData({
                    id: reservationData.id,
                    checkIn: reservationData.check_in_date,
                    checkOut: reservationData.check_out_date,
                    agency: reservationData.agency || 'DIRECT',
                    totalPrice: reservationData.total_price || '',
                    notes: reservationData.notes || '',
                    status: reservationData.status
                });
            }
        } else if (!isOpen) {
            setIsEditing(false);
            setSelectedGuestId(null);
            setIsGuestCardOpen(false);
        }
    }, [isOpen, reservationData, isEditing]);

    // ==========================================
    // 5. ERKEN DÖNÜŞ (EARLY RETURN)
    // ==========================================
    if (!isOpen || !reservationData || !formData) return null;

    // ==========================================
    // 6. İŞ MANTIĞI & KİLİTLER
    // ==========================================
    const isReadOnly = ['CHECKED_OUT', 'CANCELLED', 'NO_SHOW'].includes(formData.status);
    const isCheckInLocked = formData.status === 'IN_HOUSE';

    // ==========================================
    // 7. AKSİYON İŞLEYİCİLER (HANDLERS)
    // ==========================================
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCancelEdit = () => {
        setFormData({
            id: reservationData.id,
            checkIn: reservationData.check_in_date,
            checkOut: reservationData.check_out_date,
            agency: reservationData.agency || 'DIRECT',
            totalPrice: reservationData.total_price || '',
            notes: reservationData.notes || '',
            status: reservationData.status
        });
        setIsEditing(false);
    };

    const handleSave = (e) => {
        e.preventDefault();
        const payload = {
            check_in_date: formData.checkIn,
            check_out_date: formData.checkOut,
            agency: formData.agency,
            total_price: formData.totalPrice || '0.00',
            notes: formData.notes
        };
        updateMutation.mutate({ id: formData.id, data: payload });
    };

    const handleCancelReservation = () => {
        const isConfirmed = window.confirm("Bu rezervasyonu IPTAL durumuna almak istediğinize emin misiniz? Bu işlem geri alınamaz.");
        if (isConfirmed) {
            cancelRes(formData.id);
            onClose();
        }
    };

    const handleGuestDoubleClick = (guest) => {
        setSelectedGuestId(guest.id);
        setIsGuestCardOpen(true);
    };

    // ==========================================
    // 8. EKRAN ÇİZİMİ (RENDER)
    // ==========================================
    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden relative">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-slate-800 text-white">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <span>Rezervasyon Kartı</span>
                            <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full border border-slate-600">
                                Ref: #{formData.id}
                            </span>
                        </h2>
                        <p className="text-xs text-slate-300 mt-1 opacity-80">
                            {reservationData.room_number} Numaralı Oda | Statü: {reservationData.status_display}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                    
                    {/* SOL PANEL: Konaklama & Kontrat Formu */}
                    <div className="w-full md:w-1/2 p-6 overflow-y-auto border-r border-slate-100 bg-slate-50/50">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Konaklama Detayı</h3>
                            {!isReadOnly && !isEditing && (
                                <button 
                                    type="button" 
                                    onClick={() => setIsEditing(true)} 
                                    className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer px-2 py-1 rounded hover:bg-blue-50 transition"
                                >
                                    Düzenle
                                </button>
                            )}
                        </div>

                        <form id="res-card-form" onSubmit={handleSave} className="space-y-4">
                            {/* Acenta */}
                            <div>
                                <label className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1">
                                    <span className="flex items-center gap-1.5"><Building size={14} /> Acenta / Kanal</span>
                                    {isAgenciesLoading && <Loader2 size={12} className="animate-spin text-blue-500" />}
                                </label>
                                <select 
                                    name="agency" 
                                    value={formData.agency} 
                                    onChange={handleChange} 
                                    disabled={!isEditing || isReadOnly || isAgenciesLoading} 
                                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-100 disabled:text-slate-500"
                                >
                                    {agencyChoices?.map((choice) => (
                                        <option key={choice.value} value={choice.value}>
                                            {choice.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Tarihler */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1">
                                        <Calendar size={14} /> Check-in
                                    </label>
                                    <input 
                                        type="date" 
                                        name="checkIn" 
                                        value={formData.checkIn} 
                                        onChange={handleChange} 
                                        disabled={!isEditing || isReadOnly || isCheckInLocked} 
                                        className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-100 disabled:text-slate-500"
                                    />
                                    {isCheckInLocked && <span className="text-[9px] font-bold text-rose-500 mt-1 block">Konaklayan misafir (kilitli)</span>}
                                </div>
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1">
                                        <Calendar size={14} /> Check-out
                                    </label>
                                    <input 
                                        type="date" 
                                        name="checkOut" 
                                        value={formData.checkOut} 
                                        onChange={handleChange} 
                                        min={formData.checkIn ? getNextDay(formData.checkIn) : ''}
                                        disabled={!isEditing || isReadOnly} 
                                        className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-100 disabled:text-slate-500"
                                    />
                                </div>
                            </div>

                            {/* Fiyat & Notlar */}
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1">
                                    <CreditCard size={14} /> Toplam Tutar (TRY)
                                </label>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    name="totalPrice" 
                                    value={formData.totalPrice} 
                                    onChange={handleChange} 
                                    disabled={!isEditing || isReadOnly} 
                                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-100 disabled:text-slate-500"
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1">
                                    <FileText size={14} /> Operasyonel Notlar
                                </label>
                                <textarea 
                                    name="notes" 
                                    value={formData.notes} 
                                    onChange={handleChange} 
                                    disabled={!isEditing || isReadOnly} 
                                    rows="3"
                                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-100 disabled:text-slate-500 resize-none custom-scrollbar"
                                />
                            </div>

                            {/* Aksiyon Butonları */}
                            <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-200">
                                {formData.status === 'RESERVED' && !isEditing && (
                                    <button 
                                        type="button" 
                                        onClick={handleCancelReservation} 
                                        disabled={isCancelling} 
                                        className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-lg transition cursor-pointer disabled:opacity-50"
                                    >
                                        {isCancelling ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />} 
                                        Rezervasyonu İptal Et
                                    </button>
                                )}
                                
                                {isEditing && (
                                    <div className="flex gap-2 w-full justify-end">
                                        <button 
                                            type="button" 
                                            onClick={handleCancelEdit} 
                                            className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                                        >
                                            Vazgeç
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={updateMutation.isPending} 
                                            className="flex items-center gap-1.5 px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg transition cursor-pointer shadow-sm"
                                        >
                                            {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 
                                            Kaydet
                                        </button>
                                    </div>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* SAĞ PANEL: Misafir Listesi (Roster) */}
                    <div className="w-full md:w-1/2 p-6 bg-white overflow-y-auto custom-scrollbar flex flex-col">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <Users size={16} className="text-blue-500"/> Odadaki Misafirler
                            </h3>
                        </div>

                        <div className="space-y-3 flex-1">
                            {allGuests.map((g, index) => (
                                <div 
                                    key={g.id || index}
                                    onDoubleClick={() => handleGuestDoubleClick(g)}
                                    className="group flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-md hover:bg-blue-50/30 transition-all cursor-pointer bg-white relative overflow-hidden"
                                >
                                    {g.is_main && (
                                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                    )}
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${g.is_main ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {g.first_name ? g.first_name.charAt(0) : '?'}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">
                                                {g.first_name} {g.last_name}
                                            </p>
                                            <div className="flex gap-2 text-[11px] font-semibold text-slate-400 mt-0.5">
                                                <span>{g.tc_no || g.passport_no || 'Kimlik Belirtilmemiş'}</span>
                                                <span>•</span>
                                                <span className={g.is_main ? 'text-blue-600' : ''}>
                                                    {g.is_main ? '1. Misafir (Ana)' : `${index + 1}. Misafir`}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleGuestDoubleClick(g)}
                                        className="text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded transition-colors cursor-pointer"
                                    >
                                        Düzenle
                                    </button>
                                </div>
                            ))}
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                             <p className="text-[11px] font-medium text-slate-400">
                                Kimlik bilgilerini görmek veya düzenlemek için karta çift tıklayın veya Düzenle butonuna basın.
                             </p>
                        </div>
                    </div>

                </div>
            </div>
            
            {/* Alt Modal: GuestCardModal */}
            {isGuestCardOpen && selectedGuest && (
                <GuestCardModal
                    isOpen={isGuestCardOpen}
                    onClose={() => {
                        setIsGuestCardOpen(false);
                        setSelectedGuestId(null);
                    }}
                    guestData={selectedGuest}
                    isReadOnly={isReadOnly}
                />
            )} 
        </div>
    );
};

export default ReservationCardModal;