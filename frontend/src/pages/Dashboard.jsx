/**
 * Operasyonel kararlar, veri akışı, ekran geçişleri buradan yönetilir.
 * 
 * State ve Sekme Yönetimi: Resepsiyonistin ekranda hangi listeye (Arrival-Departure-inHouse)
 * hafızasında tutar.
 * 
 * Veri Çekme & Cache (TSQuery Custom Hooks): DRF backendine HTTP istekleri atar.
 * 
 * 
 * Dinamik Veri Seçimi (useMemo): Resepsiyonist hangi sekmeye tıkladıysa (activeTab)
 * o sekmenin sorgu paketini (activeData) koyar. 
 * 
 */

import NewReservationModal from '../components/dashboard/NewReservationModal';
import { useState, useMemo } from 'react' // useMemo: maliyetli bir hesaplama sonucunu cache'de tutmaya yarayan RH.
import { useDashBoardArrivals, useDashBoardDepartures, useDashBoardInHouse } from '../hooks/useHotelData';
import ReservationTable from '../components/dashboard/ReservationTable';
import { LogIn, LogOut, Users, RefreshCw, Plus } from 'lucide-react';

const Dashboard = () => { // state (durum kutusu) kurulur, React hafızaya bakar ve 
  const [activeTab, setActiveTab] = useState('arrivals'); // kutunun ilk değerini arrivals olarak ayarlar // İlk gelen sayfa arrivals listesi olur.
  const [isModalOpen, setIsModalOpen] = useState(false); // Modal State'i

  // Tanstack Query ile tüm verileri paralel çek (otomatik deduping ve caching yapar.)
  const arrivalsQuery = useDashBoardArrivals(); // arrivals cache'e alınır.
  const departuresQuery = useDashBoardDepartures(); // ayrılanlar cache'e alınır.
  const inHouseQuery = useDashBoardInHouse(); // inHouse cache'e alınır.

  // Aktif sekmeye göre veriyi ve durumları belirle (useMemo ile optimize edildi)
  const activeData = useMemo(() => { // maliyetli hesaplamanın sonucunu cache'de tut
    if (activeTab === 'arrivals') return arrivalsQuery; // aktif sekme arrivals
    if (activeTab === 'departures') return departuresQuery; // aktif sekme ayrılanlar
    return inHouseQuery; // veya inHouse.
  }, [activeTab, arrivalsQuery, departuresQuery, inHouseQuery]); // useMemo bunları izler, değişiklik olursa hafızay kaydeder.

  const isSyncing = arrivalsQuery.isFetching || departuresQuery.isFetching || inHouseQuery.isFetching; // 3 sorgunun arka planda tazelenip tazelenmediğini kontrol eder.

  const tabs = [ // "Data-Driven UI" (Veri Güdümlü Arayüz, kodun devamında bu dizi .map() döngüsüne sokulur
    {
      id: 'arrivals',
      label: 'Bugün Gelecekler',
      icon: LogIn,
      count: arrivalsQuery.data?.length || 0, // arrival listesinin uzunluğunu döner
      baseColor: 'text-emerald-600',
      activeClass: 'bg-emerald-50 border-emerald-400 text-emerald-800'
    },
    {
      id: 'departures',
      label: 'Bugün Ayrılacaklar',
      icon: LogOut,
      count: departuresQuery.data?.length || 0,
      baseColor: 'text-rose-600',
      activeClass: 'bg-rose-50 border-rose-400 text-rose-800',
    },
    {
      id: 'inHouse',
      label: 'Konaklayanlar',
      icon: Users,
      count: inHouseQuery.data?.length || 0,
      baseColor: 'text-blue-600',
      activeClass: 'bg-blue-50 border-blue-400 text-blue-800'
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* Header Alanı */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Operasyon Panosu</h2>
          <p className="text-sm text-slate-500 mt-0.5">Günlük resepsiyon akışı ve hızlı işlemler</p>
        </div>
        
        <div className="flex items-center gap-3">
          {isSyncing && (
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
              <RefreshCw size={14} className="animate-spin" /> Arka planda eşitleniyor...
            </div>
          )}

          {/* Yeni Rezervasyon Butonu */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition"
          >
            <Plus size={18} /> Yeni Rezervasyon
          </button>
        </div>
      </div>
      
      {/* Sekmeler (Tab Cards) maps'den itibaren kod döngü olarak çalışır.*/} 
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {tabs.map((tab) => { // tabloları döngüye sokar (arrivals-departure-inHouse)
          const Icon = tab.icon; // iconu çeker 
          const isActive = activeTab === tab.id; // seçili olan sekmenin durumunu true/false olarak kontrol eden bayrak

          return (
            <button
              key={tab.id} // tablonun id sini alır (arrivals-departures-inHouse)
              onClick={() => setActiveTab(tab.id)} // tıklanan kartın kimliğini (arrivals/departures/inHouse) state'e aktararak aktif sekmeyi günceller.
              className={`flex items-center justify-between p-5 rounded-xl border-2 transition-all text-left ${
                isActive // eğer kart seçiliyse
                  ? tab.activeClass  // seçili olan durumu (arrival-departure-inHouse) butonun rengini aşağıdaki gibi yapar
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600 hover:shadow-sm'
              }`}
            >   {/* seçili karta göre (arr-dep-inh) icon renderlanır. */}
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-lg bg-white shadow-sm ${tab.baseColor}`}> {/*burada base.color lucide iconuna miras kalır.*/}
                  <Icon size={24} strokeWidth={2.5} />                        
                </div>
                <div>
                  <span className={`text-xs font-bold uppercase tracking-wider block mb-0.5 ${isActive ? tab.baseColor : 'text-slate-400'}`}> {/*eğer kart seçiliyse base.color değilse slate400 rengi yapar.*/}
                    {tab.label} {/* başlık */}
                  </span>
                  <span className="text-2xl font-black">
                    {tab.count} {/* liste uzunluğu */}
                  </span>
                </div>
              </div>
            </button>       
          );
        })}
      </div>
      
      {/* Tablo Alanı */}
      <ReservationTable
        data={activeData.data}  // seçilen aktif sorgunun (arr,dep,ihouse) içindeki rezervasyon array'ini aktarır.
        type={activeTab} // hangi sekmenin açık olduğunu belirten metni aktarır.
        isLoading={activeData.isLoading} // seçili sorgunun henüz backend'den veri çekip çekmediğini bildiren true/false değerini aktarır.
      />

      {/* Yeni Rezervasyon Modal Bileşeni Çağrısı */}
      <NewReservationModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export default Dashboard;