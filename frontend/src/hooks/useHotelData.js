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

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; //veri okuma (GET isteği)
import { hotelService } from '../services/hotelService';
import toast from 'react-hot-toast'


// Room Rack verisini çeken ve arka planda güncelleyen hook
export const useRoomRack = () => {
    return useQuery({
        queryKey: ['roomRack'], // benzersiz ön bellek anahtarı.
        queryFn: hotelService.getRoomRack, // query fonksiyonu: hotelService içindeki endpoint'e gider.
        refetchInterval: 1000 * 60, // 6 saniyede bir rack ekranını günceller.
    });
};

// Dashboard panoları için hook'lar
export const useDashBoardArrivals = () => {
    return useQuery({
        queryKey: ['dashboard', 'arrivals'], // önbellek anahtarları
        queryFn: hotelService.getArrivals, // hotelService içindeki endpoint'e gider.
    });
};

export const useDashBoardDepartures = () => {
    return useQuery({
        queryKey: ['dashboard', 'departures'], // ön bellek anahtarları
        queryFn: hotelService.getDepartures, // hotelService içindeki endpoint'e gider.
    });
};

export const useDashBoardInHouse = () => {
    return useQuery({
        queryKey: ['dashboard', 'inHouse'], // ön bellek anahtarları
        queryFn: hotelService.getInHouse,
    });
};

export const useAvailableRooms = (checkIn, checkOut) => { //dışarıdan 2 parametre alır.
    return useQuery({ // TanStack veri okuma motoru (useQuery) çalışır
        queryKey: ['availableRooms', checkIn, checkOut], // cache için kimlik anahtarı oluşur, içine cin-cout tarihlerini de koy.
        queryFn: () => hotelService.getAvailableRooms(checkIn, checkOut), // api'ye istek atan fonksiyon
        // Sadece her iki tarih de seçiliyse API'ye istek at (Gereksiz ağı yormaz)
        enabled: !!checkIn && !!checkOut, // giriş çıkış tarihi doluysa isteği at. 
        staleTime: 1000 * 30, // 30 saniye boyunca önbellekte taze kalır.
    });
};

export const useCreateReservation = (onSuccessCallback) => { //parametre 
    const queryClient = useQueryClient(); //tansquery'nin hafıza merkezine bağlanır, yeni rez oluştuğunda cache'deki verileri silip tazelemek için kullanacağız.

    return useMutation({ // veri yazma motoru (çağırıldığı yere döner.)
        mutationFn: hotelService.createReservation, // kaydet butonuna basıldığında DJANGO API'sine iletecek servis fonksiyonu.
        onSuccess: () => {  // backend'e veri başarıyla yazıldığında bu fonksiyon çalışır.
            // başarılı kayıtta tüm panoları ve Room Rack'i anında tazele!
            queryClient.invalidateQueries({ queryKey: ['dashboard'] }); // dashboard cache'ini bayat olarak işaretler.
            queryClient.invalidateQueries({ queryKey: ['roomRack'] }); // aynı şekilde room rack cache'ini de bayatlatır.
            toast.success('Rezervasyon başarıyla oluşturuldu!');
            if (onSuccessCallback) onSuccessCallback(); // dışarıdan parametre olarak bir fonksiyon gelmişse, rezervasyon kaydı başarıyla tamamlandığında onu çalıştırır.
        },
        onError: (error) =>  {
            const errorMsg = error.response?.data?.detail || error.response?.data?.non_field_errors?.[0] || 'Kayıt sırasında bir hata oluştu.';
            toast.error(`Kayıt Başarısız: ${errorMsg}`);
        }
    });
};

export const useReservationAction = () => {
    const queryClient = useQueryClient(); // TSQuery'nin hafıza merkezine bağlanır ci/co yapıldığında veriyi tazeler.

    const checkInMutation = useMutation({
        mutationFn: (id) => hotelService.checkInReservation(id),
        onSuccess: () => {
            // Hem panoyu hem de oda durumunu (OC) aynı anda tazele.
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['roomRack'] });
            toast.success('Misafir girişi (Check-in) başarıyla tamamlandı!');
        },
        onError: (error) => {
            const msg = error.response?.data?.detail || 'Check-in işlemi gerçekleştirilemedi.';
            toast.error(msg);
        }
    });

    const checkOutMutation = useMutation({
        mutationFn: (id) => hotelService.checkOutReservation(id),
        onSuccess: () => {
            // Hem panoyu hem de oda durumunu (VD) aynı anda tazele.
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['roomRack'] });
            toast.success('Misafirin çıkışı (Check-Out) başarıyla tamamlandı!');
        },
        onError: (error) => {
            const msg = error.response?.data?.detail || 'Check-out işlemi gerçekleştirilemedi.';
            toast.error(msg);
        }
    });

    return {
        checkIn: checkInMutation.mutate,
        isCheckingIn: checkInMutation.isPending,
        checkOut: checkOutMutation.mutate,
        isCheckingOut: checkOutMutation.isPending,
    };
};