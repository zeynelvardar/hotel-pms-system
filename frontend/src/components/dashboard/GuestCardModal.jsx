/**
 * ReservationCardModal (Stay Card)
 * Bir rezervasyonun kontrat (giriş, çıkış, acenta, fiyat) detaylarını yönetir.
 * Odadaki misafirleri (1. Ana Misafir ve Ek Misafirler) listeler.
 * Misafirlere çift tıklanarak alt modal olan GuestCardModal'ın açılmasını tetikler.
 */

import { useState, useEffect } from 'react';
import { getNextDay } from '../../utils/formatters';
import { useUpdateReservation, useReservationAction, useAgencyChoices } from '../../hooks/useHotelData';
import { X, Save, Users, Calendar, Building, CreditCard, FileText, Ban, Loader2 } from 'lucide-react';

// Alt Modal (Misafir Detayları) - Yorum satırından çıkarıldı (Eğer import yolun farklıysa düzenleyebilirsin)
import GuestCardModal from './GuestCardModal'; 

// =============================================================================
// YARDIMCI FONKSİYONLAR (HELPERS)
// =============================================================================

// Gelen backend rezervasyon nesnesini form verisine çevirir
const mapReservationToFormData = (res) => ({
    id: res.id,
    checkIn: res.check_in_date,
    checkOut: res.check_out_date,
    agency: res.agency || 'DIRECT',
    totalPrice: res.total_price || '0.00',
    notes: res.notes || '',
    status: res.status
});

