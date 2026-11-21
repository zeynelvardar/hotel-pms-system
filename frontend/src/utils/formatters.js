/**
 * Merkezi Tarih Biçimlendirme ve Yerel Tarih Hesaplama Yardımcıları (Pure Functions)
 * Tüm tarih işlemleri UTC saat dilimi kaymalarını önlemek için yerel takvim üzerinden yapılır.
 */

// Modül seviyesinde önbelleklenen Intl biçimlendiricileri (Döngü içi GC yükünü önler)
const TR_SHORT_MONTH_FMT = new Intl.DateTimeFormat('tr-TR', { month: 'short' });
const TR_SHORT_WEEKDAY_FMT = new Intl.DateTimeFormat('tr-TR', { weekday: 'short' });
const TR_FULL_DATE_FMT = new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
});

/**
 * ISO tarih stringini (YYYY-MM-DD) UTC kayması olmadan yerel Date nesnesine çevirir.
 */
export const parseLocalDate = (isoDate) => {
    if (!isoDate || typeof isoDate !== 'string') return null;

    const cleanDate = isoDate.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length !== 3) return null;

    const [year, month, day] = parts.map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

    return new Date(year, month - 1, day);
};

/**
 * Yerel Date nesnesini ISO tarih stringine (YYYY-MM-DD) çevirir.
 */
export const toISODate = (dateObj) => {
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return '';

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

/**
 * Verilen ISO tarihe (YYYY-MM-DD) belirtilen gün sayısını ekler/çıkarır ve ISO string döner.
 */
export const addDaysISO = (baseIsoDate, days) => {
    const date = parseLocalDate(baseIsoDate);
    if (!date) return '';

    date.setDate(date.getDate() + days);
    return toISODate(date);
};

/**
 * Verilen ISO tarihin bulunduğu ayın (veya monthOffset kadar kaydırılmış ayın)
 * ilk ve son gününü { start, end } ISO string formatında döner.
 */
export const getMonthBounds = (baseIsoDate, monthOffset = 0) => {
    const base = parseLocalDate(baseIsoDate);
    if (!base) return { start: '', end: '' };

    const firstDay = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
    const lastDay = new Date(base.getFullYear(), base.getMonth() + monthOffset + 1, 0);

    return {
        start: toISODate(firstDay),
        end: toISODate(lastDay),
    };
};

/**
 * Forecast grafiği ve günlük döküm tablosu için zenginleştirilmiş tarih etiketleri üretir.
 */
export const formatForecastDate = (isoDate) => {
    const date = parseLocalDate(isoDate);
    if (!date) {
        return {
            shortAxis: isoDate || '-',
            tableDate: '-',
            weekdayShort: '-',
            fullFormatted: isoDate || '-',
            isWeekend: false,
        };
    }

    const dayOfWeek = date.getDay(); // 0: Pazar, 6: Cumartesi
    const dayPadded = String(date.getDate()).padStart(2, '0');
    const monthPadded = String(date.getMonth() + 1).padStart(2, '0');

    return {
        shortAxis: `${dayPadded} ${TR_SHORT_MONTH_FMT.format(date)}`,
        tableDate: `${dayPadded}.${monthPadded}.${date.getFullYear()}`,
        weekdayShort: TR_SHORT_WEEKDAY_FMT.format(date),
        fullFormatted: TR_FULL_DATE_FMT.format(date),
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    };
};

/**
 * ISO tarih stringini (YYYY-MM-DD) kullanıcı dostu DD-MM-YYYY formatına çevirir.
 */
export const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('T')[0].split('-');
    if (!year || !month || !day) return dateStr;
    return `${day}-${month}-${year}`;
};

/**
 * Verilen ISO tarihin bir sonraki gününü (YYYY-MM-DD) döner.
 */
export const getNextDay = (dateStr) => addDaysISO(dateStr, 1);

/**
 * Kullanıcı girişini anlık olarak GG.AA.YYYY biçimine maskeler.
 */
export const maskDateInput = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);

    if (digits.length <= 2) {
        return digits;
    }
    if (digits.length <= 4) {
        return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    }
    return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
};

/**
 * Maskelenmiş GG.AA.YYYY tarihini Backend için ISO (YYYY-MM-DD) formatına çevirir.
 */
export const parseMaskedDateToISO = (maskedDate) => {
    if (!maskedDate || maskedDate.length !== 10) return null;
    const [day, month, year] = maskedDate.split('.');
    if (!day || !month || !year || year.length !== 4) return null;
    return `${year}-${month}-${day}`;
};