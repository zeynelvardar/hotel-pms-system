/**
 * GuestCardModal (Misafir Profili / KBS Kartı)
 * Sektörel PMS mantığında CRM ve KBS verilerini yöneten tekil profildir.
 */

import { useState, useEffect } from 'react';
import { maskDateInput, parseMaskedDateToISO } from '../../utils/formatters';
import { validateTCKN, validatePassport } from '../../utils/validators';
import { useUpdateGuest } from '../../hooks/useHotelData';
import { X, Save, User, Mail, Phone, Hash, CalendarDays, CheckCircle2, XCircle, Loader2, ShieldCheck, Info } from 'lucide-react';
import toast from 'react-hot-toast';

const toDDMMYYYY = (isoDate) => {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${d}.${m}.${y}`;
};

const GuestCardModal = ({ isOpen, onClose, guestData, isReadOnly }) => {
    const [formData, setFormData] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [identityStatus, setIdentityStatus] = useState(null);

    const updateGuestMutation = useUpdateGuest(() => {
        setIsEditing(false);
    });

    useEffect(() => {
        if (isOpen && guestData && !isEditing) {
            setFormData({
                id: guestData.id,
                firstName: guestData.first_name || '',
                lastName: guestData.last_name || '',
                identityType: guestData.tc_no ? 'tc' : 'passport',
                identityNumber: guestData.tc_no || guestData.passport_no || '',
                birthDate: toDDMMYYYY(guestData.birth_date),
                gender: guestData.gender || 'U',
                email: guestData.email || '',
                phone: guestData.phone || ''
            });
            setIdentityStatus(null);
        }
    }, [isOpen, guestData, isEditing]);

    useEffect(() => {
        if (!formData?.identityNumber || formData.identityNumber.length < 7) {
            setIdentityStatus(null);
            return;
        }

        if (formData.identityType === 'tc') {
            setIdentityStatus(validateTCKN(formData.identityNumber) ? 'valid' : 'invalid');
        } else {
            setIdentityStatus(validatePassport(formData.identityNumber) ? 'valid' : 'invalid');
        }
    }, [formData?.identityNumber, formData?.identityType]);

    if (!isOpen || !formData) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleBirthDateChange = (e) => {
        setFormData(prev => ({ ...prev, birthDate: maskDateInput(e.target.value) }));
    };

    const handleSave = (e) => {
        e.preventDefault();

        if (identityStatus === "invalid") {
            toast.error('Lütfen geçerli bir kimlik veya pasaport numarası giriniz.');
            return;
        }

        const payload = {
            first_name: formData.firstName,
            last_name: formData.lastName,
            tc_no: formData.identityType === 'tc' ? formData.identityNumber : null,
            passport_no: formData.identityType === 'passport' ? formData.identityNumber : null,
            birth_date: parseMaskedDateToISO(formData.birthDate),
            gender: formData.gender,
            email: formData.email,
            phone: formData.phone
        };

        updateGuestMutation.mutate({ id: formData.id, data: payload });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden relative">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-slate-100 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-lg">
                            {formData.firstName ? formData.firstName.charAt(0) : <User size={20} />}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">
                                {formData.firstName} {formData.lastName}
                            </h2>
                            <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                                <ShieldCheck size={12} className="text-emerald-500"/>
                                Misafir Profili (ID: {formData.id})
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-800 rounded-full transition cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar bg-white">
                    {isReadOnly && !isEditing && (
                        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                            <Info size={16} className="text-amber-600 mt-0.5" />
                            <p className="text-xs font-medium text-amber-700 leading-relaxed">
                                Bu kayıt <b>geçmiş/kapalı bir rezervasyona</b> ait olduğu için koruma altındadır. Ancak bu misafir profilindeki bir hatayı düzeltmek isterseniz <button type="button" onClick={() => setIsEditing(true)} className="underline font-bold text-amber-800 cursor-pointer">düzenleme modunu açabilirsiniz</button>.
                            </p>
                        </div>
                    )}

                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-blue-600">
                            Kimlik & İletişim Bilgileri
                        </h3>
                        {!isReadOnly && !isEditing && (
                            <button 
                                type="button" 
                                onClick={() => setIsEditing(true)} 
                                className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition cursor-pointer"
                            >
                                Profili Düzenle
                            </button>
                        )}
                    </div>

                    <form id="guest-profile-form" onSubmit={handleSave} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Ad</label>
                                <input required type="text" name="firstName" value={formData.firstName} onChange={handleChange} disabled={!isEditing} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Soyad</label>
                                <input required type="text" name="lastName" value={formData.lastName} onChange={handleChange} disabled={!isEditing} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Cinsiyet</label>
                                <select name="gender" value={formData.gender} onChange={handleChange} disabled={!isEditing} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-500 outline-none">
                                    <option value="U">Belirtilmemiş</option>
                                    <option value="M">Erkek</option>
                                    <option value="F">Kadın</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Kimlik Türü</label>
                                <select name="identityType" value={formData.identityType} onChange={handleChange} disabled={!isEditing} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-500 outline-none">
                                    <option value="tc">TC Kimlik No</option>
                                    <option value="passport">Pasaport No</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1"><Hash size={12}/> Kimlik / Pasaport No</label>
                                <div className="relative">
                                    <input required type="text" name="identityNumber" value={formData.identityNumber} onChange={handleChange} disabled={!isEditing} maxLength={formData.identityType === 'tc' ? 11 : 15} className={`w-full border rounded-lg p-2.5 pr-8 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-500 ${identityStatus === 'invalid' ? 'border-rose-500 focus:ring-rose-500 bg-rose-50' : identityStatus === 'valid' ? 'border-emerald-500 focus:ring-emerald-500 bg-emerald-50' : 'border-slate-300 focus:ring-blue-500'}`}/>
                                    <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                                        {identityStatus === 'valid' && <CheckCircle2 size={16} className="text-emerald-500"/>}
                                        {identityStatus === 'invalid' && <XCircle size={16} className="text-rose-500"/>}
                                    </div>
                                </div>
                                {identityStatus === 'invalid' && <p className="text-[10px] text-rose-500 mt-1 font-bold">Geçersiz Format</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1"><CalendarDays size={12}/> Doğum Tarihi</label>
                                <input required type="text" name="birthDate" value={formData.birthDate} onChange={handleBirthDateChange} disabled={!isEditing} placeholder="GG.AA.YYYY" maxLength={10} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-500 outline-none" />
                            </div>
                        </div>

                        <hr className="border-slate-100" />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1"><Phone size={12}/> Telefon</label>
                                <input type="text" name="phone" value={formData.phone} onChange={handleChange} disabled={!isEditing} placeholder="Örn: 05xx xxx xx xx" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1"><Mail size={12}/> E-posta</label>
                                <input type="email" name="email" value={formData.email} onChange={handleChange} disabled={!isEditing} placeholder="Örn: ornek@email.com" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-500 outline-none" />
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 rounded-b-2xl">
                    {isEditing ? (
                        <>
                            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition cursor-pointer">
                                Vazgeç
                            </button>
                            <button 
                                form="guest-profile-form" 
                                type="submit" 
                                disabled={updateGuestMutation.isPending || identityStatus === 'invalid'} 
                                className="flex items-center gap-1.5 px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg shadow-sm transition cursor-pointer"
                            >
                                {updateGuestMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Profili Kaydet
                            </button>
                        </>
                    ) : (
                        <button type="button" onClick={onClose} className="px-6 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shadow-sm transition cursor-pointer">
                            Kapat
                        </button>
                    )}
                </div>
                
            </div>
        </div>
    );
};

export default GuestCardModal;