// =============================================================================
// ANA BİLEŞEN: ReservationCardModal
// =============================================================================
const ReservationCardModal = ({ isOpen, onClose, reservationData }) => {
    
    // =========================================================================
    // 1. YEREL DURUM (STATE)
    // =========================================================================
    const [formData, setFormData] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    
    // Alt Modal (Misafir KBS Kartı) Yönetimi İçin Stateler
    const [selectedGuest, setSelectedGuest] = useState(null);
    const [isGuestCardOpen, setIsGuestCardOpen] = useState(false);

    // =========================================================================
    // 2. SUNUCU AKSİYONLARI (HOOKS & MUTATIONS)
    // =========================================================================
    // Dinamik acenta listesini backend'den (örneğin Django Choices) çeker
    const { data: agencyChoices, isLoading: isAgenciesLoading } = useAgencyChoices();

    // Rezervasyon verilerini (tarih, fiyat vb.) güncelleyen mutasyon
    const updateMutation = useUpdateReservation(() => {
        setIsEditing(false); // Başarılı olunca otomatik olarak okuma moduna dön
    });
    
    // Rezervasyonu tamamen iptal eden ve durumu değiştiren özel kanca
    const { cancelRes, isCancelling } = useReservationAction();

    // =========================================================================
    // 3. YAŞAM DÖNGÜSÜ (EFFECTS)
    // =========================================================================
    // Modal açıldığında veya rezervasyon verisi (prop) değiştiğinde formu doldurur
    useEffect(() => {
        if (isOpen && reservationData) {
            setFormData(mapReservationToFormData(reservationData));
            setIsEditing(false);
        }
    }, [isOpen, reservationData]);

    if (!isOpen || !reservationData || !formData) return null;

    // =========================================================================
    // 4. İŞ MANTIĞI & KİLİTLER (BUSINESS LOGIC)
    // =========================================================================
    
    // Geçmiş veya iptal edilmiş kayıtlar tamamen kilitlenir (Salt Okunur)
    const isReadOnly = ['CHECKED_OUT', 'CANCELLED', 'NO_SHOW'].includes(formData.status);
    
    // İçeride konaklayan misafirin giriş tarihi (check-in) geriye dönük değiştirilemez
    const isCheckInLocked = formData.status === 'IN_HOUSE'; 

    // UI'da göstermek için Ana Misafir ile Ek Misafirleri (Accompanying) tek listede birleştirir
    const allGuests = [
        { ...reservationData.guest, is_main: true },
        ...(reservationData.accompanying_guests || []).map(g => ({ ...g, is_main: false }))
    ];

    // =========================================================================
    // 5. OLAY YÖNETİCİLERİ (HANDLERS)
    // =========================================================================

    // Formdaki standart metin/seçim girişlerini yakalar
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Düzenlemeyi iptal edip formu orijinal rezervasyon verisine döndürür (UI Sıfırlama)
    const handleCancelEdit = () => {
        setFormData(mapReservationToFormData(reservationData));
        setIsEditing(false);
    };

    // Formu Backend'e kaydeder
    const handleSave = (e) => {
        e.preventDefault();
        
        // Sadece değiştirilebilir kontrat verilerini paketle
        const payload = {
            check_in_date: formData.checkIn,
            check_out_date: formData.checkOut,
            agency: formData.agency,
            total_price: formData.totalPrice || '0.00',
            notes: formData.notes
        };

        updateMutation.mutate({ id: formData.id, data: payload });
    };

    // Rezervasyonu (İşletme mantığı gereği) tamamen İPTAL eder
    const handleCancelReservation = () => {
        const confirmCancel = window.confirm("Bu rezervasyonu İPTAL (CANCELLED) durumuna almak istediğinize emin misiniz? Bu işlem geri alınamaz.");
        if (confirmCancel) {
            cancelRes(formData.id);
            onClose(); // İptal sonrası ana modalı kapat
        }
    };

    // Misafir listesinde çift tıklanınca alt modalı (GuestCardModal) tetikler
    const handleGuestDoubleClick = (guest) => {
        setSelectedGuest(guest);
        setIsGuestCardOpen(true);
    };

    // =========================================================================
    // 6. RENDER (UI)
    // =========================================================================
    return (
        /* 6.1 Modal Karartma Arka Planı (Backdrop) - z-40, GuestCard z-50'dir */
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden relative">
                
                {/* -------------------------------------------------------------
                    BÖLÜM 1: KART BAŞLIĞI (HEADER)
                ------------------------------------------------------------- */}
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
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-slate-700 rounded-full transition cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* -------------------------------------------------------------
                    BÖLÜM 2: GÖVDE (İKİ KOLONLU DÜZEN)
                ------------------------------------------------------------- */}
                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                    
                    {/* --- SOL PANEL: KONAKLAMA & KONTRAT FORMU --- */}
                    <div className="w-full md:w-1/2 p-6 overflow-y-auto border-r border-slate-100 bg-slate-50/50">
                        
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Konaklama Detayı</h3>
                            {/* Dosya salt okunur değilse ve izleme modundaysa düzenleme butonunu göster */}
                            {!isReadOnly && !isEditing && (
                                <button 
                                    type="button" 
                                    onClick={() => setIsEditing(true)} 
                                    className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition"
                                >
                                    Düzenle
                                </button>
                            )}
                        </div>

                        {/* Kontrat Formu */}
                        <form id="res-card-form" onSubmit={handleSave} className="space-y-4">
                            
                            {/* Acenta Seçimi */}
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

                            {/* Giriş & Çıkış Tarihleri */}
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
                                    {isCheckInLocked && (
                                        <span className="text-[9px] font-bold text-rose-500 mt-1 block">Konaklayan misafir (kilitli)</span>
                                    )}
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

                            {/* Toplam Fiyat */}
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

                            {/* Operasyonel Notlar */}
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

                            {/* --- FORM AKSİYON BUTONLARI --- */}
                            <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-200">
                                
                                {/* Rezervasyonu İptal Et (İşletme Mantığı) - Sadece RESERVED durumundayken görünür */}
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
                                
                                {/* Düzenleme Modu Aktifken Çıkan Kaydet/Vazgeç Butonları */}
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

                    {/* --- SAĞ PANEL: MİSAFİR LİSTESİ (ROSTER) --- */}
                    <div className="w-full md:w-1/2 p-6 bg-white overflow-y-auto custom-scrollbar flex flex-col">
                        
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <Users size={16} className="text-blue-500"/> Odadaki Misafirler
                            </h3>
                        </div>

                        {/* Misafir Kartları */}
                        <div className="space-y-3 flex-1">
                            {allGuests.map((g, index) => (
                                <div 
                                    key={g.id || index}
                                    onDoubleClick={() => handleGuestDoubleClick(g)}
                                    className="group flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-md hover:bg-blue-50/30 transition-all cursor-pointer bg-white relative overflow-hidden"
                                >
                                    {/* Ana Misafir Mavi Etiketi (Sol Çizgi) */}
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
                                    
                                    <div className="text-[10px] font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
                                        Düzenle
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                             <p className="text-[11px] font-medium text-slate-400">
                                Kimlik bilgilerini görmek veya düzenlemek için karta çift tıklayın.
                             </p>
                        </div>
                    </div>

                </div>
            </div>
            
            {/* -------------------------------------------------------------
                BÖLÜM 3: ALT MODAL (GUEST CARD MODAL - Z-50)
            ------------------------------------------------------------- */}
            {isGuestCardOpen && selectedGuest && (
                <GuestCardModal
                    isOpen={isGuestCardOpen}
                    onClose={() => setIsGuestCardOpen(false)}
                    guestData={selectedGuest}
                    reservationId={formData.id}
                    isReadOnly={isReadOnly}
                />
            )}
        </div>
    );
};

export default ReservationCardModal;