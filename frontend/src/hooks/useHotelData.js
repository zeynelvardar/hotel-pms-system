/**
 * useHotelData.js: hotelService.js ile arayüz bileşenlerinin (RoomRack, Dashboard.jsx)
 * arasına yerleşir. Verileri servis dosyasından Cache'e alarak hızlı arayüz
 * kullanımını sağlar.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hotelService } from '../services/hotelService';
import toast from 'react-hot-toast';

// ==========================================
// 0. YARDIMCI HATA ÇÖZÜMLEYİCİ (DRY ERROR PARSER)
// ==========================================
const FIELD_LABELS = {
    check_in_date: 'Check-in Tarihi',
    check_out_date: 'Check-out Tarihi',
    room_id: 'Oda Blokajı',
    booked_room_type_id: 'Oda Tipi',
    guest: 'Misafir Bilgileri',
    tc_no: 'TC Kimlik No',
    passport_no: 'Pasaport No',
    birth_date: 'Doğum Tarihi',
    total_price: 'Toplam Tutar',
    status: 'Rezervasyon Statüsü',
};

const extractApiErrorMessage = (error, fallbackMessage = 'İşlem sırasında bir hata oluştu.') => {
    const data = error?.response?.data;
    if (!data) return fallbackMessage;

    if (typeof data === 'string') return data;
    if (data.detail) return Array.isArray(data.detail) ? data.detail[0] : data.detail;
    if (data.non_field_errors?.[0]) return data.non_field_errors[0];

    // Alan bazlı DRF hatalarını (örn: { check_in_date: ["..."] }) ayıkla
    if (typeof data === 'object') {
        const messages = [];
        for (const [field, value] of Object.entries(data)) {
            const label = FIELD_LABELS[field];
            if (Array.isArray(value) && value.length > 0) {
                messages.push(label ? `${label}: ${value[0]}` : value[0]);
            } else if (typeof value === 'object' && value !== null) {
                // Nested serializer (örn: guest: { tc_no: ["..."] }) hataları
                const nestedFirst = Object.values(value).flat()[0];
                if (nestedFirst) {
                    messages.push(label ? `${label}: ${nestedFirst}` : nestedFirst);
                }
            }
        }
        if (messages.length > 0) return messages.join(' • ');
    }

    return fallbackMessage;
};

// ==========================================
// 1. ODA & RACK HOOK'LARI
// ==========================================

export const useRoomRack = () => {
    return useQuery({
        queryKey: ['roomRack'],
        queryFn: hotelService.getRoomRack,
        refetchInterval: 1000 * 60,
    });
};

export const useAvailableRooms = (checkIn, checkOut) => {
    const isDateRangeValid = Boolean(checkIn && checkOut && new Date(checkOut) > new Date(checkIn));

    return useQuery({
        queryKey: ['availableRooms', checkIn, checkOut],
        queryFn: () => hotelService.getAvailableRooms(checkIn, checkOut),
        enabled: isDateRangeValid,
        staleTime: 1000 * 30,
    });
};

export const useChangeRoomStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ roomId, status }) => hotelService.changeRoomStatus(roomId, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roomRack'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['availableRooms'] });
            toast.success('Oda statüsü başarıyla güncellendi.');
        },
        onError: (error) => {
            toast.error(extractApiErrorMessage(error, 'Oda statüsü güncellenemedi.'));
        }
    });
};

export const useRoomTypes = () => {
    return useQuery({
        queryKey: ['roomTypes'],
        queryFn: hotelService.getRoomTypes,
        staleTime: 1000 * 60 * 60 * 24,
    });
};

// ==========================================
// 2. DASHBOARD (OPERASYON PANOSU) HOOK'LARI
// ==========================================

export const useDashboardReservations = () => useQuery({ queryKey: ['dashboard', 'reservations'], queryFn: hotelService.getReservationsList });
export const useDashboardArrivals = () => useQuery({ queryKey: ['dashboard', 'arrivals'], queryFn: hotelService.getArrivals });
export const useDashboardArrivedToday = () => useQuery({ queryKey: ['dashboard', 'arrivedToday'], queryFn: hotelService.getArrived });
export const useDashboardInHouse = () => useQuery({ queryKey: ['dashboard', 'inHouse'], queryFn: hotelService.getInHouse });
export const useDashboardDepartures = () => useQuery({ queryKey: ['dashboard', 'departures'], queryFn: hotelService.getDepartures });
export const useDashboardCheckedOut = () => useQuery({ queryKey: ['dashboard', 'checkedOut'], queryFn: hotelService.getCheckedOut });
export const useDashboardCancelled = () => useQuery({ queryKey: ['dashboard', 'cancelled'], queryFn: hotelService.getCancelled });
export const useDashboardAllRecords = () => useQuery({ queryKey: ['dashboard', 'allRecords'], queryFn: hotelService.getAllRecords });

export const useAgencyChoices = () => {
    return useQuery({
        queryKey: ['agencyChoices'],
        queryFn: hotelService.getAgencyChoices,
        staleTime: 1000 * 60 * 60,
    });
};

// ==========================================
// 3. REZERVASYON AKSİYON HOOK'LARI (Yazma/Değiştirme)
// ==========================================

export const useCreateReservation = (onSuccessCallBack) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: hotelService.createReservation,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['roomRack'] });
            queryClient.invalidateQueries({ queryKey: ['availableRooms'] });
            toast.success('Rezervasyon başarıyla oluşturuldu.');
            if (onSuccessCallBack) onSuccessCallBack();
        },
        onError: (error) => {
            const errorMsg = extractApiErrorMessage(error, 'Kayıt sırasında beklenmeyen bir doğrulama hatası oluştu.');
            toast.error(`Kayıt Başarısız: ${errorMsg}`, { duration: 5000 });
        }
    });
};

export const useUpdateReservation = (onSuccessCallBack) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }) => hotelService.updateReservation(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['roomRack'] });
            queryClient.invalidateQueries({ queryKey: ['availableRooms'] });
            toast.success('Rezervasyon güncellendi.');
            if (onSuccessCallBack) onSuccessCallBack();
        },
        onError: (error) => {
            const errorMsg = extractApiErrorMessage(error, 'Rezervasyon güncellenemedi.');
            toast.error(`Güncelleme Başarısız: ${errorMsg}`, { duration: 5000 });
        }
    });
};

export const useReservationAction = () => {
    const queryClient = useQueryClient();

    const checkInMutation = useMutation({
        mutationFn: (id) => hotelService.checkInReservation(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['roomRack'] });
            toast.success('Misafir girişi (Check-in) başarıyla tamamlandı!');
        },
        onError: (error) => {
            toast.error(extractApiErrorMessage(error, 'Check-in işlemi gerçekleştirilemedi.'));
        }
    });

    const checkOutMutation = useMutation({
        mutationFn: (id) => hotelService.checkOutReservation(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['roomRack'] });
            queryClient.invalidateQueries({ queryKey: ['availableRooms'] });
            toast.success('Misafirin çıkışı (Check-out) başarıyla tamamlandı!');
        },
        onError: (error) => {
            toast.error(extractApiErrorMessage(error, 'Check-out işlemi gerçekleştirilemedi.'));
        }
    });

    const cancelMutation = useMutation({
        mutationFn: (id) => hotelService.cancelReservation(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['roomRack'] });
            queryClient.invalidateQueries({ queryKey: ['availableRooms'] });
            toast.success('Rezervasyon iptal edildi.');
        },
        onError: (error) => {
            toast.error(extractApiErrorMessage(error, 'İptal işlemi başarısız.'));
        }
    });

    return {
        checkIn: checkInMutation.mutate,
        isCheckingIn: checkInMutation.isPending,
        checkOut: checkOutMutation.mutate,
        isCheckingOut: checkOutMutation.isPending,
        cancelRes: cancelMutation.mutate,
        isCancelling: cancelMutation.isPending,
    };
};

// ==========================================
// 4. MİSAFİR KARTI HOOK'LARI
// ==========================================

export const useUpdateGuest = (onSuccessCallBack) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }) => hotelService.updateGuest(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            toast.success('Misafir bilgileri güncellendi.');
            if (onSuccessCallBack) onSuccessCallBack();
        },
        onError: (error) => {
            toast.error(extractApiErrorMessage(error, 'Misafir bilgileri güncellenemedi.'));
        }
    });
};

// ==========================================
// 5. SİSTEM GÜNÜ & NIGHT AUDIT HOOK'U
// ==========================================

export const useSystemDate = () => {
    return useQuery({
        queryKey: ['systemDate'],
        queryFn: hotelService.getSystemDate,
        staleTime: 1000 * 60 * 5,
    });
};

export const useNightAudit = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: hotelService.triggerNightAudit,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['roomRack'] });
            queryClient.invalidateQueries({ queryKey: ['availableRooms'] });
            queryClient.invalidateQueries({ queryKey: ['systemDate'] });

            toast.success(
                `Gün Sonu Başarılı! Yeni Sistem Günü: ${new Date(data.new_system_date).toLocaleDateString('tr-TR')}\n(${data.no_shows_processed} adet gelmeyen misafir No-Show yapıldı.)`,
                { duration: 5000 }
            );
        },
        onError: (error) => {
            toast.error(extractApiErrorMessage(error, 'Gün sonu işlemi (Night Audit) başlatılamadı.'));
        }
    });
};