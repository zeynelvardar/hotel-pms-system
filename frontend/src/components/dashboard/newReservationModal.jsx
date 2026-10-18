/**
 * Yeni Rezervasyon Oluşturma Modal'ı
 * 
 * Resepsiyonistin Yeni Rezervasyon Kaydetmesinini Sağlayan
 * Açılır Pencere Modal'ı
 * 
 */

import { getNextDay, maskDateInput, parseMaskedDateToISO } from '../../utils/formatters';
import { useState, useEffect } from 'react';
import { useAvailableRooms, useCreateReservation } from '../../hooks/useHotelData';
import { validateTCKN, validatePassport } from '../../utils/validators';
import { X, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const NewReservationModal = ({ isOpen, onClose, initialRoomId = null }) => { // üst bileşenden alınan proplar (ekranda görünsün mü(bool) - sayfayı kapatma fonksiyonu)
    // Bugünün tarihini YYYY-MM-DD formatında al
    const today = new Date().toLocaleDateString('en-CA'); // o anki yerel tarihi üretir (saat dilimi sapmasını engeller).
    const tomorrow = getNextDay(today); // bir sonraki günün tarihini otomatik 

    const [formData, setFormData] = useState({  // formdata: içine koyduğumuz nesneyi tutan değer / setFormData: yazma fonksiyonu, kodun devamında aşağıdaki formları doldurmak için çağrılır.
        firstName: '',
        lastName: '',
        identityType: 'tc', // veya 'pasaport'
        identityNumber: '',
        birthDate: '',
        checkIn: today,
        checkOut: tomorrow,
        roomId: '',
        totalPrice: '',
        notes: ''
    });

    const [identityStatus, setIdentityStatus] = useState(null); //identityStatus: 

    // Tarihlere göre müsait odaları çeken hook
    const { data: availableRooms, isLoading: isRoomsLoading } = useAvailableRooms(formData.checkIn, formData.checkOut); // formdaki giriş çıkış tarihlerini alıp, backend'den o tarihlerde boş olan odaları canlı olarak çeken ve gelen verileri bileşene teslim eden kısımdır.

    // Form Gönderim Hook'u
    const createMutation = useCreateReservation(onClose); // Rezervasyon kayıt motorunu (mutation) hazırla; işlem başarıyla bittiğinde modalı kapatması için onClose fonksiyonunu emanet et.

    // Modal her açıldığında (isOpen = true) formu ve tarihleri fabrika ayarlarına sıfırla
    useEffect(() => {
        if (isOpen) {
            const currentToday = new Date().toLocaleDateString('en-CA'); // kanada = iso formatı yyyy-mm-dd
            const currentTomorrow = getNextDay(currentToday);

            setFormData({
                firstName: '',
                lastName:'',
                identityType: 'tc',
                identityNumber: '',
                birthDate: '',
                checkIn: currentToday,
                checkOut: currentTomorrow,
                roomId: initialRoomId ? String(initialRoomId) : '',
                totalPrice: '',
                notes: '',
            });
            setIdentityStatus(null);
        }
    }, [isOpen, initialRoomId]); // Modal açıldığında veya room rack''den farklı bir oda seçildiğinde çalıştır.
    

    // Kimlik numarasını anlık doğrulama
    useEffect(() => {
        if (!formData.identityNumber || formData.identityNumber.length < 7) { // eğer tckn yazarken 7 haneden küçükse
            setIdentityStatus(null);  // durumu boş olarak kalır ve hata göstermez
            return;
        }

        if (formData.identityType === 'tc') {
            setIdentityStatus(validateTCKN(formData.identityNumber) ? 'valid' : 'invalid');
        } else {
            setIdentityStatus(validatePassport(formData.identityNumber) ? 'valid' : 'invalid');
        }
    }, [formData.identityNumber, formData.identityType]); // kodu her ekran çizildiğinde değil, bu iki değişkenin değeri değiştiğinde tekrar yaz.

    // Check-in değiştiğinde Check-out'u otomatik kontrol et ve ayarla.
    useEffect(() => {
        // Eğer checkIn boş ise hiçbir şey yapma
        if (!formData.checkIn) return;

        // Geçerli bir sonraki günü hesapla
        const expectedCheckOut = getNextDay(formData.checkIn)

        if (!formData.checkOut || formData.checkOut <= formData.checkIn) { //
            setFormData(prev => ({
                ...prev,
                checkOut: expectedCheckOut
            }));
        }
    }, [formData.checkIn]); // Sadece checkIn değiştiğinde tetiklenir.

    if (!isOpen) return null; // dashboard bileşeninden gelen isOpen değerli false ise yani yeni rezervasyon butonuna basmamışsa, React bunları DOM'a çizmez.

    // Doğum günü maskelemesi ve otomatik noktalama
    const handleBirthDateChange = (e) => {
        const maskedValue = maskDateInput(e.target.value);
        setFormData((prev) => ({
            ...prev,
            birthDate: maskedValue,
        }));
    };
    
    // formdaki input ve select alanlarını tek merkezden güncelleyen evrensel change handler.
    const handleChange = (e) => { // e : olay nesnesi (kullanıcı her tuşa bastığında seçim değiştiğinde tarayıcı bu fonksiyonu tetikler)
        const { name, value } = e.target;  // o en tetiklenen html etiketi
        setFormData(prev => ({ ...prev, [name]: value})); //setFormData : formData nesnesini değiştirip ekranı günceller.
    };


    const handleSubmit = (e) => { // kullanıcı formu göndermek için enter'a bastıktan sonra tetiklenen fonksiyondur.
        e.preventDefault(); // sayfanın yenilenmesini engeller, react devralır.
        
        if (identityStatus === "invalid") {
            toast.error('Lütfen geçerli bir kimlik numarası giriniz.');
            return;
        }
        if (!formData.roomId) {
            toast.error('Lütfen müsait bir oda seçiniz.');
            return;
        }

        // Backend'in beklediği format (Nested Guest yapısına veya API'nin tasarımına göre ayarlanır.)
        // Eğer backend doğrudan bu formatı almıyorsa, API tarafında Guest Create ve Reservation Create ayrı yönetilebilir

        const payload = {
            guest: {
                first_name: formData.firstName,
                last_name: formData.lastName,
                tc_no: formData.identityType === 'tc' ? formData.identityNumber : null, // seçilen belge (identityType: tc) ise, tc yi yaz. passaportsa tc alanını boş bırak.
                passport_no: formData.identityType === 'passport' ? formData.identityNumber : null,
                birth_date: parseMaskedDateToISO(formData.birthDate),
            },
            room_id: formData.roomId,
            check_in_date: formData.checkIn,
            check_out_date: formData.checkOut,
            total_price: formData.totalPrice ? formData.totalPrice : '0.00',
            notes: formData.notes
        };

        createMutation.mutate(payload); // Payload'u backend'de gönderir.    
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                    <h2 className="text-xl font-bold text-slate-800">Yeni Rezervasyon Oluştur</h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-full transition cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <form id="reservation-form" onSubmit={handleSubmit} className="space-y-6">

                        {/* 1. Misafir Bilgileri */}
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-3">Misafir Bilgileri</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Ad</label>
                                    <input required type="text" name="firstName" value={formData.firstName} onChange={handleChange} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Soyad</label>
                                    <input required type="text" name="lastName" value={formData.lastName} onChange={handleChange} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Kimlik Türü</label>
                                    <select name="identityType" value={formData.identityType} onChange={handleChange} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                        <option value="tc">TC Kimlik No</option>
                                        <option value="passport">Passport No</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Kimlik Numarası</label>
                                    <div className="relative">
                                        <input required type="text" name="identityNumber" value={formData.identityNumber} onChange={handleChange} maxLength={formData.identityType === 'tc' ? 11 : 15} className={`w-full border rounded-lg p-2.5 pr-10 text-sm focus:ring-2 outline-none ${identityStatus === 'invalid' ? 'border-rose-500 focus:ring-rose-500 bg-rose-50' : identityStatus === 'valid' ? 'border-emerald-500 focus:ring-emerald-500 bg-emerald-50' : 'border-slate-300 focus:ring-blue-500'}`}/>
                                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                            {identityStatus === 'valid' && <CheckCircle2 size={18} className="text-emerald-500"/>}
                                            {identityStatus === 'invalid' && <XCircle size={18} className="text-rose-500"/>}
                                        </div>
                                    </div>
                                    {identityStatus === 'invalid' && <p className="text-[10px] text-rose-500 mt-1 font-semibold">Geçersiz {formData.identityType === 'tc' ? 'TCKN (Mod10 Hatası)' : 'Pasaport Formatı'}</p>}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Doğum Tarihi</label>
                                    <input required type="text" name="birthDate" value={formData.birthDate} onChange={handleBirthDateChange} placeholder="GG.AA.YYYY" maxLength={10} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"/>
                                </div>
                            </div>
                        </div>

                        <hr className="border-slate-100"/>

                        {/* 2. Konaklama Bilgileri */}
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-3">2. Konaklama Bilgileri</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Check-in</label>
                                    <input required type="date" name="checkIn" value={formData.checkIn} onChange={handleChange} min={today} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Check-out</label>
                                    <input required type="date" name="checkOut" value={formData.checkOut} onChange={handleChange} min={formData.checkIn ? getNextDay(formData.checkIn) : today} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center justify-between">
                                        <span>Müsait Odalar</span>
                                        {isRoomsLoading && <Loader2 size={14} className="animate-spin text-blue-500" />}
                                    </label>
                                    <select required name="roomId" value={formData.roomId} onChange={handleChange} disabled={isRoomsLoading || !availableRooms} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-100 disabled:text-slate-400">
                                        <option value="">Oda Seçiniz...</option>
                                        {availableRooms?.map(room => (
                                            <option key={room.id} value={room.id}>
                                                {room.room_number} {room.room_type?.name || room.room_type_code} (Kat: {room.floor})
                                            </option>
                                        ))}
                                    </select>
                                    {availableRooms?.length === 0 && (
                                        <p className="text-xs text-rose-500 mt-1 font-medium">Seçili tarihlerde müsait oda bulunamamaktadır!</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Toplam Tutar (TRY)</label>
                                    <input type="number" step="0.01" name="totalPrice" value={formData.totalPrice} onChange={handleChange} placeholder="Örn: 4500.00" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Notlar</label>
                                    <input type="text" name="notes" value={formData.notes} onChange={handleChange} placeholder="Özel istekler vb." className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition cursor-pointer">
                        İptal
                    </button>
                    <button
                        form="reservation-form"
                        type="submit"
                        disabled={createMutation.isPending || identityStatus === 'invalid' || !formData.roomId}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg shadow-md transition cursor-pointer"
                    >
                        {createMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                        Rezervasyonu Kaydet
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewReservationModal;