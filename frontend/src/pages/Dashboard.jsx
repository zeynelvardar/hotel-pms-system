/**
 * Ön Büro Operasyon Dashboardu Ana Bileşeni (Dashboard)
 * 
 * Sorumlulukları:
 * 1. Resepsiyon operasyonel sekmelerinin (Gelecekler, Konaklayanlar, Ayrılanlar vb.) merkezi yönetimi.
 * 2. TanStack Query kancaları ile eşzamanlı veri çekme ve otomatik arka plan senkronizasyonu.
 * 3. Gün sonu (Night Audit) işlemlerini onay mekanizmasıyla tetikleme.
 * 4. Yeni Rezervasyon Modalı ve Satır Çift Tıklama (Double Click) ile Rezervasyon Kartı orkestrasyonu.
 */

// ============================================================================
// 1. İÇE AKTARIMLAR (IMPORTS)
// ============================================================================
// React çekirdek kancaları
import { useState } from 'react';

// Alt Bileşenler (Components & Modals)
import NewReservationModal from '../components/dashboard/NewReservationModal';
import ReservationTable from '../components/dashboard/ReservationTable';
import ReservationCardModal from '../components/dashboard/reservationCardModal';
// Otel verisi ve mutasyon kancaları (TanStack Query)
import { 
  useDashboardReservations, 
  useDashboardArrivals, 
  useDashboardArrivedToday,
  useDashboardInHouse, 
  useDashboardDepartures, 
  useDashboardCheckedOut,
  useDashboardCancelled, 
  useDashboardAllRecords, 
  useNightAudit, 
  useSystemDate 
} from '../hooks/useHotelData';

// UI İkonları
import {
  LogIn, 
  LogOut, 
  Users, 
  RefreshCw, 
  Plus, 
  CalendarDays,
  Calendar, 
  History, 
  Ban, 
  Database, 
  CheckSquare, 
  MoonStar
} from 'lucide-react';

// Yardımcı biçimlendiriciler
import { formatDate } from '../utils/formatters';

