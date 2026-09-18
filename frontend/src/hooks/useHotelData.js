/**
 * useHotelData.js: hotelService.js ile arayüz bileşenlerinin (RoomRack, Dashboard.jsx)
 * arasına yerleşir. Verileri servis dosyasından Cache'e alarak hızlı arayüz
 * kullanımını sağlar.
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

import { useQuery } from '@tanstack/react-query'; //veri okuma (GET isteği)
import { hotelService } from '../services/hotelService';

// Room Rack verisini çeken ve arka planda güncelleyen hook
export const useRoomRack = () => {
    return useQuery({
        queryKey: ['roomRack'], // benzersiz ön bellek anahtarı.
        queryFn: hotelService.getRoomRack, // query fonksiyonu: hotelService içindeki endpoint'e gider.
        refetchInterval: 100 * 60, // 60 saniyede bir rack ekranını günceller.
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
