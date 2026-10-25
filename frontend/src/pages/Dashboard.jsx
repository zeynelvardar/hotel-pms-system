/**
 * Operasyon Panosu (Dashboard)
 * Otelcilik PMS standardına uygun 8 sekmeli veri yönetim ekranı.
 * SoC Prensibi: Yalnızca arayüz (UI) state'ini ve bileşen orkestrasyonunu yönetir.
 */

// ==========================================
// 1. İÇE AKTARIMLAR (IMPORTS)
// ==========================================
import { useState, useMemo } from 'react';
import NewReservationModal from '../components/dashboard/NewReservationModal';
import ReservationTable from '../components/dashboard/ReservationTable';
import { 
  useDashboardReservations, useDashboardArrivals, useDashboardArrivedToday,
  useDashboardInHouse, useDashboardDepartures, useDashboardCheckedOut,
  useDashboardCancelled, useDashboardAllRecords, useNightAudit, useSystemDate
} from '../hooks/useHotelData';
import {
  LogIn, LogOut, Users, RefreshCw, Plus, CalendarDays,
  Calendar, History, Ban, Database, CheckSquare, MoonStar
} from 'lucide-react';
import { formatDate } from '../utils/formatters';



const Dashboard = () => {
  // ==========================================
  // 2. YEREL DURUM (LOCAL STATE) YÖNETİMİ
  // ==========================================
  // buradaki state yönetimi mimarisi: aşağıda setActiveTab kullanıldığında ve parametre olarak tab.id verildiğinde setActiveTab içindeki fonksiyon bu değeri activeTab'e yazar ve useState ekranı günceller.
  const [activeTab, setActiveTab] = useState('arrivals'); // kullanıcının şu an hangi sekmeye tıkladığını ve ekranda hangi listeyi gördüğünü takip eder. default: arrivals.
  const [isModalOpen, setIsModalOpen] = useState(false); // dashboard'un default olacak kapalı olacağı yani ekrana basılmayacağı ayarlanır. isModelOpen: modal açık mı kapalı mı onun verisini tutar / setIsModalOpen: bunu değiştiren özel bir fonksiyontur. true/false.
  const { data: systemDate, isLoading, isDateLoading } = useSystemDate(); // useSystemDate() custom hook'unu ihtiyaç olan verilere göre getirir.

  // ==========================================
  // 3. SUNUCU VERİLERİ (TANSTACK QUERY HOOKS)
  // ==========================================
  const queries = { // daha sonra dinamik olarak çağırmak için TS Query hookları dict yapısında key value değerlerine atıyoruz.
    reservations: useDashboardReservations(),
    arrivals: useDashboardArrivals(),
    arrivedToday: useDashboardArrivedToday(),
    inHouse: useDashboardInHouse(),
    departures: useDashboardDepartures(),
    checkedOut: useDashboardCheckedOut(),
    cancelled: useDashboardCancelled(),
    allRecords: useDashboardAllRecords()
  };

  // Night Audit (Gün Sonu) Hook'u
  const { mutate: runNightAudit, isPending: isAuditPending } = useNightAudit(); // burada object destructuring yapılır, useNightAudit() hook'undan gelen tüm veriler yerine sadece; mutate (günü kapatma için istek atan) fonksiyonu alınır, runNightAudit adıyla paketlenir. / isPending: işlemin gerçekleşiği an true bittiği an false verir, react bileşeninde yükleme iconunu takiben kullanılır.
  
  // ==========================================
  // 4. VERİ SEÇİMİ VE HESAPLAMALAR (MEMOIZATION)
  // ==========================================
  // Hangi sekme seçiliyse o sekmenin verisini cache'den alır.
  const activeData = queries[activeTab] || queries.arrivals;

  // Arka planda herhangi bir sorgu yenileniyorsa True döner.
  const isSyncing = Object.values(queries).some(q => q.isFetching); // Object.values(queries): 8 sorguyu array yaptık, IsFetching: istek atılıyor mu kontrol ettik

  // ==========================================
  // 5. ARAYÜZ YAPILANDIRMASI (UI CONFIGURATION)
  // ==========================================
  const tabs = [ // array of objects (nesne dizisi) denir.
    { id: 'reservations', label: 'Bekleyenler', icon: CalendarDays, data: queries.reservations, baseColor: 'text-indigo-600', activeClass: 'bg-indigo-50 border-indigo-400 text-indigo-800'},
    { id: 'arrivals', label: 'Bugün Gelecekler', icon: LogIn, data: queries.arrivals, baseColor: 'text-emerald-600', activeClass: 'bg-emerald-50 border-emerald-400 text-emerald-800' },
    { id: 'arrivedToday', label: 'Gerçekleşen Girişler', icon: CheckSquare, data: queries.arrivedToday, baseColor: 'text-teal-600', activeClass: 'bg-teal-50 border-teal-400 text-teal-800' },
    { id: 'inHouse', label: 'Konaklayanlar', icon: Users, data: queries.inHouse, baseColor: 'text-blue-600', activeClass: 'bg-blue-50 border-blue-400 text-blue-800' },
    { id: 'departures', label: 'Beklenen Çıkışlar', icon: LogOut, data: queries.departures, baseColor: 'text-amber-600', activeClass: 'bg-amber-50 border-amber-400 text-amber-800' },
    { id: 'checkedOut', label: 'Ayrılanlar', icon: History, data: queries.checkedOut, baseColor: 'text-slate-600', activeClass: 'bg-slate-50 border-slate-400 text-slate-800' },
    { id: 'cancelled', label: 'İptal / No-Show', icon: Ban, data: queries.cancelled, baseColor: 'text-rose-600', activeClass: 'bg-rose-50 border-rose-400 text-rose-800' },
    { id: 'allRecords', label: 'Tüm Kayıtlar', icon: Database, data: queries.allRecords, baseColor: 'text-slate-400', activeClass: 'bg-slate-100 border-slate-300 text-slate-700'}
  ];

  // ==========================================
  // 6. AKSİYON İŞLEYİCİLER (HANDLERS)
  // ==========================================
  const handleNightAudit = () => { // gün sonu işlemi için pencere açılır, onay verilirse gün sonu yapılır.
    const isConfirmed = window.confirm("DİKKAT: Gün Sonu (Night Audit) işlemi başlatılacak. Dünden kalan gelmemiş misafirler No-Show olarak işaretlenecek ve sistem günü bir sonraki güne atlayacaktır. Onaylıyor musunuz?");
    if (isConfirmed) {
      runNightAudit();
    }
  };
  
  // ==========================================
  // 7. EKRAN ÇİZİMİ (RENDER / JSX)
  // ==========================================
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 7.1 Üst Bilgi (Header) ve Butonlar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Operasyon Panosu</h2>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-slate-500">Günlük Resepsiyon Akışı</p>
            {isSyncing && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                <RefreshCw size={12} className="animate-spin" /> Eşitleniyor...
              </span>
            )}
          </div>
        </div>
      
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleNightAudit}
            disabled={isAuditPending}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm transition"
          >
            {isAuditPending ? <RefreshCw size={18} className="animate-spin" /> : <MoonStar size={18} />}
            Gün Sonu Yap
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm transition"
          >
            <Plus size={18} /> Yeni Rezervasyon
          </button>
        </div>
      </div>

      {/* 7.2 Sekmeler (Tab Vards - 4 Kolonlu Grid) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tabs.map((tab) => { // tabs listesinin döngüsü başlatılır. (ekrana dinamik olarak basabilmek için.)
          const Icon = tab.icon; // tab listesindeki ikon bileşenini alır ve Icon değişkenine atar (Böylece JSX içinde <Icon /> şeklinde dinamik olarak ekrana basılabilir.)
          const isActive = activeTab === tab.id; // kullanıcının o an tıkladığı sekme (activeTab) ile döngüdeki butonun ID'sini (tab.id) karşılaştırır. true/false döner; butonun seçili olup olmadığı anlaşılır.
          const listCount = tab.data?.data?.length || 0;  // döngüdeki sekmenin içindeki kayıt sayısını alır, yoksa 0 döner.
          
          return(
            <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
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

      {/* 7.3 Alt Bileşenler (Tablo ve Modal) */}
      <ReservationTable
      data={activeData?.data?.data || activeData?.data}
      type={activeTab}
      isLoading={activeData.isLoading}
      />

      <NewReservationModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export default Dashboard;