// ============================================================================
// 2. ANA BİLEŞEN (COMPONENT)
// ============================================================================
const Dashboard = () => {
  // --------------------------------------------------------------------------
  // 2.1. YEREL DURUMLAR (LOCAL STATES)
  // --------------------------------------------------------------------------
  // Aktif seçili sekme kimliği (Default: 'arrivals' - Bugün Gelecekler)
  const [activeTab, setActiveTab] = useState('arrivals');
  
  // Hızlı Yeni Rezervasyon Modalının açık/kapalı durumu
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Rezervasyon Detay Kartı Modalı için seçilen rezervasyon nesnesi ve modal açık/kapalı durumu
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [isReservationCardOpen, setIsReservationCardOpen] = useState(false);

  // --------------------------------------------------------------------------
  // 2.2. SUNUCU DURUMLARI VE SORGULAR (SERVER HOOKS / REACT QUERY)
  // --------------------------------------------------------------------------
  // Otelin aktif operasyon günü ve yüklenme durumu
  const { data: systemDate, isLoading, isDateLoading } = useSystemDate();

  // Tüm operasyonel sekmelerin verilerini eşzamanlı çeken sorgu havuzu
  const queries = {
    reservations: useDashboardReservations(),
    arrivals: useDashboardArrivals(),
    arrivedToday: useDashboardArrivedToday(),
    inHouse: useDashboardInHouse(),
    departures: useDashboardDepartures(),
    checkedOut: useDashboardCheckedOut(),
    cancelled: useDashboardCancelled(),
    allRecords: useDashboardAllRecords()
  };

  // Gün Sonu (Night Audit) operasyonunu tetikleyen mutasyon kancası
  const { mutate: runNightAudit, isPending: isAuditPending } = useNightAudit();

  // Aktif seçili sekmenin sorgu verisi (Bulamazsa güvenli geri dönüş olarak arrivals alır)
  const activeData = queries[activeTab] || queries.arrivals;

  // Herhangi bir sekme arka planda veri tazeliyor mu kontrolü (Arka plan senkronizasyon göstergesi için)
  const isSyncing = Object.values(queries).some(q => q.isFetching);

  // --------------------------------------------------------------------------
  // 2.3. SEKME YAPILANDIRMASI (TABS CONFIGURATION)
  // --------------------------------------------------------------------------
  // Arayüzdeki sekmelerin meta verileri, bağlı sorguları ve renk kodları
  const tabs = [
    { id: 'reservations', label: 'Bekleyenler', icon: CalendarDays, data: queries.reservations, baseColor: 'text-indigo-600', activeClass: 'bg-indigo-50 border-indigo-400 text-indigo-800'},
    { id: 'arrivals', label: 'Bugün Gelecekler', icon: LogIn, data: queries.arrivals, baseColor: 'text-emerald-600', activeClass: 'bg-emerald-50 border-emerald-400 text-emerald-800' },
    { id: 'arrivedToday', label: 'Gerçekleşen Girişler', icon: CheckSquare, data: queries.arrivedToday, baseColor: 'text-teal-600', activeClass: 'bg-teal-50 border-teal-400 text-teal-800' },
    { id: 'inHouse', label: 'Konaklayanlar', icon: Users, data: queries.inHouse, baseColor: 'text-blue-600', activeClass: 'bg-blue-50 border-blue-400 text-blue-800' },
    { id: 'departures', label: 'Beklenen Çıkışlar', icon: LogOut, data: queries.departures, baseColor: 'text-amber-600', activeClass: 'bg-amber-50 border-amber-400 text-amber-800' },
    { id: 'checkedOut', label: 'Ayrılanlar', icon: History, data: queries.checkedOut, baseColor: 'text-slate-600', activeClass: 'bg-slate-50 border-slate-400 text-slate-800' },
    { id: 'cancelled', label: 'İptal / No-Show', icon: Ban, data: queries.cancelled, baseColor: 'text-rose-600', activeClass: 'bg-rose-50 border-rose-400 text-rose-800' },
    { id: 'allRecords', label: 'Tüm Kayıtlar', icon: Database, data: queries.allRecords, baseColor: 'text-slate-400', activeClass: 'bg-slate-100 border-slate-300 text-slate-700'}
  ];

  // --------------------------------------------------------------------------
  // 2.4. OLAY İŞLEYİCİLERİ VE EYLEMLER (HANDLERS)
  // --------------------------------------------------------------------------
  
  // Gün Sonu (Night Audit) operasyonunu güvenlik teyidi ile başlatır
  const handleNightAudit = () => {
    const isConfirmed = window.confirm(
      "DİKKAT: Gün Sonu (Night Audit) işlemi başlatılacak. Dünden kalan gelmemiş misafirler No-Show olarak işaretlenecek ve sistem günü bir sonraki güne atlayacaktır. Onaylıyor musunuz?"
    );
    if (isConfirmed) runNightAudit();
  };

  // Tablodaki herhangi bir rezervasyon satırına çift tıklandığında detay kartını açar
  const handleRowDoubleClick = (reservation) => {
    setSelectedReservation(reservation);
    setIsReservationCardOpen(true);
  };
  
  // ==========================================================================
  // 3. ARAYÜZ ÇİZİMİ (JSX RENDER)
  // ==========================================================================
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ... (Üst Header ve Tabs Kısmı Aynen Kalacak) ... */}

      {/* 3.1. Ana Tablo Bileşeni (Seçili sekmenin verisini listeler ve çift tıklamayı dinler) */}
      <ReservationTable
        data={activeData?.data?.data || activeData?.data}
        type={activeTab}
        isLoading={activeData.isLoading}
        onRowDoubleClick={handleRowDoubleClick} // Tablodan gelen çift tıklama olayını yakalar
      />

      {/* 3.2. Yeni Rezervasyon Oluşturma Modalı */}
      <NewReservationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* 3.3. Rezervasyon Detay Kartı Modalı (Sadece seçili bir rezervasyon varsa DOM'a basılır) */}
      {selectedReservation && (
          <ReservationCardModal
              isOpen={isReservationCardOpen}
              onClose={() => setIsReservationCardOpen(false)}
              reservationData={selectedReservation} // Tıklanan satırın tüm verisi detay kartına aktarılır
          />
      )}
    </div>
  );
};

export default Dashboard;