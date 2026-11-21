/**
 * Doluluk Tahmini (Occupancy Forecast) Sayfası
 * Otelin dinamik oda kapasitesine (OOO dahil) ve seçili oda tipine göre
 * gün bazlı doluluk oranlarını çift eksenli grafik ve detay tablosu olarak sunar.
 */

import { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  Calendar,
  CalendarRange,
  BedDouble,
  TrendingUp,
  Flame,
  Layers,
  Filter,
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  Loader2,
  BarChart3,
} from 'lucide-react';
import {
  useOccupancyForecast,
  useRoomTypes,
  useSystemDate,
} from '../hooks/useHotelData';
import {
  getMonthBounds,
  addDaysISO,
  formatForecastDate,
} from '../utils/formatters';

// ==========================================
// 1. TEMA VE EŞİK KONFİGÜRASYONU (DRY)
// ==========================================

const PRESETS = [
  { key: 'currentMonth', label: 'Bu Ay' },
  { key: 'nextMonth', label: 'Gelecek Ay' },
  { key: 'next14Days', label: '14 Gün' },
  { key: 'next30Days', label: '30 Gün' },
];

// PMS Doluluk Eşik Renkleri (Tek Kaynak / Single Source of Truth)
const getOccupancyTheme = (rate) => {
  if (rate > 100) {
    return {
      label: 'Overbooking',
      barColor: '#be123c', // rose-700
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
      barBgClass: 'bg-rose-700',
    };
  }
  if (rate >= 80) {
    return {
      label: 'Yüksek',
      barColor: '#f43f5e', // rose-500
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      barBgClass: 'bg-rose-500',
    };
  }
  if (rate >= 50) {
    return {
      label: 'Orta',
      barColor: '#f59e0b', // amber-500
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      barBgClass: 'bg-amber-500',
    };
  }
  return {
    label: 'Müsait',
    barColor: '#10b981', // emerald-500
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    barBgClass: 'bg-emerald-500',
  };
};

// ==========================================
// 2. ALT BİLEŞENLER (ANA BİLEŞEN DIŞINDA - PERFORMANS)
// ==========================================

const ForecastTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;

  const day = payload[0].payload;
  const available = day.total_rooms - day.occupied_rooms;
  const theme = getOccupancyTheme(day.occupancy_rate);

  return (
    <div className="bg-slate-900/95 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[210px]">
      <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-slate-700/80">
        <span className="font-bold text-slate-100">{day.dateInfo.fullFormatted}</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Doluluk Oranı</span>
          <span className="font-black text-sm text-white">%{day.occupancy_rate.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Dolu Oda</span>
          <span className="font-bold text-blue-300">
            {day.occupied_rooms} / {day.total_rooms}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Satılabilir Boş Oda</span>
          <span className={`font-bold ${available < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {available < 0 ? `Overbooking (${Math.abs(available)})` : available}
          </span>
        </div>
        <div className="pt-1.5 mt-1 border-t border-slate-800 flex items-center justify-between">
          <span className="text-slate-400">Yoğunluk</span>
          <span className="font-bold uppercase tracking-wider text-[10px]" style={{ color: theme.barColor }}>
            {theme.label}
          </span>
        </div>
      </div>
    </div>
  );
};

const KpiCard = ({ title, value, subtext, icon: Icon, accentClass }) => (
  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between gap-3">
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
        {title}
      </p>
      <p className="text-2xl font-black text-slate-800 mt-1 truncate">{value}</p>
      {subtext && (
        <p className="text-xs font-medium text-slate-500 mt-1 truncate">{subtext}</p>
      )}
    </div>
    <div className={`p-2.5 rounded-xl shrink-0 ${accentClass}`}>
      <Icon size={20} strokeWidth={2.2} />
    </div>
  </div>
);

// ==========================================
// 3. ANA SAYFA BİLEŞENİ (MAIN COMPONENT)
// ==========================================

const Forecast = () => {
  const { data: systemDate, isLoading: isSystemDateLoading } = useSystemDate();
  const { data: roomTypes, isLoading: isRoomTypesLoading } = useRoomTypes();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState('');
  const [activePreset, setActivePreset] = useState('currentMonth');

  // Sistem günü geldiğinde varsayılan aralığı otel sistem ayının başı-sonu olarak sabitle
  useEffect(() => {
    if (systemDate && !startDate && !endDate) {
      const bounds = getMonthBounds(systemDate, 0);
      setStartDate(bounds.start);
      setEndDate(bounds.end);
    }
  }, [systemDate, startDate, endDate]);

  const isDateRangeInvalid = Boolean(startDate && endDate && startDate > endDate);

  const {
    data: rawForecast = [],
    isLoading: isForecastLoading,
    isFetching: isForecastFetching,
    isError,
    error,
    refetch,
  } = useOccupancyForecast(startDate, endDate, selectedRoomTypeId);

  // Grafik ve tablo için zenginleştirilmiş günlük kayıtlar (Single Pass Memo)
  const enrichedDays = useMemo(() => {
    if (!Array.isArray(rawForecast)) return [];
    return rawForecast.map((item) => ({
      ...item,
      available_rooms: item.total_rooms - item.occupied_rooms,
      dateInfo: formatForecastDate(item.date),
    }));
  }, [rawForecast]);

  // KPI Özet İstatistikleri (Backend'e ek sorgu atmadan mevcut seriden türetilir)
  const summaryStats = useMemo(() => {
    if (!enrichedDays.length) {
      return {
        avgOccupancy: 0,
        totalCapacity: 0,
        totalRoomNightsSold: 0,
        totalRoomNightsCapacity: 0,
        peakDay: null,
        overbookingDaysCount: 0,
      };
    }

    let totalSold = 0;
    let totalCapNights = 0;
    let peakDay = enrichedDays[0];
    let overbookingDaysCount = 0;

    for (const day of enrichedDays) {
      totalSold += day.occupied_rooms;
      totalCapNights += day.total_rooms;
      if (day.occupancy_rate > peakDay.occupancy_rate) {
        peakDay = day;
      }
      if (day.occupied_rooms > day.total_rooms) {
        overbookingDaysCount += 1;
      }
    }

    const avgOccupancy = totalCapNights > 0 ? (totalSold / totalCapNights) * 100 : 0;

    return {
      avgOccupancy,
      totalCapacity: enrichedDays[0].total_rooms,
      totalRoomNightsSold: totalSold,
      totalRoomNightsCapacity: totalCapNights,
      peakDay,
      overbookingDaysCount,
    };
  }, [enrichedDays]);

  // Grafik Y ekseni tavanı (Overbooking varsa %100'ün üzerine dinamik esner)
  const maxRateDomain = useMemo(() => {
    const peak = summaryStats.peakDay?.occupancy_rate || 0;
    return peak > 100 ? Math.ceil(peak / 10) * 10 : 100;
  }, [summaryStats.peakDay]);

  const selectedRoomTypeLabel = useMemo(() => {
    if (!selectedRoomTypeId || !roomTypes) return 'Tüm Otel (OOO Dahil)';
    const found = roomTypes.find((rt) => String(rt.id) === String(selectedRoomTypeId));
    return found ? `${found.name} (${found.code})` : 'Seçili Oda Tipi';
  }, [selectedRoomTypeId, roomTypes]);

  // ==========================================
  // 4. FİLTRE VE HIZLI ARALIK İŞLEYİCİLERİ
  // ==========================================

  const applyPreset = (presetKey) => {
    if (!systemDate) return;
    setActivePreset(presetKey);

    if (presetKey === 'currentMonth') {
      const { start, end } = getMonthBounds(systemDate, 0);
      setStartDate(start);
      setEndDate(end);
    } else if (presetKey === 'nextMonth') {
      const { start, end } = getMonthBounds(systemDate, 1);
      setStartDate(start);
      setEndDate(end);
    } else if (presetKey === 'next14Days') {
      setStartDate(systemDate);
      setEndDate(addDaysISO(systemDate, 13));
    } else if (presetKey === 'next30Days') {
      setStartDate(systemDate);
      setEndDate(addDaysISO(systemDate, 29));
    }
  };

  const handleManualDateChange = (field, value) => {
    setActivePreset('custom');
    if (field === 'start') setStartDate(value);
    if (field === 'end') setEndDate(value);
  };

  const handleResetFilters = () => {
    setSelectedRoomTypeId('');
    applyPreset('currentMonth');
  };

  const isInitialLoading = (isSystemDateLoading || isForecastLoading) && enrichedDays.length === 0;

  // ==========================================
  // 5. EKRAN ÇİZİMİ (RENDER)
  // ==========================================

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 5.1 ÜST BAŞLIK VE FİLTRE ÇUBUĞU */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-bold tracking-tight text-slate-800">
                Doluluk Tahmini (Forecast)
              </h2>
              {isForecastFetching && !isInitialLoading && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                  <RefreshCw size={12} className="animate-spin" /> Güncelleniyor...
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Kapsam: <strong className="text-slate-700">{selectedRoomTypeLabel}</strong>
              {systemDate && (
                <span className="ml-2 text-slate-400">
                  • Sistem Günü: {formatForecastDate(systemDate).tableDate}
                </span>
              )}
            </p>
          </div>

          {/* Hızlı Tarih Ön Ayarları */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPreset(preset.key)}
                disabled={!systemDate}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activePreset === preset.key
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Detaylı Filtreler: Başlangıç, Bitiş ve Oda Tipi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-slate-100 items-end">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Başlangıç Tarihi
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleManualDateChange('start', e.target.value)}
              className={`w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:bg-white focus:ring-2 ${
                isDateRangeInvalid
                  ? 'border-rose-400 focus:ring-rose-200'
                  : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'
              }`}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Bitiş Tarihi
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => handleManualDateChange('end', e.target.value)}
              className={`w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:bg-white focus:ring-2 ${
                isDateRangeInvalid
                  ? 'border-rose-400 focus:ring-rose-200'
                  : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'
              }`}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
              <Filter size={11} /> Oda Tipi Filtresi
            </label>
            <select
              value={selectedRoomTypeId}
              onChange={(e) => setSelectedRoomTypeId(e.target.value)}
              disabled={isRoomTypesLoading}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
            >
              <option value="">Tüm Oda Tipleri (Genel Otel)</option>
              {roomTypes?.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name} ({rt.code})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
            >
              <RotateCcw size={15} /> Filtreleri Sıfırla
            </button>
          </div>
        </div>

        {isDateRangeInvalid && (
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-3.5 py-2.5 rounded-lg">
            <AlertTriangle size={15} className="shrink-0" />
            Başlangıç tarihi, bitiş tarihinden büyük olamaz. Lütfen geçerli bir tarih aralığı seçin.
          </div>
        )}
      </div>

      {/* 5.2 OVERBOOKING UYARI ŞERİDİ (VARSA) */}
      {summaryStats.overbookingDaysCount > 0 && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-sm font-semibold">
          <AlertTriangle size={18} className="text-rose-600 shrink-0" />
          <span>
            Seçili aralıkta <strong>{summaryStats.overbookingDaysCount} gün</strong> için kapasite aşımı (Overbooking) tespit edildi. Lütfen blokaj havuzunu ve oda tipi dağılımını kontrol edin.
          </span>
        </div>
      )}

      {/* 5.3 KPI ÖZET KARTLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Ortalama Doluluk"
          value={`%${summaryStats.avgOccupancy.toFixed(1)}`}
          subtext={`${enrichedDays.length} günlük dönem ortalaması`}
          icon={TrendingUp}
          accentClass="bg-blue-50 text-blue-600"
        />
        <KpiCard
          title="Toplam Kapasite"
          value={`${summaryStats.totalCapacity} Oda`}
          subtext="Aktif fiziksel envanter (OOO dahil)"
          icon={BedDouble}
          accentClass="bg-slate-100 text-slate-700"
        />
        <KpiCard
          title="En Yoğun Gün (Pik)"
          value={
            summaryStats.peakDay
              ? `%${summaryStats.peakDay.occupancy_rate.toFixed(1)}`
              : '-'
          }
          subtext={
            summaryStats.peakDay
              ? `${summaryStats.peakDay.dateInfo.tableDate} (${summaryStats.peakDay.occupied_rooms} oda)`
              : 'Veri yok'
          }
          icon={Flame}
          accentClass="bg-rose-50 text-rose-600"
        />
        <KpiCard
          title="Toplam Oda / Gece"
          value={`${summaryStats.totalRoomNightsSold} / ${summaryStats.totalRoomNightsCapacity}`}
          subtext={`Satılabilir boş gece: ${Math.max(
            0,
            summaryStats.totalRoomNightsCapacity - summaryStats.totalRoomNightsSold
          )}`}
          icon={Layers}
          accentClass="bg-emerald-50 text-emerald-600"
        />
      </div>

      {/* 5.4 GRAFİK ALANI (ÇİFT EKSENLİ COMPOSED CHART) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-600" />
              Günlük Doluluk Grafiği
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Çubuklar satılan oda sayısını (Sol Eksen), koyu çizgi doluluk yüzdesini (Sağ Eksen) gösterir.
            </p>
          </div>

          {/* Renk Eşik Göstergesi (Legend) */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> %0–49
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> %50–79
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> %80–100
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-slate-800" /> Doluluk (%)
            </span>
          </div>
        </div>

        {isInitialLoading ? (
          <div className="h-[340px] flex flex-col items-center justify-center text-slate-400">
            <Loader2 size={32} className="animate-spin mb-3 text-blue-500" />
            <span className="text-sm font-medium">Forecast verileri hesaplanıyor...</span>
          </div>
        ) : isError ? (
          <div className="h-[340px] flex flex-col items-center justify-center text-center p-6">
            <AlertTriangle size={34} className="text-rose-500 mb-2" />
            <p className="text-sm font-bold text-slate-700">
              Forecast verisi yüklenirken bir hata oluştu.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {error?.response?.data?.detail || 'Sunucu bağlantısını kontrol edip tekrar deneyin.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition cursor-pointer"
            >
              Tekrar Dene
            </button>
          </div>
        ) : enrichedDays.length === 0 ? (
          <div className="h-[340px] flex flex-col items-center justify-center text-slate-400 text-center p-6">
            <CalendarRange size={36} className="mb-3 opacity-40" />
            <p className="text-sm font-semibold text-slate-600">
              Gösterilecek oda envanteri bulunamadı.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Seçili oda tipine ait aktif oda tanımlı olmayabilir.
            </p>
          </div>
        ) : (
          <div
            className={`h-[360px] w-full transition-opacity duration-200 ${
              isForecastFetching ? 'opacity-60' : 'opacity-100'
            }`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={enrichedDays}
                margin={{ top: 10, right: 12, left: -12, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="dateInfo.shortAxis"
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  minTickGap={14}
                />
                <YAxis
                  yAxisId="rooms"
                  orientation="left"
                  allowDecimals={false}
                  domain={[0, Math.max(summaryStats.totalCapacity, 1)]}
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="rate"
                  orientation="right"
                  domain={[0, maxRateDomain]}
                  tickFormatter={(val) => `%${val}`}
                  tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ForecastTooltip />} cursor={{ fill: '#f1f5f9' }} />

                {/* %80 Yüksek Doluluk Referans Çizgisi */}
                <ReferenceLine
                  yAxisId="rate"
                  y={80}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                />

                <Bar
                  yAxisId="rooms"
                  dataKey="occupied_rooms"
                  name="Dolu Oda"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={34}
                >
                  {enrichedDays.map((entry) => (
                    <Cell
                      key={entry.date}
                      fill={getOccupancyTheme(entry.occupancy_rate).barColor}
                    />
                  ))}
                </Bar>

                <Line
                  yAxisId="rate"
                  type="monotone"
                  dataKey="occupancy_rate"
                  name="Doluluk (%)"
                  stroke="#0f172a"
                  strokeWidth={2.2}
                  dot={{ r: 3, fill: '#0f172a', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 5.5 GÜNLÜK DETAY TABLOSU */}
      {enrichedDays.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Calendar size={16} className="text-slate-500" />
              Günlük Doluluk Dökümü ({enrichedDays.length} Gün)
            </h3>
            <span className="text-xs font-medium text-slate-400">
              Çıkış (Check-out) günleri doluluğa dahil edilmez
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-5">Tarih</th>
                  <th className="py-3 px-4 text-center">Toplam Kapasite</th>
                  <th className="py-3 px-4 text-center">Dolu Oda</th>
                  <th className="py-3 px-4 text-center">Boş Oda</th>
                  <th className="py-3 px-5 w-64">Doluluk Oranı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {enrichedDays.map((day) => {
                  const isSystemToday = day.date === systemDate;
                  const theme = getOccupancyTheme(day.occupancy_rate);
                  const isOverbooked = day.available_rooms < 0;

                  return (
                    <tr
                      key={day.date}
                      className={`transition-colors ${
                        isSystemToday
                          ? 'bg-blue-50/60 hover:bg-blue-50'
                          : day.dateInfo.isWeekend
                            ? 'bg-slate-50/50 hover:bg-slate-100/60'
                            : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* TARİH & GÜN */}
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-slate-800">
                            {day.dateInfo.tableDate}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              day.dateInfo.isWeekend
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {day.dateInfo.weekdayShort}
                          </span>
                          {isSystemToday && (
                            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-600 text-white">
                              Sistem Günü
                            </span>
                          )}
                        </div>
                      </td>

                      {/* TOPLAM KAPASİTE */}
                      <td className="py-3 px-4 text-center font-semibold text-slate-500">
                        {day.total_rooms}
                      </td>

                      {/* DOLU ODA */}
                      <td className="py-3 px-4 text-center font-black text-slate-800">
                        {day.occupied_rooms}
                      </td>

                      {/* BOŞ ODA / OVERBOOKING */}
                      <td className="py-3 px-4 text-center">
                        {isOverbooked ? (
                          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-md">
                            <AlertTriangle size={12} /> {day.available_rooms}
                          </span>
                        ) : (
                          <span
                            className={`font-bold ${
                              day.available_rooms === 0 ? 'text-rose-500' : 'text-emerald-600'
                            }`}
                          >
                            {day.available_rooms}
                          </span>
                        )}
                      </td>

                      {/* DOLULUK ORANI + PROGRESS BAR */}
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${theme.barBgClass}`}
                              style={{ width: `${Math.min(day.occupancy_rate, 100)}%` }}
                            />
                          </div>
                          <span
                            className={`text-xs font-extrabold px-2 py-0.5 rounded-md border min-w-[68px] text-center ${theme.badgeClass}`}
                          >
                            %{day.occupancy_rate.toFixed(1)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Forecast;