/**
 * API Soyutlama (Abstraction Katmanı)
 * React bileşenlerinin doğrudan Axios/Fetch çağrılarıyla ve URL dizgileriyle
 * uğraşmasını engeller. DRF ile React arasında köprü görevi görür.
 * 
 * SoC & DRY: Dashboard, Roomrack vb yanlızca veriyi görselleştirir.
 * ENDPoint URL'i değiştiğinde sadece bu servisi güncellemek yeterli olur.
 */

import api from './api';  // access token ve refresh token dosyası

// DRY Prensibi: DRF'in Pagination yapısından veriyi çıkartan yardımcı fonkisyon
const extractData = (response) => response.data.results || response.data // backend'gen gelen cevabı alır, ayıklar ve React bileşenine teslim eder. (aşağıda istek atıldıktan sonra gelen veri bu fonkisyona parametre olarak (response) verilir.)

export const hotelService = { // büyük bir nesne
    // ==========================================
    // 1. ODA VE RACK OPERASYONLARI
    // ==========================================

    getRoomRack: async () => {  // key : value / getRoomRack : fonksiyon.
        const response = await api.get('rooms/rack/'); // istek atılır
        return response.data;  // ilgili react bileşenine veriyi döner
    },

    getAvailableRooms: async (checkIn, checkOut) => { // giriş çıkış tarihine göre müsait odaları listeyen uç
        const response = await api.get('rooms/available/', {
            params: { check_in: checkIn, check_out: checkOut } // giriş çıkış tarihlerine sunucuya istek atar.
        });
        return response.data;
    },

    changeRoomStatus: async (roomId, status) => {
        const response = await api.patch(`rooms/${roomId}/change-status/`, { status });
        return response.data;
    },

    // ==========================================
    // 2. DASHBOARD OPERASYON PANOSU UÇLARI (Sistem Gününe Bağlı)
    // ==========================================
    
    getReservationsList: async () => extractData(await api.get('reservations/dashboard/reservations/')),
    getArrivals: async () => extractData(await api.get('reservations/dashboard/arrivals/')),
    getArrived: async () => extractData(await api.get('reservations/dashboard/arrived-today/')),
    getInHouse: async () => extractData(await api.get('reservations/dashboard/in-house/')),
    getDepartures: async () => extractData(await api.get('reservations/dashboard/departures/')), // bugün ayrılacakar.
    getCheckedOut: async () => extractData(await api.get('reservations/dashboard/checked-out/')),
    getCancelled: async () => extractData(await api.get('reservations/dashboard/cancelled/')),
    getAllRecords: async () => extractData(await api.get('reservations/dashboard/all-records/')),

    // ==========================================
    // 3. REZERVASYON AKSİYON UÇLARI (RPC)
    // ==========================================

    createReservation: async (reservationData) => {
        const response = await api.post(`reservations/`, reservationData);
        return response.data;
    },

    checkInReservation: async (reservationId) => {
        const response = await api.post(`reservations/${reservationId}/check-in/`);
        return response.data;
    },

    checkOutReservation: async (reservationId) => {
        const response = await api.post(`reservations/${reservationId}/check-out/`);
        return response.data;
    },

    // ==========================================
    // 4. OTEL SİSTEM AKSİYONLARI
    // ==========================================
    getSystemDate: async () => {
        const response = await api.get('reservations/system-date/');
        return response.data.system_date;
    },


    triggerNightAudit: async () => {
        const response = await api.post(`reservations/night-audit/`);
        return response.data;
    }
};    