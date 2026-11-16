/**
 * Operasyon Panosu (Dashboard)
 * Otelcilik PMS standardına uygun 8 sekmeli veri yönetim ekranı.
 * SoC Prensibi: Yalnızca arayüz (UI) state'ini ve bileşen orkestrasyonunu yönetir.
 */

import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import NewReservationModal from '../components/dashboard/NewReservationModal';
import ReservationTable from '../components/dashboard/ReservationTable';
import ReservationCardModal from '../components/dashboard/ReservationCardModal';
import { 
  useDashboardReservations, useDashboardArrivals, useDashboardArrivedToday,
  useDashboardInHouse, useDashboardDepartures, useDashboardCheckedOut,
  useDashboardCancelled, useDashboardAllRecords, useNightAudit, useSystemDate
} from '../hooks/useHotelData';
import {
  LogIn, LogOut, Users, RefreshCw, Plus, CalendarDays,
  Calendar, History, Ban, Database, CheckSquare, MoonStar, AlertTriangle
} from 'lucide-react';
import { formatDate } from '../utils/formatters';

const Dashboard = () => {
  // ==========================================
  // 1. YEREL DURUM (LOCAL STATE)
  // ==========================================
  const [activeTab, setActiveTab] = useState('arrivals');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Çift tıklanan rezervasyon ve modal state'i
  const [selectedReservationId, setSelectedReservationId] = useState(null);
  const [isReservationCardOpen, setIsReservationCardOpen] = useState(false);

  const { data: systemDate, isLoading: isDateLoading } = useSystemDate();

  // ==========================================
  // 2. SUNUCU VERİLERİ (TANSTACK QUERY)
  // ==========================================
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

  const { mutate: runNightAudit, isPending: isAuditPending } = useNightAudit();
  const activeData = queries[activeTab] || queries.arrivals;
  const isSyncing = Object.values(queries).some(q => q.isFetching);

  // ==========================================
  // 3. TÜRETİLMİŞ DURUM (DERIVED STATE)
  // ==========================================
  // Arka plan sorguları yenilendiğinde açık karttaki verinin bayatlamasını önler
  const selectedReservation = useMemo(() => {
    if (!selectedReservationId || !activeData?.data) return null;
    const list = Array.isArray(activeData.data) ? activeData.data : activeData.data.results || [];
    return list.find((r) => r.id === selectedReservationId) || null;
  }, [selectedReservationId, activeData]);

  // ==========================================
  // 4. SEKME YAPILANDIRMASI (8 PMS SEKMESİ)
  // ==========================================
  const tabs = [
    { id: 'reservations', label: 'Bekleyenler', icon: CalendarDays, data: queries.reservations, baseColor: 'text-indigo-600', activeClass: 'bg-indigo-50 border-indigo-400 text-indigo-800' },
    { id: 'arrivals', label: 'Bugün Gelecekler', icon: LogIn, data: queries.arrivals, baseColor: 'text-emerald-600', activeClass: 'bg-emerald-50 border-emerald-400 text-emerald-800' },
    { id: 'arrivedToday', label: 'Gerçekleşen Girişler', icon: CheckSquare, data: queries.arrivedToday, baseColor: 'text-teal-600', activeClass: 'bg-teal-50 border-teal-400 text-teal-800' },
    { id: 'inHouse', label: 'Konaklayanlar', icon: Users, data: queries.inHouse, baseColor: 'text-blue-600', activeClass: 'bg-blue-50 border-blue-400 text-blue-800' },
    { id: 'departures', label: 'Beklenen Çıkışlar', icon: LogOut, data: queries.departures, baseColor: 'text-amber-600', activeClass: 'bg-amber-50 border-amber-400 text-amber-800' },
    { id: 'checkedOut', label: 'Ayrılanlar', icon: History, data: queries.checkedOut, baseColor: 'text-slate-600', activeClass: 'bg-slate-50 border-slate-400 text-slate-800' },
    { id: 'cancelled', label: 'İptal / No-Show', icon: Ban, data: queries.cancelled, baseColor: 'text-rose-600', activeClass: 'bg-rose-50 border-rose-400 text-rose-800' },
    { id: 'allRecords', label: 'Tüm Kayıtlar', icon: Database, data: queries.allRecords, baseColor: 'text-slate-400', activeClass: 'bg-slate-100 border-slate-300 text-slate-700' }
  ];

  // ==========================================
  // 5. AKSİYON İŞLEYİCİLER (HANDLERS)
  // ==========================================
  const handleNightAudit = () => {
    if (isAuditPending) return;

    toast.custom(
      (t) => (
        <div
          className={`max-w-md w-full bg-white shadow-2xl rounded-2xl pointer-events-auto border border-slate-200 overflow-hidden transition-all duration-200 ${
            t.visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95'
          }`}
        >
          <div className="p-4 flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 shrink-0">
              <AlertTriangle size={20} />
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-800">
                  Gün Sonu (Night Audit) Onayı
                </h3>
                {systemDate && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    {formatDate(systemDate)}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Dünden kalan gelmemiş misafirler <strong className="text-rose-600">No-Show</strong> olarak işaretlenecek ve sistem günü bir sonraki güne atlayacaktır. Onaylıyor musunuz?
              </p>
            </div>
          </div>

          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-lg transition cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id);
                runNightAudit();
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-sm transition cursor-pointer"
            >
              <MoonStar size={14} />
              Onayla ve Başlat
            </button>
          </div>
        </div>
      ),
      {
        id: 'night-audit-confirm', // Aynı anda birden fazla onay kutusu açılmasını engeller
        duration: Infinity,         // Kullanıcı karar verene kadar ekranda kalır
        position: 'top-center',
      }
    );
  };

  const handleRowDoubleClick = (reservation) => {
    setSelectedReservationId(reservation.id);
    setIsReservationCardOpen(true);
  };
  
  // ==========================================
  // 6. EKRAN ÇİZİMİ (RENDER)
  // ==========================================
  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* 6.1 Üst Bilgi (Header) ve Butonlar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Operasyon Panosu</h2>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-slate-500">Günlük Resepsiyon Akışı</p>
            {isSyncing && (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                <RefreshCw size={12} className="animate-spin" /> Eşitleniyor...
              </span>
            )}
          </div>
        </div>
      
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-700 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-inner">
            <Calendar size={15} className="text-blue-600" />
            <span className="text-slate-500">Sistem Günü:</span>
            <span className="font-bold text-slate-900">
              {isDateLoading ? 'Yükleniyor...' : (systemDate ? formatDate(systemDate) : 'Belirsiz')}
            </span>
          </div>

          <button
            onClick={handleNightAudit}
            disabled={isAuditPending}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm transition cursor-pointer"
          >
            {isAuditPending ? <RefreshCw size={18} className="animate-spin" /> : <MoonStar size={18} />}
            Gün Sonu Yap
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm transition cursor-pointer"
          >
            <Plus size={18} /> Yeni Rezervasyon
          </button>
        </div>
      </div>

      {/* 6.2 Sekmeler (8 Kolonlu Grid) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const listCount = tab.data?.data?.length || 0;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left cursor-pointer ${
                isActive
                  ? tab.activeClass
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-white shadow-sm ${tab.baseColor}`}>
                  <Icon size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <span className={`text-[11px] font-bold uppercase tracking-wider block mb-0.5 ${isActive ? tab.baseColor : 'text-slate-400'}`}>
                    {tab.label}
                  </span>
                  <span className="text-xl font-black">
                    {listCount}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 6.3 Tablo Bileşeni */}
      <ReservationTable
        data={activeData?.data}
        type={activeTab}
        isLoading={activeData?.isLoading}
        onRowDoubleClick={handleRowDoubleClick}
      />

      {/* 6.4 Yeni Rezervasyon Modalı */}
      <NewReservationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* 6.5 Rezervasyon Kartı Modalı */}
      {selectedReservation && (
        <ReservationCardModal
          isOpen={isReservationCardOpen}
          onClose={() => {
            setIsReservationCardOpen(false);
            setSelectedReservationId(null);
          }}
          reservationData={selectedReservation}
        />
      )}
    </div>
  );
};

export default Dashboard;