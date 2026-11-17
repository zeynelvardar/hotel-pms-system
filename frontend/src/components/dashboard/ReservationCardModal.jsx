/**
 * Yeni Rezervasyon Oluşturma Modal Bileşeni (NewReservationModal)
 * 
 * Sorumlulukları:
 * 1. Ana misafir ve refakatçi (ek misafir) profillerini toplama.
 * 2. TCKN (Mod10) ve Pasaport algoritmik doğrulamalarını anlık yönetme.
 * 3. Tarih aralığına göre backend'den dinamik boş oda listesini çekme.
 * 4. Otel iş kurallarını (işletme kuralları, min/max tarihler, max 4 pax kısıtı) denetleme.
 * 5. Django REST Framework nested serializer mimarisine uygun payload üretip kaydetme (FLOATING DESTEKLİ).
 * 6. Fiziksel Oda seçimini RoomAssignmentModal aracılığıyla DRY prensibine uygun yapar.
 */

// ============================================================================
// 1. İÇE AKTARIMLAR (IMPORTS)
// ============================================================================
import { getNextDay, maskDateInput, parseMaskedDateToISO } from '../../utils/formatters';
import { useState, useEffect, useMemo } from 'react';
import { useCreateReservation, useRoomTypes, useSystemDate } from '../../hooks/useHotelData';
import { validateTCKN, validatePassport } from '../../utils/validators';
import { X, CheckCircle2, XCircle, Loader2, PlusCircle, Trash2, Info, DoorOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import RoomAssignmentModal from './RoomAssignmentModal';

// ============================================================================
// 2. YARDIMCI VE FABRİKA (FACTORY) ŞABLONLARI
// ============================================================================
const emptyGuest = () => ({
    firstName: '',
    lastName: '',
    identityType: 'tc',     
    identityNumber: '',
    birthDate: '',          
    gender: 'U'             
});

// ============================================================================
// 3. ANA BİLEŞEN (COMPONENT)
// ============================================================================
const NewReservationModal = ({ isOpen, onClose, initialRoomId = null }) => {
    // ------------------------------------------------------------------------
    // 3.1. SUNUCU İLETİŞİMİ (SERVER HOOKS)
    // ------------------------------------------------------------------------
    const { data: systemDate } = useSystemDate();
    const { data: roomTypes, isLoading: isRoomTypesLoading } = useRoomTypes();
    const createMutation = useCreateReservation(onClose);

    // UX Koruması: Sistem tarihi henüz gelmediyse veya backend kapalıysa bugünü referans al
    const fallbackToday = new Date().toLocaleDateString('en-CA');
    const baseDate = systemDate || fallbackToday;
    const nextDay = getNextDay(baseDate);

    // ------------------------------------------------------------------------
    // 3.2. YEREL DURUMLAR (LOCAL STATES)
    // ------------------------------------------------------------------------
    const [formData, setFormData] = useState({
        checkIn: baseDate,
        checkOut: nextDay,
        bookedRoomTypeId: '', 
        roomId: initialRoomId ? String(initialRoomId) : '',           
        _displayRoomNumber: null, // Seçilen oda numarasını ekranda göstermek için
        agency: 'DIRECT',
        totalPrice: '',
        notes: ''
    });
    
    const [mainGuest, setMainGuest] = useState(emptyGuest());
    const [mainIdentityStatus, setMainIdentityStatus] = useState(null); 
    const [extraGuests, setExtraGuests] = useState([]);
    
    const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);

    // ------------------------------------------------------------------------
    // 3.3. TÜRETİLMİŞ DURUMLAR (DERIVED STATES)
    // ------------------------------------------------------------------------
    // Seçili Oda Tipinin Kodunu (örn: 'STD') bulur. RoomAssignmentModal'a prop olarak göndermek için.
    const selectedRoomTypeCode = useMemo(() => {
        if (!formData.bookedRoomTypeId || !roomTypes) return null;
        const matchedType = roomTypes.find(rt => String(rt.id) === String(formData.bookedRoomTypeId));
        return matchedType ? matchedType.code : null;
    }, [formData.bookedRoomTypeId, roomTypes]);

    // UI Koruması: ID varsa veya ekranda numarası gösteriliyorsa oda atanmıştır
    const getRoomLabel = () => {
        if (formData.roomId || formData._displayRoomNumber) {
            return formData._displayRoomNumber ? `${formData._displayRoomNumber} Numaralı Oda` : "Oda Seçildi";
        }
        return "Blokajsız Beklet (Havuz)";
    };

    // ------------------------------------------------------------------------
    // 3.4. YAŞAM DÖNGÜSÜ VE SENKRONİZASYON (EFFECTS)
    // ------------------------------------------------------------------------
    
    useEffect(() => {
        if (isOpen) {
            // Modal her açıldığında form verilerini temizle ve baseDate'i (Sistem Gününü) baz al
            setFormData({
                checkIn: baseDate,
                checkOut: nextDay,
                bookedRoomTypeId: '',
                roomId: initialRoomId ? String(initialRoomId) : '',
                _displayRoomNumber: null,
                agency: 'DIRECT',
                totalPrice: '',
                notes: '',
            });
            setMainGuest(emptyGuest());
            setMainIdentityStatus(null);
            setExtraGuests([]);
            setIsRoomModalOpen(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initialRoomId]);

    useEffect(() => {
        if (!mainGuest.identityNumber || mainGuest.identityNumber.length < 7) {
            setMainIdentityStatus(null);
            return;
        }
        if (mainGuest.identityType === 'tc') {
            setMainIdentityStatus(validateTCKN(mainGuest.identityNumber) ? 'valid' : 'invalid');
        } else {
            setMainIdentityStatus(validatePassport(mainGuest.identityNumber) ? 'valid' : 'invalid');
        }
    }, [mainGuest.identityNumber, mainGuest.identityType]);

    useEffect(() => {
        if (!formData.checkIn) return;
        const expectedCheckOut = getNextDay(formData.checkIn);
        
        if (!formData.checkOut || formData.checkOut <= formData.checkIn) {
            setFormData(prev => ({ ...prev, checkOut: expectedCheckOut }));
        }
    }, [formData.checkIn]);

    // Oda Tipi değiştiğinde, eğer önceden seçili fiziksel oda varsa onu sıfırla (Uyumsuzluk olmaması için)
    useEffect(() => {
        if (formData.roomId && formData.bookedRoomTypeId) {
            setFormData(prev => ({ ...prev, roomId: '', _displayRoomNumber: null }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.bookedRoomTypeId]);

    if (!isOpen) return null;

    // ------------------------------------------------------------------------
    // 3.5. OLAY İŞLEYİCİLERİ (HANDLERS)
    // ------------------------------------------------------------------------
    
    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleMainGuestChange = (e) => {
        const { name, value } = e.target;
        setMainGuest(prev => ({ ...prev, [name]: value }));
    };

    const handleMainBirthDateChange = (e) => {
        setMainGuest(prev => ({ ...prev, birthDate: maskDateInput(e.target.value) }));
    };

    const addExtraGuest = () => {
        if (extraGuests.length >= 3) {
            toast.error("Bir odaya en fazla 4 kişi (1 Ana + 3 Ek) kaydedilebilir.");
            return;
        }
        setExtraGuests(prev => [...prev, emptyGuest()]);
    };

    const removeExtraGuest = (index) => {
        setExtraGuests(prev => prev.filter((_, i) => i !== index));
    };

    const handleExtraGuestChange = (index, e) => {
        const { name, value } = e.target;
        setExtraGuests(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [name]: value };
            return updated;
        });
    };

    const handleExtraBirthDateChange = (index, e) => {
        setExtraGuests(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], birthDate: maskDateInput(e.target.value) };
            return updated;
        });
    };

    const handleRoomAssign = (newRoomId, newRoomNumber) => {
        setFormData(prev => ({ 
            ...prev, 
            roomId: newRoomId, 
            _displayRoomNumber: newRoomNumber 
        }));
    };

    // ------------------------------------------------------------------------
    // 3.6. FORM GÖNDERİMİ VE PAYLOAD OLUŞTURMA (SUBMIT)
    // ------------------------------------------------------------------------
    const handleSubmit = (e) => {
        e.preventDefault();
        
        // İş Kuralı 1: Geçersiz kimlik ile kayıt açılamaz
        if (mainIdentityStatus === "invalid") {
            toast.error('Lütfen ana misafir için geçerli bir kimlik giriniz.');
            return;
        }
        
        // İş Kuralı 2: Oda tipi (Room Type) seçilmeden rezervasyon yapılamaz
        if (!formData.bookedRoomTypeId) {
            toast.error('Lütfen misafirin satın aldığı oda tipini seçiniz.');
            return;
        }

        const mainGuestPayload = {
            first_name: mainGuest.firstName,
            last_name: mainGuest.lastName,
            tc_no: mainGuest.identityType === 'tc' ? mainGuest.identityNumber : null,
            passport_no: mainGuest.identityType === 'passport' ? mainGuest.identityNumber : null,
            birth_date: parseMaskedDateToISO(mainGuest.birthDate), 
            gender: mainGuest.gender
        };

        const extraGuestsPayload = extraGuests
            .map(eg => ({
                first_name: eg.firstName,
                last_name: eg.lastName,
                tc_no: eg.identityType === 'tc' ? eg.identityNumber : null,
                passport_no: eg.identityType === 'passport' ? eg.identityNumber : null,
                birth_date: parseMaskedDateToISO(eg.birthDate),
                gender: eg.gender
            }))
            .filter(eg => eg.first_name || eg.tc_no || eg.passport_no);

        // Django REST Framework Nested Serializer (FLOATING UYUMLU)
        const payload = {
            guest: mainGuestPayload,
            accompanying_guests: extraGuestsPayload,
            booked_room_type_id: formData.bookedRoomTypeId, // ZORUNLU
            room_id: formData.roomId || null,               // OPSİYONEL (FLOATING DESTEKLİ)
            agency: formData.agency,
            check_in_date: formData.checkIn,
            check_out_date: formData.checkOut,
            total_price: formData.totalPrice ? formData.totalPrice : '0.00',
            notes: formData.notes
        };

        createMutation.mutate(payload);
    };

    // ========================================================================
    // 4. ARAYÜZ ÇİZİMİ (JSX RENDER)
    // ========================================================================
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">

                {/* MODAL ÜST BAŞLIK */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl shrink-0">
                    <h2 className="text-lg font-bold text-slate-800">Yeni Rezervasyon Oluştur</h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-full transition cursor-pointer" title="Kapat">
                        <X size={20} />
                    </button>
                </div>

                {/* MODAL GÖVDE ALANI */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <form id="reservation-form" onSubmit={handleSubmit} className="space-y-8">

                        {/* BÖLÜM 1: 1. ANA MİSAFİR */}
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-4 flex items-center gap-2">
                                1. Ana Misafir (Kontrat Sahibi)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Ad</label>
                                    <input required type="text" name="firstName" value={mainGuest.firstName} onChange={handleMainGuestChange} className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Soyad</label>
                                    <input required type="text" name="lastName" value={mainGuest.lastName} onChange={handleMainGuestChange} className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Cinsiyet</label>
                                    <select name="gender" value={mainGuest.gender} onChange={handleMainGuestChange} className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                        <option value="U">Belirtilmemiş</option>
                                        <option value="M">Erkek</option>
                                        <option value="F">Kadın</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Kimlik Türü</label>
                                    <select name="identityType" value={mainGuest.identityType} onChange={handleMainGuestChange} className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                        <option value="tc">TC Kimlik No</option>
                                        <option value="passport">Passport No</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Kimlik Numarası</label>
                                    <div className="relative">
                                        <input required type="text" name="identityNumber" value={mainGuest.identityNumber} onChange={handleMainGuestChange} maxLength={mainGuest.identityType === 'tc' ? 11 : 15} className={`w-full border rounded-lg p-2 pr-8 text-sm focus:ring-2 outline-none ${mainIdentityStatus === 'invalid' ? 'border-rose-500 focus:ring-rose-500 bg-rose-50' : mainIdentityStatus === 'valid' ? 'border-emerald-500 focus:ring-emerald-500 bg-emerald-50' : 'border-slate-300 focus:ring-blue-500'}`} />
                                        <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                                            {mainIdentityStatus === 'valid' && <CheckCircle2 size={16} className="text-emerald-500"/>}
                                            {mainIdentityStatus === 'invalid' && <XCircle size={16} className="text-rose-500"/>}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Doğum Tarihi</label>
                                    <input required type="text" name="birthDate" value={mainGuest.birthDate} onChange={handleMainBirthDateChange} placeholder="GG.AA.YYYY" maxLength={10} className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>
                        </div>

                        {/* BÖLÜM 2: EK MİSAFİRLER */}
                        {extraGuests.length > 0 && (
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 border-b border-slate-100 pb-2">
                                    Ek Misafirler ({extraGuests.length})
                                </h3>
                                <div className="space-y-4">
                                    {extraGuests.map((eg, index) => (
                                        <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg relative">
                                            <button type="button" onClick={() => removeExtraGuest(index)} className="absolute -top-2 -right-2 bg-white text-rose-500 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-full shadow-sm border border-slate-200 cursor-pointer transition" title="Ek Misafiri Kaldır"><Trash2 size={14} /></button>
                                            <div className="col-span-2"><input type="text" name="firstName" value={eg.firstName} onChange={(e) => handleExtraGuestChange(index, e)} placeholder="Ad" className="w-full border border-slate-300 rounded p-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                                            <div className="col-span-2"><input type="text" name="lastName" value={eg.lastName} onChange={(e) => handleExtraGuestChange(index, e)} placeholder="Soyad" className="w-full border border-slate-300 rounded p-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                                            <div className="col-span-2 flex gap-2">
                                                <select name="gender" value={eg.gender} onChange={(e) => handleExtraGuestChange(index, e)} className="w-1/2 border border-slate-300 rounded p-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                                    <option value="U">Cinsiyet</option><option value="M">Erkek</option><option value="F">Kadın</option>
                                                </select>
                                                <input type="text" name="birthDate" value={eg.birthDate} onChange={(e) => handleExtraBirthDateChange(index, e)} placeholder="D.Tarihi (GG.AA.YYYY)" maxLength={10} className="w-1/2 border border-slate-300 rounded p-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
                                            </div>
                                            <div className="col-span-6 flex gap-2">
                                                <select name="identityType" value={eg.identityType} onChange={(e) => handleExtraGuestChange(index, e)} className="w-1/4 border border-slate-300 rounded p-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                                    <option value="tc">TC</option><option value="passport">Pasaport</option>
                                                </select>
                                                <input type="text" name="identityNumber" value={eg.identityNumber} onChange={(e) => handleExtraGuestChange(index, e)} placeholder="Kimlik/Pasaport No" maxLength={15} className="w-3/4 border border-slate-300 rounded p-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <button type="button" onClick={addExtraGuest} disabled={extraGuests.length >= 3} className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition disabled:opacity-50 cursor-pointer">
                                <PlusCircle size={14} /> Opsiyonel Ek Misafir Ekle
                            </button>
                        </div>
                        <hr className="border-slate-100"/>

                        {/* BÖLÜM 3: ODA TİPİ, FİZİKSEL ODA VE KONAKLAMA BİLGİLERİ */}
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-4">
                                Konaklama Bilgileri
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Acenta / Kanal</label>
                                    <select name="agency" value={formData.agency} onChange={handleFormChange} className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-semibold text-slate-700">
                                        <option value="DIRECT">Münferit (Walk-in)</option>
                                        <option value="BOOKING">Booking.com</option>
                                        <option value="EXPEDIA">Expedia</option>
                                        <option value="ETS">ETS Tur</option>
                                        <option value="JOLLY">Jolly Tur</option>
                                        <option value="TATILBUDUR">TatilBudur</option>
                                        <option value="ODAMAX">Odamax</option>
                                        <option value="CORAL">Coral Travel</option>
                                        <option value="ANEX">Anex Tour</option>
                                        <option value="CORPORATE">Kurumsal Şirket</option>
                                    </select>
                                </div>

                                <div className="md:col-span-1">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Check-in</label>
                                    {/* MİNİMUM TARİH: SİSTEM GÜNÜ (Geçmişe dönük rezervasyon yapılamaz) */}
                                    <input required type="date" name="checkIn" value={formData.checkIn} onChange={handleFormChange} min={baseDate} className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Check-out</label>
                                    <input required type="date" name="checkOut" value={formData.checkOut} onChange={handleFormChange} min={formData.checkIn ? getNextDay(formData.checkIn) : baseDate} className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>

                                <div className="md:col-span-1">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Tutar (TRY)</label>
                                    <input type="number" step="0.01" name="totalPrice" value={formData.totalPrice} onChange={handleFormChange} placeholder="0.00" className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
                                </div>

                                {/* ODA TİPİ SEÇİMİ (ZORUNLU) */}
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center justify-between">
                                        <span>Satın Alınan Oda Tipi</span>
                                        {isRoomTypesLoading && <Loader2 size={12} className="animate-spin text-blue-500" />}
                                    </label>
                                    <select 
                                        required 
                                        name="bookedRoomTypeId" 
                                        value={formData.bookedRoomTypeId} 
                                        onChange={handleFormChange} 
                                        disabled={isRoomTypesLoading || !roomTypes?.length} 
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-100 disabled:text-slate-400"
                                    >
                                        <option value="">Oda Tipi Seçiniz...</option>
                                        {roomTypes?.map(rt => (
                                            <option key={rt.id} value={rt.id}>
                                                {rt.name} ({rt.code})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* FİZİKSEL ODA SEÇİMİ (YENİ UX: BUTON İLE MODAL TETİKLEME) */}
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                                        Fiziksel Oda (Opsiyonel / Blokaj)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setIsRoomModalOpen(true)}
                                        disabled={!formData.bookedRoomTypeId}
                                        className={`w-full flex items-center justify-between p-2 text-sm border rounded-lg transition-colors outline-none
                                            ${!formData.bookedRoomTypeId 
                                                ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed' 
                                                : formData.roomId 
                                                    ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold hover:bg-blue-100 cursor-pointer shadow-sm'
                                                    : 'bg-white border-slate-300 text-slate-700 hover:border-blue-400 hover:bg-slate-50 cursor-pointer'
                                            }`}
                                        title={!formData.bookedRoomTypeId ? "Oda seçimi için önce Oda Tipini belirlemelisiniz" : "Oda Seçim Ekranını Aç"}
                                    >
                                        <span className="flex items-center gap-2">
                                            <DoorOpen size={16} className={formData.roomId ? 'text-blue-600' : 'text-slate-400'} />
                                            {getRoomLabel()}
                                        </span>
                                        <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                                            Seç / Değiştir
                                        </span>
                                    </button>
                                </div>
                                
                                {/* Bilgi Kutusu */}
                                <div className="md:col-span-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                                    <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                                        Fiziksel oda seçmek zorunlu değildir. İstenilen "Oda Tipi"ni belirleyerek rezervasyonu 
                                        <strong> blokajsız (havuzda)</strong> açabilirsiniz. Fiziksel odayı daha sonra atayabilirsiniz.
                                    </p>
                                </div>

                                <div className="md:col-span-4">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Notlar</label>
                                    <input type="text" name="notes" value={formData.notes} onChange={handleFormChange} placeholder="Özel istekler, geç giriş, balayı paketi vb." className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* MODAL ALT PANEL (FOOTER) */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 rounded-b-2xl shrink-0">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition cursor-pointer">
                        İptal
                    </button>
                    <button
                        form="reservation-form"
                        type="submit"
                        disabled={createMutation.isPending || mainIdentityStatus === 'invalid' || !formData.bookedRoomTypeId}
                        className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg shadow-sm transition cursor-pointer"
                    >
                        {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        Kaydet
                    </button>
                </div>

                {/* ORTAK ROOM ASSIGNMENT MODAL ENTEGRASYONU */}
                {isRoomModalOpen && (
                    <RoomAssignmentModal
                        isOpen={isRoomModalOpen}
                        onClose={() => setIsRoomModalOpen(false)}
                        onAssign={handleRoomAssign}
                        checkIn={formData.checkIn}
                        checkOut={formData.checkOut}
                        currentRoomId={formData.roomId}
                        reservationStatus="RESERVED"
                        bookedRoomTypeCode={selectedRoomTypeCode}
                    />
                )}

            </div>
        </div>
    );
};

export default NewReservationModal;