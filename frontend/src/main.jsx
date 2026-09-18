/**
 * main.jsx : React'ın giriş noktasıdır, tarayıcının index.html 
 * içinde sunduğu gerçek DOM (#root) yakalar;
 * React motorunu, veri/cache mimarisini ve stil katmanını çalıştırıp,
 * kök bileşen <App/>'i ekrana basar.
 */

import React from 'react';
import ReactDOM from 'react-dom/client'; // React'ın DOM işletme motoru
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // Cache, istek kuyruklarını yönetir.
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'; // Cache/istek yönetimi araçları
import App from './App.jsx'
import './index.css'

// Global Caching Stratejisi
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // Veriler 1 dakika taze kabul edilir.
      gcTime: 1000 * 60 * 5, // Kullanılmayan veriler 5 dk içinde çöpe atılır.
      refetchOnWindowFocus: true, // resepsiyonist pencereye döndüğünde veriyi tazele.
      retry: 1, // hata olursa 1 kez daha dene.
    },
  },
});


ReactDOM.createRoot(document.getElementById('root')).render( // index.html dosyasını alıp DOM'a çevirir. 
  <React.StrictMode /*bileşeni render eder - temizler- 2. kez render ederek yan etki ve sızıntıları test eder.*/>
    <QueryClientProvider client={queryClient}>
      <App />
      {/*Geliştirme aşamasını cache'i izlemek için sağ altta bir ikon çıkarır*/}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);