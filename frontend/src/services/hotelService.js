/**
 * API Soyutlama (Abstraction Katmanı)
 * React bileşenlerinin doğrudan Axios/Fetch çağrılarıyla ve URL dizgileriyle
 * uğraşmasını engeller. DRF ile React arasında köprü görevi görür.
 * 
 * SoC & DRY: Dashboard, Roomrack vb yanlızca veriyi görselleştirir.
 * ENDPoint URL'i değiştiğinde sadece bu servisi güncellemek yeterli olur.
 */

import api from './api';

export const hotelService = {
    // Room Rack BFF Ucu (Faz 5.3'te yazılan endpoint.)
    getRoomRack: async () => {
        const response = await api.get('rooms/rack/');
        return response.data;
    },

    // Dashboard Operasyon Uçları (Faz 4.2'de yazdığımız endpoint'ler.)
    getArrivals: async () => {
        const response = await api.get('reservations/dashboard/arrivals/');
        return response.data.results || response.data;
    },

    getDepartures: async () => {
        const response = await api.get('reservations/dashboard/departures/');
        return response.data.results || response.data;
    },

    getInHouse: async () => {
        const response = await api.get('reservations/dashboard/in-house/');
        return response.data.results || response.data;
    }
};