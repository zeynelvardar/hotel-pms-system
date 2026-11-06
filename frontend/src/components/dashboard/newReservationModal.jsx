/**
 * Yeni Rezervasyon Oluşturma Modal Bileşeni (NewReservationModal)
 * 
 * Sorumlulukları:
 * 1. Ana misafir ve refakatçi (ek misafir) profillerini toplama.
 * 2. TCKN (Mod10) ve Pasaport algoritmik doğrulamalarını anlık yönetme.
 * 3. Tarih aralığına göre backend'den dinamik boş oda listesini çekme.
 * 4. Otel iş kurallarını (işletme kuralları, min/max tarihler, max 4 pax kısıtı) denetleme.
 * 5. Django REST Framework nested serializer mimarisine uygun payload üretip kaydetme.
 */

// ============================================================================
// 1. İÇE AKTARIMLAR (IMPORTS)
// ============================================================================
import { getNextDay, maskDateInput, parseMaskedDateToISO } from '../../utils/formatters';
import { useState, useEffect } from 'react';
import { useAvailableRooms, useCreateReservation } from '../../hooks/useHotelData';
import { validateTCKN, validatePassport } from '../../utils/validators';
import { X, CheckCircle2, XCircle, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

// ============================================================================
// 2. YARDIMCI VE FABRİKA (FACTORY) ŞABLONLARI
// ============================================================================
/**
 * Hem ana misafir hem de ek misafirler için temiz veri tabanı objesi üreten fabrika fonksiyonu.
 * DRY prensibini korur ve form sıfırlamalarında tutarlı varsayılan alanlar sunar.
 */
const emptyGuest = () => ({
    firstName: '',
    lastName: '',
    identityType: 'tc',     // 'tc' | 'passport'
    identityNumber: '',
    birthDate: '',          // Maskeli format: GG.AA.YYYY
    gender: 'U'             // 'U' (Belirtilmemiş), 'M' (Erkek), 'F' (Kadın)
});

// ============================================================================
// 3. ANA BİLEŞEN (COMPONENT)
// ============================================================================
const NewReservationModal = ({ isOpen, onClose, initialRoomId = null }) => {
    // Varsayılan sistem takvimi tarihleri (YYYY-MM-DD formatında)
    const today = new Date().toLocaleDateString('en-CA');
    const tomorrow = getNextDay(today);

    // ------------------------------------------------------------------------
    // 3.1. YEREL DURUMLAR (LOCAL STATES)
    // ------------------------------------------------------------------------
    // Rezervasyon üst veri formu (Tarihler, oda, acenta, fiyat ve operasyonel notlar)
    const [formData, setFormData] = useState({
        checkIn: today,
        checkOut: tomorrow,
        roomId: '',
        agency: 'DIRECT',
        totalPrice: '',
        notes: ''
    });
    
    // 1. Ana Misafir (Folyo/Sözleşme Sahibi) verisi ve anlık kimlik doğrulama durumu
    const [mainGuest, setMainGuest] = useState(emptyGuest());
    const [mainIdentityStatus, setMainIdentityStatus] = useState(null); // null | 'valid' | 'invalid'

    // Ek Misafirler listesi (Oda içi refakatçiler / Accompanying Guests)
    const [extraGuests, setExtraGuests] = useState([]);

    // ------------------------------------------------------------------------
    // 3.2. SUNUCU İLETİŞİMİ (SERVER HOOKS / REACT QUERY)
    // ------------------------------------------------------------------------
    // Seçilen check-in ve check-out aralığında müsait olan odaları dinamik getirir
    const { data: availableRooms, isLoading: isRoomsLoading } = useAvailableRooms(formData.checkIn, formData.checkOut);
    
    // Rezervasyonu backend'e POST eden mutasyon kancası (Başarılı olunca onClose modalını kapatır)
    const createMutation = useCreateReservation(onClose);

    // ------------------------------------------------------------------------
    // 3.3. YAŞAM DÖNGÜSÜ VE SENKRONİZASYON (EFFECTS)
    // ------------------------------------------------------------------------
    
    // EFFECT 1: Modal her açıldığında form hafızasını sıfırlar veya oda kartından tıklandıysa odayı kilitler
    useEffect(() => {
        if (isOpen) {
            const currentToday = new Date().toLocaleDateString('en-CA');
            const currentTomorrow = getNextDay(currentToday);

            setFormData({
                checkIn: currentToday,
                checkOut: currentTomorrow,
                roomId: initialRoomId ? String(initialRoomId) : '',
                agency: 'DIRECT',
                totalPrice: '',
                notes: '',
            });
            setMainGuest(emptyGuest());
            setMainIdentityStatus(null);
            setExtraGuests([]);
        }
    }, [isOpen, initialRoomId]);

    // EFFECT 2: Ana misafir kimlik numarası değiştikçe anlık TCKN/Pasaport algoritmik kontrolü
    useEffect(() => {
        // En az 7 karakter girilmeden hata veya onay gösterme (kullanıcı yazarken rahatsız etmeme)
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

    // EFFECT 3: Check-in tarihi değiştiğinde check-out tarihinin geçmişte kalmasını önleyen otel kuralı
    useEffect(() => {
        if (!formData.checkIn) return;
        const expectedCheckOut = getNextDay(formData.checkIn);
        
        // Çıkış tarihi boşsa veya giriş tarihine eşit/önceyse otomatik sonraki güne öteler
        if (!formData.checkOut || formData.checkOut <= formData.checkIn) {
            setFormData(prev => ({ ...prev, checkOut: expectedCheckOut }));
        }
    }, [formData.checkIn]);

    // Modal kapalıysa DOM'a render etmeyip sıfır maliyetle erken çıkış yapar (Early Return)
    if (!isOpen) return null;

    // ------------------------------------------------------------------------
    // 3.4. OLAY İŞLEYİCİLERİ: FORM VE ANA MİSAFİR (HANDLERS)
    // ------------------------------------------------------------------------
    
    // Rezervasyon ana alanlarını (Oda, tarihler, acenta vb.) günceller
    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Ana misafirin ad, soyad, kimlik tipi ve cinsiyet alanlarını günceller
    const handleMainGuestChange = (e) => {
        const { name, value } = e.target;
        setMainGuest(prev => ({ ...prev, [name]: value }));
    };

    // Ana misafir doğum tarihi alanına maskeleme (GG.AA.YYYY) uygular
    const handleMainBirthDateChange = (e) => {
        setMainGuest(prev => ({ ...prev, birthDate: maskDateInput(e.target.value) }));
    };

    // ------------------------------------------------------------------------
    // 3.5. OLAY İŞLEYİCİLERİ: EK MİSAFİRLER (ACCOMPANYING GUESTS)
    // ------------------------------------------------------------------------
    
    // Yeni ek misafir satırı ekler (Maksimum 3 ek misafir + 1 ana misafir = 4 Pax kuralı)
    const addExtraGuest = () => {
        if (extraGuests.length >= 3) {
            toast.error("Bir odaya en fazla 4 kişi (1 Ana + 3 Ek) kaydedilebilir.");
            return;
        }
        setExtraGuests(prev => [...prev, emptyGuest()]);
    };

    // İlgili index'teki ek misafiri listeden çıkarır
    const removeExtraGuest = (index) => {
        setExtraGuests(prev => prev.filter((_, i) => i !== index));
    };

    // İlgili ek misafirin metin inputlarını günceller (Immutability / Değişmezlik kuralı)
    const handleExtraGuestChange = (index, e) => {
        const { name, value } = e.target;
        setExtraGuests(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [name]: value };
            return updated;
        });
    };

    // İlgili ek misafirin doğum tarihi alanına maskeleme uygular
    const handleExtraBirthDateChange = (index, e) => {
        setExtraGuests(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], birthDate: maskDateInput(e.target.value) };
            return updated;
        });
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
        
        // İş Kuralı 2: Oda atanmadan rezervasyon tamamlanamaz
        if (!formData.roomId) {
            toast.error('Lütfen müsait bir oda seçiniz.');
            return;
        }

        // Ana Misafir Django DRF Model Payload Yapısı
        const mainGuestPayload = {
            first_name: mainGuest.firstName,
            last_name: mainGuest.lastName,
            tc_no: mainGuest.identityType === 'tc' ? mainGuest.identityNumber : null,
            passport_no: mainGuest.identityType === 'passport' ? mainGuest.identityNumber : null,
            birth_date: parseMaskedDateToISO(mainGuest.birthDate), // YYYY-MM-DD ISO formatına çevirir
            gender: mainGuest.gender
        };

        // Ek Misafirler Payload Yapısı (Formda eklenip içi boş bırakılan hayalet satırları filtreler)
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

        // Django REST Framework Nested Serializer'ın beklediği nihai rezervasyon paketi
        const payload = {
            guest: mainGuestPayload,
            accompanying_guest_data: extraGuestsPayload, // Backend'de ilişkili misafir tablolarını doldurur
            room_id: formData.roomId,
            agency: formData.agency,
            check_in_date: formData.checkIn,
            check_out_date: formData.checkOut,
            total_price: formData.totalPrice ? formData.totalPrice : '0.00',
            notes: formData.notes
        };

        // Mutasyonu tetikler
        createMutation.mutate(payload);
    };

    // ========================================================================
    // 4. ARAYÜZ ÇİZİMİ (JSX RENDER)
    // ========================================================================
    return (
        /* Arka plan karartması ve modal ortalama kapsayıcısı */
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">

                {/* MODAL ÜST BAŞLIK (HEADER) */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
                    <h2 className="text-lg font-bold text-slate-800">Yeni Rezervasyon Oluştur</h2>
                    <button 
                        onClick={onClose} 
                        className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-full transition cursor-pointer"
                        title="Kapat"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* MODAL GÖVDE ALANI (SCROLL EDİLEBİLİR FORM) */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <form id="reservation-form" onSubmit={handleSubmit} className="space-y-8">

                        {/* ==================================================== */}
                        {/* BÖLÜM 1: 1. ANA MİSAFİR (KONTRAT / FOLYO SAHİBİ)     */}
                        {/* ==================================================== */}
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-4 flex items-center gap-2">
                                1. Ana Misafir (Kontrat Sahibi)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                
                                {/* 1.1 Ad */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Ad</label>
                                    <input 
                                        required 
                                        type="text" 
                                        name="firstName" 
                                        value={mainGuest.firstName} 
                                        onChange={handleMainGuestChange} 
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                                    />
                                </div>

                                {/* 1.2 Soyad */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Soyad</label>
                                    <input 
                                        required 
                                        type="text" 
                                        name="lastName" 
                                        value={mainGuest.lastName} 
                                        onChange={handleMainGuestChange} 
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                                    />
                                </div>

                                {/* 1.3 Cinsiyet */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Cinsiyet</label>
                                    <select 
                                        name="gender" 
                                        value={mainGuest.gender} 
                                        onChange={handleMainGuestChange} 
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    >
                                        <option value="U">Belirtilmemiş</option>
                                        <option value="M">Erkek</option>
                                        <option value="F">Kadın</option>
                                    </select>
                                </div>

                                {/* 1.4 Kimlik Türü */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Kimlik Türü</label>
                                    <select 
                                        name="identityType" 
                                        value={mainGuest.identityType} 
                                        onChange={handleMainGuestChange} 
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    >
                                        <option value="tc">TC Kimlik No</option>
                                        <option value="passport">Passport No</option>
                                    </select>
                                </div>

                                {/* 1.5 Kimlik Numarası (Anlık Algoritmik Doğrulama Rozetli) */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Kimlik Numarası</label>
                                    <div className="relative">
                                        <input 
                                            required 
                                            type="text" 
                                            name="identityNumber" 
                                            value={mainGuest.identityNumber} 
                                            onChange={handleMainGuestChange} 
                                            maxLength={mainGuest.identityType === 'tc' ? 11 : 15} 
                                            className={`w-full border rounded-lg p-2 pr-8 text-sm focus:ring-2 outline-none ${
                                                mainIdentityStatus === 'invalid' 
                                                    ? 'border-rose-500 focus:ring-rose-500 bg-rose-50' 
                                                    : mainIdentityStatus === 'valid' 
                                                    ? 'border-emerald-500 focus:ring-emerald-500 bg-emerald-50' 
                                                    : 'border-slate-300 focus:ring-blue-500'
                                            }`}
                                        />
                                        {/* Geçerli / Geçersiz Durum İkonu */}
                                        <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                                            {mainIdentityStatus === 'valid' && <CheckCircle2 size={16} className="text-emerald-500"/>}
                                            {mainIdentityStatus === 'invalid' && <XCircle size={16} className="text-rose-500"/>}
                                        </div>
                                    </div>
                                </div>

                                {/* 1.6 Doğum Tarihi (Maskeli Giriş) */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Doğum Tarihi</label>
                                    <input 
                                        required 
                                        type="text" 
                                        name="birthDate" 
                                        value={mainGuest.birthDate} 
                                        onChange={handleMainBirthDateChange} 
                                        placeholder="GG.AA.YYYY" 
                                        maxLength={10} 
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ==================================================== */}
                        {/* BÖLÜM 2: EK MİSAFİRLER (REFAKATÇİLER / ODA ARKADAŞLARI)*/}
                        {/* ==================================================== */}
                        {extraGuests.length > 0 && (
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 border-b border-slate-100 pb-2">
                                    Ek Misafirler ({extraGuests.length})
                                </h3>
                                <div className="space-y-4">
                                    {extraGuests.map((eg, index) => (
                                        <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg relative">
                                            
                                            {/* Ek Misafiri Sil Butonu */}
                                            <button 
                                                type="button" 
                                                onClick={() => removeExtraGuest(index)} 
                                                className="absolute -top-2 -right-2 bg-white text-rose-500 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-full shadow-sm border border-slate-200 cursor-pointer transition"
                                                title="Ek Misafiri Kaldır"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            
                                            {/* Ek Misafir Ad */}
                                            <div className="col-span-2">
                                                <input 
                                                    type="text" 
                                                    name="firstName" 
                                                    value={eg.firstName} 
                                                    onChange={(e) => handleExtraGuestChange(index, e)} 
                                                    placeholder="Ad" 
                                                    className="w-full border border-slate-300 rounded p-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none" 
                                                />
                                            </div>

                                            {/* Ek Misafir Soyad */}
                                            <div className="col-span-2">
                                                <input 
                                                    type="text" 
                                                    name="lastName" 
                                                    value={eg.lastName} 
                                                    onChange={(e) => handleExtraGuestChange(index, e)} 
                                                    placeholder="Soyad" 
                                                    className="w-full border border-slate-300 rounded p-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none" 
                                                />
                                            </div>

                                            {/* Ek Misafir Cinsiyet ve Doğum Tarihi */}
                                            <div className="col-span-2 flex gap-2">
                                                <select 
                                                    name="gender" 
                                                    value={eg.gender} 
                                                    onChange={(e) => handleExtraGuestChange(index, e)} 
                                                    className="w-1/2 border border-slate-300 rounded p-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                                >
                                                    <option value="U">Cinsiyet</option>
                                                    <option value="M">Erkek</option>
                                                    <option value="F">Kadın</option>
                                                </select>
                                                <input 
                                                    type="text" 
                                                    name="birthDate" 
                                                    value={eg.birthDate} 
                                                    onChange={(e) => handleExtraBirthDateChange(index, e)} 
                                                    placeholder="D.Tarihi (GG.AA.YYYY)" 
                                                    maxLength={10} 
                                                    className="w-1/2 border border-slate-300 rounded p-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none" 
                                                />
                                            </div>

                                            {/* Ek Misafir Kimlik Türü ve Numarası */}
                                            <div className="col-span-6 flex gap-2">
                                                <select 
                                                    name="identityType" 
                                                    value={eg.identityType} 
                                                    onChange={(e) => handleExtraGuestChange(index, e)} 
                                                    className="w-1/4 border border-slate-300 rounded p-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                                >
                                                    <option value="tc">TC</option>
                                                    <option value="passport">Pasaport</option>
                                                </select>
                                                <input 
                                                    type="text" 
                                                    name="identityNumber" 
                                                    value={eg.identityNumber} 
                                                    onChange={(e) => handleExtraGuestChange(index, e)} 
                                                    placeholder="Kimlik/Pasaport No" 
                                                    maxLength={15} 
                                                    className="w-3/4 border border-slate-300 rounded p-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none" 
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Ek Misafir Ekleme Butonu (Maks 3 ek misafir ile sınırlandırılmıştır) */}
                        <div>
                            <button 
                                type="button" 
                                onClick={addExtraGuest} 
                                disabled={extraGuests.length >= 3} 
                                className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition disabled:opacity-50 cursor-pointer"
                            >
                                <PlusCircle size={14} /> Opsiyonel Ek Misafir Ekle
                            </button>
                        </div>

                        <hr className="border-slate-100"/>

                        {/* ==================================================== */}
                        {/* BÖLÜM 3: KONAKLAMA, ODA VE SATIŞ KANALI (ACENTA)      */}
                        {/* ==================================================== */}
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-4">
                                Konaklama Bilgileri
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                
                                {/* 3.1 Satış Kanalı / Acenta */}
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Acenta / Kanal</label>
                                    <select 
                                        name="agency" 
                                        value={formData.agency} 
                                        onChange={handleFormChange} 
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-semibold text-slate-700"
                                    >
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

                                {/* 3.2 Müsait Oda Seçimi (Tarihlere göre dinamik sorgulanır) */}
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center justify-between">
                                        <span>Oda</span>
                                        {isRoomsLoading && <Loader2 size={12} className="animate-spin text-blue-500" />}
                                    </label>
                                    <select 
                                        required 
                                        name="roomId" 
                                        value={formData.roomId} 
                                        onChange={handleFormChange} 
                                        disabled={isRoomsLoading || !availableRooms} 
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-100 disabled:text-slate-400"
                                    >
                                        <option value="">Seçiniz...</option>
                                        {availableRooms?.map(r => (
                                            <option key={r.id} value={r.id}>
                                                {r.room_number} ({r.room_type?.name})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* 3.3 Check-in Tarihi */}
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Check-in</label>
                                    <input 
                                        required 
                                        type="date" 
                                        name="checkIn" 
                                        value={formData.checkIn} 
                                        onChange={handleFormChange} 
                                        min={today} 
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                                    />
                                </div>

                                {/* 3.4 Check-out Tarihi */}
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Check-out</label>
                                    <input 
                                        required 
                                        type="date" 
                                        name="checkOut" 
                                        value={formData.checkOut} 
                                        onChange={handleFormChange} 
                                        min={formData.checkIn ? getNextDay(formData.checkIn) : today} 
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                                    />
                                </div>

                                {/* 3.5 Toplam Tutar (TRY) */}
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Tutar (TRY)</label>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        name="totalPrice" 
                                        value={formData.totalPrice} 
                                        onChange={handleFormChange} 
                                        placeholder="0.00" 
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold" 
                                    />
                                </div>

                                {/* 3.6 Operasyonel Notlar */}
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Notlar</label>
                                    <input 
                                        type="text" 
                                        name="notes" 
                                        value={formData.notes} 
                                        onChange={handleFormChange} 
                                        placeholder="Özel istekler, geç giriş, balayı paketi vb." 
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                                    />
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* ==================================================== */}
                {/* BÖLÜM 4: MODAL ALT PANEL (FOOTER & SUBMIT AKSİYONLARI) */}
                {/* ==================================================== */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 rounded-b-2xl">
                    {/* İptal Butonu */}
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                    >
                        İptal
                    </button>

                    {/* Kaydet ve Rezervasyon Aç Butonu */}
                    {/* Form dışından tetiklenebilmesi için form="reservation-form" id referansı kullanır */}
                    <button
                        form="reservation-form"
                        type="submit"
                        disabled={createMutation.isPending || mainIdentityStatus === 'invalid' || !formData.roomId}
                        className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg shadow-sm transition cursor-pointer"
                    >
                        {createMutation.isPending ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <CheckCircle2 size={16} />
                        )}
                        Kaydet
                    </button>
                </div>

            </div>
        </div>
    );
};

export default NewReservationModal;