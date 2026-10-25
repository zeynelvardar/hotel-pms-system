/**
 * useHotelData.js: hotelService.js ile arayüz bileşenlerinin (RoomRack, Dashboard.jsx)
 * arasına yerleşir. Verileri servis dosyasından Cache'e alarak hızlı arayüz
 * kullanımını sağlar. (dosyadan fonksiyon çağırılana kadar bir şey yapmaz.
 * React'dan çağırıldıktan sonra işlemi gerçekleştirir.)
 * 
 * Veri Bağlama: Bileşenlerin hangi veriyi istediğini söylemesini sağlar.
 * Oto Yaşam Döngüsü/Durum Yönetimi: Her hook; isLoading, isSuccess, isError,
 * isFetching durumlarını React Query ile otomatik üretir.
 * 
 * Akıllı Cache İzolasyonu: Oda haritası verilerini bağımsız ad alanında saklar;
 * ['roomRack']: Oda haritasına ait verileri bağımsız bir ad alanında saklar. vb.
 * 
 * Operasyonel Otomasyon: useRoomRack içindeki refetchInterval (60 saniyede bir rack yenile)
 * günceller.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hotelService } from '../services/hotelService';
import toast from 'react-hot-toast';

// ==========================================
// 1. ODA & RACK HOOK'LARI
// ==========================================

export const useRoomRack = () => {
    return useQuery({ // useQuery: GET isteklerini atar, veriyi ön belleğe alır, 60 saniyede bir yeniden istek atar.
        queryKey: ['roomRack'], // tarayıcı için query anahtarı.
        queryFn: hotelService.getRoomRack, // istek atılır.
        refetchInterval: 1000 * 60, // 60 saniyede bir tekrar istek atar ve yeniler.
    });
};

export const useAvailableRooms = (checkIn, checkOut) => { // react bileşenin'den giriş ve çıkış tarihi paramtere olarak verilir.
    const isDateRangeValid = Boolean(checkIn && checkOut && new Date(checkOut) > new Date(checkIn)); // giriş ve çıkış tarihi dolu mu (true/false) -> string olarak gelen tarihleri JS tarih nesnesine çevirir ve kıyaslar (çıkış girişten büyük mü?) true/false döner.

    return useQuery({
        queryKey: ['availableRooms', checkIn, checkOut], // queryKey içine giriş ve çıkış tarihi koyuyoruz: react bileşeninde giriş çıkış tarihi değiştiğinde cache'de anlık güncellenmesi için.
        queryFn: () => hotelService.getAvailableRooms(checkIn, checkOut),
        enabled: isDateRangeValid, // tarih validasyonu true ise istek atılır.
        staleTime: 1000 * 30, // 30 saniye boyunca taze kalır, tekrar istek atılıp güncellenmesi için etkileşim gerekir. (tekrar tarih seçme vs.)
    });
};

export const useChangeRoomStatus = () => {
    const queryClient = useQueryClient(); // Ön Bellek Yöneticisi: sunucuda veri değiştiğinde, cache'deki eski verileri geçersiz kılmayı sağlar, böylece veriler güncellenir.
    
    return useMutation({
        mutationFn: ({roomId, status}) => hotelService.changeRoomStatus(roomId, status), // patch isteği atılır, roomId ve status parametre olarak hotelService.js üzerinden backend'e istek atılır.
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roomRack'] }); // oda statüsü değiştiği için roomRack queryKey'ini stale bayat hale getirir ve tekrar istek atılarak arayüz güncellenir.
            toast.success('Oda statüsü başarıyla güncellendi.');
        },
        onError: (error) => {
            toast.error(error.response?.data?.detail || 'Oda statüsü güncellenemedi.')
        }
    });
};


// ==========================================
// 2. DASHBOARD (OPERASYON PANOSU) HOOK'LARI
// ==========================================
// Hepsinde ortak 'dashboard' anahtarı (Query Key) kullanılarak cache izolasyonu sağlanır.

export const useDashboardReservations = () => useQuery({ queryKey: ['dashboard', 'reservations'], queryFn: hotelService.getReservationsList }); // tüm rezervasyonlar listesini getiren hook (cache'leme yapar.)
export const useDashboardArrivals = () => useQuery({ queryKey: ['dashboard', 'arrivals'], queryFn: hotelService.getArrivals });
export const useDashboardArrivedToday = () => useQuery({ queryKey: ['dashboard', 'arrivedToday'], queryFn: hotelService.getArrived });
export const useDashboardInHouse = () => useQuery({ queryKey: ['dashboard', 'inHouse'], queryFn: hotelService.getInHouse });
export const useDashboardDepartures = () => useQuery({ queryKey: ['dashboard', 'departures'], queryFn: hotelService.getDepartures });
export const useDashboardCheckedOut = () => useQuery({ queryKey: ['dashboard', 'checkedOut'], queryFn: hotelService.getCheckedOut });
export const useDashboardCancelled = () => useQuery({ queryKey: ['dashboard', 'cancelled'], queryFn: hotelService.getCancelled });
export const useDashboardAllRecords = () => useQuery({ queryKey: ['dashboard', 'allRecords'], queryFn: hotelService.getAllRecords });

// ==========================================
// 3. REZERVASYON AKSİYON HOOK'LARI (Yazma/Değiştirme)
// ==========================================

export const useCreateReservation = (onSuccessCallBack) => { // parametre react bileşeninden verilir, kalan işleri yaptırmaya yarar (onClose) gibi.
    const queryClient = useQueryClient(); // Ön Bellek Yöneticisi: sunucuda veri değiştiğinde, cache'deki eski verileri geçersiz kılmayı sağlar, böylece veriler güncellenir.

    return useMutation({
        mutationFn: hotelService.createReservation, // post isteği atılır.
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['roomRack'] });
            toast.success('Rezervasyon başarıyla oluşturuldu.');
            if (onSuccessCallBack) onSuccessCallBack(); // callback true ise callback'i çalıştı (onclose) modal'ı kapat. (neden burada?: eğer modal direkt kapanırsa ve işlem başarısız olursa kullanıcı bunu göremez.)
        },
        onError: (error) => {
            const errorMsg = error.response?.data?.detail || error.response?.data?.non_field_errors?.[0] || 'Kayıt sırasında bir hata oluştu.';
            toast.error(`Kayıt Başarısız: ${errorMsg}`);
        }
    });
};

export const useReservationAction = () => {
    const queryClient = useQueryClient(); // Ön Bellek Yöneticisi: sunucuda veri değiştiğinde, cache'deki eski verileri geçersiz kılmayı sağlar, böylece veriler güncellenir.

    const checkInMutation = useMutation({ // patch isteği atılır.
        mutationFn: (id) => hotelService.checkInReservation(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['roomRack'] });
            toast.success('Misafir girişi (Chech-in) başarıyla tamamlandı!');
        },
        onError: (error) => {
            toast.error(error.response?.data?.detail || 'Check-in işlemi gerçekleştirilemedi.')
        }
    });

    const checkOutMutation = useMutation({
        mutationFn: (id) => hotelService.checkOutReservation(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['roomRack'] });
            toast.success('Misafirin çıkışı (Check-Out) başarıyla tamamlandı!');
        },
        onError: (error) => {
            toast.error(error.response?.data?.detail || 'Check-out işlemi gerçekleştirilemedi.');
        }
    });

    return { // react bileşeni içinde işlemleri bu isimlemelerle çağıracağız. (karışıklık olmaması için.)
        checkIn: checkInMutation.mutate,
        isCheckingIn: checkInMutation.isPending,
        checkOut: checkOutMutation.mutate,
        isCheckingOut: checkOutMutation.isPending,
    };
};


// ==========================================
// 4. SİSTEM GÜNÜ & NIGHT AUDIT HOOK'U
// ==========================================

export const useSystemDate = () => {
    return useQuery({
        queryKey: ['systemDate'],
        queryFn: hotelService.getSystemDate,
        staleTime: 1000 * 60 * 5, // 5 dk taze kalır
    });
};

export const useNightAudit = () => {
    const queryClient = useQueryClient(); // Ön Bellek Yöneticisi: sunucuda veri değiştiğinde, cache'deki eski verileri geçersiz kılmayı sağlar, böylece veriler güncellenir.

    return useMutation({
        mutationFn: hotelService.triggerNightAudit,
        onSuccess: (data) => { // data Api içindeki axios'dan gelir. ondan önce de backend'den.
            // Gün sonu yapıldığında TÜM veriler (tarih ve durumlar) değiştiği için tüm cache'i tazele.
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['roomRack'] });
            queryClient.invalidateQueries({ queryKey: ['systemDate'] });

            toast.success(
                `Gün Sonu Başarılı! Yeni Sistem Günü: ${new Date(data.new_system_date).toLocaleDateString('tr-TR')}
                \n(${data.no_shows_processed} adet gelmeyen misafir No-Show yapıldı.)`,
                { duration: 5000 }
            );
        },
        onError: (error) => {
            toast.error(error.response?.data?.detail || 'Gün sonu işlemi (Night Audit) başlatılamadı.');
        }
    });
};